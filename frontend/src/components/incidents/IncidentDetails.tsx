import SeverityBadge, { type Severity } from './SeverityBadge';
import IncidentStatus, { type IncidentState } from './IncidentStatus';

export interface IncidentDossier {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentState;
  cam: string;
  time: string;
  narrative: string;
}

export function IncidentDetails({ dossier }: { dossier: IncidentDossier }) {
  const d: IncidentDossier = dossier;
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <div className="flex items-center gap-space-sm">
        <SeverityBadge level={d.severity} />
        <IncidentStatus status={d.status} />
        <span className="ml-auto font-data-mono-sm text-on-surface-variant">{d.id} · {d.cam} · {d.time}</span>
      </div>
      <h3 className="font-headline-lg text-on-surface pt-space-sm">{d.title}</h3>
      <div className="grid md:grid-cols-3 gap-space-md pt-space-md">
        <div className="border border-outline-variant rounded-sm p-space-sm">
          <p className="font-label-caps text-on-surface-variant">TIMELINE</p>
          <p className="font-body-sm text-on-surface">{d.time}</p>
        </div>
        <div className="border border-outline-variant rounded-sm p-space-sm">
          <p className="font-label-caps text-on-surface-variant">EVIDENCE</p>
          <p className="font-body-sm text-on-surface">See evidence ledger below</p>
        </div>
        <div className="border border-outline-variant rounded-sm p-space-sm">
          <p className="font-label-caps text-on-surface-variant">NARRATIVE</p>
          <p className="font-body-sm text-on-surface">{d.narrative}</p>
        </div>
      </div>
    </section>
  );
}

export default IncidentDetails;
