function line(data: number[], h: number, w: number): string {
  if (data.length < 2) return '';
  const max = Math.max(...data, 1);
  return data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 4)).toFixed(1)}`).join(' ');
}

export interface IncidentSeries {
  reported?: number[];
  verified?: number[];
  rangeLabel?: string;
}

export function IncidentChart({ reported = [], verified = [], rangeLabel = 'LIVE' }: IncidentSeries) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <div className="flex justify-between">
        <p className="font-label-caps text-on-surface-variant">INCIDENTS · {rangeLabel}</p>
        <p className="font-data-mono-sm text-on-surface-variant">— REPORTED — VERIFIED</p>
      </div>
      {reported.length < 2 ? (
        <p className="py-6 text-center font-body-sm text-on-surface-variant">Not enough data to chart yet.</p>
      ) : (
        <svg viewBox="0 0 300 100" className="w-full h-32 mt-space-sm" aria-hidden>
          <polyline points={line(reported, 100, 300)} fill="none" stroke="#436086" strokeWidth="2" />
          <polyline points={line(verified, 100, 300)} fill="none" stroke="#ba1a1a" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
      )}
    </section>
  );
}

export default IncidentChart;
