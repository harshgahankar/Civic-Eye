import type { MarkerBase } from './CameraMarker';

export interface IncidentMarkerProps extends MarkerBase {
  label: string;
}

export function IncidentMarker({ x, y, label }: IncidentMarkerProps) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }} title={label} role="img" aria-label={label}>
      <span className="relative flex h-4 w-4">
        <span className="absolute h-full w-full rounded-full bg-error animate-ping opacity-60" />
        <span className="h-4 w-4 rounded-full bg-error border-2 border-white shadow-pop" />
      </span>
    </div>
  );
}

export default IncidentMarker;
