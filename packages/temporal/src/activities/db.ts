import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getDbEngine(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'postgres',
      port: Number(process.env.POSTGRES_PORT || 5432),
      database: process.env.POSTGRES_DB || 'rag_api',
      user: process.env.POSTGRES_USER || 'myuser',
      password: process.env.POSTGRES_PASSWORD || 'mypassword',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function getConnection(): Promise<PoolClient> {
  const db = getDbEngine();
  return db.connect();
}
