export type MapMode = 'OPTICAL' | 'THERMAL' | 'TRAFFIC';

const MODES: MapMode[] = ['OPTICAL', 'THERMAL', 'TRAFFIC'];

interface Props {
  mode?: MapMode;
  onModeChange?: (m: MapMode) => void;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export function MapControls({ mode = 'OPTICAL', onModeChange, zoom = 1, onZoomIn, onZoomOut }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-card" role="tablist" aria-label="Map layer mode">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => onModeChange?.(m)}
            className={`rounded-lg px-3 py-1.5 font-label-caps transition ${
              mode === m ? 'bg-primary-container text-white shadow-card' : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Zoom map in"
          onClick={onZoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest font-data-mono-lg text-on-surface shadow-card hover:border-secondary hover:text-secondary transition"
        >
          +
        </button>
        <span className="w-12 text-center font-data-mono-sm tabular-nums text-on-surface-variant" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="Zoom map out"
          onClick={onZoomOut}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest font-data-mono-lg text-on-surface shadow-card hover:border-secondary hover:text-secondary transition"
        >
          −
        </button>
      </div>
    </div>
  );
}

export default MapControls;
