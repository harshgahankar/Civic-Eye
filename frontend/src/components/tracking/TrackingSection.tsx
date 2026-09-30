import { useEffect, useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import { backend } from '../../services/backend';
import { downloadCSV, stamp } from '../../utils/actions';

interface TrailStage {
  cam: string;
  t: string;
  n: string;
}

/** Cross-camera trail built from live backend behavior events. */
export function TrackingSection() {
  const pushToast = useUiStore((s) => s.pushToast);
  const [stages, setStages] = useState<TrailStage[]>([]);

  useEffect(() => {
    let live = true;
    backend.recentBehavior(60)
      .then((events) => {
        if (!live) return;
        const seen = new Map<string, (typeof events)[number]>();
        for (const e of events) {
          const key = `${e.camera_id}::${e.behavior_type}`;
          if (!seen.has(key)) seen.set(key, e);
        }
        setStages([...seen.values()].slice(0, 6).map((e) => ({
          cam: e.camera_id,
          t: new Date(e.timestamp * 1000).toISOString().substring(11, 19),
          n: `${e.behavior_type} · score ${e.score.toFixed(2)}`,
        })));
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const exportTrail = () => {
    downloadCSV(
      `civiceye_trail_${stamp()}`,
      ['STAGE', 'CAMERA', 'TIME', 'EVENT'],
      stages.map((s, i) => [`0${i + 1}`, s.cam, s.t, s.n]),
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
          <p className="font-label-caps text-slate-400">TRACK PANEL · LIVE BEHAVIOR TRAIL</p>
          <p className="font-data-mono-md text-white">STATE: TRACKING · {stages.length} STAGES</p>
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
      {stages.length === 0 ? (
        <p className="rounded-xl border border-outline-variant bg-surface px-4 py-6 text-center font-body-sm text-on-surface-variant">
          No behavior trail yet — run a processing job to populate cross-camera events.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {stages.map((s, i) => (
            <li key={`${s.cam}-${s.t}-${i}`} className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface px-3.5 py-3 transition hover:shadow-card">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-data-mono-md font-bold text-secondary">0{i + 1}</span>
              <div className="min-w-0">
                <p className="truncate font-label-caps text-on-surface">{s.cam}</p>
                <p className="truncate font-data-mono-sm text-on-surface-variant">{s.t} · {s.n}</p>
              </div>
              {i < stages.length - 1 && <span className="material-symbols-outlined ml-auto text-on-surface-variant">arrow_downward</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default TrackingSection;
