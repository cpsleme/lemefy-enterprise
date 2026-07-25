require('dotenv').config();
const { isEnabled, instrumentMongooseQueryMetrics } = require('@lemefy/api');
const { logger } = require('@lemefy/data-schemas');

const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI;

instrumentMongooseQueryMetrics(mongoose);

if (!MONGO_URI) {
  logger.warn('[connectDb] MONGO_URI is not set. MongoDB features will be disabled.');
}

/** The maximum number of connections in the connection pool. */
const maxPoolSize = parseInt(process.env.MONGO_MAX_POOL_SIZE) || undefined;
/** The minimum number of connections in the connection pool. */
const minPoolSize = parseInt(process.env.MONGO_MIN_POOL_SIZE) || undefined;
/** The maximum number of connections that may be in the process of being established concurrently by the connection pool. */
const maxConnecting = parseInt(process.env.MONGO_MAX_CONNECTING) || undefined;
/** The maximum number of milliseconds that a connection can remain idle in the pool before being removed and closed. */
const maxIdleTimeMS = parseInt(process.env.MONGO_MAX_IDLE_TIME_MS) || undefined;
/** The maximum time in milliseconds that a thread can wait for a connection to become available. */
const waitQueueTimeoutMS = parseInt(process.env.MONGO_WAIT_QUEUE_TIMEOUT_MS) || undefined;
/** Set to false to disable automatic index creation for all models associated with this connection. */
const autoIndex =
  process.env.MONGO_AUTO_INDEX != undefined
    ? isEnabled(process.env.MONGO_AUTO_INDEX) || false
    : undefined;

/** Set to `false` to disable Mongoose automatically calling `createCollection()` on every model created on this connection. */
const autoCreate =
  process.env.MONGO_AUTO_CREATE != undefined
    ? isEnabled(process.env.MONGO_AUTO_CREATE) || false
    : undefined;
/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

mongoose.connection.on('error', (err) => {
  logger.error('[connectDb] MongoDB connection error:', err);
});

function createMockConnection() {
  const mockConnection = {
    _readyState: 1,
    db: {
      collections: () => [],
      collection: () => ({
        findOne: async () => null,
        find: async () => ({ toArray: async () => [] }),
        insertOne: async () => ({}),
        updateOne: async () => ({}),
        deleteOne: async () => ({}),
        createIndex: async () => ({}),
        dropIndex: async () => ({}),
      }),
    },
    models: {},
    connection: {
      on: () => {},
    },
    close: async () => {},
  };
  return mockConnection;
}

async function connectDb() {
  if (!MONGO_URI) {
    logger.warn('[connectDb] Skipping MongoDB connection - MONGO_URI not configured');
    if (!cached.conn) {
      cached.conn = createMockConnection();
    }
    return cached.conn;
  }

  if (cached.conn && cached.conn?._readyState === 1) {
    return cached.conn;
  }

  const disconnected = cached.conn && cached.conn?._readyState !== 1;
  if (!cached.promise || disconnected) {
    const opts = {
      bufferCommands: false,
      ...(maxPoolSize ? { maxPoolSize } : {}),
      ...(minPoolSize ? { minPoolSize } : {}),
      ...(maxConnecting ? { maxConnecting } : {}),
      ...(maxIdleTimeMS ? { maxIdleTimeMS } : {}),
      ...(waitQueueTimeoutMS ? { waitQueueTimeoutMS } : {}),
      ...(autoIndex != undefined ? { autoIndex } : {}),
      ...(autoCreate != undefined ? { autoCreate } : {}),
    };
    logger.info('Mongo Connection options');
    logger.info(JSON.stringify(opts, null, 2));
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(MONGO_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;

  return cached.conn;
}

module.exports = {
  connectDb,
};
