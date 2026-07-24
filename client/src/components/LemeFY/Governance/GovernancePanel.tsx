import { useState } from 'react';
import { useLocalize } from '~/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '~/utils';

function useGovernancePolicies(standard?: string) {
  const searchParams = new URLSearchParams();
  if (standard) searchParams.set('standard', standard);
  return useQuery({
    queryKey: ['lemefy', 'governance', 'policies', standard],
    queryFn: async () => {
      const response = await fetch(`/api/lemefy/governance/policies?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch policies');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

function useComplianceCheck(policyId: string | null) {
  return useQuery({
    queryKey: ['lemefy', 'governance', 'compliance', policyId],
    queryFn: async () => {
      if (!policyId) return null;
      const response = await fetch(`/api/lemefy/governance/compliance/${encodeURIComponent(policyId)}`);
      if (!response.ok) throw new Error('Failed to check compliance');
      return response.json();
    },
    enabled: !!policyId,
    staleTime: 5 * 60 * 1000,
  });
}

function useUpdateControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      policyId,
      controlId,
      updates,
    }: {
      policyId: string;
      controlId: string;
      updates: Record<string, unknown>;
    }) => {
      const response = await fetch(
        `/api/lemefy/governance/policies/${encodeURIComponent(policyId)}/controls/${encodeURIComponent(controlId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        },
      );
      if (!response.ok) throw new Error('Failed to update control');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lemefy', 'governance'] });
    },
  });
}

const STATUS_COLORS: Record<string, string> = {
  compliant: 'green',
  'non-compliant': 'red',
  pending: 'yellow',
  'not-applicable': 'gray',
};

export default function GovernancePanel() {
  const localize = useLocalize();
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [filterStandard, setFilterStandard] = useState<string | undefined>();
  const { data: policies, isLoading } = useGovernancePolicies(filterStandard);
  const { data: compliance } = useComplianceCheck(selectedPolicy);
  const updateControl = useUpdateControl();

  const standards = ['FINOS', 'NIST', 'ISO27001', 'SOC2'];

  return (
    <div className="lemefy-governance">
      <h3>{localize('Governance & Compliance')}</h3>

      <div className="lemefy-governance-filters">
        {standards.map((std) => (
          <button
            key={std}
            className={cn(
              'lemefy-filter-btn',
              filterStandard === std && 'lemefy-filter-btn-active',
            )}
            onClick={() => setFilterStandard(filterStandard === std ? undefined : std)}
          >
            {std}
          </button>
        ))}
        <button
          className={cn(
            'lemefy-filter-btn',
            !filterStandard && 'lemefy-filter-btn-active',
          )}
          onClick={() => setFilterStandard(undefined)}
        >
          {localize('All')}
        </button>
      </div>

      {isLoading ? (
        <div className="lemefy-loading">{localize('Loading policies...')}</div>
      ) : (
        <div className="lemefy-governance-list">
          {policies?.policies?.map((policy: any) => (
            <div key={policy.id} className="lemefy-policy-card">
              <h4>{policy.name}</h4>
              <p>{policy.description}</p>
              <span className="lemefy-policy-standard">{policy.standard}</span>
              <button
                onClick={() => setSelectedPolicy(policy.id)}
                className="lemefy-policy-btn"
              >
                {localize('Check Compliance')}
              </button>
            </div>
          ))}
        </div>
      )}

      {compliance && (
        <div className="lemefy-compliance-result">
          <h4>{localize('Compliance Report')}: {compliance.policyName}</h4>
          <div className="lemefy-compliance-score">
            <span className="lemefy-score-label">{localize('Score')}</span>
            <span className={cn('lemefy-score-value', compliance.score >= 80 ? 'lemefy-score-pass' : 'lemefy-score-fail')}>
              {compliance.score}%
            </span>
          </div>
          <div className="lemefy-compliance-status">
            {compliance.compliant ? localize('Compliant') : localize('Non-Compliant')}
          </div>
          <table className="lemefy-controls-table">
            <thead>
              <tr>
                <th>{localize('Control')}</th>
                <th>{localize('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {compliance.controls.map((control: any) => (
                <tr key={control.controlId}>
                  <td>{control.controlName}</td>
                  <td>
                    <span
                      className={cn(
                        'lemefy-status-badge',
                        `lemefy-status-${STATUS_COLORS[control.status] ?? 'gray'}`,
                      )}
                    >
                      {control.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}