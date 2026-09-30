import { useState } from 'react';
import { useUiStore } from '../../store/uiStore';

type Verdict = 'true' | 'false' | 'escalated' | null;

const BANNERS: Record<Exclude<Verdict, null>, string> = {
  true: 'Finding confirmed — queued for dispatch logging.',
  false: 'Marked as false positive — model feedback recorded.',
  escalated: 'Escalated to watch commander for review.',
};

export function VerificationPanel() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [verdict, setVerdict] = useState<Verdict>(null);

  const decide = (v: Exclude<Verdict, null>) => {
    setVerdict(v);
    pushToast(
      v === 'true' ? 'Finding verified as TRUE.' : v === 'false' ? 'Finding marked FALSE.' : 'Finding escalated.',
      v === 'false' ? 'error' : 'success',
    );
  };

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card sm:p-5">
      <p className="eyebrow">Human verification</p>
      <p className="pt-1 font-body-md text-on-surface">Confirm machine finding before dispatch. All actions are logged.</p>
      {verdict ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
          <p className="flex-1 font-body-sm font-medium text-emerald-800">{BANNERS[verdict]}</p>
          <button
            type="button"
            onClick={() => setVerdict(null)}
            className="font-label-caps text-emerald-700 hover:text-emerald-900 transition"
          >
            RE-REVIEW
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 pt-3">
          <button type="button" onClick={() => decide('true')} className="rounded-lg bg-emerald-700 px-4 py-2 font-label-caps text-white hover:bg-emerald-800 active:scale-[0.98] transition">VERIFY TRUE</button>
          <button type="button" onClick={() => decide('false')} className="rounded-lg border border-error/50 px-4 py-2 font-label-caps text-error hover:bg-red-50 transition">MARK FALSE</button>
          <button type="button" onClick={() => decide('escalated')} className="rounded-lg border border-outline-variant px-4 py-2 font-label-caps text-on-surface-variant hover:border-on-surface-variant transition">ESCALATE</button>
        </div>
      )}
    </section>
  );
}

export default VerificationPanel;
