export interface RagQueryResult {
  documents: RagDocument[];
  query: string;
  totalResults: number;
  latencyMs: number;
}

export interface RagDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface LemefyKnowledgeArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  tags: string[];
  embedding?: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}