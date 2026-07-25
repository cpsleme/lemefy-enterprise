import { Router } from 'express';
import multer from 'multer';
import { sleep } from '@librechat/agents';
import {
  isEnabled,
  deleteAgentCheckpoints,
  resolveImportMaxFileSize,
  restoreTenantContextFromReq,
  deleteAllSharedLinksWithCleanup,
  deleteConvoSharedLinksWithCleanup,
} from '@lemefy/api';
import { logger } from '@lemefy/data-schemas';
import { CacheKeys, EModelEndpoint } from 'lemefy-data-provider';
import {
  createImportLimiters,
  validateConvoAccess,
  createForkLimiters,
  configMiddleware,
} from '~/server/middleware';
import { forkConversation, duplicateConversation } from '~/server/utils/import/fork';
import { storage, importFileFilter } from '~/server/routes/files/multer';
import { requireJwtAuth } from '~/server/middleware/requireJwtAuth';
import { importConversations } from '~/server/utils/import';
import getLogStores from '~/cache/getLogStores';
import db from '~/models';
import pgChat from '@lemefy/data-schemas';

const assistantClients: Record<string, any> = {
  [EModelEndpoint.azureAssistants]: require('~/server/services/Endpoints/azureAssistants'),
  [EModelEndpoint.assistants]: require('~/server/services/Endpoints/assistants'),
};

const router = Router();
router.use(requireJwtAuth);

const isValidProjectFilter = (projectId: string | string[] | undefined): boolean =>
  !projectId || projectId === 'unassigned' || /^[a-f\d]{24}$/i.test(projectId as string);

router.get('/', async (req: any, res: any) => {
  const limit = parseInt(req.query.limit as string, 10) || 25;
  const cursor = req.query.cursor;
  const isArchived = isEnabled(req.query.isArchived);
  const search = req.query.search ? decodeURIComponent(req.query.search as string) : undefined;
  const sortBy = (req.query.sortBy as string) || 'updatedAt';
  const sortDirection = (req.query.sortDirection as string) || 'desc';
  const projectId = Array.isArray(req.query.projectId)
    ? req.query.projectId[0]
    : req.query.projectId;

  if (!isValidProjectFilter(projectId)) {
    return res.status(400).json({ error: 'projectId must be a valid project id or unassigned' });
  }

  let tags;
  if (req.query.tags) {
    tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
  }

  try {
    const result = await pgChat.conversation.getConvosByCursor(req.user.id, {
      cursor,
      limit,
      isArchived,
      tags,
      search,
      sortBy,
      sortDirection,
      chatProjectId: projectId,
    });
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error fetching conversations', error);
    res.status(500).json({ error: 'Error fetching conversations' });
  }
});

router.get('/:conversationId', async (req: any, res: any) => {
  const { conversationId } = req.params;
  try {
    const convo = await pgChat.conversation.getConvo(conversationId, req.user.id);

    if (convo) {
      res.status(200).json(convo);
    } else {
      res.status(404).end();
    }
  } catch (error) {
    logger.error('Error fetching conversation', error);
    res.status(500).json({ error: 'Error fetching conversation' });
  }
});

router.get('/gen_title/:conversationId', async (req: any, res: any) => {
  const { conversationId } = req.params;
  const titleCache = getLogStores(CacheKeys.GEN_TITLE);
  const key = `${req.user.id}-${conversationId}`;
  let title = await titleCache.get(key);

  if (!title) {
    const delays = [500, 1000, 2000, 4000, 8000];
    for (const delay of delays) {
      await sleep(delay);
      title = await titleCache.get(key);
      if (title) {
        break;
      }
    }
  }

  if (title) {
    await titleCache.delete(key);
    res.status(200).json({ title });
  } else {
    res.status(404).json({
      message: "Title not found or method not implemented for the conversation's endpoint",
    });
  }
});

router.delete('/', configMiddleware, async (req: any, res: any) => {
  let filter: any = {};
  const { conversationId, source, thread_id, endpoint } = req.body?.arg ?? {};

  if (!conversationId && !source && !thread_id && !endpoint) {
    return res.status(400).json({
      error: 'no parameters provided',
    });
  }

  if (conversationId) {
    filter = { conversationId };
  } else if (source === 'button') {
    return res.status(200).send('No conversationId provided');
  }

  if (
    typeof endpoint !== 'undefined' &&
    Object.prototype.propertyIsEnumerable.call(assistantClients, endpoint)
  ) {
    // @ts-expect-error dynamic client
    const { openai } = await assistantClients[endpoint].initializeClient({ req, res });
    try {
      const response = await openai.beta.threads.delete(thread_id);
      logger.debug('Deleted OpenAI thread:', response);
    } catch (error) {
      logger.error('Error deleting OpenAI thread:', error);
    }
  }

  try {
    const dbResponse = await pgChat.conversation.deleteConvos(req.user.id, filter);
    if (Array.isArray(dbResponse?.conversationIds)) {
      await deleteAgentCheckpoints(
        dbResponse.conversationIds,
        req.config?.endpoints?.[EModelEndpoint.agents]?.checkpointer,
      );
    }
    if (filter.conversationId) {
      await db.deleteToolCalls(req.user.id, filter.conversationId);
      await deleteConvoSharedLinksWithCleanup(req.user.id, filter.conversationId);
    }
    res.status(201).json(dbResponse);
  } catch (error) {
    logger.error('Error clearing conversations', error);
    res.status(500).send('Error clearing conversations');
  }
});

router.delete('/all', configMiddleware, async (req: any, res: any) => {
  try {
    const dbResponse = await pgChat.conversation.deleteConvos(req.user.id, {});
    if (Array.isArray(dbResponse?.conversationIds)) {
      await deleteAgentCheckpoints(
        dbResponse.conversationIds,
        req.config?.endpoints?.[EModelEndpoint.agents]?.checkpointer,
      );
    }
    await db.deleteToolCalls(req.user.id);
    await deleteAllSharedLinksWithCleanup(req.user.id);
    res.status(201).json(dbResponse);
  } catch (error) {
    logger.error('Error clearing conversations', error);
    res.status(500).send('Error clearing conversations');
  }
});

router.post('/archive', validateConvoAccess, async (req: any, res: any) => {
  const { conversationId, isArchived } = req.body?.arg ?? {};

  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  if (typeof isArchived !== 'boolean') {
    return res.status(400).json({ error: 'isArchived must be a boolean' });
  }

  try {
    const dbResponse = await pgChat.conversation.upsertConvo(
      {
        conversationId,
        userId: req?.user?.id,
        isTemporary: req?.body?.isTemporary,
        isArchived,
      },
      { noUpsert: true },
    );
    res.status(200).json(dbResponse);
  } catch (error) {
    logger.error('Error archiving conversation', error);
    res.status(500).send('Error archiving conversation');
  }
});

router.post('/pin', validateConvoAccess, async (req: any, res: any) => {
  const { conversationId, pinned } = req.body?.arg ?? {};

  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  if (pinned === undefined) {
    return res.status(400).json({ error: 'pinned is required' });
  }

  if (typeof pinned !== 'boolean') {
    return res.status(400).json({ error: 'pinned must be a boolean' });
  }

  try {
    const dbResponse = await pgChat.conversation.upsertConvo(
      { conversationId, userId: req.user.id, pinned },
      { noUpsert: true },
    );
    res.status(200).json(dbResponse);
  } catch (error) {
    logger.error('Error pinning conversation', error);
    res.status(500).send('Error pinning conversation');
  }
});

const MAX_CONVO_TITLE_LENGTH = 1024;

router.post('/update', validateConvoAccess, async (req: any, res: any) => {
  const { conversationId, title } = req.body?.arg ?? {};

  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  if (title === undefined) {
    return res.status(400).json({ error: 'title is required' });
  }

  if (typeof title !== 'string') {
    return res.status(400).json({ error: 'title must be a string' });
  }

  const sanitizedTitle = title.trim().slice(0, MAX_CONVO_TITLE_LENGTH);

  try {
    const dbResponse = await pgChat.conversation.upsertConvo(
      {
        conversationId,
        userId: req?.user?.id,
        isTemporary: req?.body?.isTemporary,
        title: sanitizedTitle,
      },
      { noUpsert: true },
    );
    res.status(201).json(dbResponse);
  } catch (error) {
    logger.error('Error updating conversation', error);
    res.status(500).send('Error updating conversation');
  }
});

const { importIpLimiter, importUserLimiter } = createImportLimiters();
const { forkIpLimiter, forkUserLimiter } = createForkLimiters();
const importMaxFileSize = resolveImportMaxFileSize();
const upload = multer({
  storage,
  fileFilter: importFileFilter,
  limits: { fileSize: importMaxFileSize },
});
const uploadSingle = upload.single('file');

function handleUpload(req: any, res: any, next: any) {
  uploadSingle(req, res, (err: any) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File exceeds the maximum allowed size' });
    }
    if (err) {
      return next(err);
    }
    next();
  });
}

router.post(
  '/import',
  importIpLimiter,
  importUserLimiter,
  configMiddleware,
  handleUpload,
  restoreTenantContextFromReq,
  async (req: any, res: any) => {
    try {
      await importConversations({
        filepath: req.file.path,
        requestUserId: req.user.id,
        userRole: req.user.role,
        interfaceConfig: req.config?.interfaceConfig,
      });
      res.status(201).json({ message: 'Conversation(s) imported successfully' });
    } catch (error) {
      logger.error('Error processing file', error);
      res.status(500).send('Error processing file');
    }
  },
);

router.post('/fork', forkIpLimiter, forkUserLimiter, async (req: any, res: any) => {
  try {
    const { conversationId, messageId, option, splitAtTarget, latestMessageId } = req.body;
    const result = await forkConversation({
      requestUserId: req.user.id,
      originalConvoId: conversationId,
      targetMessageId: messageId,
      latestMessageId,
      records: true,
      splitAtTarget,
      option,
    });

    res.json(result);
  } catch (error) {
    logger.error('Error forking conversation:', error);
    res.status(500).send('Error forking conversation');
  }
});

router.post('/duplicate', forkIpLimiter, forkUserLimiter, async (req: any, res: any) => {
  try {
    const { conversationId, title } = req.body;
    const result = await duplicateConversation({
      userId: req.user.id,
      conversationId,
      title,
    });
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error duplicating conversation:', error);
    res.status(500).send('Error duplicating conversation');
  }
});

export default router;
