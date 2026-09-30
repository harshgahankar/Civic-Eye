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
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-wrap items-end gap-space-md">
        <div>
          <p className="font-label-caps text-on-surface-variant">CITY GRID &middot; LIVE FEED</p>
          <h1 className="font-headline-xl text-on-surface">GEOGRAPHIC INTELLIGENCE</h1>
        </div>
        <span className="ml-auto font-data-mono-sm rounded-full border border-secondary px-space-sm py-1 text-secondary">
          GRID RES 40M
        </span>
      </header>

      {/* Filter tabs + layer checkboxes */}
      <div className="flex flex-wrap items-center gap-space-md">
        <div className="flex flex-wrap gap-space-sm" role="tablist" aria-label="Incident filters">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`font-label-caps rounded-sm border px-space-sm py-1 ${
                tab === t ? 'border-secondary bg-secondary text-on-primary' : 'border-outline text-on-surface-variant'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-space-sm">
          {LAYERS.map((l) => (
            <label key={l} className="flex items-center gap-1 font-data-mono-sm text-on-surface-variant">
              <input type="checkbox" checked={!!layers[l]} onChange={() => toggleLayer(l)} />
              {l}
            </label>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-12">
        <div className="xl:col-span-8">
          <IntelligenceMap interactive />
          <p className="pt-space-xs font-data-mono-sm text-on-surface-variant">
            FILTER {tab} &middot; LAYERS {Object.entries(layers).filter(([, v]) => v).map(([k]) => k).join(', ') || 'NONE'}
          </p>
        </div>
        <div className="flex flex-col gap-space-md xl:col-span-4">
          <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
            <p className="font-label-caps text-on-surface-variant">SECTOR INTEL DISTRIBUTION</p>
            <ul className="flex flex-col gap-space-xs pt-space-sm">
              {DISTRIBUTION.map((d) => (
                <li key={d.k} className="flex items-center gap-space-sm">
                  <span className="w-44 font-data-mono-sm text-on-surface">{d.k}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                    <span className="block h-full bg-secondary" style={{ width: `${d.v}%` }} />
                  </span>
                  <span className="font-data-mono-sm text-on-surface-variant">{d.v}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="overflow-x-auto rounded-sm border border-outline-variant bg-surface-container-lowest">
            <p className="font-label-caps px-space-sm pt-space-sm text-on-surface-variant">ACTIVE UNITS</p>
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

      <footer className="flex flex-wrap items-center gap-space-md rounded-sm bg-primary-container px-space-md py-space-sm font-data-mono-sm text-secondary-fixed">
        <span>EXPORT DOSSIER &middot; GEOJSON / PDF / CSV</span>
        <button className="ml-auto font-label-caps bg-secondary px-space-md py-1 text-on-primary rounded-sm">EXPORT</button>
      </footer>
    </div>
  );
}

export default IncidentsPage;
