import type { MarkerBase } from './CameraMarker';

export interface IncidentMarkerProps extends MarkerBase {
  label: string;
}

export function IncidentMarker({ x, y, label }: IncidentMarkerProps) {
  return (
    <div className="absolute" style={{ left: x, top: y }} title={label}>
      <span className="block w-4 h-4 rounded-full bg-error animate-ping" />
      <span className="block -mt-4 w-4 h-4 rounded-full bg-error border-2 border-on-error" />
    </div>
  );
}

export default IncidentMarker;
