import type { LemefyKnowledgeArticle } from '../types';

interface RagDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

interface RagQueryResult {
  documents: RagDocument[];
  query: string;
  totalResults: number;
  latencyMs: number;
}

interface RagSearchOptions {
  query: string;
  category?: string;
  source?: string;
  tags?: string[];
  limit?: number;
  threshold?: number;
}

class InMemoryVectorStore {
  private documents: Map<string, RagDocument>;
  private embeddings: Map<string, number[]>;

  constructor() {
    this.documents = new Map();
    this.embeddings = new Map();
  }

  insert(doc: RagDocument, embedding?: number[]): void {
    this.documents.set(doc.id, doc);
    if (embedding) {
      this.embeddings.set(doc.id, embedding);
    }
  }

  search(options: RagSearchOptions): RagDocument[] {
    let results = Array.from(this.documents.values());

    if (options.category) {
      results = results.filter((d) => d.category === options.category);
    }
    if (options.source) {
      results = results.filter((d) => d.source === options.source);
    }
    if (options.tags && options.tags.length > 0) {
      results = results.filter((d) =>
        options.tags!.some((tag) => d.tags.includes(tag)),
      );
    }

    if (options.query) {
      const queryTerms = options.query.toLowerCase().split(/\s+/);
      results.sort((a, b) => {
        const aScore = this.relevanceScore(a, queryTerms);
        const bScore = this.relevanceScore(b, queryTerms);
        return bScore - aScore;
      });
    }

    const limit = options.limit ?? 10;
    const threshold = options.threshold ?? 0;

    return results
      .filter((_) => threshold <= 0)
      .slice(0, limit);
  }

  private relevanceScore(doc: RagDocument, terms: string[]): number {
    const content = doc.content.toLowerCase();
    const title = doc.title.toLowerCase();
    let score = 0;

    for (const term of terms) {
      if (title.includes(term)) score += 3;
      if (content.includes(term)) score += 1;
    }

    return score;
  }

  getAll(): RagDocument[] {
    return Array.from(this.documents.values());
  }

  delete(id: string): boolean {
    this.documents.delete(id);
    this.embeddings.delete(id);
    return true;
  }
}

const vectorStore = new InMemoryVectorStore();

const FINOS_DOCUMENTS: RagDocument[] = [
  {
    id: 'finos-c3-tagging',
    title: 'Common Cloud Controls: Resource Tagging',
    content: 'FINOS Common Cloud Controls (C3) define a taxonomy for cloud resource tagging. Resources must be tagged with cost center, environment, team, project, and compliance tags. Tagging enables cost allocation, governance, and auditability across multi-cloud environments.',
    source: 'FINOS Common Cloud Controls',
    category: 'FinOps',
    tags: ['FINOS', 'C3', 'tagging', 'cloud', 'cost-allocation'],
    metadata: { standard: 'FINOS', version: '1.0' },
  },
  {
    id: 'finos-c3-encryption',
    title: 'Common Cloud Controls: Encryption Requirements',
    content: 'FINOS C3 requires all data to be encrypted at rest using AES-256 or equivalent, and in transit using TLS 1.2 or higher. Key management must use centralized KMS with rotation policies. Encryption is mandatory for all PII and regulated data.',
    source: 'FINOS Common Cloud Controls',
    category: 'FinOps',
    tags: ['FINOS', 'C3', 'encryption', 'security'],
    metadata: { standard: 'FINOS', version: '1.0' },
  },
  {
    id: 'finos-c3-iam',
    title: 'Common Cloud Controls: IAM Best Practices',
    content: 'FINOS C3 IAM controls require least-privilege access, MFA for all human users, service account management, regular access reviews, and just-in-time elevation. IAM policies must be version-controlled and audited.',
    source: 'FINOS Common Cloud Controls',
    category: 'Governance',
    tags: ['FINOS', 'C3', 'IAM', 'security', 'access-control'],
    metadata: { standard: 'FINOS', version: '1.0' },
  },
  {
    id: 'finos-c3-logging',
    title: 'Common Cloud Controls: Audit Logging',
    content: 'FINOS C3 audit logging requires all API calls, administrative actions, and data access events to be captured. Logs must be immutable, retained for at least 1 year, and monitored for anomalies. Centralized log aggregation is required.',
    source: 'FINOS Common Cloud Controls',
    category: 'Compliance',
    tags: ['FINOS', 'C3', 'logging', 'audit', 'compliance'],
    metadata: { standard: 'FINOS', version: '1.0' },
  },
  {
    id: 'finos-c3-network',
    title: 'Common Cloud Controls: Network Security',
    content: 'FINOS C3 network security requires segmentation of environments, restrictive security groups, VPC peering controls, and egress filtering. Private subnets must be used for sensitive workloads. Network access must follow the principle of least privilege.',
    source: 'FINOS Common Cloud Controls',
    category: 'Security',
    tags: ['FINOS', 'C3', 'networking', 'security'],
    metadata: { standard: 'FINOS', version: '1.0' },
  },
  {
    id: 'finops-fokus',
    title: 'FinOps FOCUS Specification',
    content: 'The FOCUS specification (FinOps Open Cost and Usage Standard) defines how teams should collect, allocate, and report cloud costs. It provides a standardized data model for cost data that enables consistent reporting across organizations. FOCUS supports multi-cloud cost attribution and chargeback.',
    source: 'FinOps Foundation',
    category: 'FinOps',
    tags: ['FinOps', 'FOCUS', 'cost-management', 'cloud-finops'],
    metadata: { standard: 'FinOps', version: '1.0' },
  },
  {
    id: 'finops-optimization',
    title: 'FinOps Cost Optimization Best Practices',
    content: 'Key FinOps cost optimization strategies include: 1) Right-sizing compute resources based on utilization metrics, 2) Leveraging reserved instances and savings plans for predictable workloads, 3) Implementing auto-scaling to match demand, 4) Using storage tiering for infrequently accessed data, 5) Setting up budget alerts and anomaly detection, 6) Tagging resources for cost allocation.',
    source: 'FinOps Foundation',
    category: 'FinOps',
    tags: ['FinOps', 'optimization', 'cost-savings', 'best-practices'],
    metadata: { standard: 'FinOps', version: '1.0' },
  },
  {
    id: 'finops-budget-alerts',
    title: 'FinOps Budget Management and Alerting',
    content: 'FinOps practices recommend setting up budgets at the project, team, and cost-center level. Budget alerts should be configured at 50%, 80%, and 100% thresholds. Anomaly detection systems should flag unexpected cost spikes within 24 hours. Regular cost reviews should be conducted monthly.',
    source: 'FinOps Foundation',
    category: 'FinOps',
    tags: ['FinOps', 'budget', 'alerts', 'cost-monitoring'],
    metadata: { standard: 'FinOps', version: '1.0' },
  },
  {
    id: 'dora-metrics',
    title: 'DORA Metrics for Engineering Performance',
    content: 'DORA (DevOps Research and Assessment) metrics are the four key indicators of software delivery and operational performance: 1) Lead Time for Changes - time from commit to production, 2) Deployment Frequency - how often code is deployed, 3) Change Failure Rate - percentage of deployments causing failures, 4) Mean Time to Restore (MTTR) - time to recover from failures. High-performing teams target deploy on-demand, <1hr lead time, <5% failure rate, <1hr MTTR.',
    source: 'Google DevOps Research',
    category: 'Metrics',
    tags: ['DORA', 'metrics', 'engineering', 'performance', 'devops'],
    metadata: { version: '1.0' },
  },
  {
    id: 'space-metrics',
    title: 'SPACE Framework for Developer Experience',
    content: 'The SPACE framework measures developer experience across five dimensions: 1) Satisfaction and well-being, 2) Performance (achieving goals), 3) Activity (fitness for purpose), 4) Communication and collaboration, 5) Efficiency and flow. These metrics complement DORA by focusing on the human side of engineering performance.',
    source: 'Microsoft Research',
    category: 'Metrics',
    tags: ['SPACE', 'metrics', 'developer-experience', 'well-being'],
    metadata: { version: '1.0' },
  },
];

function seedDocuments(): void {
  for (const doc of FINOS_DOCUMENTS) {
    vectorStore.insert(doc);
  }
}

seedDocuments();

export async function searchKnowledge(
  options: RagSearchOptions,
): Promise<RagQueryResult> {
  const startTime = Date.now();

  const documents = vectorStore.search(options);

  const latencyMs = Date.now() - startTime;

  return {
    documents,
    query: options.query,
    totalResults: documents.length,
    latencyMs,
  };
}

export async function addKnowledgeDocument(
  doc: LemefyKnowledgeArticle,
): Promise<void> {
  vectorStore.insert({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    source: doc.source,
    category: doc.category,
    tags: doc.tags,
    metadata: doc.metadata,
  });
}

export async function getDocumentById(id: string): Promise<RagDocument | null> {
  return vectorStore.getAll().find((d) => d.id === id) ?? null;
}

export async function listDocuments(params: {
  category?: string;
  source?: string;
  limit?: number;
}): Promise<RagDocument[]> {
  let docs = vectorStore.getAll();
  if (params.category) {
    docs = docs.filter((d) => d.category === params.category);
  }
  if (params.source) {
    docs = docs.filter((d) => d.source === params.source);
  }
  return docs.slice(0, params.limit ?? 50);
}

export async function deleteDocument(id: string): Promise<boolean> {
  return vectorStore.delete(id);
}