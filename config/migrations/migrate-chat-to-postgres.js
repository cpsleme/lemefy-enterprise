/**
 * Migration script: MongoDB chat data → PostgreSQL
 *
 * Usage:
 *   node config/migrations/migrate-chat-to-postgres.js
 *
 * Environment variables:
 *   MONGO_URI        - MongoDB connection string (default: mongodb://127.0.0.1:27017/Lemefy)
 *   POSTGRES_HOST    - PostgreSQL host (default: localhost)
 *   POSTGRES_PORT    - PostgreSQL port (default: 5432)
 *   POSTGRES_DB      - PostgreSQL database (default: lemefy)
 *   POSTGRES_USER    - PostgreSQL user (default: lemefy)
 *   POSTGRES_PASSWORD- PostgreSQL password (default: lemefy_password)
 *   BATCH_SIZE       - Number of records per batch (default: 100)
 */

require('dotenv').config();
const { Db, ObjectId } = require('mongodb');
const { Pool } = require('pg');
const { chatDb, saveConvo, saveMessage, createChatProject, upsertConversationTag, createToolCall } = require('@lemefy/data-schemas');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Lemefy';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;

const mongoClient = new Db(MONGO_URI);

async function migrate() {
  console.log('Starting chat migration from MongoDB to PostgreSQL...');

  // Connect to MongoDB
  const mongoDb = mongoClient.db();
  console.log('Connected to MongoDB');

  // Connect to PostgreSQL (Drizzle pool is lazily initialized)
  console.log('PostgreSQL connection configured via Drizzle');

  let totalConversations = 0;
  let totalMessages = 0;
  let totalProjects = 0;
  let totalTags = 0;
  let totalToolCalls = 0;

  try {
    // Migrate chat projects
    console.log('Migrating chat projects...');
    const projects = await mongoDb.collection('chatProjects').find({}).toArray();
    for (const project of projects) {
      await createChatProject({
        id: project._id.toString(),
        name: project.name,
        description: project.description || null,
        userId: project.userId?.toString() || project.user_id?.toString(),
        tenantId: project.tenantId?.toString() || 'default',
        color: project.color || '#3B82F6',
        icon: project.icon || 'folder',
        isArchived: String(project.isArchived ?? false),
      });
      totalProjects++;
    }
    console.log(`Migrated ${totalProjects} chat projects`);

    // Migrate conversations
    console.log('Migrating conversations...');
    const conversations = await mongoDb.collection('convos').find({}).toArray();
    for (const convo of conversations) {
      await saveConvo({
        conversationId: convo._id.toString(),
        title: convo.title || null,
        userId: convo.userId?.toString() || convo.user_id?.toString(),
        agentId: convo.agentId?.toString() || null,
        isTemporary: String(convo.isTemporary ?? false),
        tags: convo.tags || [],
        chatProjectId: convo.chatProjectId?.toString() || null,
        files: convo.files || [],
        expiredAt: convo.expiredAt ? new Date(convo.expiredAt) : null,
        tenantId: convo.tenantId?.toString() || 'default',
        pinned: String(convo.pinned ?? false),
      });
      totalConversations++;
    }
    console.log(`Migrated ${totalConversations} conversations`);

    // Migrate messages
    console.log('Migrating messages...');
    const messages = await mongoDb.collection('messages').find({}).toArray();
    for (const msg of messages) {
      await saveMessage({
        messageId: msg._id.toString(),
        conversationId: msg.conversationId?.toString(),
        userId: msg.userId?.toString() || msg.user_id?.toString(),
        model: msg.model || null,
        endpoint: msg.endpoint || null,
        sender: msg.sender || 'user',
        text: msg.text || null,
        feedback: msg.feedback || null,
        content: msg.content || null,
        threadId: msg.threadId?.toString() || null,
        metadata: msg.metadata || {},
        attachments: msg.attachments || [],
        expiredAt: msg.expiredAt ? new Date(msg.expiredAt) : null,
        tenantId: msg.tenantId?.toString() || 'default',
      });
      totalMessages++;
    }
    console.log(`Migrated ${totalMessages} messages`);

    // Migrate conversation tags
    console.log('Migrating conversation tags...');
    const tags = await mongoDb.collection('conversationTags').find({}).toArray();
    for (const tag of tags) {
      await upsertConversationTag({
        id: tag._id.toString(),
        tag: tag.tag,
        userId: tag.userId?.toString() || tag.user_id?.toString(),
        tenantId: tag.tenantId?.toString() || 'default',
        conversationId: tag.conversationId?.toString() || null,
      });
      totalTags++;
    }
    console.log(`Migrated ${totalTags} conversation tags`);

    // Migrate tool calls
    console.log('Migrating tool calls...');
    const toolCalls = await mongoDb.collection('toolCalls').find({}).toArray();
    for (const tc of toolCalls) {
      await createToolCall({
        id: tc._id.toString(),
        conversationId: tc.conversationId?.toString(),
        messageId: tc.messageId?.toString(),
        userId: tc.userId?.toString() || tc.user_id?.toString(),
        tenantId: tc.tenantId?.toString() || 'default',
        name: tc.name,
        arguments: tc.arguments || {},
        response: tc.response || null,
      });
      totalToolCalls++;
    }
    console.log(`Migrated ${totalToolCalls} tool calls`);

    console.log('\nMigration completed successfully!');
    console.log(`Total records migrated:`);
    console.log(`  - Projects: ${totalProjects}`);
    console.log(`  - Conversations: ${totalConversations}`);
    console.log(`  - Messages: ${totalMessages}`);
    console.log(`  - Tags: ${totalTags}`);
    console.log(`  - Tool Calls: ${totalToolCalls}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
  }
}

migrate().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
