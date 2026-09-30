import { useEffect, useRef, useState } from 'react';

export interface CCTVPlayerProps {
  src: string;
  label?: string;
}

function fmt(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = Math.floor(totalSecs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CCTVPlayer({ src, label = 'REPLAY' }: CCTVPlayerProps) {
  const DURATION = 131; // 02:11 clip
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(32);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setPos((p) => {
        if (p >= DURATION) {
          setPlaying(false);
          return DURATION;
        }
        return p + 1;
      });
    }, 1000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing]);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-primary-container shadow-card">
      <div className="flex items-center justify-between px-3.5 pt-3">
        <p className="font-label-caps text-slate-300">{label}</p>
        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-white hover:bg-blue-700 transition"
        >
          <span className="material-symbols-outlined text-[20px]">{playing ? 'pause' : 'play_arrow'}</span>
        </button>
      </div>
      <div className="relative mx-3.5 mt-2 aspect-video overflow-hidden rounded-lg">
        <img src={src} alt="CCTV replay" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        {!playing && (
          <span className="absolute inset-0 flex items-center justify-center bg-primary/30">
            <span className="rounded-full bg-primary/70 px-2 py-1 font-data-mono-sm text-white backdrop-blur-sm">PAUSED</span>
          </span>
        )}
      </div>
      <div className="px-3.5 pb-3.5 pt-2">
        <input
          type="range"
          aria-label="Scrub replay"
          min={0}
          max={DURATION}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="w-full accent-[#2563eb]"
        />
        <div className="flex justify-between font-data-mono-sm tabular-nums text-slate-300">
          <span>{fmt(pos)}</span>
          <span>{fmt(DURATION)}</span>
        </div>
      </div>
    </div>
  );
}

export default CCTVPlayer;
