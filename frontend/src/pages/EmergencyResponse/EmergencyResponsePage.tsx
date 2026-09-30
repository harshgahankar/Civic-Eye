import { useEffect, useState } from 'react';
import EmergencyPanel from '../../components/emergency/EmergencyPanel';
import DispatchModal from '../../components/emergency/DispatchModal';
import { incidentService } from '../../services/incidentService';
import { backend } from '../../services/backend';
import type { ArchivedAlert, Incident } from '../../types/incident';
import { useUiStore } from '../../store/uiStore';

interface PriorityCard {
  id: string;
  sev: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cam: string;
  title: string;
  tele: string;
}

function toCard(i: Incident): PriorityCard {
  return {
    id: i.id,
    sev: i.severity.toUpperCase() as PriorityCard['sev'],
    cam: `${i.cameraId} · ${i.sector}`,
    title: i.title,
    tele: `CONF ${i.confidence.toFixed(1)}% · ${i.timestamp}`,
  };
}

type CardStatus = 'active' | 'dispatched' | 'verified' | 'stood-down';

/** Flagged upload video for an incident card, if the pipeline stamped one. */
function IncidentVideo({ incidentId }: { incidentId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    incidentService.detail(incidentId)
      .then((d) => {
        if (!live || !d) return;
        const name = d.metadata?.output_video;
        if (typeof name === 'string' && name) {
          setSrc(backend.outputVideoUrl(name));
          setFlagged(d.metadata?.source === 'upload');
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [incidentId]);

  if (!src || failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-primary-container" aria-label={`${incidentId} no video source`}>
        <span className="material-symbols-outlined text-[30px] text-slate-500">videocam_off</span>
        <span className="font-data-mono-sm text-slate-400">AWAITING FEED</span>
      </div>
    );
  }
  return (
    <>
      <video
        src={src}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        controls
        preload="metadata"
        onError={() => setFailed(true)}
      />
      {flagged && (
        <span className="absolute right-space-sm top-space-sm rounded-sm bg-error px-space-sm py-0.5 font-label-caps text-on-error">
          FLAGGED · UPLOAD
        </span>
      )}
    </>
  );
}

const SEV_STYLE: Record<string, string> = {
  CRITICAL: 'bg-error text-on-error',
  HIGH: 'bg-amber-500 text-black',
  MEDIUM: 'bg-secondary text-on-primary',
  LOW: 'bg-surface-container-high text-on-surface-variant',
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
  const [cards, setCards] = useState<PriorityCard[]>([]);
  const [archived, setArchived] = useState<ArchivedAlert[]>([]);
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    let live = true;
    incidentService.list()
      .then((rows) => {
        if (!live) return;
        setCards(rows
          .filter((i) => i.status === 'active' || i.status === 'pending' || i.status === 'monitoring')
          .map(toCard));
      })
      .catch(() => {});
    incidentService.archived()
      .then((rows) => { if (live) setArchived(rows); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const visible = cards.filter(
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
          <span className="font-data-mono-sm rounded-full bg-error px-space-sm py-1 text-on-error">
            {String(cards.filter((c) => c.sev === 'CRITICAL').length).padStart(2, '0')} CRITICAL
          </span>
          <span className="font-data-mono-sm rounded-full bg-amber-500 px-space-sm py-1 text-black">
            {String(cards.filter((c) => c.sev === 'HIGH').length).padStart(2, '0')} HIGH
          </span>
          <span className="font-data-mono-sm rounded-full bg-secondary px-space-sm py-1 text-on-primary">
            {String(cards.filter((c) => c.sev === 'MEDIUM').length).padStart(2, '0')} MEDIUM
          </span>
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
                <IncidentVideo incidentId={a.id} />
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
        incidentId={dispatchFor ?? ''}
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
            {archived.map((a) => (
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
        <span>COMMAND LINK NOMINAL · DISPATCH QUEUE {cards.length}</span>
        <span className="ml-auto">LIVE GRID</span>
      </footer>
    </div>
  );
}

export default EmergencyResponsePage;
