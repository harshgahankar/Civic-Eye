import { Link } from 'react-router-dom';

interface RailIncident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  cam: string;
  time: string;
}

const ITEMS: RailIncident[] = [
  { id: 'INC-2401', title: 'Unattended baggage — Times Sq', severity: 'critical', cam: 'CAM-07', time: '14:02:11Z' },
  { id: 'INC-2400', title: 'Crowd surge — Herald Sq', severity: 'high', cam: 'CAM-12', time: '13:58:44Z' },
  { id: 'INC-2399', title: 'Loitering cluster — Penn Stn', severity: 'medium', cam: 'CAM-03', time: '13:51:02Z' },
];

const sev: Record<RailIncident['severity'], { dot: string; ring: string; label: string }> = {
  critical: { dot: 'bg-error', ring: 'border-l-error', label: 'CRITICAL' },
  high: { dot: 'bg-amber-500', ring: 'border-l-amber-500', label: 'HIGH' },
  medium: { dot: 'bg-secondary', ring: 'border-l-secondary', label: 'MEDIUM' },
};

export function LiveIncidentRail() {
  return (
    <section aria-label="Live dossier stream" className="card card-pad flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div>
          <p className="eyebrow">Live queue</p>
          <h3 className="section-title text-[22px]">Dossier Stream</h3>
        </div>
        <Link to="/incidents" className="rounded-lg px-2.5 py-1.5 font-label-caps text-secondary hover:bg-blue-50 transition">
          VIEW ALL →
        </Link>
      </div>
      <ul className="flex flex-1 flex-col gap-2.5">
        {ITEMS.map((i) => (
          <li
            key={i.id}
            className={`rounded-xl border border-outline-variant border-l-4 ${sev[i.severity].ring} bg-surface p-3 transition-all hover:shadow-card hover:-translate-y-px`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${sev[i.severity].dot}`} />
              <p className="font-data-mono-md font-semibold text-on-surface">{i.id} · {i.cam}</p>
              <span className="ml-auto font-data-mono-sm text-on-surface-variant">{i.time}</span>
            </div>
            <p className="py-1.5 font-body-md font-medium text-on-surface">{i.title}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button className="rounded-lg bg-error px-2.5 py-1 font-label-caps text-on-error hover:bg-red-700 transition">INTERCEPT</button>
              <Link to={`/incidents/${i.id}`} className="rounded-lg border border-secondary/40 px-2.5 py-1 font-label-caps text-secondary hover:bg-blue-50 transition">DETAILS</Link>
              <button className="rounded-lg border border-outline-variant px-2.5 py-1 font-label-caps text-on-surface-variant hover:border-on-surface-variant transition">ACK</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default LiveIncidentRail;
