export interface DispatchModalProps {
  open: boolean;
  onClose?: () => void;
  incidentId?: string;
}

export function DispatchModal({ open, onClose, incidentId = 'INC-2401' }: DispatchModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/60" role="dialog" aria-modal="true">
      <div className="w-[420px] bg-surface-container-lowest border border-outline-variant rounded-sm p-space-lg">
        <h3 className="font-headline-md text-on-surface">DISPATCH {incidentId}</h3>
        <p className="font-body-md text-on-surface-variant py-space-sm">Assign nearest unit? This is a stub — wire to dispatch service.</p>
        <div className="flex gap-space-sm">
          <button className="font-label-caps px-space-md py-2 bg-error text-on-error rounded-sm">CONFIRM DISPATCH</button>
          <button onClick={onClose} className="font-label-caps px-space-md py-2 border border-outline rounded-sm text-on-surface-variant">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

export default DispatchModal;
