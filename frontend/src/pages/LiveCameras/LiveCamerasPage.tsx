import { useEffect, useMemo, useState } from 'react';
import CCTVCard, { type CameraFeed } from '../../components/cctv/CCTVCard';
import UploadModal from '../../components/cctv/UploadModal';
import { cameraService } from '../../services/cameraService';
import { trackingService } from '../../services/trackingService';
import { backend } from '../../services/backend';
import type { Camera } from '../../types/camera';
import type { Detection } from '../../types/detection';
import type { Incident } from '../../types/incident';
import { downloadCSV, stamp } from '../../utils/actions';
import { useUiStore } from '../../store/uiStore';

const ALL = 'ALL AREAS';
const PAGE_SIZE = 5;

/** Annotated pipeline outputs wired to wall feeds (loops in the card player).
 *  Refresh with: Copy-Item backend/data/videos/outputs/*.mp4 frontend/public/videos/ */
const FEED_VIDEO: Record<string, string> = {
  'CAM-12': '/videos/bag1_tracked.mp4',
  'CAM-05': '/videos/bag2_tracked.mp4',
  'CAM-07': '/videos/car1_tracked.mp4',
  'CAM-21': '/videos/car2_tracked.mp4',
  'CAM-01': '/videos/car3_tracked.mp4',
  'CAM-03': '/videos/croud2_tracked.mp4',
  'CAM-04': '/videos/croud3_tracked.mp4',
  'CAM-02': '/videos/croud1_tracked.mp4',
};

function toFeed(c: Camera): CameraFeed {
  const src = FEED_VIDEO[c.id] ?? '';
  return {
    id: c.id,
    name: `${c.name} · ${c.location}`,
    src,
    fps: c.fps,
    live: src !== '',
  };
}

export function LiveCamerasPage() {
  const [area, setArea] = useState<string>(ALL);
  const [areas, setAreas] = useState<{ name: string; count: number }[]>([]);
  /** Playable feeds per area — the wall only shows cameras with wired
   *  sample footage, so counts must reflect that same set (not the full
   *  registry) to stay aligned with the visible cards. */
  const [wiredCounts, setWiredCounts] = useState<Record<string, number>>({});
  const [feeds, setFeeds] = useState<Camera[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [page, setPage] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);
  const query = useUiStore((s) => s.searchQuery);
  const setQuery = useUiStore((s) => s.setSearchQuery);

  useEffect(() => {
    cameraService.areas().then(setAreas).catch(() => undefined);
    cameraService.list()
      .then((cams) => {
        const counts: Record<string, number> = {};
        cams
          .filter((c) => FEED_VIDEO[c.id])
          .forEach((c) => {
            counts[c.area] = (counts[c.area] ?? 0) + 1;
          });
        setWiredCounts(counts);
      })
      .catch(() => undefined);
    trackingService.detections().then(setDetections).catch(() => undefined);
    backend.incidents(200).then(setIncidents).catch(() => undefined);
  }, []);

  useEffect(() => {
    let live = true;
    setPage(0);
    cameraService.listByArea(area).then((cams) => {
      // Wall shows only feeds with wired sample footage (looping video).
      if (live) setFeeds(cams.filter((c) => FEED_VIDEO[c.id]));
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [area]);

  const q = query.trim().toLowerCase();

  const [allCams, setAllCams] = useState<Camera[]>([]);
  useEffect(() => {
    if (q) cameraService.list().then(setAllCams).catch(() => undefined);
  }, [q]);
  const matched = q ? allCams.filter((f) => `${f.id} ${f.name} ${f.location} ${f.area}`.toLowerCase().includes(q)) : null;

  const criticalCount = incidents.filter(
    (i) => i.severity === 'critical' && (area === ALL || feeds.some((f) => f.id === i.cameraId)),
  ).length;

  const visibleIds = useMemo(() => new Set(feeds.map((f) => f.id)), [feeds]);
  const teleRows = useMemo(
    () => (area === ALL ? detections : detections.filter((d) => visibleIds.has(d.cameraId))),
    [area, visibleIds, detections],
  );
  const pageCount = Math.max(1, Math.ceil(teleRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = teleRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const exportDetections = () => {
    downloadCSV(
      `civiceye_detections_${area.toLowerCase().replace(/\s+/g, '_')}_${stamp()}`,
      ['ID', 'CAMERA', 'LABEL', 'CONFIDENCE', 'ACTION'],
      teleRows.map((d) => [d.id, d.cameraId, d.label, d.confidence.toFixed(1), d.action]),
    );
    pushToast(`Exported ${teleRows.length} detections (${area}) to CSV.`, 'success');
  };

  const renderCard = (c: Camera) => {
    const active = incidents.find(
      (i) => i.cameraId === c.id && (i.status === 'active' || i.status === 'pending' || i.status === 'monitoring'),
    );
    const severity = (active?.severity ?? 'nominal') as 'nominal' | 'low' | 'medium' | 'high' | 'critical';
    return (
      <CCTVCard
        key={c.id}
        camera={toFeed(c)}
        severity={severity}
        caption={active ? active.title : `${c.location} · ${c.status === 'online' ? 'All clear' : c.status}`}
        subCaption={active ? `${active.id} · ${active.severity.toUpperCase()} · needs attention` : `${c.id} · OSD · nominal`}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-primary-container px-4 py-2 font-data-mono-sm text-slate-300">
        LIVE GRID &middot; {feeds.length} FEEDS INDEXED &middot; BACKEND-DRIVEN TELEMETRY
      </div>

      <header className="flex flex-wrap items-end gap-4">
        <div>
          <p className="eyebrow">CCTV wall &middot; {area === ALL ? 'All areas' : area}</p>
          <h1 className="font-headline-xl text-on-surface tracking-tight">Live Surveillance</h1>
          <p className="pt-1 font-data-mono-md text-on-surface-variant">
            {feeds.length} feeds &middot;{' '}
            {criticalCount > 0 ? (
              <span className="font-semibold text-error">
                {criticalCount} critical
              </span>
            ) : (
              <span className="text-emerald-600">no critical incidents</span>
            )}
          </p>
        </div>
        <button type="button" onClick={() => setUploadOpen(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 font-label-caps text-on-secondary shadow-card hover:bg-blue-700 active:scale-[0.98] transition">
          <span className="material-symbols-outlined text-[16px]">upload</span>
          UPLOAD
        </button>
      </header>
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />

      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Area filter">
        <button
          key={ALL}
          type="button"
          onClick={() => setArea(ALL)}
          aria-pressed={area === ALL}
          className={`rounded-lg border px-3 py-1.5 font-label-caps transition ${
            area === ALL
              ? 'border-secondary bg-secondary text-on-primary shadow-card'
              : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-secondary hover:text-secondary'
          }`}
        >
          ALL AREAS · {Object.values(wiredCounts).reduce((n, c) => n + c, 0)}
        </button>
        {areas.map((a) => (
          <button
            key={a.name}
            type="button"
            onClick={() => setArea(a.name)}
            aria-pressed={area === a.name}
            className={`rounded-lg border px-3 py-1.5 font-label-caps transition ${
              area === a.name
                ? 'border-secondary bg-secondary text-on-primary shadow-card'
                : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-secondary hover:text-secondary'
            }`}
          >
            {a.name.toUpperCase()} · {wiredCounts[a.name] ?? 0}
          </button>
        ))}
      </div>

      <div className="card card-pad !py-3">
        {incidents.length === 0 ? (
          <p className="flex items-center gap-2 font-data-mono-sm text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {area === ALL ? 'CITYWIDE WATCH NOMINAL' : `${area.toUpperCase()} · ALL CLEAR — NO ACTIVE INCIDENTS`}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {(area === ALL ? incidents : incidents.filter((i) => visibleIds.has(i.cameraId))).slice(0, 8).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 font-data-mono-sm">
                <span className="font-bold uppercase">{i.severity}</span>
                <span className="text-on-surface-variant">{i.id}</span>
                <span className="font-medium text-on-surface">{i.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {matched !== null ? (
        <div>
          <p className="pb-2 font-data-mono-sm text-on-surface-variant">
            {matched.length} RESULT{matched.length === 1 ? '' : 'S'} FOR “{query.trim()}” ·{' '}
            <button type="button" onClick={() => setQuery('')} className="font-semibold text-secondary hover:text-blue-800 transition">
              CLEAR SEARCH
            </button>
          </p>
          {matched.length > 0 ? (
            <div key="search" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 anim-fade-up">
              {matched.map(renderCard)}
            </div>
          ) : (
            <div className="card card-pad text-center">
              <p className="font-body-md font-medium text-on-surface">No camera matches “{query.trim()}”.</p>
              <p className="pt-1 font-body-sm text-on-surface-variant">Try a camera ID or area name.</p>
            </div>
          )}
        </div>
      ) : (
        <div key={area} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 anim-fade-up">
          {feeds.map(renderCard)}
        </div>
      )}

      <section className="table-shell" aria-label="Detection telemetry">
        <table>
          <thead>
            <tr>
              <th>DETECTION</th>
              <th>CAMERA</th>
              <th>LABEL</th>
              <th>CONF</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody className="font-data-mono-md text-on-surface">
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="font-semibold">{d.id}</td>
                <td>{d.cameraId}</td>
                <td>{d.label}</td>
                <td className="tabular-nums">{d.confidence.toFixed(1)}%</td>
                <td className="font-label-caps text-secondary">{d.action}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center font-body-sm text-on-surface-variant">
                  No logged detections for {area} yet — run a processing job to populate telemetry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-2 font-data-mono-sm text-on-surface-variant">
        <span>SHOWING {rows.length} OF {teleRows.length} DETECTIONS · {area.toUpperCase()} · PAGE {safePage + 1}/{pageCount}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-label-caps hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:pointer-events-none transition"
          >
            PREV
          </button>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-label-caps hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:pointer-events-none transition"
          >
            NEXT
          </button>
        </div>
      </footer>
    </div>
  );
}

export default LiveCamerasPage;
