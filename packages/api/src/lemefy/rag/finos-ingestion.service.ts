import type { LemefyKnowledgeArticle } from '../types';
import { addKnowledgeDocument } from '../rag/service';

export interface DocumentSource {
  id: string;
  name: string;
  description: string;
  category: string;
  source: string;
  tags: string[];
  fetch(): Promise<Array<{ title: string; content: string }>>;
}

interface IngestedDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

function buildDocId(sourceId: string, index: number): string {
  return `${sourceId}-doc-${index}`;
}

async function ingestSource(source: DocumentSource): Promise<IngestedDocument[]> {
  const articles = await source.fetch();
  return articles.map((article, index) => ({
    id: buildDocId(source.id, index),
    title: article.title,
    content: article.content,
    source: source.source,
    category: source.category,
    tags: source.tags,
    metadata: {
      sourceId: source.id,
      sourceName: source.name,
      ingestedAt: new Date().toISOString(),
    },
  }));
}

export async function ingestDocuments(sources: DocumentSource[]): Promise<IngestedDocument[]> {
  const ingested: IngestedDocument[] = [];

  for (const source of sources) {
    try {
      const docs = await ingestSource(source);
      ingested.push(...docs);

      for (const doc of docs) {
        await addKnowledgeDocument({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          source: doc.source,
          category: doc.category,
          tags: doc.tags,
          metadata: doc.metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`[finos-ingestion] Failed to ingest source ${source.id}:`, error);
    }
  }

  return ingested;
}

export function createFinosCommonCloudControlsSource(): DocumentSource {
  return {
    id: 'finos-c3',
    name: 'FINOS Common Cloud Controls',
    description: 'FINOS C3 taxonomy for cloud resource tagging, encryption, IAM, logging, and network security.',
    category: 'Governance',
    source: 'FINOS Common Cloud Controls',
    tags: ['FINOS', 'C3', 'cloud', 'security', 'compliance'],
    fetch: async () => [
      {
        title: 'Common Cloud Controls: Resource Tagging',
        content: 'FINOS Common Cloud Controls (C3) define a taxonomy for cloud resource tagging. Resources must be tagged with cost center, environment, team, project, and compliance tags. Tagging enables cost allocation, governance, and auditability across multi-cloud environments.',
      },
      {
        title: 'Common Cloud Controls: Encryption Requirements',
        content: 'FINOS C3 requires all data to be encrypted at rest using AES-256 or equivalent, and in transit using TLS 1.2 or higher. Key management must use centralized KMS with rotation policies. Encryption is mandatory for all PII and regulated data.',
      },
      {
        title: 'Common Cloud Controls: IAM Best Practices',
        content: 'FINOS C3 IAM controls require least-privilege access, MFA for all human users, service account management, regular access reviews, and just-in-time elevation. IAM policies must be version-controlled and audited.',
      },
      {
        title: 'Common Cloud Controls: Audit Logging',
        content: 'FINOS C3 audit logging requires all API calls, administrative actions, and data access events to be captured. Logs must be immutable, retained for at least 1 year, and monitored for anomalies. Centralized log aggregation is required.',
      },
      {
        title: 'Common Cloud Controls: Network Security',
        content: 'FINOS C3 network security requires segmentation of environments, restrictive security groups, VPC peering controls, and egress filtering. Private subnets must be used for sensitive workloads. Network access must follow the principle of least privilege.',
      },
    ],
  };
}

export function createFinosFluxnovaSource(): DocumentSource {
  return {
    id: 'finos-fluxnova',
    name: 'FINOS Fluxnova - Software Delivery',
    description: 'FINOS Fluxnova guidance on secure software delivery, CI/CD, SBOM, and secret management.',
    category: 'Software Delivery',
    source: 'FINOS Fluxnova',
    tags: ['FINOS', 'Fluxnova', 'CI/CD', 'SBOM', 'secret-management'],
    fetch: async () => [
      {
        title: 'Fluxnova: CI/CD Pipeline Security',
        content: 'FINOS Fluxnova requires CI/CD pipelines to include security scanning, dependency checks, and approval gates. All pipeline steps must be auditable and secrets must be injected through secure vaults.',
      },
      {
        title: 'Fluxnova: Software Bill of Materials',
        content: 'FINOS Fluxnova mandates SBOM generation for all deployments. SBOMs must be in SPDX or CycloneDX format and published to the artifact registry. Components must be scanned for known vulnerabilities.',
      },
      {
        title: 'Fluxnova: Secret Management',
        content: 'FINOS Fluxnova requires secrets to be managed through centralized secret stores. Secrets must never be stored in source code, environment variables in plain text, or container images. Rotation policies must be enforced.',
      },
    ],
  };
}

export function createFinosFocusSource(): DocumentSource {
  return {
    id: 'finos-focus',
    name: 'FINOS FOCUS Specification',
    description: 'FinOps Open Cost and Usage Standard (FOCUS) for standardized cloud cost data collection and reporting.',
    category: 'FinOps',
    source: 'FinOps Foundation',
    tags: ['FinOps', 'FOCUS', 'cost-management', 'cloud-finops'],
    fetch: async () => [
      {
        title: 'FOCUS Specification Overview',
        content: 'The FOCUS specification (FinOps Open Cost and Usage Standard) defines how teams should collect, allocate, and report cloud costs. It provides a standardized data model for cost data that enables consistent reporting across organizations. FOCUS supports multi-cloud cost attribution and chargeback.',
      },
      {
        title: 'FOCUS Cost Attribution',
        content: 'FOCUS defines standard dimensions for cost attribution including service, account, project, department, and environment. These dimensions enable consistent cost allocation across cloud providers and support chargeback/showback models.',
      },
    ],
  };
}

export const DEFAULT_FINOS_SOURCES = [
  createFinosCommonCloudControlsSource(),
  createFinosFluxnovaSource(),
  createFinosFocusSource(),
];
