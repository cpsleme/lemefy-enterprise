import { Router } from 'express';
import {
  isEnabled,
  getBalanceConfig,
  getCloudFrontConfig,
  getAppConfigOptionsFromUser,
  resolveBuildInfo,
  resolveTitleTiming,
  sanitizeModelSpecs,
  excludeHiddenModelSpecs,
  isFileSnapshotEnabled,
} from '@lemefy/api';
import { EModelEndpoint, defaultSocialLogins } from 'lemefy-data-provider';
import { logger, getTenantId, SystemCapabilities } from '@lemefy/data-schemas';
import { hasCapability } from '~/server/middleware/roles/capabilities';
import { getLdapConfig } from '~/server/services/Config/ldap';
import { getRumConfig } from '~/server/services/Config/rum';
import { getAppConfig } from '~/server/services/Config/app';

const router = Router();

const emailLoginEnabled =
  process.env.ALLOW_EMAIL_LOGIN === undefined || isEnabled(process.env.ALLOW_EMAIL_LOGIN);
const passwordResetEnabled = isEnabled(process.env.ALLOW_PASSWORD_RESET);

const sharedLinksEnabled =
  process.env.ALLOW_SHARED_LINKS === undefined || isEnabled(process.env.ALLOW_SHARED_LINKS);

const publicSharedLinksEnabled =
  sharedLinksEnabled && isEnabled(process.env.ALLOW_SHARED_LINKS_PUBLIC);

const sharePointFilePickerEnabled = isEnabled(process.env.ENABLE_SHAREPOINT_FILEPICKER);
const openidReuseTokens = isEnabled(process.env.OPENID_REUSE_TOKENS);

resolveBuildInfo();

function isBirthday() {
  const today = new Date();
  return today.getMonth() === 1 && today.getDate() === 11;
}

function buildPreLoginPayload() {
  const isOpenIdEnabled =
    !!process.env.OPENID_CLIENT_ID &&
    (isEnabled(process.env.OPENID_USE_PKCE) || !!process.env.OPENID_CLIENT_SECRET?.trim()) &&
    !!process.env.OPENID_ISSUER &&
    !!process.env.OPENID_SESSION_SECRET;

  const isSamlEnabled =
    !!process.env.SAML_ENTRY_POINT &&
    !!process.env.SAML_ISSUER &&
    !!process.env.SAML_CERT &&
    !!process.env.SAML_SESSION_SECRET;

  const ldap = getLdapConfig();

  const payload: any = {
    appTitle: process.env.APP_TITLE || 'Lemefy',
    discordLoginEnabled: !!process.env.DISCORD_CLIENT_ID && !!process.env.DISCORD_CLIENT_SECRET,
    facebookLoginEnabled: !!process.env.FACEBOOK_CLIENT_ID && !!process.env.FACEBOOK_CLIENT_SECRET,
    githubLoginEnabled: !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET,
    googleLoginEnabled: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    appleLoginEnabled:
      !!process.env.APPLE_CLIENT_ID &&
      !!process.env.APPLE_TEAM_ID &&
      !!process.env.APPLE_KEY_ID &&
      !!process.env.APPLE_PRIVATE_KEY_PATH,
    openidLoginEnabled: isOpenIdEnabled,
    openidLabel: process.env.OPENID_BUTTON_LABEL || 'Continue with OpenID',
    openidImageUrl: process.env.OPENID_IMAGE_URL,
    openidAutoRedirect: isEnabled(process.env.OPENID_AUTO_REDIRECT),
    samlLoginEnabled: !isOpenIdEnabled && isSamlEnabled,
    samlLabel: process.env.SAML_BUTTON_LABEL,
    samlImageUrl: process.env.SAML_IMAGE_URL,
    serverDomain: process.env.DOMAIN_SERVER || 'http://localhost:3080',
    emailLoginEnabled,
    registrationEnabled: !ldap?.enabled && isEnabled(process.env.ALLOW_REGISTRATION),
    socialLoginEnabled: isEnabled(process.env.ALLOW_SOCIAL_LOGIN),
    emailEnabled:
      (!!process.env.EMAIL_SERVICE || !!process.env.EMAIL_HOST) &&
      !!process.env.EMAIL_USERNAME &&
      !!process.env.EMAIL_PASSWORD &&
      !!process.env.EMAIL_FROM,
    passwordResetEnabled,
  };

  const minPasswordLength = parseInt(process.env.MIN_PASSWORD_LENGTH, 10);
  if (minPasswordLength && !isNaN(minPasswordLength)) {
    payload.minPasswordLength = minPasswordLength;
  }

  if (ldap) {
    payload.ldap = ldap;
  }

  return payload;
}

function buildPublicSharePayload() {
  const payload: any = {
    analyticsGtmId: process.env.ANALYTICS_GTM_ID,
  };

  if (typeof process.env.CUSTOM_FOOTER === 'string') {
    payload.customFooter = process.env.CUSTOM_FOOTER;
  }

  return payload;
}

function buildPostLoginPayload() {
  const payload: any = {
    showBirthdayIcon:
      isBirthday() ||
      isEnabled(process.env.SHOW_BIRTHDAY_ICON) ||
      process.env.SHOW_BIRTHDAY_ICON === '',
    helpAndFaqURL: process.env.HELP_AND_FAQ_URL || 'https://lemefy.ai',
    sharedLinksEnabled,
    publicSharedLinksEnabled,
    openidReuseTokens,
    allowAccountDeletion:
      process.env.ALLOW_ACCOUNT_DELETION === undefined ||
      isEnabled(process.env.ALLOW_ACCOUNT_DELETION),
  };

  return payload;
}

function buildBuildInfoPayload(interfaceConfig?: any) {
  if (interfaceConfig?.buildInfo === false) {
    return undefined;
  }
  const info = resolveBuildInfo();
  if (!info.commit && !info.branch && !info.buildDate) {
    return undefined;
  }
  return {
    commit: info.commit,
    commitShort: info.commitShort,
    branch: info.branch,
    buildDate: info.buildDate,
  };
}

function buildWebSearchConfig(appConfig?: any) {
  const ws = appConfig?.webSearch;
  if (!ws) {
    return undefined;
  }
  const { searchProvider, scraperProvider, rerankerType } = ws;
  if (!searchProvider && !scraperProvider && !rerankerType) {
    return undefined;
  }
  return {
    ...(searchProvider && { searchProvider }),
    ...(scraperProvider && { scraperProvider }),
    ...(rerankerType && { rerankerType }),
  };
}

function buildCloudFrontStartupConfig() {
  const config = getCloudFrontConfig();
  if (
    config?.imageSigning !== 'cookies' ||
    !config.domain ||
    !config.cookieDomain ||
    !config.privateKey ||
    !config.keyPairId
  ) {
    return undefined;
  }

  return {
    cookieRefresh: {
      endpoint: '/api/auth/cloudfront/refresh',
      domain: config.domain,
    },
  };
}

router.get('/', async function (req: any, res: any) {
  try {
    const preLoginPayload = buildPreLoginPayload();
    const publicSharePayload = buildPublicSharePayload();
    const rum = getRumConfig();

    if (!req.user) {
      const tenantId = getTenantId();
      const baseConfig = await getAppConfig(tenantId ? { tenantId } : { baseOnly: true });

      const payload: any = {
        ...preLoginPayload,
        socialLogins: baseConfig?.registration?.socialLogins ?? defaultSocialLogins,
        turnstile: baseConfig?.turnstileConfig,
        ...(rum ? { rum } : {}),
      };

      const interfaceConfig = baseConfig?.interfaceConfig;
      const buildInfoDisabled = interfaceConfig?.buildInfo === false;
      if (interfaceConfig?.privacyPolicy || interfaceConfig?.termsOfService || buildInfoDisabled) {
        payload.interface = {};
        if (interfaceConfig.privacyPolicy) {
          payload.interface.privacyPolicy = interfaceConfig.privacyPolicy;
        }
        if (interfaceConfig.termsOfService) {
          payload.interface.termsOfService = interfaceConfig.termsOfService;
        }
        if (buildInfoDisabled) {
          payload.interface.buildInfo = false;
        }
      }

      const unauthBuildInfo = buildBuildInfoPayload(interfaceConfig);
      if (unauthBuildInfo) {
        payload.buildInfo = unauthBuildInfo;
      }

      return res.status(200).send(payload);
    }

    const appConfig = await getAppConfig(getAppConfigOptionsFromUser(req.user));

    const balanceConfig = getBalanceConfig(appConfig);
    const cloudFront = buildCloudFrontStartupConfig();

    const payload: any = {
      ...preLoginPayload,
      ...publicSharePayload,
      ...buildPostLoginPayload(),
      sharedLinksSnapshotFilesEnabled: sharedLinksEnabled && isFileSnapshotEnabled(appConfig),
      socialLogins: appConfig?.registration?.socialLogins ?? defaultSocialLogins,
      interface: appConfig?.interfaceConfig,
      titleGenerationTiming: resolveTitleTiming({
        appConfig,
        endpoint: EModelEndpoint.agents,
      }),
      turnstile: appConfig?.turnstileConfig,
      modelSpecs: sanitizeModelSpecs(excludeHiddenModelSpecs(appConfig?.modelSpecs)),
      balance: balanceConfig,
      bundlerURL: process.env.SANDPACK_BUNDLER_URL,
      staticBundlerURL: process.env.SANDPACK_STATIC_BUNDLER_URL,
      sharePointFilePickerEnabled,
      sharePointBaseUrl: process.env.SHAREPOINT_BASE_URL,
      sharePointPickerGraphScope: process.env.SHAREPOINT_PICKER_GRAPH_SCOPE,
      sharePointPickerSharePointScope: process.env.SHAREPOINT_PICKER_SHAREPOINT_SCOPE,
      conversationImportMaxFileSize: process.env.CONVERSATION_IMPORT_MAX_FILE_SIZE_BYTES
        ? parseInt(process.env.CONVERSATION_IMPORT_MAX_FILE_SIZE_BYTES, 10)
        : 0,
      ...(cloudFront ? { cloudFront } : {}),
      ...(rum ? { rum } : {}),
      fileUploadSseEnabled: isEnabled(process.env.FILE_UPLOAD_SSE_ENABLED),
    };

    const webSearch = buildWebSearchConfig(appConfig);
    if (webSearch) {
      payload.webSearch = webSearch;
    }

    const buildInfo = buildBuildInfoPayload(appConfig?.interfaceConfig);
    if (buildInfo) {
      payload.buildInfo = buildInfo;
    }

    if (!payload.allowAccountDeletion) {
      try {
        const userId = req.user.id ?? req.user._id?.toString();
        if (userId) {
          const canDelete = await hasCapability(
            { id: userId, role: req.user.role ?? '', tenantId: req.user.tenantId },
            SystemCapabilities.ACCESS_ADMIN,
          );
          if (canDelete) {
            payload.allowAccountDeletion = true;
          }
        }
      } catch (err) {
        logger.warn(`[config] ACCESS_ADMIN capability check failed: ${(err as Error).message}`);
      }
    }

    return res.status(200).send(payload);
  } catch (err) {
    logger.error('Error in startup config', err);
    return res.status(500).send({ error: (err as Error).message });
  }
});

export default router;
