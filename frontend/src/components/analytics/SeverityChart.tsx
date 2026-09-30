const SEGS = [
  { k: 'CRITICAL', v: 8, c: 'bg-error' },
  { k: 'HIGH', v: 22, c: 'bg-amber-500' },
  { k: 'MEDIUM', v: 35, c: 'bg-secondary' },
  { k: 'LOW', v: 35, c: 'bg-surface-container-high' },
];

export interface SeveritySeg {
  k: string;
  v: number;
  c: string;
}

export function SeverityChart({ segs = SEGS }: { segs?: SeveritySeg[] }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant">SEVERITY MIX · STACKED</p>
      <div className="flex h-4 rounded-full overflow-hidden mt-space-sm border border-outline-variant">
        {segs.map((s) => (
          <span key={s.k} className={s.c} style={{ width: `${s.v}%` }} title={`${s.k} ${s.v}%`} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-space-md pt-space-sm font-data-mono-sm text-on-surface-variant">
        {segs.map((s) => (
          <li key={s.k}>{s.k} {s.v}%</li>
        ))}
      </ul>
    </section>
  );
}

export default SeverityChart;
