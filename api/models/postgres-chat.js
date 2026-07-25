const { pgGetConvo, pgGetConvosByCursor, pgSaveConvo, pgDeleteConvos, pgSaveMessage, pgGetMessages, pgUpdateMessage, pgDeleteMessages, pgCreateChatProject, pgGetChatProjects, pgUpsertConversationTag, pgCreateToolCall, pgGetToolCallsByConvo } = require('@lemefy/data-schemas');

module.exports = {
  conversation: {
    getConvo: pgGetConvo,
    getConvosByCursor: pgGetConvosByCursor,
    upsertConvo: pgSaveConvo,
    deleteConvos: pgDeleteConvos,
    saveConvo: pgSaveConvo,
  },
  message: {
    getMessages: pgGetMessages,
    getMessagesByCursor: async (params) => {
      const messages = await pgGetMessages({
        conversationId: params.conversationId,
        user: params.user,
        limit: params.limit,
        cursor: params.cursor,
      });
      return { messages, nextCursor: null };
    },
    saveMessage: pgSaveMessage,
    updateMessage: pgUpdateMessage,
    deleteMessages: pgDeleteMessages,
    searchMessages: async (query, filter, hydrate) => {
      const userId = typeof filter === 'string' ? filter.replace('user = "', '').replace('"', '') : filter?.filter?.userId;
      const tenantId = filter?.tenantId || 'default';
      const hits = await require('@lemefy/data-schemas').searchMessages(query, userId, tenantId, 20);
      return { hits, query, processingTimeMs: 0, limit: 20, offset: 0, estimatedTotalHits: hits.length };
    },
  },
  chatProject: {
    createChatProject: pgCreateChatProject,
    getChatProjects: pgGetChatProjects,
  },
  conversationTag: {
    upsertConversationTag: pgUpsertConversationTag,
  },
  toolCall: {
    createToolCall: pgCreateToolCall,
    getToolCallsByConvo: pgGetToolCallsByConvo,
    deleteToolCalls: async (userId, conversationId) => pgDeleteConvos(conversationId ? { conversationId } : {}, userId),
  },
};
