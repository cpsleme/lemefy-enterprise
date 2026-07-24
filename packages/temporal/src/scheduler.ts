import { Client } from '@temporalio/client';
import { FinosFocusDailySync } from './workflows/finos-sync.workflow';

async function scheduleWorkflow() {
  const client = new Client({
    address: process.env.TEMPORAL_ADDRESS || 'temporal:7233',
  });

  const scheduleId = 'finos-focus-daily-sync';

  await client.schedule.create({
    scheduleId,
    policy: {
      catchupWindow: '1h',
    },
    spec: {
      cron: [{ second: '0', minute: '0', hour: '3' }],
    },
    action: {
      type: 'startWorkflow',
      workflowType: FinosFocusDailySync,
      argument: undefined,
      taskQueue: 'finos-focus-sync',
    },
  });

  console.log(`Schedule ${scheduleId} created for daily sync at 03:00`);
}

scheduleWorkflow().catch((error) => {
  console.error('Failed to create schedule:', error);
  process.exit(1);
});
