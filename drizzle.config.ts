import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/data-schemas/src/db/chat/schema.ts',
  out: './packages/data-schemas/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || 'postgres://lemefy:lemefy_password@localhost:5432/lemefy',
  },
  tablesFilter: ['chat_*', 'conversation_tags', 'tool_calls'],
});
