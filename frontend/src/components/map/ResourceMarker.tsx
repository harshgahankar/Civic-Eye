import type { MarkerBase } from './CameraMarker';

export interface ResourceMarkerProps extends MarkerBase {
  label: string;
}

export function ResourceMarker({ x, y, label }: ResourceMarkerProps) {
  return (
    <div className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1" style={{ left: x, top: y }} title={label}>
      <span className="h-3 w-3 rounded-sm bg-emerald-500 border border-white shadow-pop" />
      <span className="rounded bg-primary/80 px-1 font-data-mono-sm text-emerald-200 backdrop-blur-sm">{label}</span>
    </div>
  );
}

export default ResourceMarker;
