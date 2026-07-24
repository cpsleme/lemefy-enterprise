import { useState } from 'react';
import { useLocalize } from '~/hooks';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '~/data-provider';
import { cn } from '~/utils';
import type { FinOpsReport } from '~/data-provider/types';

function useFinOpsReport(params: {
  projectId?: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  return useQuery<FinOpsReport>({
    queryKey: ['lemefy', 'finops', 'report', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.projectId) searchParams.set('projectId', params.projectId);
      if (params.periodStart) searchParams.set('periodStart', params.periodStart);
      if (params.periodEnd) searchParams.set('periodEnd', params.periodEnd);
      const response = await fetch(`/api/lemefy/finops/report?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch FinOps report');
      return response.json();
    },
    enabled: !!params.projectId && !!params.periodStart && !!params.periodEnd,
    staleTime: 5 * 60 * 1000,
  });
}

function useFinOpsRecommendations(projectId: string) {
  return useQuery({
    queryKey: ['lemefy', 'finops', 'recommendations', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/lemefy/finops/recommendations?projectId=${encodeURIComponent(projectId)}`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

export default function FinOpsDashboard() {
  const localize = useLocalize();
  const [projectId, setProjectId] = useState('');
  const [periodStart, setPeriodStart] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  );
  const [periodEnd, setPeriodEnd] = useState(
    new Date().toISOString().split('T')[0],
  );

  const { data: report, isLoading: reportLoading } = useFinOpsReport({
    projectId,
    periodStart,
    periodEnd,
  });

  const { data: recommendations, isLoading: recsLoading } = useFinOpsRecommendations(projectId);

  if (!projectId) {
    return (
      <div className="lemefy-finops-empty">
        <p>{localize('Enter a project ID to view FinOps data')}</p>
      </div>
    );
  }

  return (
    <div className="lemefy-finops">
      <div className="lemefy-finops-filters">
        <label>{localize('Project ID')}</label>
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="proj-xxx"
        />
        <label>{localize('Period Start')}</label>
        <input
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
        />
        <label>{localize('Period End')}</label>
        <input
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
        />
      </div>

      {reportLoading ? (
        <div className="lemefy-loading">{localize('Loading FinOps report...')}</div>
      ) : report ? (
        <div className="lemefy-finops-report">
          <h3>{localize('Cost Report')}</h3>
          <div className="lemefy-finops-summary">
            <div className="lemefy-finops-stat">
              <span className="lemefy-stat-label">{localize('Total Cost')}</span>
              <span className="lemefy-stat-value">
                {report.currency} {report.totalCost.toLocaleString()}
              </span>
            </div>
            <div className="lemefy-finops-stat">
              <span className="lemefy-stat-label">{localize('Period')}</span>
              <span className="lemefy-stat-value">
                {report.periodStart} to {report.periodEnd}
              </span>
            </div>
            <div className="lemefy-finops-stat">
              <span className="lemefy-stat-label">{localize('Recommendations')}</span>
              <span className="lemefy-stat-value">{report.recommendations.length}</span>
            </div>
          </div>

          <h4>{localize('Cost Breakdown')}</h4>
          <table className="lemefy-cost-table">
            <thead>
              <tr>
                <th>{localize('Service')}</th>
                <th>{localize('Cost')}</th>
                <th>{localize('Unit')}</th>
              </tr>
            </thead>
            <tbody>
              {report.breakdown.map((item) => (
                <tr key={item.service}>
                  <td>{item.service}</td>
                  <td>
                    {item.currency} {item.cost.toLocaleString()}
                  </td>
                  <td>{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {report.recommendations.length > 0 && (
            <>
              <h4>{localize('Recommendations')}</h4>
              <ul className="lemefy-recommendations">
                {report.recommendations.map((rec) => (
                  <li key={rec.id} className={`lemefy-rec lemefy-rec-${rec.severity}`}>
                    <strong>{rec.title}</strong>
                    <p>{rec.description}</p>
                    <span>
                      {localize('Estimated savings')}: {rec.currency} {rec.estimatedSavings.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      {recsLoading && <div className="lemefy-loading">{localize('Loading recommendations...')}</div>}
    </div>
  );
}