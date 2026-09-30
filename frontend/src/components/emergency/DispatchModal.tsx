import { useEffect, useState } from 'react';
import { mockUnits } from '../../data/mockResources';
import { useUiStore } from '../../store/uiStore';

export interface DispatchModalProps {
  open: boolean;
  onClose?: () => void;
  onConfirm?: (unitId: string) => void;
  incidentId?: string;
}

export function DispatchModal({ open, onClose, onConfirm, incidentId = 'INC-2401' }: DispatchModalProps) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [unitId, setUnitId] = useState(mockUnits[0]?.id ?? 'UNIT-07');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const confirm = () => {
    onConfirm?.(unitId);
    pushToast(`${unitId} dispatched to ${incidentId}.`, 'success');
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/60 backdrop-blur-sm p-4 anim-fade-up" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Dispatch ${incidentId}`}>
      <div
        className="w-full max-w-[440px] rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-pop anim-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">DISPATCH MATRIX</p>
        <h3 className="section-title pt-1">Dispatch {incidentId}</h3>
        <p className="pt-1 font-body-md text-on-surface-variant">Assign the nearest available unit. The assignment is logged to the audit trail.</p>
        <label className="block pt-4">
          <span className="mb-1.5 block font-label-caps text-on-surface-variant">RESPONSE UNIT</span>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 font-data-mono-md text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
          >
            {mockUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id} · {u.type} · ETA {u.eta}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 pt-5">
          <button type="button" onClick={confirm} className="flex-1 rounded-lg bg-error px-4 py-2.5 font-label-caps text-on-error hover:bg-red-700 active:scale-[0.98] transition">
            CONFIRM DISPATCH
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-outline-variant px-4 py-2.5 font-label-caps text-on-surface-variant hover:border-on-surface-variant transition">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

export default DispatchModal;
