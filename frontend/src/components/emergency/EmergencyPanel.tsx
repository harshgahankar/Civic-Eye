import { useState } from 'react';
import { useUiStore } from '../../store/uiStore';

export function EmergencyPanel({ onDispatch, incidentId = '' }: { onDispatch?: (unitId: string) => void; incidentId?: string }) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [paged, setPaged] = useState<Set<string>>(new Set());

  // No response-unit registry exists in the backend: paging is operator-side
  // only (no invented units). The panel renders an empty state until units
  // are integrated.
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
        {incidentId && (
          <span className="rounded-full bg-error px-2.5 py-0.5 font-label-caps text-on-error">{incidentId}</span>
        )}
      </div>
      {paged.size === 0 ? (
        <p className="pt-3 font-body-sm text-on-surface-variant">
          No response units registered. Use dispatch to assign a unit by ID.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 pt-3">
          {[...paged].map((unit) => (
            <li key={unit} className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 font-data-mono-md text-on-surface">
              <span className="font-semibold">{unit}</span>
              <span className="ml-auto font-label-caps text-secondary">PAGED ✓</span>
              <button
                type="button"
                onClick={() => page(unit)}
                className="rounded-lg bg-primary-container px-2.5 py-1 font-label-caps text-white hover:bg-secondary transition"
              >
                PAGE
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default EmergencyPanel;
