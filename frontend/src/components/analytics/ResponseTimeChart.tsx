export interface SectorTime {
  k: string;
  v: number;
}

const TYPE_ICON: Record<string, string> = {
  'TRAFFIC-ACCIDENT': 'car_crash',
  'UNATTENDED-OBJECT': 'luggage',
  'CROWD-ANOMALY': 'groups',
  SECURITY: 'shield',
};

export function ResponseTimeChart({ sectors = [], title = 'INCIDENTS BY TYPE', unit = '' }: { sectors?: SectorTime[]; title?: string; unit?: string }) {
  const rows = [...sectors].sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...rows.map((s) => s.v));
  const total = rows.reduce((n, s) => n + s.v, 0);
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md">
      <div className="flex items-center justify-between pb-space-sm">
        <p className="font-label-caps text-on-surface-variant">{title}</p>
        {total > 0 && <span className="font-data-mono-sm text-on-surface-variant">{total} TOTAL</span>}
      </div>
      {rows.length === 0 ? (
        <p className="font-body-sm text-on-surface-variant">No data recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-space-xs">
          {rows.map((s, idx) => (
            <li key={s.k} className="flex items-center gap-space-sm rounded-lg px-1 py-0.5 transition hover:bg-surface-container-low">
              <span className="font-data-mono-sm tabular-nums text-on-surface-variant">{String(idx + 1).padStart(2, '0')}</span>
              <span className="material-symbols-outlined text-[18px] text-secondary">{TYPE_ICON[s.k] ?? 'monitoring'}</span>
              <span className="w-32 truncate font-data-mono-sm text-on-surface" title={s.k}>{s.k}</span>
              <span className="flex-1 h-3 bg-surface-container-high rounded-full overflow-hidden">
                <span className="block h-full rounded-full bg-gradient-to-r from-secondary to-blue-400 transition-all" style={{ width: `${Math.min(100, (s.v / max) * 100)}%` }} />
              </span>
              <span className="w-20 text-right font-data-mono-sm tabular-nums text-on-surface-variant">
                {s.v}{unit} · {total === 0 ? 0 : Math.round((s.v / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ResponseTimeChart;
