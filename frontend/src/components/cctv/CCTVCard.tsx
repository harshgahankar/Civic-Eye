import type { ReactNode } from 'react';
import CameraStatus from './CameraStatus';

export interface CameraFeed {
  id: string;
  name: string;
  src: string;
  fps?: number;
  live?: boolean;
}

export interface CCTVCardProps {
  camera: CameraFeed;
  overlay?: ReactNode;
  children?: ReactNode;
}

export function CCTVCard({ camera, overlay, children }: CCTVCardProps) {
  return (
    <article className="bg-primary-container border border-outline/20 rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-space-sm py-space-xs">
        <p className="font-data-mono-md text-on-primary">{camera.id} · {camera.name}</p>
        <CameraStatus live={camera.live} fps={camera.fps} />
      </div>
      <div className="relative aspect-video bg-primary">
        <img src={camera.src} alt={`${camera.id} feed`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <span className="absolute top-1 left-1 w-4 h-4 border-t-2 border-l-2 border-secondary-fixed" />
        <span className="absolute top-1 right-1 w-4 h-4 border-t-2 border-r-2 border-secondary-fixed" />
        <span className="absolute bottom-1 left-1 w-4 h-4 border-b-2 border-l-2 border-secondary-fixed" />
        <span className="absolute bottom-1 right-1 w-4 h-4 border-b-2 border-r-2 border-secondary-fixed" />
        {overlay}
        {children}
      </div>
      <div className="flex items-center justify-between px-space-sm py-space-xs font-data-mono-sm text-on-primary-container">
        <span>OSD {camera.id} · 1080p</span>
        <span>TELEMETRY 30FPS · H.265</span>
      </div>
    </article>
  );
}

export default CCTVCard;
