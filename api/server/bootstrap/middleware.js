module.exports = async function registerMiddleware(app, deps) {
  const express = require('express');
  const {
    metricsMiddleware,
    noIndex,
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
  } = deps;

  app.use(metricsMiddleware);
  app.use(noIndex);
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ extended: true, limit: '3mb' }));
  app.use(handleJsonParseError);

  app.use((req, _res, next) => {
    Object.defineProperty(req, 'query', {
      ...Object.getOwnPropertyDescriptor(req, 'query'),
      value: req.query,
      writable: true,
    });
    next();
  });

  app.use(mongoSanitize());
  app.use(cors());
  app.use(cookieParser());

  if (!isEnabled(DISABLE_COMPRESSION)) {
    app.use(compression());
  } else {
    console.warn('Response compression has been disabled via DISABLE_COMPRESSION.');
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

  app.get('/index.html', sendIndexHtml);
  app.use(staticCache(deps.appConfig.paths.dist));
  app.use(staticCache(deps.appConfig.paths.fonts));
  app.use(staticCache(deps.appConfig.paths.assets));

  if (telemetry.enabled) {
    app.use(telemetry.telemetryMiddleware);
  }

  if (!ALLOW_SOCIAL_LOGIN) {
    console.warn('Social logins are disabled. Set ALLOW_SOCIAL_LOGIN=true to enable them.');
  }

  app.use(passport.initialize());
  passport.use(jwtLogin());
  passport.use(passportLogin());

  if (process.env.LDAP_URL && process.env.LDAP_USER_SEARCH_BASE) {
    passport.use(ldapLogin);
  }

  if (isEnabled(ALLOW_SOCIAL_LOGIN)) {
    await configureSocialLogins(app);
  }

  app.use(capabilityContextMiddleware);

  return { sendIndexHtml };
};
