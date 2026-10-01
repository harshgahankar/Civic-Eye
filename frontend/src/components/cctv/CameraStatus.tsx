export interface CameraStatusProps {
  live?: boolean;
  fps?: number;
}

export function CameraStatus({ live = true, fps = 30 }: CameraStatusProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-label-caps ${live ? 'bg-error text-on-error' : 'bg-surface-container-high text-on-surface-variant'}`}>
        {live && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
        {live ? 'LIVE' : 'IDLE'}
      </span>
      <span className="font-data-mono-sm tabular-nums text-on-surface-variant">{fps} FPS</span>
    </span>
  );
}

export default CameraStatus;
