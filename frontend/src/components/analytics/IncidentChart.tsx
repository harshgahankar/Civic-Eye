function pts(data: number[], h: number, w: number): string {
  if (data.length < 2) return '';
  const max = Math.max(...data, 1);
  return data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
}

function coords(data: number[], h: number, w: number): [number, number][] {
  const max = Math.max(...data, 1);
  return data.map((v, i) => [
    (i / Math.max(data.length - 1, 1)) * w,
    h - (v / max) * (h - 4),
  ]);
}

export interface IncidentSeries {
  reported?: number[];
  verified?: number[];
  rangeLabel?: string;
  labels?: string[];
}

export function IncidentChart({ reported = [], verified = [], rangeLabel = 'LIVE', labels = [] }: IncidentSeries) {
  const H = 100;
  const W = 300;
  const rep = coords(reported, H, W);
  const ver = coords(verified, H, W);
  const peak = Math.max(0, ...reported);
  const total = reported.reduce((n, v) => n + v, 0);
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-label-caps text-on-surface-variant">INCIDENTS · {rangeLabel}</p>
        <p className="flex items-center gap-3 font-data-mono-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-[#436086]" /> REPORTED
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed border-[#ba1a1a]" /> VERIFIED
          </span>
        </p>
      </div>
      {reported.length < 2 ? (
        <p className="py-6 text-center font-body-sm text-on-surface-variant">
          {reported.length === 0 ? 'No incidents in this range yet.' : 'Single data point — process more videos to grow the trend.'}
        </p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full h-36 mt-space-sm" role="img" aria-label={`Incident trend, peak ${peak}, total ${total}`}>
            <defs>
              <linearGradient id="repFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#436086" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#436086" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[25, 50, 75].map((g) => (
              <line key={g} x1="0" y1={g} x2={W} y2={g} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" className="text-on-surface-variant" />
            ))}
            {rep.length > 0 && (
              <polygon
                points={`0,${H} ${pts(reported, H, W)} ${W},${H}`}
                fill="url(#repFill)"
              />
            )}
            <polyline points={pts(reported, H, W)} fill="none" stroke="#436086" strokeWidth="2" strokeLinejoin="round" />
            <polyline points={pts(verified, H, W)} fill="none" stroke="#ba1a1a" strokeWidth="1.5" strokeDasharray="4 3" />
            {rep.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="3" fill="#436086" stroke="#fff" strokeWidth="1">
                <title>{labels[i] ?? `Point ${i + 1}`}: {reported[i]} reported · {verified[i] ?? 0} verified</title>
              </circle>
            ))}
          </svg>
          <div className="flex justify-between font-data-mono-sm text-on-surface-variant">
            <span className="truncate">{labels[0] ?? ''}</span>
            <span>PEAK {peak} · TOTAL {total}</span>
            <span className="truncate">{labels[labels.length - 1] ?? ''}</span>
          </div>
        </>
      )}
    </section>
  );
}

export default IncidentChart;
