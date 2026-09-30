const SECTORS = [
  { k: 'MIDTOWN', v: 92 },
  { k: 'HERALD', v: 74 },
  { k: 'PENN', v: 61 },
  { k: 'UNION', v: 48 },
];

export interface SectorTime {
  k: string;
  v: number;
}

export function ResponseTimeChart({ sectors = [], title = 'INCIDENTS BY TYPE', unit = '' }: { sectors?: SectorTime[]; title?: string; unit?: string }) {
  const max = Math.max(1, ...sectors.map((s) => s.v));
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant pb-space-sm">{title}</p>
      {sectors.length === 0 ? (
        <p className="font-body-sm text-on-surface-variant">No data recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-space-xs">
          {sectors.map((s) => (
            <li key={s.k} className="flex items-center gap-space-sm">
              <span className="w-20 font-data-mono-sm text-on-surface">{s.k}</span>
              <span className="flex-1 h-3 bg-surface-container-high rounded-full overflow-hidden">
                <span className="block h-full bg-secondary" style={{ width: `${Math.min(100, (s.v / max) * 100)}%` }} />
              </span>
              <span className="font-data-mono-sm text-on-surface-variant">{s.v}{unit}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ResponseTimeChart;
