import type { MarkerBase } from './CameraMarker';

export interface ResourceMarkerProps extends MarkerBase {
  label: string;
}

export function ResourceMarker({ x, y, label }: ResourceMarkerProps) {
  return (
    <div className="absolute flex items-center gap-1" style={{ left: x, top: y }} title={label}>
      <span className="w-3 h-3 rounded-sm bg-emerald-500 border border-on-primary" />
      <span className="font-data-mono-sm text-emerald-200">{label}</span>
    </div>
  );
}

export default ResourceMarker;
