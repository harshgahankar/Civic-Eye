export type IncidentState = 'open' | 'ack' | 'dispatched' | 'resolved';

const MAP: Record<IncidentState, string> = {
  open: 'text-error border-error',
  ack: 'text-amber-600 border-amber-500',
  dispatched: 'text-secondary border-secondary',
  resolved: 'text-emerald-700 border-emerald-600',
};

export function IncidentStatus({ status }: { status: IncidentState }) {
  return (
    <span className={`font-label-caps px-space-sm py-0.5 border rounded-full uppercase ${MAP[status]}`}>
      {status}
    </span>
  );
}

export default IncidentStatus;
