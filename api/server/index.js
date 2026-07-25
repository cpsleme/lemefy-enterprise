const telemetry = require('./telemetry');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const passport = require('passport');
const { parse: parseEnv } = require('./config/env.validate');
require('module-alias')({ base: path.resolve(__dirname, '..') });
parseEnv();
const axios = require('axios');
const express = require('express');
const { logger, runAsSystem, tenantStorage } = require('@lemefy/data-schemas');
const {
  isEnabled,
  apiNotFound,
  createMetrics,
  ErrorController,
  memoryDiagnostics,
  performStartupChecks,
  handleJsonParseError,
  GenerationJobManager,
  createStreamServices,
  deleteAgentCheckpoint,
  initializeFileStorage,
  initializeDeploymentSkills,
  loadToolApprovalHooks,
  QUERY_DEVTOOLS_HEADER,
  maybeInjectQueryDevtoolsBootstrap,
  preAuthTenantMiddleware,
  setupGracefulShutdown,
  updateInterfacePermissions,
} = require('~/adapters/app');
const { connectDb, indexSync } = require('~/db');
const {
  updateAccessPermissions,
  sweepOrphanedPreviews,
  getRoleByName,
  seedDatabase,
} = require('~/models');
const initializeOAuthReconnectManager = require('./services/initializeOAuthReconnectManager');
const { capabilityContextMiddleware } = require('./middleware/roles/capabilities');
const createValidateImageRequest = require('./middleware/validateImageRequest');
const { startExpiredFileSweep } = require('./services/Files/process');
const { initializeGitHubSkillSync } = require('./services/Skills/sync');
const { jwtLogin, ldapLogin, passportLogin } = require('~/strategies');
const { checkMigrations } = require('./services/start/migration');
const optionalJwtAuth = require('./middleware/optionalJwtAuth');
const initializeMCPs = require('./services/initializeMCPs');
const configureSocialLogins = require('./socialLogins');
const createSpaFallback = require('./utils/fallback');
const { getAppConfig } = require('./services/Config');
const staticCache = require('./utils/staticCache');
const noIndex = require('./middleware/noIndex');
const routes = require('./routes');
const registerHealthRoutes = require('./bootstrap/health');
const registerMiddleware = require('./bootstrap/middleware');
const registerRoutes = require('./bootstrap/routes');

// Allow PORT=0 to be used for automatic free port assignment
const port = isNaN(Number(PORT)) ? 3080 : Number(PORT);
const host = HOST || 'localhost';
const trusted_proxy = Number(TRUST_PROXY) || 1; /* trust first proxy by default */

const app = express();
let serverReady = false;

const { PORT, HOST, ALLOW_SOCIAL_LOGIN, DISABLE_COMPRESSION, TRUST_PROXY } = process.env ?? {};

const SERVER_NOT_READY_CODE = 'SERVER_NOT_READY';
const CHAT_START_RETRY_AFTER_SECONDS = '1';

const rejectChatStartsUntilReady = (req, res, next) => {
  if (serverReady || req.method !== 'POST' || req.path === '/abort') {
    return next();
  }

  res.set('Retry-After', CHAT_START_RETRY_AFTER_SECONDS);
  return res.status(503).json({
    code: SERVER_NOT_READY_CODE,
    error: 'Server is still starting. Please retry shortly.',
  });
};

const configureGenerationStreams = () => {
  const streamServices = createStreamServices();
  GenerationJobManager.configure({
    ...streamServices,
    cleanupOnComplete: !isEnabled(process.env.STREAM_KEEP_COMPLETED_JOBS),
  });
  GenerationJobManager.initialize();
  // Prune the paused run's durable checkpoint when its approval EXPIRES (periodic sweeper
  // or a stale submit) instead of leaving it until the Mongo TTL. streamId === conversationId
  // === the LangGraph thread_id. Config is resolved lazily per expiry so the prune always
  // targets the currently configured checkpoint collections.
  GenerationJobManager.setApprovalExpiredHandler(async (conversationId, job) => {
    // Resolve config in the PAUSED JOB's tenant/user scope — the expiry runs outside any
    // request context. Passing ids to getAppConfig only keys the cache; the Config query
    // itself is ALS-scoped by the tenant-isolation plugin, so ENTER the tenant context.
    await tenantStorage.run({ tenantId: job?.tenantId, userId: job?.userId }, async () => {
      const appConfig = await getAppConfig({ userId: job?.userId, tenantId: job?.tenantId });
      await deleteAgentCheckpoint(conversationId, appConfig?.endpoints?.agents?.checkpointer);
    });
  });
};

const startServer = async () => {
  const { metricsMiddleware, metricsRouter } = createMetrics();
  if (!process.env.METRICS_SECRET) {
    logger.warn('[metrics] METRICS_SECRET is not set - /metrics will return 401 for all requests');
  }

  if (typeof Bun !== 'undefined') {
    axios.defaults.headers.common['Accept-Encoding'] = 'gzip';
  }
  await connectDb();

  logger.info('Connected to MongoDB');
  indexSync().catch((err) => {
    logger.error('[indexSync] Background sync failed:', err);
  });

  app.disable('x-powered-by');
  app.set('trust proxy', trusted_proxy);

  if (isEnabled(process.env.TENANT_ISOLATION_STRICT)) {
    logger.warn(
      '[Security] TENANT_ISOLATION_STRICT is active. Ensure your reverse proxy strips or sets ' +
        'the X-Tenant-Id header — untrusted clients must not be able to set it directly.',
    );
  }

  await runAsSystem(seedDatabase);
  /* Recover stuck `status: 'pending'` records from a crash mid-render.
   * `runAsSystem` is required — `File` is tenant-isolated and strict
   * mode rejects unscoped queries. Lazy sweep in the preview endpoint
   * covers anything younger than the boot cutoff. */
  runAsSystem(sweepOrphanedPreviews).catch((err) => {
    logger.error('[sweepOrphanedPreviews] Background sweep failed:', err);
  });
  const appConfig = await getAppConfig({ baseOnly: true });
  initializeFileStorage(appConfig);
  await initializeDeploymentSkills({ projectRoot: path.resolve(__dirname, '../..') });
  initializeGitHubSkillSync(appConfig);
  startExpiredFileSweep({ appConfig, loadAppConfig: getAppConfig });
  // Register any programmatic tool-approval policy hooks declared in
  // `endpoints.agents.toolApproval.hooks`. Honor the `enabled` kill switch: when tool
  // approval is off we pass no hooks, so a disabled endpoint imports/runs nothing (and any
  // previously loaded batch is unregistered). Hooks are read from the BASE config only —
  // they register once, process-wide; per-user/tenant differences belong inside the hook
  // (via its context), not in per-override module lists.
  const toolApproval = appConfig?.endpoints?.agents?.toolApproval;
  await loadToolApprovalHooks(toolApproval?.enabled ? toolApproval.hooks : undefined, {
    basePath: path.resolve(__dirname, '../..'),
  });
  await runAsSystem(async () => {
    await performStartupChecks(appConfig);
    await updateInterfacePermissions({ appConfig, getRoleByName, updateAccessPermissions });
  });

  const indexPath = path.join(appConfig.paths.dist, 'index.html');
  let indexHTML = fs.readFileSync(indexPath, 'utf8');

  // In order to provide support to serving the application in a sub-directory
  // We need to update the base href if the DOMAIN_CLIENT is specified and not the root path
  if (process.env.DOMAIN_CLIENT) {
    const clientUrl = new URL(process.env.DOMAIN_CLIENT);
    const baseHref = clientUrl.pathname.endsWith('/')
      ? clientUrl.pathname
      : `${clientUrl.pathname}/`;
    if (baseHref !== '/') {
      logger.info(`Setting base href to ${baseHref}`);
      indexHTML = indexHTML.replace(/base href="\/"/, `base href="${baseHref}"`);
    }
  }

  const sendIndexHtml = (req, res) => {
    res.set({
      'Cache-Control': process.env.INDEX_CACHE_CONTROL || 'no-cache, no-store, must-revalidate',
      Pragma: process.env.INDEX_PRAGMA || 'no-cache',
      Expires: process.env.INDEX_EXPIRES || '0',
    });
    res.vary(QUERY_DEVTOOLS_HEADER);

    const lang = req.cookies.lang || req.headers['accept-language']?.split(',')[0] || 'en-US';
    const saneLang = lang.replace(/"/g, '&quot;');
    let updatedIndexHtml = indexHTML.replace(/lang="en-US"/g, `lang="${saneLang}"`);
    updatedIndexHtml = maybeInjectQueryDevtoolsBootstrap(updatedIndexHtml, req);

    res.type('html');
    res.send(updatedIndexHtml);
  };

  registerHealthRoutes(app);

  await registerMiddleware(app, {
    metricsMiddleware,
    noIndex,
    express,
    handleJsonParseError,
    mongoSanitize,
    cors,
    cookieParser,
    compression,
    isEnabled,
    DISABLE_COMPRESSION,
    staticCache,
    telemetry,
    passport,
    jwtLogin,
    passportLogin,
    ldapLogin,
    ALLOW_SOCIAL_LOGIN,
    configureSocialLogins,
    capabilityContextMiddleware,
    preAuthTenantMiddleware,
    optionalJwtAuth,
    createValidateImageRequest,
    QUERY_DEVTOOLS_HEADER,
    maybeInjectQueryDevtoolsBootstrap,
    indexHTML,
    appConfig,
  });

  await registerRoutes(app, routes, {
    preAuthTenantMiddleware,
    optionalJwtAuth,
    createValidateImageRequest,
    rejectChatStartsUntilReady,
    appConfig,
  });

  app.use('/metrics', metricsRouter);

  app.use('/api', apiNotFound);

  app.use(createSpaFallback(sendIndexHtml));

  if (telemetry.enabled) {
    app.use(telemetry.telemetryErrorMiddleware);
  }

  app.use(ErrorController);

  configureGenerationStreams();

  const server = app.listen(port, host, async (err) => {
    if (err) {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }

    if (host === '0.0.0.0') {
      logger.info(
        `Server listening on all interfaces at port ${port}. Use http://localhost:${port} to access it`,
      );
    } else {
      logger.info(`Server listening at http://${host == '0.0.0.0' ? 'localhost' : host}:${port}`);
    }

    /**
     * The listen callback is async, so any rejection from these awaits would
     * otherwise be detached from `startServer().catch(...)` (which only
     * catches errors that happen before `app.listen`). Without explicit
     * handling, the global `unhandledRejection` handler would swallow init
     * failures and leave the server listening but only partially
     * initialized — passing liveness checks while serving broken requests.
     */
    try {
      await runAsSystem(async () => {
        await initializeMCPs();
        await initializeOAuthReconnectManager();
      });
      await checkMigrations();

      const inspectFlags = process.execArgv.some((arg) => arg.startsWith('--inspect'));
      if (inspectFlags || isEnabled(process.env.MEM_DIAG)) {
        memoryDiagnostics.start();
      }
      serverReady = true;
      app.locals.serverReady = serverReady;
      logger.info('Server readiness checks passing.');
    } catch (initErr) {
      serverReady = false;
      logger.error('Post-listen initialization failed:', initErr);
      process.exit(1);
    }
  });

  setupGracefulShutdown(server);
};

/**
 * Boot rejections (e.g. `connectDb`, `getAppConfig`, `performStartupChecks`)
 * must remain fail-fast: a half-initialized process with no listening HTTP
 * server should die immediately so the orchestrator restarts it, instead of
 * being kept alive by the `unhandledRejection` handler below until the
 * liveness probe eventually times out. Mirrors the pattern in
 * `experimental.js`.
 */
startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

let messageCount = 0;
process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    logger.error('There was an uncaught error:', err);
  }

  if (err.message && err.message?.toLowerCase()?.includes('abort')) {
    logger.warn('There was an uncatchable abort error.');
    return;
  }

  if (err.message.includes('GoogleGenerativeAI')) {
    logger.warn(
      '\n\n`GoogleGenerativeAI` errors cannot be caught due to an upstream issue, see: https://github.com/google-gemini/generative-ai-js/issues/303',
    );
    return;
  }

  if (err.message.includes('fetch failed')) {
    if (messageCount === 0) {
      logger.warn('Meilisearch error, search will be disabled');
      messageCount++;
    }

    return;
  }

  if (err.message.includes('OpenAIError') || err.message.includes('ChatCompletionMessage')) {
    logger.error(
      '\n\nAn Uncaught `OpenAIError` error may be due to your reverse-proxy setup or stream configuration, or a bug in the `openai` node package.',
    );
    return;
  }

  if (err.stack && err.stack.includes('@librechat/agents')) {
    logger.error(
      '\n\nAn error occurred in the agents system. The error has been logged and the app will continue running.',
      {
        message: err.message,
        stack: err.stack,
      },
    );
    return;
  }

  if (isEnabled(process.env.CONTINUE_ON_UNCAUGHT_EXCEPTION)) {
    logger.error('Unhandled error encountered. The app will continue running.', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });
    return;
  }

  process.exit(1);
});

/**
 * Unhandled promise rejection handler.
 *
 * Node 15+ terminates the process by default when a promise rejection is
 * unhandled. MCP OAuth reconnect storms and streamable-HTTP transport resets
 * can produce transient fire-and-forget rejections (ECONNRESET, token refresh
 * races) that are recoverable — the server should log and keep serving other
 * requests rather than silently crash under load.
 *
 * Non-Error reasons are forwarded as-is so structured payloads (e.g.
 * `{ code: "ECONNRESET", errno: -104 }`) survive instead of being collapsed to
 * "[object Object]" by `String()`.
 */
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error) {
    logger.error('Unhandled promise rejection. The app will continue running.', {
      name: reason.name,
      message: reason.message,
      stack: reason.stack,
      cause: reason.cause,
    });
    return;
  }
  logger.error('Unhandled promise rejection. The app will continue running.', { reason });
});

/** Export app for easier testing purposes */
module.exports = app;
