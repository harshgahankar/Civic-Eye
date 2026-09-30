import { Link } from 'react-router-dom';
import SeverityBadge, { type Severity } from './SeverityBadge';
import IncidentStatus, { type IncidentState } from './IncidentStatus';

export interface IncidentSummary {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentState;
  cam: string;
  time: string;
}

export function IncidentCard({ incident }: { incident: IncidentSummary }) {
  return (
    <article className="border border-outline-variant rounded-sm p-space-sm bg-surface-container-lowest">
      <div className="flex items-center gap-space-sm">
        <SeverityBadge level={incident.severity} />
        <IncidentStatus status={incident.status} />
        <span className="ml-auto font-data-mono-sm text-on-surface-variant">{incident.time}</span>
      </div>
      <h4 className="font-headline-md text-on-surface pt-space-xs">{incident.title}</h4>
      <p className="font-data-mono-sm text-on-surface-variant">{incident.id} · {incident.cam}</p>
      <Link to={`/incidents/${incident.id}`} className="inline-block mt-space-sm font-label-caps text-secondary border border-secondary rounded-sm px-space-sm py-1">
        OPEN DOSSIER →
      </Link>
    </article>
  );
}

export default IncidentCard;
