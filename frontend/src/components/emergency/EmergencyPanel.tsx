const ROWS = [
  { unit: 'UNIT-07', type: 'ESU', eta: '3 MIN', state: 'EN ROUTE' },
  { unit: 'UNIT-12', type: 'PATROL', eta: '5 MIN', state: 'STAGED' },
  { unit: 'MED-03', type: 'EMS', eta: '7 MIN', state: 'STANDBY' },
];

export function EmergencyPanel() {
  return (
    <section className="bg-surface-container-lowest border border-error/40 rounded-sm p-space-md">
      <div className="flex items-center justify-between">
        <h3 className="font-headline-md text-error">DISPATCH MATRIX</h3>
        <span className="font-label-caps bg-error text-on-error px-space-sm py-0.5 rounded-full">INC-2401</span>
      </div>
      <ul className="pt-space-sm flex flex-col gap-space-xs">
        {ROWS.map((r) => (
          <li key={r.unit} className="flex items-center gap-space-sm border border-outline-variant rounded-sm px-space-sm py-space-xs font-data-mono-md text-on-surface">
            <span>{r.unit}</span>
            <span className="text-on-surface-variant">{r.type}</span>
            <span className="ml-auto">{r.eta}</span>
            <span className="font-label-caps text-secondary">{r.state}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default EmergencyPanel;
