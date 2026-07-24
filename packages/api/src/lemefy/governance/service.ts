import type {
  GovernancePolicy,
  GovernanceControl,
} from '../types';

interface ComplianceCheckResult {
  policyId: string;
  policyName: string;
  standard: 'FINOS' | 'NIST' | 'ISO27001' | 'SOC2';
  compliant: boolean;
  controls: {
    controlId: string;
    controlName: string;
    status: 'compliant' | 'non-compliant' | 'pending' | 'not-applicable';
    evidence?: string;
  }[];
  score: number;
  assessedAt: string;
}

const FINOS_STANDARDS: GovernancePolicy[] = [
  {
    id: 'finos-common-cloud-controls',
    name: 'Common Cloud Controls (C3)',
    description: 'FINOS Common Cloud Controls provide a taxonomy for cloud security and compliance.',
    standard: 'FINOS',
    category: 'Cloud Security',
    controls: [
      {
        id: 'c3-tagging',
        name: 'Resource Tagging',
        description: 'All cloud resources must have standardized tags for cost allocation and governance.',
        status: 'pending',
        lastAssessed: '',
        owner: '',
      },
      {
        id: 'c3-encryption',
        name: 'Encryption at Rest and in Transit',
        description: 'All data must be encrypted at rest and in transit using approved cipher suites.',
        status: 'pending',
        lastAssessed: '',
        owner: '',
      },
      {
        id: 'c3-iam',
        name: 'Identity and Access Management',
        description: 'IAM policies must follow least privilege principles with MFA enforcement.',
        status: 'pending',
        lastAssessed: '',
        owner: '',
      },
      {
        id: 'c3-logging',
        name: 'Audit Logging',
        description: 'All API calls and administrative actions must be logged and retained.',
        status: 'pending',
        lastAssessed: '',
        owner: '',
      },
      {
        id: 'c3-network',
        name: 'Network Security',
        description: 'Network segmentation, security groups, and firewall rules must be properly configured.',
        status: 'pending',
        lastAssessed: '',
        owner: '',
      },
    ],
    enabled: true,
    lastReviewed: '',
  },
  {
    id: 'finos-fluxnova',
    name: 'Fluxnova - Software Delivery',
    description: 'FINOS Fluxnova provides guidance on secure software delivery practices.',
    standard: 'FINOS',
    category: 'Software Delivery',
    controls: [
      {
        id: 'flux-ci-cd',
        name: 'CI/CD Pipeline Security',
        description: 'CI/CD pipelines must include security scanning and approval gates.',
        status: 'pending',
        lastAssessed: '',
        owner: '',
      },
      {
        id: 'flux-sbom',
        name: 'Software Bill of Materials',
        description: 'SBOM must be generated for all deployments.',
        status: 'pending',
        lastAssessed: '',
        owner: '',
      },
      {
        id: 'flux-secret-mgmt',
        name: 'Secret Management',
        description: 'Secrets must be managed through a centralized secret store, never in source code.',
        status: 'pending',
        lastAssessed: '',
        owner: '',
      },
    ],
    enabled: true,
    lastReviewed: '',
  },
];

function assessControl(control: GovernanceControl): GovernanceControl {
  if (!control.lastAssessed) {
    return { ...control, status: 'pending' };
  }
  if (control.evidence && control.evidence.length > 0) {
    return { ...control, status: 'compliant' };
  }
  return { ...control, status: 'non-compliant' };
}

function calculateScore(controls: GovernanceControl[]): number {
  if (controls.length === 0) return 0;
  const compliant = controls.filter((c) => c.status === 'compliant').length;
  const pending = controls.filter((c) => c.status === 'pending').length;
  return Math.round((compliant / controls.length) * 100);
}

export const governanceService = {
  async getPolicies(standard?: string): Promise<GovernancePolicy[]> {
    if (standard) {
      return FINOS_STANDARDS.filter((p) => p.standard === standard);
    }
    return FINOS_STANDARDS;
  },

  async getPolicy(id: string): Promise<GovernancePolicy | null> {
    return FINOS_STANDARDS.find((p) => p.id === id) ?? null;
  },

  async updateControl(
    policyId: string,
    controlId: string,
    updates: Partial<GovernanceControl>,
  ): Promise<GovernanceControl | null> {
    const policy = FINOS_STANDARDS.find((p) => p.id === policyId);
    if (!policy) return null;

    const control = policy.controls.find((c) => c.id === controlId);
    if (!control) return null;

    Object.assign(control, updates);
    return assessControl(control);
  },

  async checkCompliance(policyId: string): Promise<ComplianceCheckResult> {
    const policy = FINOS_STANDARDS.find((p) => p.id === policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const assessedControls = policy.controls.map(assessControl);
    const score = calculateScore(assessedControls);

    return {
      policyId: policy.id,
      policyName: policy.name,
      standard: policy.standard,
      compliant: score >= 80,
      controls: assessedControls.map((c) => ({
        controlId: c.id,
        controlName: c.name,
        status: c.status,
        evidence: c.evidence,
      })),
      score,
      assessedAt: new Date().toISOString(),
    };
  },

  async assessAllPolicies(): Promise<ComplianceCheckResult[]> {
    return Promise.all(
      FINOS_STANDARDS.map((policy) => this.checkCompliance(policy.id)),
    );
  },
};