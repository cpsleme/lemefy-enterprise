import type { WorkspaceManager } from '../domain/ports/workspace-manager.port';
import type { KaneoHttpClient } from './kaneo-http-client';

export class UserWorkspaceService implements WorkspaceManager {
  constructor(private readonly kaneoClient: KaneoHttpClient) {}

  async getOrCreateWorkspace(userId: string, userName: string): Promise<string> {
    const workspaceName = `user-${userId}`;
    const existing = await this.kaneoClient.listWorkspaces(userId);
    const match = existing.find((ws) => ws.name === workspaceName || ws.owner === userId);
    if (match) {
      return match.id;
    }

    const workspace = await this.kaneoClient.createWorkspace(workspaceName, userId);
    return workspace.id;
  }
}
