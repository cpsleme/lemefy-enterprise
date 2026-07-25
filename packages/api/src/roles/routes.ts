import { Router } from 'express';
import { logger, SystemCapabilities } from '@lemefy/data-schemas';
import {
  SystemRoles,
  roleDefaults,
  PermissionTypes,
  agentPermissionsSchema,
  promptPermissionsSchema,
  memoryPermissionsSchema,
  mcpServersPermissionsSchema,
  marketplacePermissionsSchema,
  peoplePickerPermissionsSchema,
  remoteAgentsPermissionsSchema,
  skillPermissionsSchema,
} from 'lemefy-data-provider';
import { hasCapability, requireCapability } from '~/server/middleware/roles/capabilities';
import { updateRoleByName, getRoleByName } from '~/models';
import { requireJwtAuth } from '~/server/middleware';

const router = Router();
router.use(requireJwtAuth);
const manageRoles = requireCapability(SystemCapabilities.MANAGE_ROLES);

const permissionConfigs = {
  prompts: {
    schema: promptPermissionsSchema,
    permissionType: PermissionTypes.PROMPTS,
    errorMessage: 'Invalid prompt permissions.',
  },
  agents: {
    schema: agentPermissionsSchema,
    permissionType: PermissionTypes.AGENTS,
    errorMessage: 'Invalid agent permissions.',
  },
  memories: {
    schema: memoryPermissionsSchema,
    permissionType: PermissionTypes.MEMORIES,
    errorMessage: 'Invalid memory permissions.',
  },
  'people-picker': {
    schema: peoplePickerPermissionsSchema,
    permissionType: PermissionTypes.PEOPLE_PICKER,
    errorMessage: 'Invalid people picker permissions.',
  },
  'mcp-servers': {
    schema: mcpServersPermissionsSchema,
    permissionType: PermissionTypes.MCP_SERVERS,
    errorMessage: 'Invalid MCP servers permissions.',
  },
  marketplace: {
    schema: marketplacePermissionsSchema,
    permissionType: PermissionTypes.MARKETPLACE,
    errorMessage: 'Invalid marketplace permissions.',
  },
  'remote-agents': {
    schema: remoteAgentsPermissionsSchema,
    permissionType: PermissionTypes.REMOTE_AGENTS,
    errorMessage: 'Invalid remote agents permissions.',
  },
  skills: {
    schema: skillPermissionsSchema,
    permissionType: PermissionTypes.SKILLS,
    errorMessage: 'Invalid skill permissions.',
  },
};

const createPermissionUpdateHandler = (permissionKey: string) => {
  const config = permissionConfigs[permissionKey as keyof typeof permissionConfigs];

  return async (req: any, res: any) => {
    const { roleName } = req.params;
    const updates = req.body;

    try {
      const parsedUpdates = config.schema.partial().parse(updates || {});

      const role = await getRoleByName(roleName);
      if (!role) {
        return res.status(404).send({ message: 'Role not found' });
      }

      const currentPermissions =
        role.permissions?.[config.permissionType] || (role as any)[config.permissionType] || {};

      const mergedUpdates = {
        permissions: {
          ...role.permissions,
          [config.permissionType]: {
            ...currentPermissions,
            ...parsedUpdates,
          },
        },
      };

      const updatedRole = await updateRoleByName(roleName, mergedUpdates);
      res.status(200).send(updatedRole);
    } catch (error: any) {
      return res.status(400).send({ message: config.errorMessage, error: error.errors });
    }
  };
};

router.get('/:roleName', async (req: any, res: any) => {
  const { roleName } = req.params;

  try {
    const isOwnRole = req.user?.role === roleName;
    const isDefaultRole = Object.hasOwn(roleDefaults, roleName);
    const requiresReadRoles = !isOwnRole && (roleName === SystemRoles.ADMIN || !isDefaultRole);
    if (requiresReadRoles) {
      let hasReadRoles = false;
      try {
        hasReadRoles = await hasCapability(
          {
            id: req.user?.id ?? req.user?._id?.toString() ?? '',
            role: req.user?.role ?? '',
            tenantId: req.user?.tenantId,
            idOnTheSource: req.user?.idOnTheSource ?? null,
          },
          SystemCapabilities.READ_ROLES,
        );
      } catch (err) {
        logger.warn(`[GET /roles/:roleName] capability check failed: ${(err as Error).message}`);
      }
      if (!hasReadRoles) {
        return res.status(403).send({ message: 'Unauthorized' });
      }
    }

    const role = await getRoleByName(roleName, '-_id -__v');
    if (!role) {
      return res.status(404).send({ message: 'Role not found' });
    }

    res.status(200).send(role);
  } catch (error) {
    logger.error('[GET /roles/:roleName] Error:', error);
    return res.status(500).send({ message: 'Failed to retrieve role' });
  }
});

router.put('/:roleName/prompts', manageRoles, createPermissionUpdateHandler('prompts'));
router.put('/:roleName/agents', manageRoles, createPermissionUpdateHandler('agents'));
router.put('/:roleName/memories', manageRoles, createPermissionUpdateHandler('memories'));
router.put('/:roleName/people-picker', manageRoles, createPermissionUpdateHandler('people-picker'));
router.put('/:roleName/mcp-servers', manageRoles, createPermissionUpdateHandler('mcp-servers'));
router.put('/:roleName/marketplace', manageRoles, createPermissionUpdateHandler('marketplace'));
router.put('/:roleName/remote-agents', manageRoles, createPermissionUpdateHandler('remote-agents'));
router.put('/:roleName/skills', manageRoles, createPermissionUpdateHandler('skills'));

export default router;
