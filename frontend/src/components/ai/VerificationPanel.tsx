export function VerificationPanel() {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant">HUMAN VERIFICATION</p>
      <p className="font-body-md text-on-surface py-space-xs">Confirm machine finding before dispatch. All actions are logged.</p>
      <div className="flex gap-space-sm">
        <button className="font-label-caps px-space-md py-2 bg-emerald-700 text-white rounded-sm">VERIFY TRUE</button>
        <button className="font-label-caps px-space-md py-2 border border-error text-error rounded-sm">MARK FALSE</button>
        <button className="font-label-caps px-space-md py-2 border border-outline text-on-surface-variant rounded-sm">ESCALATE</button>
      </div>
    </section>
  );
}

export default VerificationPanel;
