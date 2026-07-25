import { Router } from 'express';
import mongoose from 'mongoose';
import {
  isEnabled,
  generateCheckAccess,
  grantCreationPermissions,
  ensureLinkPermissions,
  isFileSnapshotEnabled,
  isFileSnapshotKillSwitchActive,
  buildSharedLinkStartupPayload,
  deleteSharedLinkWithCleanup,
  updateSharedLinkPermissionsExpiration,
  isActiveExpirationDate,
  getSharedLinkExpiration,
} from '@lemefy/api';
import {
  logger,
  getTenantId,
  runAsSystem,
  tenantStorage,
  SYSTEM_TENANT_ID,
  createTempChatExpirationDate,
} from '@lemefy/data-schemas';
import { FileSources, PermissionTypes, Permissions } from 'lemefy-data-provider';
import {
  getFiles,
  updateFile,
  getSharedMessages,
  createSharedLink,
  updateSharedLink,
  getSharedLinks,
  getSharedLink,
  getSharedLinkFile,
  backfillSharedLinkFiles,
  getRoleByName,
} from '~/models';
import { getStrategyFunctions } from '~/server/services/Files/strategies';
import { cleanFileName, getContentDisposition } from '~/server/utils/files';
import canAccessSharedLink from '~/server/middleware/canAccessSharedLink';
import { forkSharedConversation } from '~/server/utils/import/fork';
import { createForkLimiters } from '~/server/middleware/limiters';
import optionalShareFileAuth from '~/server/middleware/optionalShareFileAuth';
import optionalJwtAuth from '~/server/middleware/optionalJwtAuth';
import requireJwtAuth from '~/server/middleware/requireJwtAuth';
import configMiddleware from '~/server/middleware/config/app';
import { getAppConfig } from '~/server/services/Config/app';

const router = Router();

const checkSharedLinksAccess = generateCheckAccess({
  permissionType: PermissionTypes.SHARED_LINKS,
  permissions: [Permissions.CREATE],
  getRoleByName: getRoleByName as any,
});

const resolveSharedLinkExpiration = async (req: any, conversationId: string) =>
  getSharedLinkExpiration(
    { req, conversationId },
    {
      getConvo: async (userId: string, sourceConversationId: string) => {
        const Conversation = mongoose.models.Conversation;
        return Conversation.findOne(
          { conversationId: sourceConversationId, user: userId },
          'isTemporary expiredAt',
        ).lean();
      },
      createExpirationDate: createTempChatExpirationDate,
      logger,
    },
  );

const allowSharedLinks =
  process.env.ALLOW_SHARED_LINKS === undefined || isEnabled(process.env.ALLOW_SHARED_LINKS);

const runWithTenant = (tenantId: string, fn: () => void) =>
  tenantId ? tenantStorage.run({ tenantId }, fn) : runAsSystem(fn);

const PREVIEW_LAZY_SWEEP_CUTOFF_MS = 2 * 60 * 1000;

const getShareStartupPayload = async () => {
  const tenantId = getTenantId();
  const appConfig = await getAppConfig(
    tenantId && tenantId !== SYSTEM_TENANT_ID ? { tenantId } : { baseOnly: true },
  );
  return buildSharedLinkStartupPayload(appConfig);
};

const SAFE_INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/avif',
  'image/x-icon',
  'application/pdf',
]);

const resolveShareFile = async (req: any, res: any, next: any) => {
  try {
    if (isFileSnapshotKillSwitchActive()) {
      return res.status(404).json({ message: 'Shared file access is disabled' });
    }

    const { shareId, file_id } = req.params;
    const { file, hasSnapshots, optedOut } = await getSharedLinkFile(shareId, file_id);
    if (optedOut) {
      return res.status(404).json({ message: 'File not found in shared link' });
    }
    let snapshot = file;
    if (!snapshot && !hasSnapshots) {
      snapshot = await backfillSharedLinkFiles(shareId, file_id);
    }
    if (!snapshot) {
      logger.warn(
        `[shareFileAccess] File ${file_id} not in snapshot for share ${shareId} (route ${req.originalUrl})`,
      );
      return res.status(404).json({ message: 'File not found in shared link' });
    }

    const [liveFile] = await getFiles({ file_id }, null, {});
    if (!liveFile) {
      logger.warn(
        `[shareFileAccess] Snapshotted file ${file_id} no longer available for share ${shareId}`,
      );
      return res.status(404).json({ message: 'File no longer available' });
    }

    const revisionChanged =
      (snapshot.previewRevision ?? null) !== (liveFile.previewRevision ?? null);
    const bytesChanged =
      snapshot.bytes != null && liveFile.bytes != null && snapshot.bytes !== liveFile.bytes;
    if (revisionChanged || bytesChanged) {
      logger.warn(
        `[shareFileAccess] Snapshot version mismatch for file ${file_id} (share ${shareId})`,
      );
      return res.status(404).json({ message: 'File no longer available' });
    }

    req.shareFile = snapshot;
    req.liveFile = liveFile;
    return next();
  } catch (error) {
    logger.error('[shareFileAccess] Error resolving shared file:', error);
    return res.status(500).json({ message: 'Error resolving shared file' });
  }
};

const streamSharedFile = async (req: any, res: any, file: any, requestedDisposition: string) => {
  const source = file.source || FileSources.local;
  const { getDownloadStream, getDownloadURL } = getStrategyFunctions(source);

  const disposition =
    requestedDisposition === 'inline' && SAFE_INLINE_TYPES.has(file.type) ? 'inline' : 'attachment';

  const isDirectSource = source === FileSources.s3 || source === FileSources.cloudfront;
  if (req.query.direct === 'true' && getDownloadURL && isDirectSource) {
    try {
      const url = await getDownloadURL({
        req,
        file,
        customFilename: cleanFileName(file.filename),
        contentType: file.type || 'application/octet-stream',
      });
      if (url) {
        res.setHeader('Cache-Control', 'no-store');
        return res.redirect(302, url);
      }
    } catch (error) {
      logger.warn('[shareFileAccess] download URL generation failed, streaming instead:', error);
    }
  }

  if (!getDownloadStream) {
    return res.status(501).send('Not Implemented');
  }

  const streamPath = (file.storageKey || file.filepath || '').split('?')[0];
  const fileStream = await getDownloadStream(req, streamPath);
  fileStream.on('error', (error: any) => {
    logger.error('[shareFileAccess] Stream error:', error);
  });

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', getContentDisposition(file.filename, disposition));
  res.setHeader(
    'Content-Type',
    disposition === 'inline' ? file.type || 'application/octet-stream' : 'application/octet-stream',
  );
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return fileStream.pipe(res);
};

if (allowSharedLinks) {
  const { forkIpLimiter, forkUserLimiter } = createForkLimiters();

  router.get('/:shareId/config', optionalJwtAuth, canAccessSharedLink, async (_req: any, res: any) => {
    try {
      const payload = await getShareStartupPayload();
      res.set('Cache-Control', 'private, no-store');
      res.status(200).json(payload);
    } catch (error) {
      logger.error('Error getting shared startup config:', error);
      res.status(500).json({ message: 'Error getting shared startup config' });
    }
  });

  router.get(
    '/:shareId',
    optionalJwtAuth,
    canAccessSharedLink,
    configMiddleware,
    async (req: any, res: any) => {
      try {
        const share = await getSharedMessages(req.params.shareId, req.shareResourceId, {
          snapshotFiles: !isFileSnapshotKillSwitchActive(),
        });
        if (share) {
          res.set('Cache-Control', 'private, no-store');
          res.status(200).json(share);
        } else {
          res.status(404).end();
        }
      } catch (error) {
        logger.error('Error getting shared messages:', error);
        res.status(500).json({ message: 'Error getting shared messages' });
      }
    },
  );

  router.post(
    '/:shareId/fork',
    requireJwtAuth,
    forkIpLimiter,
    forkUserLimiter,
    canAccessSharedLink,
    async (req: any, res: any) => {
      try {
        const result = await forkSharedConversation({
          shareId: req.params.shareId,
          shareResourceId: req.shareResourceId,
          requestUserId: req.user.id,
          userRole: req.user.role,
          userTenantId: req.user.tenantId,
          targetMessageIndex: req.body?.targetMessageIndex,
          snapshotFiles: !isFileSnapshotKillSwitchActive(),
        });
        if (!result) {
          return res.status(404).json({ message: 'Shared conversation not found' });
        }
        res.status(201).json(result);
      } catch (error) {
        logger.error('Error forking shared conversation:', error);
        res.status(500).json({ message: 'Error forking shared conversation' });
      }
    },
  );

  router.get(
    '/:shareId/files/:file_id/preview',
    optionalJwtAuth,
    optionalShareFileAuth,
    canAccessSharedLink,
    configMiddleware,
    resolveShareFile,
    async (req: any, res: any) => {
      try {
        const { file_id } = req.params;
        let liveFile = req.liveFile;
        if (liveFile?.status === 'pending' && liveFile.updatedAt instanceof Date) {
          const ageMs = Date.now() - liveFile.updatedAt.getTime();
          if (ageMs > PREVIEW_LAZY_SWEEP_CUTOFF_MS) {
            const swept = await updateFile(
              { file_id, status: 'failed', previewError: 'orphaned' },
              { status: 'pending', updatedAt: liveFile.updatedAt },
            );
            if (swept) {
              liveFile = swept;
            }
          }
        }
        const status = liveFile?.status || 'ready';
        const payload: any = { file_id, status };
        if (status === 'ready' && liveFile?.text != null) {
          payload.text = liveFile.text;
          payload.textFormat = liveFile.textFormat ?? null;
        } else if (status === 'failed' && liveFile?.previewError) {
          payload.previewError = liveFile.previewError;
        }
        res.set('Cache-Control', 'private, no-store');
        return res.status(200).json(payload);
      } catch (error) {
        logger.error('[shareFileAccess] Error fetching shared preview:', error);
        return res.status(500).json({ message: 'Error fetching preview' });
      }
    },
  );

  router.get(
    '/:shareId/files/:file_id/download',
    optionalJwtAuth,
    optionalShareFileAuth,
    canAccessSharedLink,
    configMiddleware,
    resolveShareFile,
    async (req: any, res: any) => {
      try {
        await runWithTenant(req.shareFile.tenantId, () =>
          streamSharedFile(req, res, req.shareFile, 'attachment'),
        );
      } catch (error) {
        logger.error('[shareFileAccess] Error downloading shared file:', error);
        if (!res.headersSent) {
          res.status(500).send('Error downloading file');
        }
      }
    },
  );

  router.get(
    '/:shareId/files/:file_id',
    optionalJwtAuth,
    optionalShareFileAuth,
    canAccessSharedLink,
    configMiddleware,
    resolveShareFile,
    async (req: any, res: any) => {
      try {
        await runWithTenant(req.shareFile.tenantId, () =>
          streamSharedFile(req, res, req.shareFile, 'inline'),
        );
      } catch (error) {
        logger.error('[shareFileAccess] Error serving shared file:', error);
        if (!res.headersSent) {
          res.status(500).send('Error serving file');
        }
      }
    },
  );
}

router.get('/', requireJwtAuth, async (req: any, res: any) => {
  try {
    const params = {
      pageParam: req.query.cursor,
      pageSize: Math.max(1, parseInt(req.query.pageSize as string, 10) || 10),
      sortBy: ['createdAt', 'title'].includes(req.query.sortBy as string)
        ? (req.query.sortBy as string)
        : 'createdAt',
      sortDirection: ['asc', 'desc'].includes(req.query.sortDirection as string)
        ? (req.query.sortDirection as string)
        : 'desc',
      search: req.query.search ? decodeURIComponent((req.query.search as string).trim()) : undefined,
    };

    const result = await getSharedLinks(
      req.user.id,
      params.pageParam,
      params.pageSize,
      params.sortBy,
      params.sortDirection,
      params.search,
    );

    res.status(200).send({
      links: result.links,
      nextCursor: result.nextCursor,
      hasNextPage: result.hasNextPage,
    });
  } catch (error) {
    logger.error('Error getting shared links:', error);
    res.status(500).json({
      message: 'Error getting shared links',
      error: (error as Error).message,
    });
  }
});

router.get('/link/:conversationId', requireJwtAuth, async (req: any, res: any) => {
  try {
    const share = await getSharedLink(req.user.id, req.params.conversationId);

    if (share._id && share.success) {
      await ensureLinkPermissions(share._id, req.user.id);
    }

    return res.status(200).json({
      _id: share._id,
      success: share.success,
      shareId: share.shareId,
      targetMessageId: share.targetMessageId,
      snapshotFiles: share.snapshotFiles,
      conversationId: req.params.conversationId,
    });
  } catch (error) {
    logger.error('Error getting shared link:', error);
    res.status(500).json({ message: 'Error getting shared link' });
  }
});

router.post(
  '/:conversationId',
  requireJwtAuth,
  configMiddleware,
  checkSharedLinksAccess,
  async (req: any, res: any) => {
    try {
      const { targetMessageId } = req.body;
      const expiredAt = await resolveSharedLinkExpiration(req, req.params.conversationId);
      if (expiredAt != null && !isActiveExpirationDate(expiredAt)) {
        return res.status(404).end();
      }

      const role = await getRoleByName(req.user.role);
      const sharedLinksPerms = role?.permissions?.[PermissionTypes.SHARED_LINKS] || {};
      const grantPublic = sharedLinksPerms[Permissions.SHARE_PUBLIC] === true;
      const snapshotFiles =
        isFileSnapshotEnabled(req.config) && req.body?.snapshotFiles !== false;

      const created = await createSharedLink(
        req.user.id,
        req.params.conversationId,
        targetMessageId,
        expiredAt,
        snapshotFiles,
      );
      if (created) {
        await grantCreationPermissions(created._id, req.user.id, grantPublic, expiredAt);
        res.status(200).json(created);
      } else {
        res.status(404).end();
      }
    } catch (error) {
      logger.error('Error creating shared link:', error);
      res.status(500).json({ message: 'Error creating shared link' });
    }
  },
);

router.patch('/:shareId', requireJwtAuth, configMiddleware, async (req: any, res: any) => {
  try {
    const { targetMessageId } = req.body ?? {};
    if (targetMessageId !== undefined && typeof targetMessageId !== 'string') {
      return res.status(400).json({ message: 'targetMessageId must be a string' });
    }

    let expiredAt;
    const SharedLink = mongoose.models.SharedLink;
    const existing = await SharedLink.findOne(
      { shareId: req.params.shareId, user: req.user.id },
      'conversationId',
    ).lean();
    if (existing?.conversationId) {
      expiredAt = await resolveSharedLinkExpiration(req, existing.conversationId);
    }
    if (expiredAt != null && !isActiveExpirationDate(expiredAt)) {
      return res.status(404).end();
    }

    const updatedShare = await updateSharedLink(
      req.user.id,
      req.params.shareId,
      targetMessageId,
      expiredAt,
      isFileSnapshotEnabled(req.config) && req.body?.snapshotFiles !== false,
    );
    if (updatedShare) {
      if (updatedShare._id && expiredAt !== undefined) {
        await updateSharedLinkPermissionsExpiration(updatedShare._id, expiredAt);
      }
      res.status(200).json(updatedShare);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    logger.error('Error updating shared link:', error);
    res.status(500).json({ message: 'Error updating shared link' });
  }
});

router.delete('/:shareId', requireJwtAuth, async (req: any, res: any) => {
  try {
    const result = await deleteSharedLinkWithCleanup(req.user.id, req.params.shareId);

    if (!result) {
      return res.status(404).json({ message: 'Share not found' });
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error deleting shared link:', error);
    return res.status(400).json({ message: 'Error deleting shared link' });
  }
});

export default router;
