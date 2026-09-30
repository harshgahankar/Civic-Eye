const STEPS = ['INGEST', 'DETECT', 'TRACK', 'FUSE', 'ALERT'];

export function DetectionPipeline() {
  return (
    <div className="flex items-center gap-1 bg-primary-container rounded-sm p-space-sm overflow-x-auto">
      {STEPS.map((s, i) => (
        <span key={s} className="flex items-center gap-1 shrink-0">
          <span className="font-label-caps bg-secondary text-on-primary px-space-sm py-1 rounded-sm">{s}</span>
          {i < STEPS.length - 1 && <span className="text-secondary-fixed-dim">→</span>}
        </span>
      ))}
      <span className="ml-auto font-data-mono-sm text-secondary-fixed-dim shrink-0">1.4s E2E</span>
    </div>
  );
}

export default DetectionPipeline;
