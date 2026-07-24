import { defineActivity } from '@temporalio/workflow';

export interface Document {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export const upsertDocuments = defineActivity({
  name: 'upsertDocuments',
  description: 'Upsert documents into the RAG API',
  retry: {
    initialInterval: '5s',
    maximumInterval: '60s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
}, async (documents: Document[]): Promise<number> => {
  if (documents.length === 0) return 0;

  const response = await fetch(process.env.RAG_API_URL || 'http://localhost:8000/documents', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(documents),
  });

  if (!response.ok) {
    throw new Error(`RAG API error: ${response.status}`);
  }

  return documents.length;
});
