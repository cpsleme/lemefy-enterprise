import { createFinosCommonCloudControlsSource, createFinosFluxnovaSource, createFinosFocusSource, ingestDocuments, DEFAULT_FINOS_SOURCES } from '../rag/finos-ingestion.service';

jest.mock('../rag/service', () => ({
  addKnowledgeDocument: jest.fn(),
}));

import { addKnowledgeDocument } from '../rag/service';

describe('finos-ingestion service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createFinosCommonCloudControlsSource', () => {
    it('should return a valid document source with expected metadata', () => {
      const source = createFinosCommonCloudControlsSource();
      expect(source.id).toBe('finos-c3');
      expect(source.name).toBe('FINOS Common Cloud Controls');
      expect(source.category).toBe('Governance');
      expect(source.tags).toEqual(['FINOS', 'C3', 'cloud', 'security', 'compliance']);
      expect(typeof source.fetch).toBe('function');
    });

    it('should fetch multiple documents', async () => {
      const source = createFinosCommonCloudControlsSource();
      const docs = await source.fetch();
      expect(docs.length).toBeGreaterThan(0);
      for (const doc of docs) {
        expect(doc.title).toBeTruthy();
        expect(doc.content).toBeTruthy();
      }
    });
  });

  describe('createFinosFluxnovaSource', () => {
    it('should return a valid document source', () => {
      const source = createFinosFluxnovaSource();
      expect(source.id).toBe('finos-fluxnova');
      expect(source.name).toBe('FINOS Fluxnova - Software Delivery');
      expect(source.category).toBe('Software Delivery');
    });
  });

  describe('createFinosFocusSource', () => {
    it('should return a valid document source', () => {
      const source = createFinosFocusSource();
      expect(source.id).toBe('finos-focus');
      expect(source.name).toBe('FINOS FOCUS Specification');
      expect(source.category).toBe('FinOps');
    });
  });

  describe('DEFAULT_FINOS_SOURCES', () => {
    it('should contain exactly 3 sources', () => {
      expect(DEFAULT_FINOS_SOURCES).toHaveLength(3);
      expect(DEFAULT_FINOS_SOURCES.map(s => s.id)).toEqual(['finos-c3', 'finos-fluxnova', 'finos-focus']);
    });
  });

  describe('ingestDocuments', () => {
    it('should ingest all default sources and call addKnowledgeDocument for each', async () => {
      const docs = await ingestDocuments(DEFAULT_FINOS_SOURCES);
      expect(docs.length).toBeGreaterThan(0);
      expect(addKnowledgeDocument).toHaveBeenCalledTimes(docs.length);
    });

    it('should handle a filtered subset of sources', async () => {
      const docs = await ingestDocuments([createFinosFocusSource()]);
      expect(docs.length).toBeGreaterThan(0);
      expect(addKnowledgeDocument).toHaveBeenCalledTimes(docs.length);
      const titles = docs.map(d => d.source);
      expect(titles.every(t => t === 'FinOps Foundation')).toBe(true);
    });

    it('should continue ingesting even if one source throws', async () => {
      const failingSource = {
        id: 'failing-source',
        name: 'Failing Source',
        description: 'Test',
        category: 'Test',
        source: 'Test',
        tags: ['test'],
        fetch: async () => { throw new Error('network error'); },
      };
      const docs = await ingestDocuments([...DEFAULT_FINOS_SOURCES, failingSource]);
      expect(docs.length).toBeGreaterThan(0);
      expect(addKnowledgeDocument).toHaveBeenCalledTimes(docs.length);
    });
  });
});
