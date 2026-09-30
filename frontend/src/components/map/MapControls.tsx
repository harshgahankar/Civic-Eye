const MODES = ['OPTICAL', 'THERMAL', 'TRAFFIC'];

export function MapControls() {
  return (
    <div className="flex items-center gap-space-sm">
      <div className="flex gap-1 bg-surface-container border border-outline-variant rounded-sm p-1">
        {MODES.map((m, i) => (
          <button key={m} className={`font-label-caps px-space-sm py-1 rounded-sm ${i === 0 ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            {m}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <button aria-label="zoom in" className="w-8 h-8 border border-outline-variant rounded-sm font-data-mono-lg text-on-surface bg-surface-container-lowest">+</button>
        <button aria-label="zoom out" className="w-8 h-8 border border-outline-variant rounded-sm font-data-mono-lg text-on-surface bg-surface-container-lowest">−</button>
      </div>
    </div>
  );
}

export default MapControls;
