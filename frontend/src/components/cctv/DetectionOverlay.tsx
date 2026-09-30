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
        <div key={b.label} className={`absolute border-2 ${b.color ?? 'border-secondary-fixed'}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
          <span className="absolute -top-5 left-0 font-data-mono-sm bg-primary text-on-primary px-1">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export default DetectionOverlay;
