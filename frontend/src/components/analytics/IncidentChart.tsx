const A = [12, 9, 14, 11, 16, 10, 13, 15, 9, 12, 14, 11, 10, 13, 16, 12, 9, 11, 14, 12, 10, 13, 15, 11, 9, 12, 14, 10, 11, 13];
const B = [8, 7, 9, 8, 10, 7, 8, 9, 6, 8, 9, 7, 7, 8, 10, 8, 6, 7, 9, 8, 7, 8, 9, 7, 6, 8, 9, 7, 7, 8];

function line(data: number[], h: number, w: number): string {
  const max = Math.max(...data);
  return data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
}

export interface IncidentSeries {
  reported?: number[];
  verified?: number[];
  rangeLabel?: string;
}

export function IncidentChart({ reported = A, verified = B, rangeLabel = '30 DAY DUAL-LINE' }: IncidentSeries) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <div className="flex justify-between">
        <p className="font-label-caps text-on-surface-variant">INCIDENTS · {rangeLabel}</p>
        <p className="font-data-mono-sm text-on-surface-variant">— REPORTED — VERIFIED</p>
      </div>
      <svg viewBox="0 0 300 100" className="w-full h-32 mt-space-sm" aria-hidden>
        <polyline points={line(reported, 100, 300)} fill="none" stroke="#436086" strokeWidth="2" />
        <polyline points={line(verified, 100, 300)} fill="none" stroke="#ba1a1a" strokeWidth="1.5" strokeDasharray="4 3" />
      </svg>
    </section>
  );
}

export default IncidentChart;
