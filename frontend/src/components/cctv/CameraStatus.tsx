export interface CameraStatusProps {
  live?: boolean;
  fps?: number;
}

export function CameraStatus({ live = true, fps = 30 }: CameraStatusProps) {
  return (
    <span className="flex items-center gap-1">
      <span className={`font-label-caps px-space-xs py-0.5 rounded-full ${live ? 'bg-error text-on-error' : 'bg-surface-container-high text-on-surface-variant'}`}>
        {live ? '● LIVE' : '○ IDLE'}
      </span>
      <span className="font-data-mono-sm text-on-primary-container">{fps} FPS</span>
    </span>
  );
}

export default CameraStatus;
