import { useState } from 'react';
import EmergencyPanel from '../../components/emergency/EmergencyPanel';
import DispatchModal from '../../components/emergency/DispatchModal';
import { mockArchivedIncidents } from '../../data/mockIncidents';
import { useUiStore } from '../../store/uiStore';

const PRIORITY = [
  {
    id: 'ALR-8842',
    sev: 'CRITICAL',
    cam: 'CAM-07 · JUNCTION A',
    title: 'Multi-vehicle collision — 2 lanes blocked',
    img: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=640&q=60&auto=format&fit=crop',
    tele: 'CONF 94.2% · 30FPS · 08:42:10Z',
  },
  {
    id: 'ALR-8841',
    sev: 'HIGH',
    cam: 'CAM-04 · METRO CENTRAL',
    title: 'Crowd surge — density +42% in 5 min',
    img: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=640&q=60&auto=format&fit=crop',
    tele: 'CONF 88.7% · 30FPS · 08:40:55Z',
  },
  {
    id: 'ALR-8839',
    sev: 'MEDIUM',
    cam: 'CAM-12 · STATION GATE 2',
    title: 'Unattended baggage — dwell 6 min',
    img: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=640&q=60&auto=format&fit=crop',
    tele: 'CONF 91.4% · 30FPS · 08:38:31Z',
  },
] as const;

type CardStatus = 'active' | 'dispatched' | 'verified' | 'stood-down';

const SEV_STYLE: Record<string, string> = {
  CRITICAL: 'bg-error text-on-error',
  HIGH: 'bg-amber-500 text-black',
  MEDIUM: 'bg-secondary text-on-primary',
};

const STATUS_RIBBON: Record<CardStatus, string | null> = {
  active: null,
  dispatched: 'UNIT EN ROUTE',
  verified: 'FIELD VERIFIED',
  'stood-down': 'STOOD DOWN',
};

export function EmergencyResponsePage() {
  const [query, setQuery] = useState('');
  const [sevFilter, setSevFilter] = useState('ALL');
  const [status, setStatus] = useState<Record<string, CardStatus>>({});
  const [dispatchFor, setDispatchFor] = useState<string | null>(null);
  const pushToast = useUiStore((s) => s.pushToast);

  const visible = PRIORITY.filter(
    (p) =>
      (sevFilter === 'ALL' || p.sev === sevFilter) &&
      (query === '' || `${p.id} ${p.title} ${p.cam}`.toLowerCase().includes(query.toLowerCase()))
  );

  const setCard = (id: string, s: CardStatus) => setStatus((prev) => ({ ...prev, [id]: s }));

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-wrap items-end gap-space-md">
        <div>
          <p className="font-label-caps text-on-surface-variant">DISPATCH QUEUE &middot; LIVE</p>
          <h1 className="font-headline-xl text-on-surface">EMERGENCY ALERTS</h1>
        </div>
        <div className="ml-auto flex gap-space-sm">
          <span className="font-data-mono-sm rounded-full bg-error px-space-sm py-1 text-on-error">01 CRITICAL</span>
          <span className="font-data-mono-sm rounded-full bg-amber-500 px-space-sm py-1 text-black">02 HIGH</span>
          <span className="font-data-mono-sm rounded-full bg-secondary px-space-sm py-1 text-on-primary">04 MEDIUM</span>
        </div>
      </header>

      {/* Search / filter bar */}
      <div className="flex flex-wrap gap-space-sm">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SEARCH ID / LOCATION…"
          aria-label="Search alerts"
          className="min-w-52 flex-1 rounded-sm border border-outline bg-surface-container-lowest px-space-sm py-2 font-data-mono-md text-on-surface"
        />
        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSevFilter(s)}
            aria-pressed={sevFilter === s}
            className={`font-label-caps rounded-sm border px-space-sm py-2 ${
              sevFilter === s ? 'border-secondary bg-secondary text-on-primary' : 'border-outline text-on-surface-variant'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Priority cards */}
      {visible.length === 0 && (
        <div className="card card-pad text-center">
          <p className="font-body-md font-medium text-on-surface">No alerts match the current filter.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSevFilter('ALL');
            }}
            className="pt-1 font-label-caps text-secondary hover:text-blue-800 transition"
          >
            CLEAR FILTERS
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-3">
        {visible.map((a) => {
          const st = status[a.id] ?? 'active';
          const ribbon = STATUS_RIBBON[st];
          const closed = st === 'stood-down';
          return (
            <article key={a.id} className={`overflow-hidden rounded-sm border border-outline-variant bg-surface-container-lowest transition ${closed ? 'opacity-60' : ''}`}>
              <div className="relative aspect-video bg-primary">
                <img src={a.img} alt={`${a.id} snapshot`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                <span className={`absolute left-space-sm top-space-sm px-space-sm py-0.5 font-label-caps ${SEV_STYLE[a.sev]}`}>
                  {a.sev} · {a.id}
                </span>
                {ribbon && (
                  <span className="absolute bottom-space-sm left-space-sm rounded-sm bg-primary/85 px-space-sm py-0.5 font-label-caps text-on-primary backdrop-blur-sm">
                    {ribbon}
                  </span>
                )}
              </div>
              <div className="p-space-md">
                <p className="font-data-mono-sm text-on-surface-variant">{a.cam}</p>
                <h3 className="font-headline-md text-on-surface pt-1">{a.title}</h3>
                <p className="font-data-mono-sm text-on-surface-variant pt-1">{a.tele}</p>
                <div className="flex flex-wrap gap-space-sm pt-space-sm">
                  {closed ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCard(a.id, 'active');
                        pushToast(`${a.id} reopened to the active queue.`, 'info');
                      }}
                      className="font-label-caps border border-secondary px-space-sm py-1 text-secondary rounded-sm hover:bg-blue-50 transition"
                    >
                      REOPEN
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setDispatchFor(a.id)}
                        disabled={st === 'dispatched'}
                        className="font-label-caps bg-error px-space-sm py-1 text-on-error rounded-sm hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none transition"
                      >
                        {st === 'dispatched' ? 'DISPATCHED ✓' : 'DISPATCH'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCard(a.id, 'verified');
                          pushToast(`${a.id} verified by field unit.`, 'success');
                        }}
                        disabled={st === 'verified'}
                        className="font-label-caps border border-secondary px-space-sm py-1 text-secondary rounded-sm hover:bg-blue-50 disabled:opacity-50 disabled:pointer-events-none transition"
                      >
                        {st === 'verified' ? 'VERIFIED ✓' : 'VERIFY'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCard(a.id, 'stood-down');
                          pushToast(`${a.id} stood down and archived.`, 'info');
                        }}
                        className="font-label-caps border border-outline px-space-sm py-1 text-on-surface-variant rounded-sm hover:border-on-surface-variant transition"
                      >
                        STAND DOWN
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <DispatchModal
        open={dispatchFor !== null}
        incidentId={dispatchFor ?? 'INC-2401'}
        onClose={() => setDispatchFor(null)}
        onConfirm={() => {
          if (dispatchFor) setCard(dispatchFor, 'dispatched');
        }}
      />

      <EmergencyPanel onDispatch={(unit) => pushToast(`Dispatch board: ${unit} ready for tasking.`, 'info')} />

      {/* Historical archive */}
      <section className="overflow-x-auto rounded-sm border border-outline-variant bg-surface-container-lowest">
        <p className="font-label-caps px-space-sm pt-space-sm text-on-surface-variant">HISTORICAL ARCHIVE</p>
        <table className="w-full text-left">
          <thead>
            <tr className="font-label-caps text-on-surface-variant">
              <th className="px-space-sm py-space-xs">ALERT</th>
              <th className="px-space-sm py-space-xs">TITLE</th>
              <th className="px-space-sm py-space-xs">SEVERITY</th>
              <th className="px-space-sm py-space-xs">RESOLVED</th>
              <th className="px-space-sm py-space-xs">DURATION</th>
            </tr>
          </thead>
          <tbody>
            {mockArchivedIncidents.map((a) => (
              <tr key={a.id} className="border-t border-outline-variant font-data-mono-md text-on-surface">
                <td className="px-space-sm py-space-xs">{a.id}</td>
                <td className="px-space-sm py-space-xs">{a.title}</td>
                <td className="px-space-sm py-space-xs uppercase">{a.severity}</td>
                <td className="px-space-sm py-space-xs">{a.resolvedAt}</td>
                <td className="px-space-sm py-space-xs">{a.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="flex items-center gap-space-md rounded-sm bg-primary-container px-space-md py-space-sm font-data-mono-sm text-secondary-fixed">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        <span>COMMAND LINK NOMINAL · 24 STREAMS · DISPATCH QUEUE 3</span>
        <span className="ml-auto">NYC-METRO-01</span>
      </footer>
    </div>
  );
}

export default EmergencyResponsePage;
