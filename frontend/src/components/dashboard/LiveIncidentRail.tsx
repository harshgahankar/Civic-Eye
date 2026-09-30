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

const sevDot: Record<RailIncident['severity'], string> = {
  critical: 'bg-error',
  high: 'bg-amber-500',
  medium: 'bg-secondary',
};

export function LiveIncidentRail() {
  return (
    <section aria-label="Live dossier stream" className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <div className="flex items-center justify-between pb-space-sm">
        <h3 className="font-headline-md text-on-surface">DOSSIER STREAM</h3>
        <Link to="/incidents" className="font-label-caps text-secondary">VIEW ALL →</Link>
      </div>
      <ul className="flex flex-col gap-space-sm">
        {ITEMS.map((i) => (
          <li key={i.id} className="border border-outline-variant rounded-sm p-space-sm">
            <div className="flex items-center gap-space-sm">
              <span className={`w-2 h-2 rounded-full ${sevDot[i.severity]}`} />
              <p className="font-data-mono-md text-on-surface">{i.id} · {i.cam}</p>
              <span className="ml-auto font-data-mono-sm text-on-surface-variant">{i.time}</span>
            </div>
            <p className="font-body-md text-on-surface py-space-xs">{i.title}</p>
            <div className="flex gap-space-sm pt-space-xs">
              <button className="font-label-caps px-space-sm py-1 bg-error text-on-error rounded-sm">INTERCEPT</button>
              <Link to={`/incidents/${i.id}`} className="font-label-caps px-space-sm py-1 border border-secondary text-secondary rounded-sm">DETAILS</Link>
              <button className="font-label-caps px-space-sm py-1 border border-outline text-on-surface-variant rounded-sm">ACKNOWLEDGE</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default LiveIncidentRail;
