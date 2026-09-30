import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { incidentService } from '../../services/incidentService';
import { useUiStore } from '../../store/uiStore';

export interface DispatchModalProps {
  open: boolean;
  onClose?: () => void;
  onConfirm?: (unitId: string) => void;
  incidentId?: string;
}

export function DispatchModal({ open, onClose, onConfirm, incidentId = '' }: DispatchModalProps) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [unitId, setUnitId] = useState('');
  const [busy, setBusy] = useState(false);

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

  const confirm = async () => {
    const unit = unitId.trim();
    if (!unit || !incidentId) {
      pushToast('Enter a response unit ID to dispatch.', 'error');
      return;
    }
    setBusy(true);
    try {
      await incidentService.dispatch(incidentId);
      onConfirm?.(unit);
      pushToast(`${unit} dispatched to ${incidentId}.`, 'success');
      onClose?.();
    } catch {
      pushToast(`Dispatch failed — backend unreachable for ${incidentId}.`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-primary/60 backdrop-blur-sm p-4 anim-fade-up" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Dispatch ${incidentId}`}>
      <div
        className="w-full max-w-[440px] rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-pop anim-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="eyebrow">DISPATCH MATRIX</p>
        <h3 className="section-title pt-1">Dispatch {incidentId || '—'}</h3>
        <p className="pt-1 font-body-md text-on-surface-variant">Assign a response unit. The assignment is logged to the audit trail.</p>
        <label className="block pt-4">
          <span className="mb-1.5 block font-label-caps text-on-surface-variant">RESPONSE UNIT ID</span>
          <input
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            placeholder="e.g. UNIT-12"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 font-data-mono-md text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
          />
        </label>
        <div className="flex gap-2 pt-5">
          <button type="button" onClick={confirm} disabled={busy} className="flex-1 rounded-lg bg-error px-4 py-2.5 font-label-caps text-on-error hover:bg-red-700 active:scale-[0.98] transition disabled:opacity-50">
            {busy ? 'DISPATCHING…' : 'CONFIRM DISPATCH'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-outline-variant px-4 py-2.5 font-label-caps text-on-surface-variant hover:border-on-surface-variant transition">
            CANCEL
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default DispatchModal;
