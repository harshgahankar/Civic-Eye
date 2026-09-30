const ZONES = [
  { k: 'METRO CONCOURSE', v: 78, s: 'SURGE WATCH' },
  { k: 'STATION GATE 2', v: 46, s: 'NOMINAL' },
  { k: 'MARKET ROW', v: 31, s: 'NOMINAL' },
];

export function CrowdIntelligencePage() {
  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <p className="font-label-caps text-on-surface-variant">DENSITY GRID &middot; LIVE ESTIMATE</p>
        <h1 className="font-headline-xl text-on-surface">CROWD INTELLIGENCE</h1>
      </header>
      <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
        <p className="font-label-caps text-on-surface-variant">CROWD ANALYSIS · CAM-04 METRO CENTRAL</p>
        <p className="font-body-md text-on-surface pt-space-xs">Density +42% in 5 min. Flow east-biased. Threshold watch at 80%.</p>
      </section>
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
        {ZONES.map((z) => (
          <div key={z.k} className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
            <p className="font-label-caps text-on-surface-variant">{z.k}</p>
            <p className="font-headline-lg text-on-surface">{z.v}%</p>
            <div className="mt-space-sm h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full bg-secondary rounded-full" style={{ width: `${z.v}%` }} />
            </div>
            <p className="pt-space-xs font-data-mono-sm text-secondary">{z.s}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CrowdIntelligencePage;
