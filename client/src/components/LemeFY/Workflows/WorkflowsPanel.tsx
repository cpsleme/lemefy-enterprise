import { useState } from 'react';
import { useLocalize } from '~/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '~/utils';

function usePrefectFlows(limit?: number) {
  const searchParams = new URLSearchParams();
  if (limit) searchParams.set('limit', String(limit));
  return useQuery({
    queryKey: ['lemefy', 'workflows', 'flows', limit],
    queryFn: async () => {
      const response = await fetch(`/api/lemefy/workflows/flows?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch flows');
      return response.json();
    },
    staleTime: 30 * 1000,
  });
}

function usePrefectRuns(params: {
  deploymentId?: string;
  status?: string;
  limit?: number;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.deploymentId) searchParams.set('deploymentId', params.deploymentId);
  if (params.status) searchParams.set('status', params.status);
  if (params.limit) searchParams.set('limit', String(params.limit));
  return useQuery({
    queryKey: ['lemefy', 'workflows', 'runs', params],
    queryFn: async () => {
      const response = await fetch(`/api/lemefy/workflows/runs?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch runs');
      return response.json();
    },
    staleTime: 10 * 1000,
  });
}

function useTriggerFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      deploymentId,
      parameters,
      wait,
    }: {
      deploymentId: string;
      parameters?: Record<string, unknown>;
      wait?: boolean;
    }) => {
      const response = await fetch(
        `/api/lemefy/workflows/flows/${encodeURIComponent(deploymentId)}/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parameters, wait }),
        },
      );
      if (!response.ok) throw new Error('Failed to trigger flow');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lemefy', 'workflows'] });
    },
  });
}

export default function WorkflowsPanel() {
  const localize = useLocalize();
  const { data: flows, isLoading: flowsLoading } = usePrefectFlows();
  const { data: runs, isLoading: runsLoading } = usePrefectRuns();
  const triggerFlow = useTriggerFlow();
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [waitForCompletion, setWaitForCompletion] = useState(false);
  const [parameters, setParameters] = useState('{}');

  return (
    <div className="lemefy-workflows">
      <h3>{localize('Workflow Orchestration (Prefect)')}</h3>

      <div className="lemefy-workflows-layout">
        <div className="lemefy-flows-list">
          <h4>{localize('Deployments')}</h4>
          {flowsLoading && <div className="lemefy-loading">{localize('Loading flows...')}</div>}
          {flows?.content?.map((flow: any) => (
            <div key={flow.id} className="lemefy-flow-item">
              <strong>{flow.name}</strong>
              <span className="lemefy-flow-status">{flow.status}</span>
              <button
                onClick={() => {
                  setSelectedDeployment(flow.id);
                  setParameters('{}');
                }}
              >
                {localize('Trigger')}
              </button>
            </div>
          ))}
        </div>

        {selectedDeployment && (
          <div className="lemefy-flow-detail">
            <h4>{localize('Trigger Flow')}</h4>
            <label>{localize('Deployment ID')}</label>
            <input type="text" value={selectedDeployment} readOnly />
            <label>{localize('Parameters (JSON)')}</label>
            <textarea
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              rows={4}
            />
            <label>
              <input
                type="checkbox"
                checked={waitForCompletion}
                onChange={(e) => setWaitForCompletion(e.target.checked)}
              />
              {localize('Wait for completion')}
            </label>
            <button
              onClick={() => {
                let parsedParams;
                try {
                  parsedParams = JSON.parse(parameters);
                } catch {
                  parsedParams = {};
                }
                triggerFlow.mutate({
                  deploymentId: selectedDeployment,
                  parameters: parsedParams,
                  wait: waitForCompletion,
                });
              }}
              disabled={triggerFlow.isPending}
            >
              {triggerFlow.isPending ? localize('Running...') : localize('Run Flow')}
            </button>
          </div>
        )}
      </div>

      <div className="lemefy-runs-section">
        <h4>{localize('Recent Runs')}</h4>
        {runsLoading && <div className="lemefy-loading">{localize('Loading runs...')}</div>}
        {runs?.content?.map((run: any) => (
          <div key={run.id} className="lemefy-run-item">
            <span className={`lemefy-run-status lemefy-run-status-${run.status}`}>
              {run.status}
            </span>
            <span>{run.deploymentId}</span>
            <span>{run.startTime ?? 'N/A'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}