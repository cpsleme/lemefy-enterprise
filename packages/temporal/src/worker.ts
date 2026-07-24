import { Worker } from '@temporalio/worker';
import * as workflows from './workflows/finos-sync.workflow';
import * as activities from './activities/fetch-documents.activity';
import * as upsertActivities from './activities/upsert-documents.activity';
import * as syncStatusActivity from './activities/record-sync-status.activity';

async function runWorker() {
  const worker = new Worker({
    workflowsPaths: [require.resolve('./workflows/finos-sync.workflow.ts')],
    activities: {
      fetchRepoDocuments: activities.fetchRepoDocuments,
      upsertDocuments: upsertActivities.upsertDocuments,
      recordSyncStatus: syncStatusActivity.recordSyncStatus,
    },
    taskQueue: 'finos-focus-sync',
    connection: {
      address: process.env.TEMPORAL_ADDRESS || 'temporal:7233',
    },
  });

  await worker.run();
  console.log('Temporal worker started');
}

runWorker().catch((error) => {
  console.error('Temporal worker failed:', error);
  process.exit(1);
});
