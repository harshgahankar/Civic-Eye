import { useState } from 'react';
import IntelligenceMap from '../../components/map/IntelligenceMap';
import ResponseUnit from '../../components/emergency/ResponseUnit';
import { mockUnits } from '../../data/mockResources';

const TABS = ['ALL', 'ACCIDENTS', 'CROWD', 'BAGGAGE', 'PATROL'] as const;
const LAYERS = ['CAMERAS', 'INCIDENTS', 'UNITS', 'HEATMAP'] as const;
const DISTRIBUTION = [
  { k: 'SECTOR A · EXPRESSWAY', v: 18 },
  { k: 'SECTOR B · METRO', v: 34 },
  { k: 'SECTOR C · JUNCTION', v: 62 },
  { k: 'SECTOR D · STATION', v: 27 },
];

export function IncidentsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('ALL');
  const [layers, setLayers] = useState<Record<string, boolean>>({
    CAMERAS: true,
    INCIDENTS: true,
    UNITS: true,
    HEATMAP: false,
  });

  const toggleLayer = (l: string) => setLayers((p) => ({ ...p, [l]: !p[l] }));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end gap-4">
        <div>
          <p className="eyebrow">City grid &middot; Live feed</p>
          <h1 className="font-headline-xl text-on-surface tracking-tight">Geographic Intelligence</h1>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-secondary/40 bg-blue-50 px-3 py-1 font-data-mono-sm font-semibold text-secondary">
          <span className="material-symbols-outlined text-[14px]">grid_on</span>
          GRID RES 40M
        </span>
      </header>

      {/* Filter tabs + layer checkboxes */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Incident filters">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-lg border px-3 py-1.5 font-label-caps transition ${
                tab === t
                  ? 'border-secondary bg-secondary text-on-primary shadow-card'
                  : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-secondary hover:text-secondary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {LAYERS.map((l) => (
            <label key={l} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 font-data-mono-sm text-on-surface-variant hover:border-secondary transition">
              <input
                type="checkbox"
                checked={!!layers[l]}
                onChange={() => toggleLayer(l)}
                className="h-3.5 w-3.5 accent-[#2563eb]"
              />
              {l}
            </label>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <IntelligenceMap interactive />
          <p className="pt-2 font-data-mono-sm text-on-surface-variant">
            FILTER {tab} &middot; LAYERS {Object.entries(layers).filter(([, v]) => v).map(([k]) => k).join(', ') || 'NONE'}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <section className="card card-pad">
            <p className="eyebrow">Sector intel distribution</p>
            <ul className="flex flex-col gap-2.5 pt-3">
              {DISTRIBUTION.map((d) => (
                <li key={d.k} className="flex items-center gap-2.5">
                  <span className="w-40 shrink-0 truncate font-data-mono-sm text-on-surface">{d.k}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                    <span className="block h-full rounded-full bg-gradient-to-r from-secondary to-blue-400" style={{ width: `${d.v}%` }} />
                  </span>
                  <span className="w-8 text-right font-data-mono-sm tabular-nums text-on-surface-variant">{d.v}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card overflow-hidden">
            <p className="eyebrow px-4 pt-4">Active units</p>
            <table className="w-full text-left">
              <tbody>
                {mockUnits.map((u) => (
                  <ResponseUnit key={u.id} unit={{ id: u.id, type: u.type, status: u.status.toUpperCase(), eta: u.eta.toUpperCase() }} />
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-3 rounded-xl bg-primary-container px-4 py-3 font-data-mono-sm text-slate-300 shadow-card">
        <span>EXPORT DOSSIER &middot; GEOJSON / PDF / CSV</span>
        <button type="button" className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-1.5 font-label-caps text-on-primary hover:bg-blue-700 active:scale-[0.98] transition">
          <span className="material-symbols-outlined text-[16px]">file_download</span>
          EXPORT
        </button>
      </footer>
    </div>
  );
}

export default IncidentsPage;
