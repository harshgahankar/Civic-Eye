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
    <div className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: x, top: y }} title={id}>
      <span className={`material-symbols-outlined rounded-full p-1 text-lg shadow-pop ring-2 ${critical ? 'bg-error text-on-error ring-red-300' : 'bg-secondary-fixed text-on-secondary-fixed ring-white/60'}`}>
        videocam
      </span>
      <span className="mt-0.5 rounded bg-primary/80 px-1 font-data-mono-sm text-white backdrop-blur-sm">{id}</span>
    </div>
  );
}

export default CameraMarker;
