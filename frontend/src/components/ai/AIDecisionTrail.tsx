export interface TrailPhase {
  t: string;
  d: string;
}

export function AIDecisionTrail({ phases = [] }: { phases?: TrailPhase[] }) {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant pb-space-sm">FORENSIC TIMELINE · {phases.length} PHASES</p>
      {phases.length === 0 ? (
        <p className="font-body-sm text-on-surface-variant">No decision trail recorded for this incident yet.</p>
      ) : (
        <ol className="flex flex-col gap-space-sm">
          {phases.map((p, i) => (
            <li key={`${p.t}-${i}`} className="flex gap-space-sm">
              <span className="font-data-mono-md text-secondary">0{i + 1}</span>
              <div>
                <p className="font-label-caps text-on-surface">{p.t}</p>
                <p className="font-body-sm text-on-surface-variant">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default AIDecisionTrail;
