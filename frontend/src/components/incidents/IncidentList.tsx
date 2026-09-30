import IncidentCard, { type IncidentSummary } from './IncidentCard';

const DEFAULTS: IncidentSummary[] = [
  { id: 'INC-2401', title: 'Unattended baggage — Times Sq', severity: 'critical', status: 'open', cam: 'CAM-07', time: '14:02:11Z' },
  { id: 'INC-2400', title: 'Crowd surge — Herald Sq', severity: 'high', status: 'dispatched', cam: 'CAM-12', time: '13:58:44Z' },
  { id: 'INC-2399', title: 'Loitering cluster — Penn Stn', severity: 'medium', status: 'ack', cam: 'CAM-03', time: '13:51:02Z' },
];

export function IncidentList({ items }: { items?: IncidentSummary[] }) {
  const list = items ?? DEFAULTS;
  return (
    <ul className="flex flex-col gap-space-sm">
      {list.map((i) => (
        <li key={i.id}>
          <IncidentCard incident={i} />
        </li>
      ))}
    </ul>
  );
}

export default IncidentList;
