import { useState } from 'react';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import FinOpsDashboard from './FinOps/FinOpsDashboard';
import GovernancePanel from './Governance/GovernancePanel';
import KnowledgeBaseSearch from './KnowledgeBase/KnowledgeBaseSearch';
import WorkflowsPanel from './Workflows/WorkflowsPanel';
import ProjectsPanel from './Projects/ProjectsPanel';
import MetricsPanel from './Metrics/MetricsPanel';

const LEMEFY_TABS = [
  { id: 'finops', label: 'FinOps', icon: 'dollar-sign' },
  { id: 'governance', label: 'Governance', icon: 'shield' },
  { id: 'knowledge', label: 'Knowledge Base', icon: 'book' },
  { id: 'workflows', label: 'Workflows', icon: 'play' },
  { id: 'projects', label: 'Projects', icon: 'list' },
  { id: 'metrics', label: 'Metrics', icon: 'chart' },
] as const;

type LemefyTab = (typeof LEMEFY_TABS)[number]['id'];

interface LemefyPanelProps {
  className?: string;
  defaultTab?: LemefyTab;
}

export default function LemefyPanel({ className, defaultTab = 'finops' }: LemefyPanelProps) {
  const localize = useLocalize();
  const [activeTab, setActiveTab] = useState<LemefyTab>(defaultTab);

  return (
    <div className={cn('lemefy-panel', className)}>
      <div className="lemefy-panel-tabs" role="tablist">
        {LEMEFY_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-label={localize(tab.label)}
            className={cn(
              'lemefy-tab',
              activeTab === tab.id && 'lemefy-tab-active',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="lemefy-panel-content" role="tabpanel">
        {activeTab === 'finops' && <FinOpsDashboard />}
        {activeTab === 'governance' && <GovernancePanel />}
        {activeTab === 'knowledge' && <KnowledgeBaseSearch />}
        {activeTab === 'workflows' && <WorkflowsPanel />}
        {activeTab === 'projects' && <ProjectsPanel />}
        {activeTab === 'metrics' && <MetricsPanel />}
      </div>
    </div>
  );
}