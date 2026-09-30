const STRIP = [
  { k: 'INGEST', v: '24 STREAMS · 30FPS' },
  { k: 'INFERENCE', v: 'YOLOv8 + TRACKER' },
  { k: 'THROUGHPUT', v: '1.2 GB/S' },
  { k: 'UPTIME', v: '99.98%' },
];

export function SystemStatus() {
  return (
    <footer className="flex flex-wrap items-center gap-space-md bg-primary-container text-secondary-fixed font-data-mono-sm px-space-lg py-space-sm rounded-sm">
      {STRIP.map((s) => (
        <span key={s.k}>
          {s.k}: <strong>{s.v}</strong>
        </span>
      ))}
      <span className="ml-auto">NYC-METRO-01 · ALL SYSTEMS NOMINAL</span>
    </footer>
  );
}

export default SystemStatus;
