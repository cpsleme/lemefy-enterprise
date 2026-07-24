import type { Request, Response, NextFunction } from 'express';
import type { IUser } from '@lemefy/data-schemas';
import { UserWorkspaceService } from '../infrastructure/user-workspace.service';
import { KaneoHttpClient } from '../infrastructure/kaneo-http-client';

const kaneoBaseUrl = process.env.KANEO_API_URL ?? 'http://localhost:5173';
const kaneoApiKey = process.env.KANEO_API_KEY;
const kaneoClient = new KaneoHttpClient(kaneoBaseUrl, kaneoApiKey);
const workspaceService = new UserWorkspaceService(kaneoClient);

export function ensureKaneoWorkspace(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as IUser | undefined;

  if (!user?.id) {
    next();
    return;
  }

  if (user.kaneoWorkspaceId) {
    (req as unknown as Record<string, string>).kaneoWorkspaceId = user.kaneoWorkspaceId;
    next();
    return;
  }

  workspaceService
    .getOrCreateWorkspace(user.id, user.name ?? user.email ?? user.id)
    .then((workspaceId) => {
      if (user.set) {
        user.set('kaneoWorkspaceId', workspaceId);
        if (typeof user.save === 'function') {
          user.save().catch(() => {});
        }
      }
      (req as unknown as Record<string, string>).kaneoWorkspaceId = workspaceId;
      next();
    })
    .catch((error: unknown) => {
      next(error);
    });
}
