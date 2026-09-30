import { useUiStore } from '../../store/uiStore';
import { downloadCSV, stamp } from '../../utils/actions';

export const TRACK_STAGES = [
  { cam: 'CAM-07 · JUNCTION A', t: '08:42:10Z', n: 'SUBJECT-442 ACQUIRED' },
  { cam: 'CAM-08 · JUNCTION B', t: '08:44:02Z', n: 'HANDOFF · VECTOR EAST' },
  { cam: 'CAM-01 · EXPRESSWAY', t: '08:47:31Z', n: 'RE-ACQUIRED · CONF 0.91' },
];

/** Shared cross-camera trail body. Embedded in Live Cameras + the /tracking view. */
export function TrackingSection() {
  const pushToast = useUiStore((s) => s.pushToast);

  const exportTrail = () => {
    downloadCSV(
      `civiceye_trail_subject442_${stamp()}`,
      ['STAGE', 'CAMERA', 'TIME', 'EVENT'],
      TRACK_STAGES.map((s, i) => [`0${i + 1}`, s.cam, s.t, s.n]),
    );
    pushToast('Subject trail exported to CSV.', 'success');
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5 anim-fade-up">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary-container px-4 py-3 shadow-card">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-blue-200">
          <span className="material-symbols-outlined text-[20px]">route</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-label-caps text-slate-400">TRACK PANEL · SUBJECT-442</p>
          <p className="font-data-mono-md text-white">STATE: HELD · 96 FRAMES · 3 CAMERAS</p>
        </div>
        <button
          type="button"
          onClick={exportTrail}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 font-label-caps text-white hover:bg-blue-700 active:scale-[0.98] transition"
        >
          <span className="material-symbols-outlined text-[16px]">file_download</span>
          EXPORT TRAIL
        </button>
      </div>
      <ol className="flex flex-col gap-2">
        {TRACK_STAGES.map((s, i) => (
          <li key={s.cam} className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface px-3.5 py-3 transition hover:shadow-card">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-data-mono-md font-bold text-secondary">0{i + 1}</span>
            <div className="min-w-0">
              <p className="truncate font-label-caps text-on-surface">{s.cam}</p>
              <p className="truncate font-data-mono-sm text-on-surface-variant">{s.t} · {s.n}</p>
            </div>
            {i < TRACK_STAGES.length - 1 && <span className="material-symbols-outlined ml-auto text-on-surface-variant">arrow_downward</span>}
          </li>
        ))}
      </ol>
      <p className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 font-data-mono-sm text-on-surface-variant">
        CAMERA HISTORY · CAM-07 → CAM-08 → CAM-01 · GAP 0 FRAMES
      </p>
    </div>
  );
}

export default TrackingSection;
