export { searchKnowledge, addKnowledgeDocument, getDocumentById, listDocuments, deleteDocument } from './service';
export const ragTools = [
  {
    name: 'search_knowledge',
    description: 'Search the Lemefy knowledge base for FINOS, FinOps, and cloud governance documentation',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', description: 'Filter by category (FinOps, Governance, Compliance, Metrics)' },
        source: { type: 'string', description: 'Filter by source (FINOS, FinOps Foundation, etc.)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'Max results' },
        threshold: { type: 'number', minimum: 0, maximum: 1, default: 0, description: 'Relevance threshold' },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_document',
    description: 'Add a document to the knowledge base',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID' },
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Document content' },
        source: { type: 'string', description: 'Document source' },
        category: { type: 'string', description: 'Document category' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Document tags' },
      },
      required: ['id', 'title', 'content', 'source', 'category'],
    },
  },
  {
    name: 'get_document',
    description: 'Get a document by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_documents',
    description: 'List documents with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category' },
        source: { type: 'string', description: 'Filter by source' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
    },
  },
  {
    name: 'delete_document',
    description: 'Delete a document from the knowledge base',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document ID' },
      },
      required: ['id'],
    },
  },
];