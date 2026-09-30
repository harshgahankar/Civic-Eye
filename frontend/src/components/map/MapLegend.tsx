const ITEMS = [
  { c: 'bg-secondary', t: 'Camera online' },
  { c: 'bg-error', t: 'Critical incident' },
  { c: 'bg-amber-500', t: 'High incident' },
];

export function MapLegend() {
  return (
    <div className="flex flex-wrap gap-space-md font-data-mono-sm text-on-surface-variant">
      {ITEMS.map((i) => (
        <span key={i.t} className="flex items-center gap-1">
          <span className={`w-2.5 h-2.5 rounded-full ${i.c}`} />
          {i.t}
        </span>
      ))}
    </div>
  );
}

export default MapLegend;
