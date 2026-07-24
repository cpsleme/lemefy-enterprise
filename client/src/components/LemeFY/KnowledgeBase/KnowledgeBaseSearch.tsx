import { useState } from 'react';
import { useLocalize } from '~/hooks';
import { useQuery } from '@tanstack/react-query';
import { cn } from '~/utils';

function useKnowledgeSearch(params: {
  query: string;
  category?: string;
  source?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['lemefy', 'rag', 'search', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('query', params.query);
      if (params.category) searchParams.set('category', params.category);
      if (params.source) searchParams.set('source', params.source);
      if (params.limit) searchParams.set('limit', String(params.limit));
      const response = await fetch(`/api/lemefy/rag/search?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to search knowledge');
      return response.json();
    },
    enabled: params.query.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

function useListDocuments(params: { category?: string; source?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.source) searchParams.set('source', params.source);
  if (params.limit) searchParams.set('limit', String(params.limit));
  return useQuery({
    queryKey: ['lemefy', 'rag', 'documents', params],
    queryFn: async () => {
      const response = await fetch(`/api/lemefy/rag/documents?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to list documents');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

const CATEGORIES = ['FinOps', 'Governance', 'Compliance', 'Metrics', 'Security'];

export default function KnowledgeBaseSearch() {
  const localize = useLocalize();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search');

  const { data: searchResults, isLoading: searchLoading } = useKnowledgeSearch({
    query,
    category,
    limit: 10,
  });

  const { data: documents, isLoading: docsLoading } = useListDocuments({
    category,
    limit: 20,
  });

  return (
    <div className="lemefy-knowledge">
      <h3>{localize('Knowledge Base')}</h3>

      <div className="lemefy-knowledge-tabs">
        <button
          className={cn(
            'lemefy-tab-btn',
            activeTab === 'search' && 'lemefy-tab-btn-active',
          )}
          onClick={() => setActiveTab('search')}
        >
          {localize('Search')}
        </button>
        <button
          className={cn(
            'lemefy-tab-btn',
            activeTab === 'browse' && 'lemefy-tab-btn-active',
          )}
          onClick={() => setActiveTab('browse')}
        >
          {localize('Browse')}
        </button>
      </div>

      <div className="lemefy-knowledge-filters">
        <select value={category ?? ''} onChange={(e) => setCategory(e.target.value || undefined)}>
          <option value="">{localize('All Categories')}</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {activeTab === 'search' ? (
        <div className="lemefy-search-results">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={localize('Search FINOS, FinOps, governance knowledge...')}
            className="lemefy-search-input"
          />
          {searchLoading && <div className="lemefy-loading">{localize('Searching...')}</div>}
          {searchResults?.documents && (
            <ul className="lemefy-doc-list">
              {searchResults.documents.map((doc: any) => (
                <li key={doc.id} className="lemefy-doc-item">
                  <h4>{doc.title}</h4>
                  <p>{doc.content.slice(0, 200)}...</p>
                  <span className="lemefy-doc-source">{doc.source}</span>
                </li>
              ))}
            </ul>
          )}
          {!searchLoading && query.length >= 2 && searchResults?.totalResults === 0 && (
            <p>{localize('No results found')}</p>
          )}
        </div>
      ) : (
        <div className="lemefy-doc-list">
          {docsLoading && <div className="lemefy-loading">{localize('Loading documents...')}</div>}
          {documents?.documents && (
            <ul>
              {documents.documents.map((doc: any) => (
                <li key={doc.id} className="lemefy-doc-item">
                  <h4>{doc.title}</h4>
                  <p>{doc.content.slice(0, 200)}...</p>
                  <span className="lemefy-doc-source">{doc.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}