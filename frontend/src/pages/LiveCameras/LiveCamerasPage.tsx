import { useState } from 'react';
import CCTVCard, { type CameraFeed } from '../../components/cctv/CCTVCard';
import DetectionOverlay from '../../components/cctv/DetectionOverlay';
import { mockDetections } from '../../data/mockDetections';

const FEEDS: CameraFeed[] = [
  {
    id: 'CAM-07',
    name: 'Junction A',
    src: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=640&q=60&auto=format&fit=crop',
    fps: 30,
    live: true,
  },
  {
    id: 'CAM-04',
    name: 'Metro Central',
    src: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=640&q=60&auto=format&fit=crop',
    fps: 30,
    live: true,
  },
  {
    id: 'CAM-12',
    name: 'Station Gate 2',
    src: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=640&q=60&auto=format&fit=crop',
    fps: 30,
    live: true,
  },
  {
    id: 'CAM-01',
    name: 'Expressway',
    src: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=640&q=60&auto=format&fit=crop',
    fps: 30,
    live: true,
  },
];

const SECTORS = ['ALL SECTORS', 'Sector A', 'Sector B', 'Sector C', 'Sector D'];
const PAGE_SIZE = 5;

export function LiveCamerasPage() {
  const [sector, setSector] = useState(SECTORS[0]);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(mockDetections.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = mockDetections.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      {/* Archival banner strip */}
      <div className="rounded-xl bg-primary-container px-4 py-2 font-data-mono-sm text-slate-300">
        ARCHIVE REEL 2026-09-30 &middot; 189 TARGETS INDEXED &middot; RETENTION 90D &middot; CHAIN-OF-CUSTODY SEALED
      </div>

      {/* Page header */}
      <header className="flex flex-wrap items-end gap-4">
        <div>
          <p className="eyebrow">CCTV wall &middot; Sector grid</p>
          <h1 className="font-headline-xl text-on-surface tracking-tight">Live Surveillance</h1>
          <p className="pt-1 font-data-mono-md text-on-surface-variant">
            189 targets &middot; <span className="font-semibold text-error">01 critical</span>
          </p>
        </div>
        <button type="button" className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 font-label-caps text-on-secondary shadow-card hover:bg-blue-700 active:scale-[0.98] transition">
          <span className="material-symbols-outlined text-[16px]">file_download</span>
          EXPORT
        </button>
      </header>

      {/* Sector filter toolbar */}
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Sector filter">
        {SECTORS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSector(s)}
            aria-pressed={sector === s}
            className={`rounded-lg border px-3 py-1.5 font-label-caps transition ${
              sector === s
                ? 'border-secondary bg-secondary text-on-primary shadow-card'
                : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-secondary hover:text-secondary'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 2x2 CCTV wall */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CCTVCard
          camera={FEEDS[0]}
          overlay={
            <DetectionOverlay
              boxes={[
                { x: '42%', y: '48%', w: '22%', h: '30%', label: 'COLLISION 0.94', color: 'border-error' },
                { x: '18%', y: '55%', w: '12%', h: '28%', label: 'VEHICLE 0.91', color: 'border-secondary-fixed' },
              ]}
            />
          }
        >
          <p className="absolute bottom-2 left-2 rounded-md bg-error px-1.5 py-0.5 font-data-mono-sm text-on-error shadow-pop">
            CRITICAL &middot; COLLISION &middot; LANES 1-2 BLOCKED
          </p>
          <p className="absolute bottom-2 right-2 rounded-md bg-primary/80 px-1.5 py-0.5 font-data-mono-sm text-white backdrop-blur-sm">
            30FPS &middot; H.265 &middot; 4K
          </p>
        </CCTVCard>
        <CCTVCard
          camera={FEEDS[1]}
          overlay={
            <DetectionOverlay
              boxes={[{ x: '25%', y: '35%', w: '45%', h: '40%', label: 'CROWD SURGE 0.89', color: 'border-amber-500' }]}
            />
          }
        >
          <p className="absolute bottom-2 left-2 rounded-md bg-primary/80 px-1.5 py-0.5 font-data-mono-sm text-white backdrop-blur-sm">
            CROWD SURGE &middot; DENSITY +42%
          </p>
        </CCTVCard>
        <CCTVCard
          camera={FEEDS[2]}
          overlay={
            <DetectionOverlay
              boxes={[{ x: '58%', y: '52%', w: '14%', h: '26%', label: 'BAG 0.91', color: 'border-error' }]}
            />
          }
        >
          <p className="absolute bottom-2 left-2 rounded-md bg-primary/80 px-1.5 py-0.5 font-data-mono-sm text-white backdrop-blur-sm">
            BAGGAGE WATCH &middot; DWELL 6 MIN
          </p>
        </CCTVCard>
        <CCTVCard camera={FEEDS[3]}>
          <p className="absolute bottom-2 left-2 rounded-md bg-primary/80 px-1.5 py-0.5 font-data-mono-sm text-white backdrop-blur-sm">
            ARTERIAL FLOW &middot; NOMINAL
          </p>
        </CCTVCard>
      </div>

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
          </tbody>
        </table>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-2 font-data-mono-sm text-on-surface-variant">
        <span>SHOWING {rows.length} OF {mockDetections.length} DETECTIONS · PAGE {safePage + 1}/{pageCount}</span>
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
