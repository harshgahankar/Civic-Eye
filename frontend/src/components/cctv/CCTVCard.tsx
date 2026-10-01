import type { ReactNode } from 'react';
import CameraStatus from './CameraStatus';

export interface CameraFeed {
  id: string;
  name: string;
  src: string;
  fps?: number;
  live?: boolean;
}

export type CamSeverity = 'nominal' | 'low' | 'medium' | 'high' | 'critical';

export interface CCTVCardProps {
  camera: CameraFeed;
  overlay?: ReactNode;
  children?: ReactNode;
  /** Incident severity on this feed — drives accent ring + status bar. */
  severity?: CamSeverity;
  /** Primary status line (e.g. incident title or location). */
  caption?: string;
  /** Secondary status line (e.g. severity · state). */
  subCaption?: string;
}

const SEVERITY_RING: Record<CamSeverity, string> = {
  nominal: 'border-outline-variant',
  low: 'border-outline-variant',
  medium: 'border-secondary/60',
  high: 'border-amber-500/70',
  critical: 'border-error ring-2 ring-error/30',
};

const SEVERITY_DOT: Record<CamSeverity, string> = {
  nominal: 'bg-emerald-500',
  low: 'bg-emerald-500',
  medium: 'bg-secondary',
  high: 'bg-amber-500',
  critical: 'bg-error animate-pulse',
};

const SEVERITY_BADGE: Record<CamSeverity, string> = {
  nominal: 'bg-emerald-500/15 text-emerald-700',
  low: 'bg-emerald-500/15 text-emerald-700',
  medium: 'bg-secondary/15 text-secondary',
  high: 'bg-amber-500/15 text-amber-700',
  critical: 'bg-error text-on-error',
};

export function CCTVCard({
  camera,
  overlay,
  children,
  severity = 'nominal',
  caption,
  subCaption,
}: CCTVCardProps) {
  const alert = severity === 'critical' || severity === 'high';
  const title = caption ?? camera.name;
  return (
    <article
      className={`group overflow-hidden rounded-2xl border bg-surface-container-lowest shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop ${SEVERITY_RING[severity]}`}
    >
      {/* Header: identity + live pill */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[severity]}`} aria-hidden />
        <p className="min-w-0 flex-1 truncate font-data-mono-md text-on-surface">
          <span className="font-bold tracking-wide">{camera.id}</span>
          <span className="font-normal text-on-surface-variant"> · {camera.name}</span>
        </p>
        <CameraStatus live={camera.live} fps={camera.fps} />
      </div>

      {/* Feed */}
      <div className="relative aspect-video overflow-hidden bg-primary">
        {camera.src && /\.(mp4|webm|ogg)(\?|$)/i.test(camera.src) ? (
          <video
            src={camera.src}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={`${camera.id} feed`}
          />
        ) : camera.src ? (
          <img src={camera.src} alt={`${camera.id} feed`} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-primary-container" aria-label={`${camera.id} no video source`}>
            <span className="material-symbols-outlined text-[34px] text-slate-500">videocam_off</span>
            <span className="font-data-mono-sm text-slate-400">{camera.live ? 'SIGNAL PENDING' : 'OFFLINE'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-primary/10 pointer-events-none" />
        {/* Viewfinder corners */}
        <span className="absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 border-white/70 rounded-tl-md drop-shadow" />
        <span className="absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 border-white/70 rounded-tr-md drop-shadow" />
        <span className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 border-white/70 rounded-bl-md drop-shadow" />
        <span className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 border-white/70 rounded-br-md drop-shadow" />
        {/* REC + severity badges */}
        {camera.live && (
          <span className="absolute top-3 left-8 flex items-center gap-1 rounded-md bg-primary/70 px-1.5 py-0.5 font-data-mono-sm text-white backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-error animate-pulse" />
            REC
          </span>
        )}
        {alert && (
          <span className={`absolute top-3 right-8 rounded-md px-1.5 py-0.5 font-label-caps shadow-pop ${SEVERITY_BADGE[severity]}`}>
            {severity.toUpperCase()}
          </span>
        )}
        {overlay}
        {children}
      </div>

      {/* Status bar: severity + caption + telemetry */}
      <div className={`flex items-center gap-2.5 px-3.5 py-2.5 ${alert ? 'bg-error/5' : 'bg-surface-container-low/60'}`}>
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 font-label-caps ${SEVERITY_BADGE[severity]}`}>
          {severity === 'nominal' ? 'NOMINAL' : severity.toUpperCase()}
        </span>
        <p className="min-w-0 flex-1 truncate font-body-sm font-medium text-on-surface" title={title}>
          {title}
        </p>
        <span className="shrink-0 font-data-mono-sm tabular-nums text-on-surface-variant">
          {camera.fps ?? 30}FPS · {camera.live ? 'LIVE' : 'IDLE'}
        </span>
      </div>
      {subCaption && (
        <p className="truncate border-t border-outline-variant/60 px-3.5 py-1.5 font-data-mono-sm text-on-surface-variant" title={subCaption}>
          {subCaption}
        </p>
      )}
    </article>
  );
}

export default CCTVCard;
