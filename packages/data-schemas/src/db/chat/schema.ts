import { pgTable, text, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const chatConversations = pgTable('chat_conversations', {
  conversationId: text('conversation_id').notNull().primaryKey(),
  title: text('title'),
  userId: text('user_id').notNull(),
  agentId: text('agent_id'),
  isTemporary: text('is_temporary').default('false'),
  tags: jsonb('tags').default([]),
  chatProjectId: text('chat_project_id'),
  files: jsonb('files').default([]),
  expiredAt: timestamp('expired_at'),
  tenantId: text('tenant_id').notNull(),
  pinned: text('pinned').default('false'),
  createdAt: timestamp('created_at').default(sql`now()`),
  updatedAt: timestamp('updated_at').default(sql`now()`),
}, (table) => ({
  userIdIdx: index('chat_conversations_user_id_idx').on(table.userId),
  tenantIdIdx: index('chat_conversations_tenant_id_idx').on(table.tenantId),
  expiredAtIdx: index('chat_conversations_expired_at_idx').on(table.expiredAt),
  userTenantIdx: index('chat_conversations_user_tenant_idx').on(table.userId, table.tenantId),
  chatProjectIdIdx: index('chat_conversations_chat_project_id_idx').on(table.chatProjectId),
})) as any;

export const chatMessages = pgTable('chat_messages', {
  messageId: text('message_id').notNull(),
  conversationId: text('conversation_id').notNull(),
  userId: text('user_id').notNull(),
  model: text('model'),
  endpoint: text('endpoint'),
  sender: text('sender').notNull(),
  text: text('text'),
  feedback: text('feedback'),
  content: jsonb('content'),
  threadId: text('thread_id'),
  metadata: jsonb('metadata').default({}),
  attachments: jsonb('attachments').default([]),
  expiredAt: timestamp('expired_at'),
  tenantId: text('tenant_id').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`),
  updatedAt: timestamp('updated_at').default(sql`now()`),
}, (table) => ({
  pk: unique('chat_messages_pk').on(table.messageId, table.userId, table.tenantId),
  conversationIdIdx: index('chat_messages_conversation_id_idx').on(table.conversationId),
  userIdIdx: index('chat_messages_user_id_idx').on(table.userId),
  tenantIdIdx: index('chat_messages_tenant_id_idx').on(table.tenantId),
  threadIdIdx: index('chat_messages_thread_id_idx').on(table.threadId),
  userTenantIdx: index('chat_messages_user_tenant_idx').on(table.userId, table.tenantId),
  conversationUserIdx: index('chat_messages_conversation_user_idx').on(table.conversationId, table.userId),
})) as any;

export const chatProjects = pgTable('chat_projects', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  userId: text('user_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  color: text('color').default('#3B82F6'),
  icon: text('icon').default('folder'),
  isArchived: text('is_archived').default('false'),
  createdAt: timestamp('created_at').default(sql`now()`),
  updatedAt: timestamp('updated_at').default(sql`now()`),
}, (table) => ({
  userIdIdx: index('chat_projects_user_id_idx').on(table.userId),
  tenantIdIdx: index('chat_projects_tenant_id_idx').on(table.tenantId),
  userTenantIdx: index('chat_projects_user_tenant_idx').on(table.userId, table.tenantId),
})) as any;

export const conversationTags = pgTable('conversation_tags', {
  id: text('id').notNull().primaryKey(),
  tag: text('tag').notNull(),
  userId: text('user_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  conversationId: text('conversation_id'),
  createdAt: timestamp('created_at').default(sql`now()`),
}, (table) => ({
  tagUserTenantUnique: unique('conversation_tags_tag_user_tenant_unique').on(table.tag, table.userId, table.tenantId),
  userIdIdx: index('conversation_tags_user_id_idx').on(table.userId),
  tenantIdIdx: index('conversation_tags_tenant_id_idx').on(table.tenantId),
  conversationIdIdx: index('conversation_tags_conversation_id_idx').on(table.conversationId),
})) as any;

export const toolCalls = pgTable('tool_calls', {
  id: text('id').notNull().primaryKey(),
  conversationId: text('conversation_id').notNull(),
  messageId: text('message_id').notNull(),
  userId: text('user_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  arguments: jsonb('arguments').default({}),
  response: jsonb('response'),
  createdAt: timestamp('created_at').default(sql`now()`),
}, (table) => ({
  conversationIdIdx: index('tool_calls_conversation_id_idx').on(table.conversationId),
  messageIdIdx: index('tool_calls_message_id_idx').on(table.messageId),
  userIdIdx: index('tool_calls_user_id_idx').on(table.userId),
  tenantIdIdx: index('tool_calls_tenant_id_idx').on(table.tenantId),
})) as any;

export const chatCheckpoints = pgTable('chat_checkpoints', {
  id: text('id').notNull().primaryKey(),
  conversationId: text('conversation_id').notNull(),
  state: jsonb('state').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`),
}, (table) => ({
  conversationIdIdx: index('chat_checkpoints_conversation_id_idx').on(table.conversationId),
})) as any;

export type ChatConversation = typeof chatConversations.$inferSelect;
export type NewChatConversation = typeof chatConversations.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ChatProject = typeof chatProjects.$inferSelect;
export type NewChatProject = typeof chatProjects.$inferInsert;
export type ConversationTag = typeof conversationTags.$inferSelect;
export type NewConversationTag = typeof conversationTags.$inferInsert;
export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;
export type ChatCheckpoint = typeof chatCheckpoints.$inferSelect;
export type NewChatCheckpoint = typeof chatCheckpoints.$inferInsert;