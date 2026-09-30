export interface SeveritySeg {
  k: string;
  v: number;
  c: string;
}

export function SeverityChart({ segs = [] }: { segs?: SeveritySeg[] }) {
  const total = segs.reduce((n, s) => n + s.v, 0);
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant">SEVERITY MIX · STACKED</p>
      {total === 0 ? (
        <p className="py-4 text-center font-body-sm text-on-surface-variant">No severity data yet.</p>
      ) : (
        <>
          <div className="flex h-4 rounded-full overflow-hidden mt-space-sm border border-outline-variant">
            {segs.map((s) => (
              <span key={s.k} className={s.c} style={{ width: `${(s.v / total) * 100}%` }} title={`${s.k} ${s.v}`} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-space-md pt-space-sm font-data-mono-sm text-on-surface-variant">
            {segs.map((s) => (
              <li key={s.k}>{s.k} {s.v}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default SeverityChart;
