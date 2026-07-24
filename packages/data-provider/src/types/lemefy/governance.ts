export interface LemefyGovernancePolicy {
  id: string;
  name: string;
  description: string;
  standard: 'FINOS' | 'NIST' | 'ISO27001' | 'SOC2';
  category: string;
  controls: GovernanceControl[];
  enabled: boolean;
  lastReviewed: string;
}

export interface GovernanceControl {
  id: string;
  name: string;
  description: string;
  status: 'compliant' | 'non-compliant' | 'pending' | 'not-applicable';
  evidence?: string;
  lastAssessed: string;
  owner: string;
}

export interface ComplianceCheckResult {
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