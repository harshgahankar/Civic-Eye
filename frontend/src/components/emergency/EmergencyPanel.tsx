import { useState } from 'react';
import { useUiStore } from '../../store/uiStore';

const ROWS = [
  { unit: 'UNIT-07', type: 'ESU', eta: '3 MIN', state: 'EN ROUTE' },
  { unit: 'UNIT-12', type: 'PATROL', eta: '5 MIN', state: 'STAGED' },
  { unit: 'MED-03', type: 'EMS', eta: '7 MIN', state: 'STANDBY' },
];

export function EmergencyPanel({ onDispatch }: { onDispatch?: (unitId: string) => void }) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [paged, setPaged] = useState<Set<string>>(new Set());

  const page = (unit: string) => {
    if (onDispatch) {
      onDispatch(unit);
      return;
    }
    setPaged((p) => new Set(p).add(unit));
    pushToast(`${unit} paged for immediate response.`, 'info');
  };

  return (
    <section className="rounded-xl border border-red-200 bg-surface-container-lowest p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-headline-md text-error">DISPATCH MATRIX</h3>
        <span className="rounded-full bg-error px-2.5 py-0.5 font-label-caps text-on-error">INC-2401</span>
      </div>
      <ul className="flex flex-col gap-2 pt-3">
        {ROWS.map((r) => {
          const done = paged.has(r.unit);
          return (
            <li key={r.unit} className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 font-data-mono-md text-on-surface">
              <span className="font-semibold">{r.unit}</span>
              <span className="text-on-surface-variant">{r.type}</span>
              <span className="ml-auto tabular-nums">{r.eta}</span>
              <span className="hidden font-label-caps text-secondary sm:inline">{done ? 'PAGED ✓' : r.state}</span>
              <button
                type="button"
                disabled={done && !onDispatch}
                onClick={() => page(r.unit)}
                className="rounded-lg bg-primary-container px-2.5 py-1 font-label-caps text-white hover:bg-secondary disabled:opacity-50 disabled:pointer-events-none transition"
              >
                {done && !onDispatch ? 'PAGED' : 'PAGE'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default EmergencyPanel;
