import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as chatSchema from './schema';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || 'lemefy',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const chatDb: ReturnType<typeof drizzle<typeof chatSchema>> = drizzle(pool, {
  schema: {
    ...chatSchema,
  },
});

export default chatDb;