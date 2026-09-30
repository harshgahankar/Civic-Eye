export interface Box {
  x: string;
  y: string;
  w: string;
  h: string;
  label: string;
  color?: string;
}

export function DetectionOverlay({ boxes }: { boxes?: Box[] }) {
  const defaults: Box[] = boxes ?? [
    { x: '58%', y: '52%', w: '14%', h: '26%', label: 'BAG 0.98', color: 'border-error' },
    { x: '30%', y: '40%', w: '10%', h: '34%', label: 'PERSON 0.91', color: 'border-secondary-fixed' },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {defaults.map((b) => (
        <div key={b.label} className={`absolute rounded-[3px] border-2 ${b.color ?? 'border-secondary-fixed'}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
          <span className="absolute -top-6 left-0 whitespace-nowrap rounded-md bg-primary/90 px-1.5 py-0.5 font-data-mono-sm text-white shadow-pop backdrop-blur-sm">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export default DetectionOverlay;
