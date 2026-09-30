import type { IncidentSeverity } from '../types/incident';

export const severityColor: Record<IncidentSeverity, string> = {
  critical: 'bg-error text-on-primary',
  high: 'bg-error-container text-on-surface',
  medium: 'bg-secondary-container text-on-surface',
  low: 'bg-surface-container-high text-on-surface',
};

export const severityDot: Record<IncidentSeverity, string> = {
  critical: 'bg-error',
  high: 'bg-error',
  medium: 'bg-secondary',
  low: 'bg-outline-variant',
};

export function severityLabel(s: IncidentSeverity): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
