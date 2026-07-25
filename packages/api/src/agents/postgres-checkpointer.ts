import { saveCheckpoint, getCheckpoint, deleteChatCheckpoints } from '@lemefy/data-schemas';
import { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import type { Checkpoint, CheckpointMetadata, PendingWrite, RunnableConfig, CheckpointTuple, CheckpointListOptions } from '@langchain/langgraph-checkpoint';

export class PostgresCheckpointer extends BaseCheckpointSaver {
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string;
    const checkpoint = await getCheckpoint(threadId);
    if (!checkpoint) return undefined;

    return {
      config,
      checkpoint: checkpoint.state as Checkpoint,
      metadata: {} as CheckpointMetadata,
      pendingWrites: [],
    };
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string;
    const checkpoint = await getCheckpoint(threadId);
    if (!checkpoint) return;

    yield {
      config,
      checkpoint: checkpoint.state as Checkpoint,
      metadata: {} as CheckpointMetadata,
    };
  }

  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, newVersions: Record<string, number>): Promise<RunnableConfig> {
    const conversationId = config.configurable?.thread_id as string;
    await saveCheckpoint({
      id: checkpoint.id,
      conversationId,
      state: checkpoint,
      createdAt: new Date().toISOString(),
    });
    return config;
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    return;
  }

  async deleteThread(threadId: string): Promise<void> {
    await deleteChatCheckpoints(threadId);
  }
}

export async function getAgentCheckpointer() {
  return new PostgresCheckpointer();
}
