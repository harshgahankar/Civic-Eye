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

export function ResponseTimeChart({ sectors = SECTORS }: { sectors?: SectorTime[] }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant pb-space-sm">RESPONSE TIME BY SECTOR (s)</p>
      <ul className="flex flex-col gap-space-xs">
        {sectors.map((s) => (
          <li key={s.k} className="flex items-center gap-space-sm">
            <span className="w-20 font-data-mono-sm text-on-surface">{s.k}</span>
            <span className="flex-1 h-3 bg-surface-container-high rounded-full overflow-hidden">
              <span className="block h-full bg-secondary" style={{ width: `${s.v}%` }} />
            </span>
            <span className="font-data-mono-sm text-on-surface-variant">{s.v}s</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ResponseTimeChart;
