import { Router } from 'express';
import { logger, getTenantId, tenantStorage } from '@lemefy/data-schemas';
import {
  CacheKeys,
  Constants,
  PermissionBits,
  PermissionTypes,
  Permissions,
} from 'lemefy-data-provider';
import {
  getBasePath,
  createSafeUser,
  MCPOAuthHandler,
  MCPTokenStorage,
  setOAuthSession,
  PENDING_STALE_MS,
  mcpConfig: mcpSettings,
  getUserMCPAuthMap,
  validateOAuthCsrf,
  OAUTH_CSRF_COOKIE,
  setOAuthCsrfCookie,
  generateCheckAccess,
  validateOAuthSession,
  OAUTH_SESSION_COOKIE,
} from '@lemefy/api';
import {
  createMCPServerController,
  updateMCPServerController,
  deleteMCPServerController,
  getMCPServersList,
  getMCPServerById,
  getMCPTools,
} from '~/server/controllers/mcp';
import {
  getOAuthReconnectionManager,
  getMCPServersRegistry,
  getFlowStateManager,
  getMCPManager,
} from '~/config';
import {
  getServerConnectionStatus,
  resolveAllMcpConfigs,
  resolveConfigServers,
  getMCPSetupData,
} from '~/server/services/MCP';
import { requireJwtAuth, canAccessMCPServerResource } from '~/server/middleware';
import { getUserPluginAuthValue } from '~/server/services/PluginService';
import { updateMCPServerTools } from '~/server/services/Config/mcp';
import { reinitMCPServer } from '~/server/services/Tools/mcp';
import { getLogStores } from '~/cache';
import pgChat from '@lemefy/data-schemas';
import { getRoleByName } from '@lemefy/data-schemas';

const router = Router();

const OAUTH_CSRF_COOKIE_PATH = '/api/mcp';

const getOAuthFlowId = (userId: string, serverName: string) =>
  MCPOAuthHandler.generateFlowId(userId, serverName, getTenantId());

const canAccessOAuthFlow = (flowId: string, userId: string) => {
  const parsed = MCPOAuthHandler.parseFlowId(flowId);
  if (!parsed) {
    return false;
  }
  if (parsed.tenantId && parsed.tenantId !== getTenantId()) {
    return false;
  }
  return parsed.userId === userId || parsed.userId === 'system';
};

const clearGetTokensFlow = async (flowId: string) => {
  const flowManager = getFlowStateManager(getLogStores(CacheKeys.FLOWS));
  const state = await flowManager.getFlowState(flowId, 'mcp_get_tokens');
  if (state?.type === 'mcp_get_tokens' && state.status === 'PENDING') {
    await flowManager.completeFlow(flowId, 'mcp_get_tokens', {} as any);
    return;
  }
  await flowManager.deleteFlow(flowId, 'mcp_get_tokens');
};

const checkMCPUsePermissions = generateCheckAccess({
  permissionType: PermissionTypes.MCP_SERVERS,
  permissions: [Permissions.USE],
  getRoleByName,
});

const checkMCPCreate = generateCheckAccess({
  permissionType: PermissionTypes.MCP_SERVERS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName,
});

router.get('/tools', requireJwtAuth, checkMCPUsePermissions, async (req: any, res: any) => {
  return getMCPTools(req, res);
});

router.get('/:serverName/oauth/initiate', requireJwtAuth, setOAuthSession, async (req: any, res: any) => {
  try {
    const { serverName } = req.params;
    const { userId, flowId } = req.query;
    const user = req.user;

    if (typeof userId !== 'string' || userId !== user.id) {
      return res.status(403).json({ error: 'User mismatch' });
    }

    const expectedFlowId = getOAuthFlowId(user.id, serverName);
    if (typeof flowId !== 'string' || flowId !== expectedFlowId) {
      logger.error('[MCP OAuth] Invalid flow ID for initiate request', {
        serverName,
        userId,
        flowId,
        expectedFlowId,
      });
      return res.status(403).json({ error: 'Flow mismatch' });
    }

    logger.debug('[MCP OAuth] Initiate request', { serverName, userId, flowId });

    const flowsCache = getLogStores(CacheKeys.FLOWS);
    const flowManager = getFlowStateManager(flowsCache);
    const flowState = await flowManager.getFlowState(flowId, 'mcp_oauth');

    if (!flowState) {
      logger.error('[MCP OAuth] Flow state not found', { flowId });
      return res.status(404).json({ error: 'Flow not found' });
    }

    const {
      authorizationUrl: storedAuthorizationUrl,
      serverName: flowServerName,
      userId: flowUserId,
      serverUrl,
      oauth: oauthConfig,
    } = flowState.metadata || {};

    if (flowUserId && flowUserId !== user.id) {
      logger.error('[MCP OAuth] Flow user mismatch', { flowId, userId, flowUserId });
      return res.status(403).json({ error: 'User mismatch' });
    }

    if (flowServerName && flowServerName !== serverName) {
      logger.error('[MCP OAuth] Flow server mismatch', { flowId, serverName, flowServerName });
      return res.status(400).json({ error: 'Invalid flow state' });
    }

    const pendingAge = flowState.createdAt ? Date.now() - flowState.createdAt : Infinity;
    const isFreshPendingFlow = flowState.status === 'PENDING' && pendingAge < PENDING_STALE_MS;
    if (!isFreshPendingFlow) {
      logger.error('[MCP OAuth] Flow is not active for initiation', {
        flowId,
        status: flowState.status,
        pendingAge,
      });
      return res.status(400).json({ error: 'Invalid flow state' });
    }

    if (typeof storedAuthorizationUrl === 'string' && storedAuthorizationUrl.length > 0) {
      logger.debug('[MCP OAuth] Reusing stored authorization URL', {
        serverName,
        userId,
        flowId,
      });
      setOAuthCsrfCookie(res, flowId, OAUTH_CSRF_COOKIE_PATH);
      return res.redirect(storedAuthorizationUrl);
    }

    if (!serverUrl || !oauthConfig) {
      logger.error('[MCP OAuth] Missing server URL or OAuth config in flow state');
      return res.status(400).json({ error: 'Invalid flow state' });
    }

    const configServers = await resolveConfigServers(req);
    const registry = getMCPServersRegistry();
    const { allowedDomains, allowedAddresses } = await registry.resolveAllowlists({
      userId,
      role: req.user?.role,
    });

    const {
      authorizationUrl,
      flowId: oauthFlowId,
      flowMetadata,
    } = await MCPOAuthHandler.initiateOAuthFlow(
      serverName,
      serverUrl,
      userId,
      {} as any,
      oauthConfig,
      allowedDomains,
      undefined,
      allowedAddresses,
      getTenantId(),
    );

    logger.debug('[MCP OAuth] OAuth flow initiated', { oauthFlowId, authorizationUrl });

    const oldState = (flowState.metadata as any)?.state;
    if (typeof oldState === 'string') {
      await MCPOAuthHandler.deleteStateMapping(oldState, flowManager);
    }
    const metadataWithUrl = { ...flowMetadata, authorizationUrl, tenantId: getTenantId() };
    await flowManager.initFlow(oauthFlowId, 'mcp_oauth', metadataWithUrl);
    await MCPOAuthHandler.storeStateMapping(flowMetadata.state, oauthFlowId, flowManager);
    setOAuthCsrfCookie(res, oauthFlowId, OAUTH_CSRF_COOKIE_PATH);
    res.redirect(authorizationUrl);
  } catch (error) {
    logger.error('[MCP OAuth] Failed to initiate OAuth', error);
    res.status(500).json({ error: 'Failed to initiate OAuth' });
  }
});

export default router;
