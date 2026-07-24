export interface DORAMetric {
  name: 'Lead Time for Changes' | 'Deployment Frequency' | 'Change Failure Rate' | 'Mean Time to Restore';
  value: number;
  unit: string;
  trend: 'improving' | 'stable' | 'declining';
  period: string;
}

export interface SPACEMetric {
  name: 'Velocity' | 'Load' | 'Stability' | 'Time to Productivity' | 'Feedback Loops' | 'Team Happiness';
  value: number;
  unit: string;
  trend: 'improving' | 'stable' | 'declining';
  period: string;
}