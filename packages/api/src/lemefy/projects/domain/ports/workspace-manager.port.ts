export interface WorkspaceManager {
  getOrCreateWorkspace(userId: string, userName: string): Promise<string>;
}
