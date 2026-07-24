import type { DORAMetric, SPACEMetric } from '../types';

interface DeployEvent {
  id: string;
  timestamp: string;
  team: string;
  projectId: string;
  success: boolean;
  leadTimeHours: number;
  failureReason?: string;
  restoreTimeMinutes?: number;
}

interface DeveloperSurvey {
  team: string;
  period: string;
  satisfaction: number;
  productivity: number;
  flowEfficiency: number;
  responseTime: number;
}

const deployEvents: DeployEvent[] = [];
const surveys: DeveloperSurvey[] = [];

function calculateLeadTimeForChanges(team: string, periodStart: string, periodEnd: string): DORAMetric {
  const events = deployEvents.filter(
    (e) =>
      e.team === team &&
      e.timestamp >= periodStart &&
      e.timestamp <= periodEnd,
  );

  const avgLeadTime =
    events.length > 0
      ? events.reduce((sum, e) => sum + e.leadTimeHours, 0) / events.length
      : 0;

  let trend: DORAMetric['trend'] = 'stable';
  if (avgLeadTime < 1) trend = 'improving';
  else if (avgLeadTime > 24) trend = 'declining';

  return {
    name: 'Lead Time for Changes',
    value: parseFloat(avgLeadTime.toFixed(2)),
    unit: 'hours',
    trend,
    period: `${periodStart} to ${periodEnd}`,
  };
}

function calculateDeploymentFrequency(
  team: string,
  periodStart: string,
  periodEnd: string,
): DORAMetric {
  const events = deployEvents.filter(
    (e) =>
      e.team === team &&
      e.timestamp >= periodStart &&
      e.timestamp <= periodEnd,
  );

  const freq = events.length;
  let trend: DORAMetric['trend'] = 'stable';
  if (freq >= 1) trend = 'improving';
  else if (freq === 0) trend = 'declining';

  return {
    name: 'Deployment Frequency',
    value: freq,
    unit: 'deployments',
    trend,
    period: `${periodStart} to ${periodEnd}`,
  };
}

function calculateChangeFailureRate(
  team: string,
  periodStart: string,
  periodEnd: string,
): DORAMetric {
  const events = deployEvents.filter(
    (e) =>
      e.team === team &&
      e.timestamp >= periodStart &&
      e.timestamp <= periodEnd,
  );

  if (events.length === 0) {
    return {
      name: 'Change Failure Rate',
      value: 0,
      unit: 'percent',
      trend: 'stable',
      period: `${periodStart} to ${periodEnd}`,
    };
  }

  const failures = events.filter((e) => !e.success).length;
  const rate = (failures / events.length) * 100;

  let trend: DORAMetric['trend'] = 'stable';
  if (rate < 5) trend = 'improving';
  else if (rate > 15) trend = 'declining';

  return {
    name: 'Change Failure Rate',
    value: parseFloat(rate.toFixed(2)),
    unit: 'percent',
    trend,
    period: `${periodStart} to ${periodEnd}`,
  };
}

function calculateMTTR(
  team: string,
  periodStart: string,
  periodEnd: string,
): DORAMetric {
  const events = deployEvents.filter(
    (e) =>
      e.team === team &&
      e.timestamp >= periodStart &&
      e.timestamp <= periodEnd &&
      e.restoreTimeMinutes !== undefined,
  );

  if (events.length === 0) {
    return {
      name: 'Mean Time to Restore',
      value: 0,
      unit: 'minutes',
      trend: 'stable',
      period: `${periodStart} to ${periodEnd}`,
    };
  }

  const avgRestore =
    events.reduce((sum, e) => sum + (e.restoreTimeMinutes ?? 0), 0) / events.length;

  let trend: DORAMetric['trend'] = 'stable';
  if (avgRestore < 60) trend = 'improving';
  else if (avgRestore > 240) trend = 'declining';

  return {
    name: 'Mean Time to Restore',
    value: parseFloat(avgRestore.toFixed(2)),
    unit: 'minutes',
    trend,
    period: `${periodStart} to ${periodEnd}`,
  };
}

export const doraService = {
  async getMetrics(
    team: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<DORAMetric[]> {
    return [
      calculateLeadTimeForChanges(team, periodStart, periodEnd),
      calculateDeploymentFrequency(team, periodStart, periodEnd),
      calculateChangeFailureRate(team, periodStart, periodEnd),
      calculateMTTR(team, periodStart, periodEnd),
    ];
  },

  async recordDeployEvent(event: Omit<DeployEvent, 'id' | 'timestamp'>): Promise<DeployEvent> {
    const id = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const deployEvent: DeployEvent = {
      id,
      timestamp: new Date().toISOString(),
      ...event,
    };
    deployEvents.push(deployEvent);
    return deployEvent;
  },

  async getTeamPerformance(team: string) {
    const periodEnd = new Date().toISOString();
    const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return this.getMetrics(team, periodStart, periodEnd);
  },
};

export const spaceService = {
  async getMetrics(team: string, period: string): Promise<SPACEMetric[]> {
    const survey = surveys.find((s) => s.team === team && s.period === period);

    const defaultMetrics: SPACEMetric[] = [
      {
        name: 'Velocity',
        value: 75,
        unit: 'points/sprint',
        trend: 'stable',
        period,
      },
      {
        name: 'Load',
        value: 65,
        unit: 'load index',
        trend: 'stable',
        period,
      },
      {
        name: 'Stability',
        value: 80,
        unit: 'score',
        trend: 'stable',
        period,
      },
      {
        name: 'Time to Productivity',
        value: 5,
        unit: 'weeks',
        trend: 'stable',
        period,
      },
      {
        name: 'Feedback Loops',
        value: 3.5,
        unit: 'days',
        trend: 'stable',
        period,
      },
      {
        name: 'Team Happiness',
        value: survey?.satisfaction ?? 70,
        unit: 'score',
        trend: 'stable',
        period,
      },
    ];

    if (survey) {
      return defaultMetrics.map((m) => {
        if (m.name === 'Team Happiness') {
          return { ...m, value: survey.satisfaction, trend: survey.satisfaction >= 70 ? 'improving' : 'declining' };
        }
        if (m.name === 'Velocity') {
          return { ...m, value: survey.productivity, trend: survey.productivity >= 70 ? 'improving' : 'declining' };
        }
        if (m.name === 'Stability') {
          return { ...m, value: survey.flowEfficiency * 100, trend: survey.flowEfficiency >= 0.5 ? 'improving' : 'declining' };
        }
        return m;
      });
    }

    return defaultMetrics;
  },

  async recordSurvey(survey: Omit<DeveloperSurvey, 'responseTime'>) {
    surveys.push({ ...survey, responseTime: 0 });
  },
};