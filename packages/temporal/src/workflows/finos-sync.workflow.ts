import { defineWorkflow } from '@temporalio/workflow';
import { fetchRepoDocuments, upsertDocuments, recordSyncStatus } from './fetch-documents.activity';

export interface RepoMeta {
  id: string;
  name: string;
  url: string;
  branch: string;
  extensions: string[];
  category: string;
  tags: string[];
}

export interface Document {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface SyncResult {
  repoId: string;
  status: 'success' | 'failed';
  ingested: number;
  error?: string;
}

export const listReposQuery = defineQuery<RepoMeta[]>('listRepos');
export const getSyncStatusQuery = defineQuery<SyncResult[]>('getSyncStatus');

export const FinosFocusDailySync = defineWorkflow({
  id: 'finos-focus-daily-sync',
  description: 'Daily sync of FINOS/FOCUS documentation into the vectorized knowledge base',
  queryHandlers: {
    listRepos,
    getSyncStatus,
  },
});

const REPOS: RepoMeta[] = [
  {
    id: 'finos-ccc',
    name: 'FINOS Common Cloud Controls',
    url: 'https://github.com/finos/common-cloud-controls',
    branch: 'main',
    extensions: ['.md', '.yaml', '.yml', '.json'],
    category: 'Governance',
    tags: ['FINOS', 'CCC', 'cloud', 'security'],
  },
  {
    id: 'finos-calm',
    name: 'FINOS Architecture as Code (CALM)',
    url: 'https://github.com/finos/architecture-as-code',
    branch: 'main',
    extensions: ['.md', '.yaml', '.yml', '.json'],
    category: 'Architecture',
    tags: ['FINOS', 'CALM', 'architecture'],
  },
  {
    id: 'finos-aigf',
    name: 'FINOS AI Governance Framework',
    url: 'https://github.com/finos/ai-governance-framework',
    branch: 'main',
    extensions: ['.md', '.yaml', '.yml', '.json'],
    category: 'Governance',
    tags: ['FINOS', 'AIGF', 'AI', 'governance'],
  },
  {
    id: 'finops-focus',
    name: 'FinOps FOCUS Specification',
    url: 'https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec',
    branch: 'working_draft',
    extensions: ['.md', '.yaml', '.yml', '.json', '.html'],
    category: 'FinOps',
    tags: ['FinOps', 'FOCUS', 'cost', 'billing'],
  },
];

let syncStatus: SyncResult[] = [];

function listRepos(): RepoMeta[] {
  return REPOS;
}

function getSyncStatus(): SyncResult[] {
  return syncStatus;
}

export async function FinosFocusDailySyncWorkflow(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const repo of REPOS) {
    try {
      const documents = await fetchRepoDocuments(repo);
      const ingested = await upsertDocuments(documents);
      await recordSyncStatus(repo.id, 'success', ingested);
      results.push({ repoId: repo.id, status: 'success', ingested });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordSyncStatus(repo.id, 'failed', 0, message);
      results.push({ repoId: repo.id, status: 'failed', ingested: 0, error: message });
    }
  }

  syncStatus = results;
  return results;
}
