const STAGES = [
  { cam: 'CAM-07 · JUNCTION A', t: '08:42:10Z', n: 'SUBJECT-442 ACQUIRED' },
  { cam: 'CAM-08 · JUNCTION B', t: '08:44:02Z', n: 'HANDOFF · VECTOR EAST' },
  { cam: 'CAM-01 · EXPRESSWAY', t: '08:47:31Z', n: 'RE-ACQUIRED · CONF 0.91' },
];

export function MultiCameraTrackingPage() {
  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <p className="font-label-caps text-on-surface-variant">CROSS-CAMERA SUBJECT TRAIL</p>
        <h1 className="font-headline-xl text-on-surface">MULTI-CAMERA TRACKING</h1>
      </header>
      <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
        <p className="font-label-caps text-on-surface-variant">TRACK PANEL · SUBJECT-442</p>
        <p className="font-data-mono-md text-on-surface pt-space-xs">STATE: HELD · 96 FRAMES · 3 CAMERAS</p>
      </section>
      <ol className="flex flex-col gap-space-sm">
        {STAGES.map((s, i) => (
          <li key={s.cam} className="flex gap-space-sm rounded-sm border border-outline-variant bg-surface-container-lowest p-space-sm">
            <span className="font-data-mono-md text-secondary">0{i + 1}</span>
            <div>
              <p className="font-label-caps text-on-surface">{s.cam}</p>
              <p className="font-data-mono-sm text-on-surface-variant">{s.t} · {s.n}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
        <p className="font-label-caps text-on-surface-variant">CAMERA HISTORY</p>
        <p className="font-data-mono-sm text-on-surface-variant pt-space-xs">CAM-07 → CAM-08 → CAM-01 · GAP 0 FRAMES</p>
      </section>
    </div>
  );
}

export default MultiCameraTrackingPage;
