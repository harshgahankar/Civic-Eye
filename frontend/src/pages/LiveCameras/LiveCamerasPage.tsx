import { useEffect, useMemo, useState } from 'react';
import CCTVCard, { type CameraFeed } from '../../components/cctv/CCTVCard';
import DetectionOverlay, { type Box } from '../../components/cctv/DetectionOverlay';
import TrackingSection from '../../components/tracking/TrackingSection';
import { mockDetections } from '../../data/mockDetections';
import { MUMBAI_AREAS, mockAreaIncidents } from '../../data/mockCameras';
import { cameraService } from '../../services/cameraService';
import type { Camera } from '../../types/camera';
import { downloadCSV, stamp } from '../../utils/actions';
import { useUiStore } from '../../store/uiStore';

const ALL = 'ALL AREAS';
const PAGE_SIZE = 5;

/** Curated detection overlays for showcase feeds; everything else gets a status caption. */
const CURATED: Record<string, { boxes?: Box[]; caption: string; critical?: boolean }> = {
  'CAM-07': {
    boxes: [
      { x: '42%', y: '48%', w: '22%', h: '30%', label: 'COLLISION 0.94', color: 'border-error' },
      { x: '18%', y: '55%', w: '12%', h: '28%', label: 'VEHICLE 0.91', color: 'border-secondary-fixed' },
    ],
    caption: 'CRITICAL · COLLISION · LANES 1-2 BLOCKED',
    critical: true,
  },
  'CAM-03': {
    boxes: [{ x: '25%', y: '35%', w: '45%', h: '40%', label: 'CROWD SURGE 0.89', color: 'border-amber-500' }],
    caption: 'CROWD SURGE · DENSITY +42%',
  },
  'CAM-12': {
    boxes: [{ x: '58%', y: '52%', w: '14%', h: '26%', label: 'BAG 0.91', color: 'border-error' }],
    caption: 'BAGGAGE WATCH · DWELL 6 MIN',
  },
  'CAM-01': { caption: 'ARTERIAL FLOW · NOMINAL' },
};

const SEV_TONE: Record<string, string> = {
  CRITICAL: 'text-error',
  HIGH: 'text-amber-600',
  MEDIUM: 'text-secondary',
};

function toFeed(c: Camera): CameraFeed {
  return {
    id: c.id,
    name: `${c.name} · ${c.location}`,
    src: c.thumbnail ?? '',
    fps: c.fps,
    live: c.status === 'online',
  };
}

export function LiveCamerasPage() {
  const [area, setArea] = useState<string>(ALL);
  const [areas, setAreas] = useState<{ name: string; count: number }[]>([]);
  const [feeds, setFeeds] = useState<Camera[]>([]);
  const [page, setPage] = useState(0);
  const [trackOpen, setTrackOpen] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);
  const query = useUiStore((s) => s.searchQuery);
  const setQuery = useUiStore((s) => s.setSearchQuery);

  useEffect(() => {
    cameraService.areas().then(setAreas).catch(() => undefined);
  }, []);

  useEffect(() => {
    let live = true;
    setPage(0);
    cameraService.listByArea(area).then((cams) => {
      if (live) setFeeds(cams);
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

  const incidents = useMemo(() => {
    if (area === ALL) return Object.values(mockAreaIncidents).flat();
    return mockAreaIncidents[area] ?? [];
  }, [area]);

  const visibleIds = useMemo(() => new Set(feeds.map((f) => f.id)), [feeds]);
  const teleRows = useMemo(
    () => (area === ALL ? mockDetections : mockDetections.filter((d) => visibleIds.has(d.cameraId))),
    [area, visibleIds],
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
    const meta = CURATED[c.id];
    const caption = meta?.caption ?? `${c.location.toUpperCase()} · ${c.status === 'online' ? 'NOMINAL' : 'MAINTENANCE'}`;
    const critical = meta?.critical ?? false;
    return (
      <CCTVCard
        key={c.id}
        camera={toFeed(c)}
        overlay={meta?.boxes ? <DetectionOverlay boxes={meta.boxes} /> : undefined}
      >
        <p className={`absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 font-data-mono-sm shadow-pop ${critical ? 'bg-error text-on-error' : 'bg-primary/80 text-white backdrop-blur-sm'}`}>
          {caption}
        </p>
        {critical && (
          <p className="absolute bottom-2 right-2 rounded-md bg-primary/80 px-1.5 py-0.5 font-data-mono-sm text-white backdrop-blur-sm">
            {c.fps}FPS · H.265 · 4K
          </p>
        )}
      </CCTVCard>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Archival banner strip */}
      <div className="rounded-xl bg-primary-container px-4 py-2 font-data-mono-sm text-slate-300">
        MUMBAI GRID · MH-MUM-01 &middot; {feeds.length} FEEDS INDEXED &middot; RETENTION 90D &middot; CHAIN-OF-CUSTODY SEALED
      </div>

      {/* Page header */}
      <header className="flex flex-wrap items-end gap-4">
        <div>
          <p className="eyebrow">CCTV wall &middot; {area === ALL ? 'All Mumbai areas' : area}</p>
          <h1 className="font-headline-xl text-on-surface tracking-tight">Live Surveillance</h1>
          <p className="pt-1 font-data-mono-md text-on-surface-variant">
            {feeds.length} feeds &middot;{' '}
            {incidents.filter((i) => i.severity === 'CRITICAL').length > 0 ? (
              <span className="font-semibold text-error">
                {incidents.filter((i) => i.severity === 'CRITICAL').length} critical
              </span>
            ) : (
              <span className="text-emerald-600">no critical incidents</span>
            )}
          </p>
        </div>
        <button type="button" onClick={exportDetections} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 font-label-caps text-on-secondary shadow-card hover:bg-blue-700 active:scale-[0.98] transition">
          <span className="material-symbols-outlined text-[16px]">file_download</span>
          EXPORT
        </button>
      </header>

      {/* Mumbai area filter toolbar */}
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Mumbai area filter">
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
          ALL AREAS
        </button>
        {(areas.length > 0 ? areas : MUMBAI_AREAS.map((name) => ({ name, count: 0 }))).map((a) => (
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
            {a.name.toUpperCase()}{a.count > 0 ? ` · ${a.count}` : ''}
          </button>
        ))}
      </div>

      {/* Area incident strip */}
      <div className="card card-pad !py-3">
        {incidents.length === 0 ? (
          <p className="flex items-center gap-2 font-data-mono-sm text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {area === ALL ? 'CITYWIDE WATCH NOMINAL' : `${area.toUpperCase()} · ALL CLEAR — NO ACTIVE INCIDENTS`}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {incidents.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 font-data-mono-sm">
                <span className={`font-bold ${SEV_TONE[i.severity]}`}>{i.severity}</span>
                <span className="text-on-surface-variant">{i.id}</span>
                <span className="font-medium text-on-surface">{i.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CCTV wall (or search results) */}
      {matched !== null ? (
        <div>
          <p className="pb-2 font-data-mono-sm text-on-surface-variant">
            {matched.length} RESULT{matched.length === 1 ? '' : 'S'} FOR “{query.trim()}” ·{' '}
            <button type="button" onClick={() => setQuery('')} className="font-semibold text-secondary hover:text-blue-800 transition">
              CLEAR SEARCH
            </button>
          </p>
          {matched.length > 0 ? (
            <div key="search" className="grid grid-cols-1 gap-4 md:grid-cols-2 anim-fade-up">
              {matched.map(renderCard)}
            </div>
          ) : (
            <div className="card card-pad text-center">
              <p className="font-body-md font-medium text-on-surface">No camera matches “{query.trim()}”.</p>
              <p className="pt-1 font-body-sm text-on-surface-variant">Try a camera ID (CAM-07) or area name.</p>
            </div>
          )}
        </div>
      ) : (
        <div key={area} className="grid grid-cols-1 gap-4 md:grid-cols-2 anim-fade-up">
          {feeds.map(renderCard)}
        </div>
      )}

      {/* Detection telemetry table */}
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
                  No logged detections for {area} yet.
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

      {/* Multi-camera tracking (opens on demand) */}
      <section className="card overflow-hidden" aria-label="Multi-camera tracking">
        <button
          type="button"
          aria-expanded={trackOpen}
          aria-controls="tracking-panel"
          onClick={() => setTrackOpen((v) => !v)}
          className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-container-low/60 sm:px-5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-blue-200">
            <span className="material-symbols-outlined text-[22px]">route</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="eyebrow block">Cross-camera subject trail</span>
            <span className="section-title block text-[20px]">Multi-Camera Tracking</span>
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-label-caps text-emerald-700 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SUBJECT-442 · HELD
          </span>
          <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${trackOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>
        {trackOpen && (
          <div id="tracking-panel" className="border-t border-outline-variant">
            <TrackingSection />
          </div>
        )}
      </section>
    </div>
  );
}

export default LiveCamerasPage;
