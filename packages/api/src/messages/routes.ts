import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@lemefy/data-schemas';
import { ContentTypes, isAssistantsEndpoint } from 'lemefy-data-provider';
import {
  unescapeLaTeX,
  countTokens,
  sendFeedbackScore,
  traceIdForMessage,
  mergeQuotedTextForCount,
} from '@lemefy/api';
import { findAllArtifacts, replaceArtifactContent } from '~/server/services/Artifacts/update';
import {
  requireJwtAuth,
  validateMessageReq,
  configMiddleware,
  sendValidationResponse,
  prepareMessageRequestValidation,
} from '~/server/middleware';
import db from '~/models';
import pgChat from '@lemefy/data-schemas';

const router = Router();
router.use(requireJwtAuth);

const USE_POSTGRES_CHAT = !!process.env.USE_POSTGRES_CHAT;

router.get('/', async (req: any, res: any) => {
  try {
    const user = req.user.id ?? '';
    const {
      cursor = null,
      sortBy = 'updatedAt',
      sortDirection = 'desc',
      pageSize: pageSizeRaw,
      conversationId,
      messageId,
      search,
    } = req.query;
    const pageSize = parseInt(pageSizeRaw as string, 10) || 25;

    let response: any;
    const sortField = ['endpoint', 'createdAt', 'updatedAt'].includes(sortBy as string)
      ? (sortBy as string)
      : 'createdAt';
    const sortOrder = sortDirection === 'asc' ? 'asc' : 'desc';

    if (conversationId && messageId) {
      const messages = await pgChat.message.getMessages({ conversationId: conversationId as string, messageId: messageId as string, user });
      response = { messages: messages?.length ? [messages[0]] : [], nextCursor: null };
    } else if (conversationId) {
      const messages = await pgChat.message.getMessagesByCursor({
        conversationId: conversationId as string,
        user,
        limit: pageSize,
        cursor: cursor as string | null,
        sortField,
        sortOrder,
      });
      response = { messages, nextCursor: null };
    } else if (search) {
      const tenantId = req.user?.tenantId || 'default';
      const searchResults = await pgChat.message.searchMessages(search as string, user, tenantId, pageSize);

      const messageIds = searchResults.map((m) => m.messageId);
      const dbMessages = messageIds.length
        ? await pgChat.message.getMessages({
            conversationId: searchResults[0]?.conversationId,
            userId: user,
            tenantId,
            limit: messageIds.length,
            cursor: messageIds[0],
          })
        : [];

      const dbMessageMap = new Map(dbMessages.map((m) => [m.messageId, m]));

      const activeMessages = searchResults.map((hit) => {
        const dbMessage = dbMessageMap.get(hit.messageId);
        return {
          ...hit,
          text: dbMessage?.text ?? hit.text,
          content: dbMessage?.content ?? hit.content,
          isCreatedByUser: dbMessage?.isCreatedByUser,
          endpoint: dbMessage?.endpoint,
        };
      });

      response = { messages: activeMessages, nextCursor: null };
    } else {
      response = { messages: [], nextCursor: null };
    }

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/branch', async (req: any, res: any) => {
  try {
    const { messageId, agentId } = req.body;
    const userId = req.user.id;

    if (!messageId || !agentId) {
      return res.status(400).json({ error: 'messageId and agentId are required' });
    }

    const sourceMessage = await db.getMessage({ user: userId, messageId });
    if (!sourceMessage) {
      return res.status(404).json({ error: 'Source message not found' });
    }

    if (sourceMessage.isCreatedByUser) {
      return res.status(400).json({ error: 'Cannot branch from user messages' });
    }

    if (!Array.isArray(sourceMessage.content)) {
      return res.status(400).json({ error: 'Message does not have content' });
    }

    const hasAgentMetadata = sourceMessage.content.some((part: any) => part?.agentId);
    if (!hasAgentMetadata) {
      return res.status(400).json({ error: 'Message does not have parallel content with attributions' });
    }

    const filteredContent: any[] = [];
    for (const part of sourceMessage.content) {
      if (part?.agentId === agentId) {
        const { agentId: _a, groupId: _g, ...cleanPart } = part;
        filteredContent.push(cleanPart);
      }
    }

    if (filteredContent.length === 0) {
      return res.status(400).json({ error: 'No content found for the specified agentId' });
    }

    const newMessageId = uuidv4();
    const newMessage: any = {
      messageId: newMessageId,
      conversationId: sourceMessage.conversationId,
      parentMessageId: sourceMessage.parentMessageId,
      attachments: sourceMessage.attachments,
      isCreatedByUser: false,
      model: sourceMessage.model,
      endpoint: sourceMessage.endpoint,
      sender: sourceMessage.sender,
      iconURL: sourceMessage.iconURL,
      content: filteredContent,
      unfinished: false,
      error: false,
      user: userId,
    };

    const savedMessage = await pgChat.message.saveMessage(newMessage);

    if (!savedMessage) {
      return res.status(500).json({ error: 'Failed to save branch message' });
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    logger.error('Error creating branch message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/artifact/:messageId', async (req: any, res: any) => {
  try {
    const { messageId } = req.params;
    const { index, original, updated } = req.body;

    if (typeof index !== 'number' || index < 0 || original == null || updated == null) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    const message = await db.getMessage({ user: req.user.id, messageId });
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const artifacts = findAllArtifacts(message);
    if (index >= artifacts.length) {
      return res.status(400).json({ error: 'Artifact index out of bounds' });
    }

    const unescapedOriginal = unescapeLaTeX(original);
    const unescapedUpdated = unescapeLaTeX(updated);

    const targetArtifact = artifacts[index];
    let updatedText: string | null = null;

    if (targetArtifact.source === 'content') {
      const part = message.content[targetArtifact.partIndex];
      updatedText = replaceArtifactContent(
        part.text,
        targetArtifact,
        unescapedOriginal,
        unescapedUpdated,
      );
      if (updatedText) {
        part.text = updatedText;
      }
    } else {
      updatedText = replaceArtifactContent(
        message.text,
        targetArtifact,
        unescapedOriginal,
        unescapedUpdated,
      );
      if (updatedText) {
        message.text = updatedText;
      }
    }

    if (!updatedText) {
      return res.status(400).json({ error: 'Original content not found in target artifact' });
    }

    const savedMessage = await pgChat.message.saveMessage({
      conversationId: message.conversationId,
      text: message.text,
      content: message.content,
      userId: req.user.id,
    });

    res.status(200).json({
      conversationId: savedMessage.conversationId,
      content: savedMessage.content,
      text: savedMessage.text,
    });
  } catch (error) {
    logger.error('Error editing artifact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:conversationId', prepareMessageRequestValidation, async (req: any, res: any) => {
  try {
    const { conversationId } = req.params;
    const validation = req.messageRequestValidation;
    const messagesPromise = validation.shouldFetchMessages
      ? db.getMessages({ conversationId, user: req.user.id }, '-_id -__v -user').then(
          (messages) => ({ messages }),
          (error) => ({ error }),
        )
      : null;

    const validationResult = await validation.promise;
    if (!validationResult.ok) {
      return sendValidationResponse(res, validationResult);
    }

    const messagesResult = await messagesPromise;
    if (messagesResult?.error) {
      throw messagesResult.error;
    }

    const messages = messagesResult?.messages ?? [];
    res.status(200).json(messages);
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:conversationId', validateMessageReq, async (req: any, res: any) => {
  try {
    const message = { ...req.body, conversationId: req.params.conversationId };
    const reqCtx = {
      userId: req?.user?.id,
      isTemporary: req?.body?.isTemporary,
      interfaceConfig: req?.config?.interfaceConfig,
    };
    const savedMessage = USE_POSTGRES_CHAT
      ? await pgChat.message.saveMessage({ ...message, user: req.user.id })
      : await db.saveMessage(
          reqCtx,
          { ...message, user: req.user.id },
          { context: 'POST /api/messages/:conversationId' },
        );
    if (!savedMessage) {
      return res.status(400).json({ error: 'Message not saved' });
    }
    if (USE_POSTGRES_CHAT) {
      await pgChat.conversation.upsertConvo({ conversationId: message.conversationId, userId: req.user.id });
    } else {
      await db.saveConvo(reqCtx, savedMessage, { context: 'POST /api/messages/:conversationId' });
    }
    res.status(201).json(savedMessage);
  } catch (error) {
    logger.error('Error saving message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:conversationId/:messageId', validateMessageReq, async (req: any, res: any) => {
  try {
    const { conversationId, messageId } = req.params;
    const messages = await pgChat.message.getMessages({ conversationId, messageId, user: req.user.id });
    if (!messages || !messages.length) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.status(200).json(messages[0]);
  } catch (error) {
    logger.error('Error fetching message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:conversationId/:messageId', validateMessageReq, async (req: any, res: any) => {
  try {
    const { conversationId, messageId } = req.params;
    const { text, index, model } = req.body;

    if (index === undefined) {
      const existingMessages = await pgChat.message.getMessages({ conversationId, messageId, user: req.user.id });
      const existing = existingMessages?.[0];
      const textToCount = mergeQuotedTextForCount(
        text,
        existing?.quotes,
        existing?.isCreatedByUser === true,
      );
      const tokenCount = await countTokens(textToCount, model);
      const result = await pgChat.message.updateMessage(messageId, req.user.id, { text, tokenCount });
      return res.status(200).json(result);
    }

    if (typeof index !== 'number' || index < 0) {
      return res.status(400).json({ error: 'Invalid index' });
    }

    const targetMessages = await pgChat.message.getMessages({ conversationId, messageId, user: req.user.id });
    const message = targetMessages?.[0];
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const existingContent = message.content;
    if (!Array.isArray(existingContent) || index >= existingContent.length) {
      return res.status(400).json({ error: 'Invalid index' });
    }

    const updatedContent = [...existingContent];
    if (!updatedContent[index]) {
      return res.status(400).json({ error: 'Content part not found' });
    }

    const currentPartType = updatedContent[index].type;
    if (currentPartType !== ContentTypes.TEXT && currentPartType !== ContentTypes.THINK) {
      return res.status(400).json({ error: 'Cannot update non-text content' });
    }

    const oldText = updatedContent[index][currentPartType];
    updatedContent[index] = { type: currentPartType, [currentPartType]: text };

    let tokenCount = message.tokenCount;
    if (tokenCount !== undefined) {
      const oldTokenCount = await countTokens(oldText, model);
      const newTokenCount = await countTokens(text, model);
      tokenCount = Math.max(0, tokenCount - oldTokenCount) + newTokenCount;
    }

    const result = await pgChat.message.updateMessage(messageId, req.user.id, { content: updatedContent, tokenCount });
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error updating message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put(
  '/:conversationId/:messageId/feedback',
  validateMessageReq,
  configMiddleware,
  async (req: any, res: any) => {
    try {
      const { conversationId, messageId } = req.params;
      const { feedback } = req.body;

      const updatedMessage = await pgChat.message.updateMessage(messageId, req?.user?.id, { feedback: feedback || null });

      if (!isAssistantsEndpoint(updatedMessage.endpoint)) {
        sendFeedbackScore({
          traceId: traceIdForMessage(messageId),
          feedback: updatedMessage.feedback,
          appConfig: req.config,
          metadata: {
            messageId: updatedMessage.messageId ?? messageId,
            parentMessageId: updatedMessage.parentMessageId,
            conversationId: updatedMessage.conversationId ?? conversationId,
            sessionId: updatedMessage.conversationId ?? conversationId,
            userId: req?.user?.id,
            tenantId: req?.user?.tenantId,
            endpoint: updatedMessage.endpoint,
            sender: updatedMessage.sender,
            isCreatedByUser: updatedMessage.isCreatedByUser,
            tokenCount: updatedMessage.tokenCount,
          },
        }).catch((err) => logger.error('[langfuse] feedback score failed:', err));
      }

      res.json({
        messageId,
        conversationId,
        feedback: updatedMessage.feedback,
      });
    } catch (error) {
      logger.error('Error updating message feedback:', error);
      res.status(500).json({ error: 'Failed to update feedback' });
    }
  },
);

router.delete('/:conversationId/:messageId', validateMessageReq, async (req: any, res: any) => {
  try {
    const { conversationId, messageId } = req.params;
    await pgChat.message.deleteMessages([messageId], req.user.id);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
