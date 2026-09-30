const PHASES = [
  { t: 'DETECT', d: 'YOLOv8 box · 0.98 · CAM-07 f-1182' },
  { t: 'TRACK', d: 'ID-442 held 96 frames · owner vector split' },
  { t: 'REASON', d: 'Dwell >90s + separation >25m → critical' },
  { t: 'ACT', d: 'Alert + dossier + dispatch proposal' },
];

export function AIDecisionTrail() {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant pb-space-sm">FORENSIC TIMELINE · 4 PHASES</p>
      <ol className="flex flex-col gap-space-sm">
        {PHASES.map((p, i) => (
          <li key={p.t} className="flex gap-space-sm">
            <span className="font-data-mono-md text-secondary">0{i + 1}</span>
            <div>
              <p className="font-label-caps text-on-surface">{p.t}</p>
              <p className="font-body-sm text-on-surface-variant">{p.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default AIDecisionTrail;
