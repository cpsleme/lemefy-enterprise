import { defineActivity } from '@temporalio/workflow';
import { getDbEngine } from '../activities/db';

export const recordSyncStatus = defineActivity({
  name: 'recordSyncStatus',
  description: 'Record sync status in PostgreSQL',
  retry: {
    initialInterval: '2s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 2,
  },
}, async (repoId: string, status: 'success' | 'failed', ingested: number, error?: string): Promise<void> => {
  const db = getDbEngine();
  const conn = await db.connect();

  await conn.execute(
    `CREATE TABLE IF NOT EXISTS finos_doc_sync (
      id SERIAL PRIMARY KEY,
      repo_id VARCHAR(255),
      status VARCHAR(50),
      ingested INTEGER,
      error TEXT,
      finished_at TIMESTAMP DEFAULT NOW()
    )`
  );

  await conn.execute(
    `INSERT INTO finos_doc_sync (repo_id, status, ingested, error)
     VALUES (:repoId, :status, :ingested, :error)`,
    { repoId, status, ingested, error: error ?? null }
  );
});
