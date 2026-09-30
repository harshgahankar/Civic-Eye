const RES = [
  { k: 'PATROL', avail: 8, total: 12 },
  { k: 'ESU', avail: 3, total: 5 },
  { k: 'EMS', avail: 5, total: 8 },
];

export function ResourceStatus() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant pb-space-sm">RESOURCE STATUS</p>
      <ul className="flex flex-col gap-space-xs">
        {RES.map((r) => (
          <li key={r.k} className="font-data-mono-md text-on-surface flex justify-between">
            <span>{r.k}</span>
            <span>{r.avail}/{r.total} AVAIL</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ResourceStatus;
