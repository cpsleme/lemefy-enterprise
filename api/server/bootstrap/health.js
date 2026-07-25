module.exports = function registerHealthRoutes(app) {
  app.get('/health', (_req, res) => res.status(200).send('OK'));
  app.get('/livez', (_req, res) => res.status(200).send('OK'));
  app.get('/readyz', (_req, res) => {
    if (!app.locals?.serverReady) {
      return res.status(503).send('NOT_READY');
    }
    return res.status(200).send('OK');
  });

  app.get('/health/mongo', async (_req, res) => {
    try {
      const dataSchemas = require('@lemefy/data-schemas');
      const client = dataSchemas?.client;
      if (client?.db?.admin) {
        await client.db.admin().ping();
        return res.status(200).send('OK');
      }
      res.status(503).send('Mongo client unavailable');
    } catch (error) {
      res.status(503).send('Mongo not ready');
    }
  });

  app.get('/health/meilisearch', async (_req, res) => {
    try {
      const axios = require('axios');
      const host = process.env.MEILI_HOST || 'http://localhost:7700';
      const masterKey = process.env.MEILI_MASTER_KEY;
      const response = await axios.get(`${host}/health`, {
        headers: masterKey ? {Authorization: `Bearer ${masterKey}`} : undefined,
        timeout: 2000,
      });
      res.status(response.status === 200 ? 200 : 503).send(response.data);
    } catch (error) {
      res.status(503).send('Meilisearch not ready');
    }
  });

  app.get('/health/redis', async (_req, res) => {
    try {
      const Redis = require('ioredis');
      const redisUri = process.env.REDIS_URI;
      if (!redisUri) {
        return res.status(200).send('Redis not configured');
      }
      const redis = new Redis(redisUri, { keepAlive: 1, maxRetriesPerRequest: 1 });
      await redis.ping();
      await redis.quit();
      res.status(200).send('OK');
    } catch (error) {
      res.status(503).send('Redis not ready');
    }
  });

  app.get('/health/postgres', async (_req, res) => {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.POSTGRES_HOST,
        port: Number(process.env.POSTGRES_PORT || 5432),
        database: process.env.POSTGRES_DB,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        max: 1,
        connectionTimeoutMillis: 2000,
      });
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      res.status(200).send('OK');
    } catch (error) {
      res.status(503).send('Postgres not ready');
    }
  });
};
