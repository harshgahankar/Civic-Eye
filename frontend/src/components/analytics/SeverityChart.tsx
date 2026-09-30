export interface SeveritySeg {
  k: string;
  v: number;
  c: string;
}

const STROKE: Record<string, string> = {
  CRITICAL: '#ba1a1a',
  HIGH: '#f59e0b',
  MEDIUM: '#436086',
  LOW: '#94a3b8',
};

export function SeverityChart({ segs = [] }: { segs?: SeveritySeg[] }) {
  const total = segs.reduce((n, s) => n + s.v, 0);
  const R = 34;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = segs.filter((s) => s.v > 0).map((s) => {
    const frac = total === 0 ? 0 : s.v / total;
    const seg = { ...s, dash: frac * C, offset: -acc * C, frac };
    acc += frac;
    return seg;
  });
  const top = [...segs].sort((a, b) => b.v - a.v)[0];
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md">
      <p className="font-label-caps text-on-surface-variant">SEVERITY MIX</p>
      {total === 0 ? (
        <p className="py-4 text-center font-body-sm text-on-surface-variant">No severity data yet.</p>
      ) : (
        <div className="flex items-center gap-space-md pt-space-sm">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-0" role="img" aria-label={`Severity mix, ${total} total`}>
              <circle cx="50" cy="50" r={R} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="14" className="text-on-surface-variant" />
              {arcs.map((s) => (
                <circle
                  key={s.k}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke={STROKE[s.k] ?? '#436086'}
                  strokeWidth="14"
                  strokeDasharray={`${s.dash} ${C - s.dash}`}
                  strokeDashoffset={s.offset}
                  transform="rotate(-90 50 50)"
                >
                  <title>{s.k}: {s.v} ({Math.round(s.frac * 100)}%)</title>
                </circle>
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline-md leading-none text-on-surface">{total}</span>
              <span className="font-data-mono-sm text-on-surface-variant">TOTAL</span>
            </div>
          </div>
          <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
            {arcs.map((s) => (
              <li key={s.k} className="flex items-center gap-2 font-data-mono-sm text-on-surface-variant">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STROKE[s.k] ?? '#436086' }} />
                <span className="truncate">{s.k}</span>
                <span className="ml-auto shrink-0 tabular-nums text-on-surface">{s.v} · {Math.round(s.frac * 100)}%</span>
              </li>
            ))}
            {top && top.v > 0 && (
              <li className="pt-1 font-data-mono-sm text-on-surface-variant">
                DOMINANT: <span className="font-semibold text-on-surface">{top.k}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

export default SeverityChart;
