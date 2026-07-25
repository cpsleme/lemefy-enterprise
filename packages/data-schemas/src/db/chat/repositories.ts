import { chatDb } from './index';
import {
  chatConversations,
  chatMessages,
  chatProjects,
  conversationTags,
  toolCalls,
  chatCheckpoints,
} from './schema';
import { eq, and, desc, asc, inArray, like, sql, or, isNull } from 'drizzle-orm';
import type {
  ChatConversation,
  NewChatConversation,
  ChatMessage,
  NewChatMessage,
  ChatProject,
  NewChatProject,
  ConversationTag,
  NewConversationTag,
  ToolCall,
  NewToolCall,
  ChatCheckpoint,
  NewChatCheckpoint,
} from './schema';

export async function saveConvo(convo: NewChatConversation): Promise<ChatConversation> {
  const [result] = await chatDb.insert(chatConversations).values(convo).returning();
  return result;
}

export async function getConvo(conversationId: string, userId: string, tenantId: string): Promise<ChatConversation | null> {
  const [result] = await chatDb
    .select()
    .from(chatConversations)
    .where(and(
      eq(chatConversations.conversationId, conversationId),
      eq(chatConversations.userId, userId),
      eq(chatConversations.tenantId, tenantId)
    ))
    .limit(1);

  return result ?? null;
}

export async function getConvosByCursor(params: {
  userId?: string;
  tenantId: string;
  limit?: number;
  cursor?: string;
  agentId?: string;
  chatProjectId?: string;
  search?: string;
  isArchived?: boolean;
  tags?: string[];
}): Promise<ChatConversation[]> {
  const {
    userId,
    tenantId,
    limit = 25,
    cursor,
    agentId,
    chatProjectId,
    search,
    isArchived,
    tags,
  } = params;

  const conditions = [eq(chatConversations.tenantId, tenantId)];
  if (userId) conditions.push(eq(chatConversations.userId, userId));
  if (agentId) conditions.push(eq(chatConversations.agentId, agentId));
  if (isArchived !== undefined) {
    conditions.push(eq(chatConversations.isArchived, String(isArchived)));
  }
  if (chatProjectId && chatProjectId !== 'unassigned') {
    conditions.push(eq(chatConversations.chatProjectId, chatProjectId));
  } else if (chatProjectId === 'unassigned') {
    conditions.push(isNull(chatConversations.chatProjectId));
  }
  if (search) conditions.push(like(chatConversations.title, `%${search}%`));

  if (cursor) {
    conditions.push(eq(chatConversations.conversationId, cursor));
  }

  return chatDb
    .select()
    .from(chatConversations)
    .where(and(...conditions))
    .orderBy(desc(chatConversations.updatedAt), desc(chatConversations.createdAt))
    .limit(limit);
}

export async function deleteConvos(conversationIds: string[], userId: string, tenantId: string): Promise<ChatConversation[]> {
  return chatDb
    .delete(chatConversations)
    .where(and(
      inArray(chatConversations.conversationId, conversationIds),
      eq(chatConversations.userId, userId),
      eq(chatConversations.tenantId, tenantId)
    ))
    .returning();
}

export async function saveMessage(message: NewChatMessage): Promise<ChatMessage> {
  const [result] = await chatDb.insert(chatMessages).values(message).returning();
  return result;
}

export async function getMessages(params: {
  conversationId: string;
  userId: string;
  tenantId: string;
  limit?: number;
  cursor?: string;
}): Promise<ChatMessage[]> {
  const { conversationId, userId, tenantId, limit = 50, cursor } = params;
  const conditions = [
    and(
      eq(chatMessages.conversationId, conversationId),
      eq(chatMessages.userId, userId),
      eq(chatMessages.tenantId, tenantId)
    ),
  ];
  if (cursor) conditions.push(eq(chatMessages.messageId, cursor));

  return chatDb
    .select()
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(asc(chatMessages.createdAt))
    .limit(limit);
}

export async function getMessagesByCursor(params: {
  conversationId: string;
  userId: string;
  tenantId: string;
  limit?: number;
  cursor?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<ChatMessage[]> {
  const { conversationId, userId, tenantId, limit = 25, cursor, sortField = 'createdAt', sortOrder = 'desc' } = params;
  const column = sortField === 'updatedAt' ? chatMessages.updatedAt : chatMessages.createdAt;
  const orderFn = sortOrder === 'asc' ? asc : desc;

  const conditions = [
    and(
      eq(chatMessages.conversationId, conversationId),
      eq(chatMessages.userId, userId),
      eq(chatMessages.tenantId, tenantId)
    ),
  ];

  if (cursor) {
    const cmp = sortOrder === 'asc' ? 'gt' : 'lt';
    conditions.push(sql`${column} ${sql.raw(cmp)} (SELECT ${column} FROM ${chatMessages} WHERE ${chatMessages.messageId} = ${cursor})`);
  }

  return chatDb
    .select()
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(orderFn(column), desc(chatMessages.messageId))
    .limit(limit);
}

export async function updateMessage(messageId: string, userId: string, tenantId: string, data: Partial<ChatMessage>): Promise<ChatMessage | undefined> {
  const [result] = await chatDb
    .update(chatMessages)
    .set(data)
    .where(and(
      eq(chatMessages.messageId, messageId),
      eq(chatMessages.userId, userId),
      eq(chatMessages.tenantId, tenantId)
    ))
    .returning();

  return result;
}

export async function deleteMessages(messageIds: string[], userId: string, tenantId: string): Promise<ChatMessage[]> {
  return chatDb
    .delete(chatMessages)
    .where(and(
      inArray(chatMessages.messageId, messageIds),
      eq(chatMessages.userId, userId),
      eq(chatMessages.tenantId, tenantId)
    ))
    .returning();
}

export async function createChatProject(project: NewChatProject): Promise<ChatProject> {
  const [result] = await chatDb.insert(chatProjects).values(project).returning();
  return result;
}

export async function getChatProjects(userId: string, tenantId: string): Promise<ChatProject[]> {
  return chatDb
    .select()
    .from(chatProjects)
    .where(and(
      eq(chatProjects.userId, userId),
      eq(chatProjects.tenantId, tenantId)
    ))
    .orderBy(desc(chatProjects.createdAt));
}

export async function upsertConversationTag(tag: NewConversationTag): Promise<ConversationTag> {
  const [result] = await chatDb
    .insert(conversationTags)
    .values(tag)
    .onConflictDoUpdate({
      target: [conversationTags.tag, conversationTags.userId, conversationTags.tenantId],
      set: { conversationId: tag.conversationId },
    })
    .returning();

  return result;
}

export async function createToolCall(toolCall: NewToolCall): Promise<ToolCall> {
  const [result] = await chatDb.insert(toolCalls).values(toolCall).returning();
  return result;
}

export async function getToolCallsByConvo(conversationId: string, userId: string, tenantId: string): Promise<ToolCall[]> {
  return chatDb
    .select()
    .from(toolCalls)
    .where(and(
      eq(toolCalls.conversationId, conversationId),
      eq(toolCalls.userId, userId),
      eq(toolCalls.tenantId, tenantId)
    ))
    .orderBy(asc(toolCalls.createdAt));
}

export async function saveCheckpoint(checkpoint: NewChatCheckpoint): Promise<ChatCheckpoint> {
  const [result] = await chatDb.insert(chatCheckpoints).values(checkpoint).returning();
  return result;
}

export async function getCheckpoint(conversationId: string): Promise<ChatCheckpoint | null> {
  const [result] = await chatDb
    .select()
    .from(chatCheckpoints)
    .where(eq(chatCheckpoints.conversationId, conversationId))
    .limit(1);

  return result ?? null;
}

export async function deleteChatCheckpoints(conversationId: string): Promise<ChatCheckpoint[]> {
  return chatDb
    .delete(chatCheckpoints)
    .where(eq(chatCheckpoints.conversationId, conversationId))
    .returning();
}

export async function upsertConvo(data: NewChatConversation): Promise<ChatConversation> {
  const [result] = await chatDb
    .insert(chatConversations)
    .values(data)
    .onConflictDoUpdate({
      target: [chatConversations.conversationId],
      set: {
        title: data.title,
        agentId: data.agentId,
        isTemporary: data.isTemporary,
        tags: data.tags,
        chatProjectId: data.chatProjectId,
        files: data.files,
        expiredAt: data.expiredAt,
        pinned: data.pinned,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result;
}

export async function deleteToolCalls(conversationId: string | null, userId: string, tenantId: string): Promise<ToolCall[]> {
  const where = conversationId
    ? and(
        eq(toolCalls.conversationId, conversationId),
        eq(toolCalls.userId, userId),
        eq(toolCalls.tenantId, tenantId)
      )
    : and(
        eq(toolCalls.userId, userId),
        eq(toolCalls.tenantId, tenantId)
      );

  return chatDb
    .delete(toolCalls)
    .where(where)
    .returning();
}

export async function searchMessages(search: string, userId: string, tenantId: string, limit = 20): Promise<ChatMessage[]> {
  const tsquery = sql`websearch_to_tsquery('english', ${search})`;
  return chatDb
    .select()
    .from(chatMessages)
    .where(and(
      eq(chatMessages.userId, userId),
      eq(chatMessages.tenantId, tenantId),
      sql`to_tsvector('english', ${chatMessages.text} || ' ' || COALESCE(${chatMessages.content}::text, '')) @@ ${tsquery}`
    ))
    .orderBy(desc(sql`ts_rank(to_tsvector('english', ${chatMessages.text} || ' ' || COALESCE(${chatMessages.content}::text, '')), ${tsquery})`))
    .limit(limit);
}
