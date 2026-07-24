import { defineActivity } from '@temporalio/workflow';

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

export const fetchRepoDocuments = defineActivity({
  name: 'fetchRepoDocuments',
  description: 'Fetch documents from a GitHub repository using the GitHub API',
  retry: {
    initialInterval: '5s',
    maximumInterval: '60s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
}, async (repo: RepoMeta): Promise<Document[]> => {
  const apiUrl = `${repo.url}/git/trees/${repo.branch}?recursive=1`;
  const treeResponse = await fetch(apiUrl, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (!treeResponse.ok) {
    throw new Error(`GitHub API error for ${repo.name}: ${treeResponse.status}`);
  }
  const tree = await treeResponse.json();
  const items = (tree.tree || []).filter((item: any) => item.type === 'blob');

  const documents: Document[] = [];
  for (const item of items) {
    const path = item.path as string;
    const ext = path.split('.').pop()?.toLowerCase() || '';
    if (!repo.extensions.includes(`.${ext}`)) continue;
    if (path.split('/').some((part) => part.startsWith('.') || part === '.git')) continue;

    const fileUrl = `${repo.url}/raw/${repo.branch}/${path}`;
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) continue;

    const content = await fileResponse.text();
    const id = Buffer.from(`${repo.id}:${path}`).toString('base64').slice(0, 32);

    documents.push({
      id,
      title: `${repo.name} - ${path}`,
      content,
      source: repo.name,
      category: repo.category,
      tags: repo.tags,
      metadata: {
        repo: repo.url,
        branch: repo.branch,
        path,
        extension: `.${ext}`,
        ingestedAt: new Date().toISOString(),
      },
    });
  }

  return documents;
});
