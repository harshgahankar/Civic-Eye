export type Severity = 'critical' | 'high' | 'medium' | 'low';

const MAP: Record<Severity, string> = {
  critical: 'bg-error text-on-error',
  high: 'bg-amber-500 text-on-primary',
  medium: 'bg-secondary text-on-primary',
  low: 'bg-surface-container-high text-on-surface-variant',
};

export function SeverityBadge({ level }: { level: Severity }) {
  return (
    <span className={`font-label-caps px-space-sm py-0.5 rounded-full uppercase ${MAP[level]}`}>
      {level}
    </span>
  );
}

export default SeverityBadge;
