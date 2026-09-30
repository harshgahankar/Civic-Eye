import { useState } from 'react';
import CCTVGrid from '../../components/cctv/CCTVGrid';
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

export function LiveCamerasPage() {
  const [sector, setSector] = useState(SECTORS[0]);

  return (
    <div className="flex flex-col gap-space-lg">
      {/* Archival banner strip */}
      <div className="bg-primary-container px-space-md py-space-xs font-data-mono-sm text-secondary-fixed">
        ARCHIVE REEL 2026-09-30 &middot; 189 TARGETS INDEXED &middot; RETENTION 90D &middot; CHAIN-OF-CUSTODY SEALED
      </div>

      {/* Page header */}
      <header className="flex flex-wrap items-end gap-space-md">
        <div>
          <p className="font-label-caps text-on-surface-variant">CCTV WALL &middot; SECTOR GRID</p>
          <h1 className="font-headline-xl text-on-surface">LIVE SURVEILLANCE</h1>
          <p className="font-data-mono-md text-on-surface-variant pt-space-xs">
            189 targets &middot; <span className="text-error">01 critical</span>
          </p>
        </div>
        <button className="ml-auto font-label-caps bg-secondary px-space-md py-2 text-on-primary rounded-sm">
          EXPORT
        </button>
      </header>

      {/* Sector filter toolbar */}
      <div className="flex flex-wrap gap-space-sm" role="toolbar" aria-label="Sector filter">
        {SECTORS.map((s) => (
          <button
            key={s}
            onClick={() => setSector(s)}
            className={`font-label-caps rounded-sm border px-space-sm py-1 ${
              sector === s
                ? 'border-secondary bg-secondary text-on-primary'
                : 'border-outline text-on-surface-variant'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 2x2 CCTV wall */}
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
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
          <p className="absolute bottom-1 left-1 bg-error px-1 font-data-mono-sm text-on-error">
            CRITICAL &middot; COLLISION &middot; LANES 1-2 BLOCKED
          </p>
          <p className="absolute bottom-1 right-1 bg-primary/80 px-1 font-data-mono-sm text-on-primary">
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
          <p className="absolute bottom-1 left-1 bg-primary/80 px-1 font-data-mono-sm text-on-primary">
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
          <p className="absolute bottom-1 left-1 bg-primary/80 px-1 font-data-mono-sm text-on-primary">
            BAGGAGE WATCH &middot; DWELL 6 MIN
          </p>
        </CCTVCard>
        <CCTVCard camera={FEEDS[3]}>
          <p className="absolute bottom-1 left-1 bg-primary/80 px-1 font-data-mono-sm text-on-primary">
            ARTERIAL FLOW &middot; NOMINAL
          </p>
        </CCTVCard>
      </div>
      <div className="hidden">
        <CCTVGrid cameras={FEEDS} />
      </div>

      {/* Detection telemetry table */}
      <section className="overflow-x-auto rounded-sm border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-left">
          <thead>
            <tr className="font-label-caps text-on-surface-variant">
              <th className="px-space-sm py-space-xs">DETECTION</th>
              <th className="px-space-sm py-space-xs">CAMERA</th>
              <th className="px-space-sm py-space-xs">LABEL</th>
              <th className="px-space-sm py-space-xs">CONF</th>
              <th className="px-space-sm py-space-xs">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {mockDetections.slice(0, 5).map((d) => (
              <tr key={d.id} className="border-t border-outline-variant font-data-mono-md text-on-surface">
                <td className="px-space-sm py-space-xs">{d.id}</td>
                <td className="px-space-sm py-space-xs">{d.cameraId}</td>
                <td className="px-space-sm py-space-xs">{d.label}</td>
                <td className="px-space-sm py-space-xs">{d.confidence.toFixed(1)}%</td>
                <td className="px-space-sm py-space-xs font-label-caps text-secondary">{d.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <footer className="flex items-center justify-between font-data-mono-sm text-on-surface-variant">
        <span>SHOWING 5 OF 189 DETECTIONS</span>
        <div className="flex gap-space-sm">
          <button className="border border-outline rounded-sm px-space-sm py-1">PREV</button>
          <button className="border border-outline rounded-sm px-space-sm py-1">NEXT</button>
        </div>
      </footer>
    </div>
  );
}

export default LiveCamerasPage;
