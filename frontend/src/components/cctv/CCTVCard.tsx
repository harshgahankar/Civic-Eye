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
    <article className="group overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-card transition-all hover:shadow-pop">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-outline-variant/70">
        <p className="truncate font-data-mono-md font-semibold text-on-surface">{camera.id} <span className="font-normal text-on-surface-variant">· {camera.name}</span></p>
        <CameraStatus live={camera.live} fps={camera.fps} />
      </div>
      <div className="relative aspect-video bg-primary overflow-hidden">
        {camera.src && /\.(mp4|webm|ogg)(\?|$)/i.test(camera.src) ? (
          <video
            src={camera.src}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={`${camera.id} feed`}
          />
        ) : camera.src ? (
          <img src={camera.src} alt={`${camera.id} feed`} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-primary-container" aria-label={`${camera.id} no video source`}>
            <span className="material-symbols-outlined text-[34px] text-slate-500">videocam_off</span>
            <span className="font-data-mono-sm text-slate-400">{camera.live ? 'SIGNAL PENDING' : 'OFFLINE'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent pointer-events-none" />
        <span className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/80 rounded-tl-sm drop-shadow" />
        <span className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/80 rounded-tr-sm drop-shadow" />
        <span className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/80 rounded-bl-sm drop-shadow" />
        <span className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/80 rounded-br-sm drop-shadow" />
        {overlay}
        {children}
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 font-data-mono-sm text-on-surface-variant bg-surface-container-low/50">
        <span>OSD {camera.id} · 1080p</span>
        <span>30FPS · H.265</span>
      </div>
    </article>
  );
}

export default CCTVCard;
