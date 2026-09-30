export interface MarkerBase {
  x: string;
  y: string;
}

export interface CameraMarkerProps extends MarkerBase {
  id: string;
  critical?: boolean;
}

export function CameraMarker({ x, y, id, critical = false }: CameraMarkerProps) {
  return (
    <div className="absolute flex flex-col items-center" style={{ left: x, top: y }} title={id}>
      <span className={`material-symbols-outlined text-lg rounded-full p-1 ${critical ? 'bg-error text-on-error' : 'bg-secondary-fixed text-on-secondary-fixed'}`}>
        videocam
      </span>
      <span className="font-data-mono-sm text-secondary-fixed-dim">{id}</span>
    </div>
  );
}

export default CameraMarker;
