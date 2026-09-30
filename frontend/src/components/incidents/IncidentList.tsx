import IncidentCard, { type IncidentSummary } from './IncidentCard';

export function IncidentList({ items }: { items?: IncidentSummary[] }) {
  const list = items ?? [];
  if (list.length === 0) {
    return (
      <p className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md text-center font-body-sm text-on-surface-variant">
        No incidents yet.
      </p>
    );
  }
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
