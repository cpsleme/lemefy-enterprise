import { useState } from 'react';
import { useLocalize } from '~/hooks';
import { useQuery } from '@tanstack/react-query';
import { cn } from '~/utils';

function useDorametrics(
  team: string,
  periodStart: string,
  periodEnd: string,
) {
  const searchParams = new URLSearchParams();
  searchParams.set('team', team);
  searchParams.set('periodStart', periodStart);
  searchParams.set('periodEnd', periodEnd);
  return useQuery({
    queryKey: ['lemefy', 'metrics', 'dora', team, periodStart, periodEnd],
    queryFn: async () => {
      const response = await fetch(`/api/lemefy/metrics/dora?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch DORA metrics');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

function useSpaceMetrics(team: string, period: string) {
  const searchParams = new URLSearchParams();
  searchParams.set('team', team);
  searchParams.set('period', period);
  return useQuery({
    queryKey: ['lemefy', 'metrics', 'space', team, period],
    queryFn: async () => {
      const response = await fetch(`/api/lemefy/metrics/space?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch SPACE metrics');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

const TREND_ICONS: Record<string, string> = {
  improving: '↑',
  stable: '→',
  declining: '↓',
};

export default function MetricsPanel() {
  const localize = useLocalize();
  const [team, setTeam] = useState('default');
  const [period, setPeriod] = useState('30d');

  const periodStart = new Date(
    Date.now() - (period === '7d' ? 7 : period === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000,
  ).toISOString();
  const periodEnd = new Date().toISOString();

  const { data: doraData, isLoading: doraLoading } = useDorametrics(team, periodStart, periodEnd);
  const { data: spaceData, isLoading: spaceLoading } = useSpaceMetrics(team, period);

  const doraMetrics = doraData?.metrics ?? [];
  const spaceMetrics = spaceData?.metrics ?? [];

  return (
    <div className="lemefy-metrics">
      <h3>{localize('Engineering Metrics')}</h3>

      <div className="lemefy-metrics-filters">
        <label>{localize('Team')}</label>
        <input type="text" value={team} onChange={(e) => setTeam(e.target.value)} />
        <label>{localize('Period')}</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      <div className="lemefy-metrics-section">
        <h4>DORA Metrics</h4>
        {doraLoading && <div className="lemefy-loading">{localize('Loading DORA metrics...')}</div>}
        {doraMetrics.length > 0 && (
          <div className="lemefy-metrics-grid">
            {doraMetrics.map((metric: any) => (
              <div key={metric.name} className="lemefy-metric-card">
                <h5>{metric.name}</h5>
                <div className="lemefy-metric-value">
                  {metric.value} {metric.unit}
                </div>
                <div
                  className={cn(
                    'lemefy-metric-trend',
                    `lemefy-trend-${metric.trend}`,
                  )}
                >
                  {TREND_ICONS[metric.trend] ?? '→'} {metric.trend}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lemefy-metrics-section">
        <h4>SPACE Metrics</h4>
        {spaceLoading && <div className="lemefy-loading">{localize('Loading SPACE metrics...')}</div>}
        {spaceMetrics.length > 0 && (
          <div className="lemefy-metrics-grid">
            {spaceMetrics.map((metric: any) => (
              <div key={metric.name} className="lemefy-metric-card">
                <h5>{metric.name}</h5>
                <div className="lemefy-metric-value">
                  {metric.value} {metric.unit}
                </div>
                <div
                  className={cn(
                    'lemefy-metric-trend',
                    `lemefy-trend-${metric.trend}`,
                  )}
                >
                  {TREND_ICONS[metric.trend] ?? '→'} {metric.trend}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}