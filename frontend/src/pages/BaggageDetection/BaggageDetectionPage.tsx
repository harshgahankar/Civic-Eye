export function BaggageDetectionPage() {
  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <p className="font-label-caps text-on-surface-variant">STATIONARY OBJECT WATCH</p>
        <h1 className="font-headline-xl text-on-surface">BAGGAGE DETECTION</h1>
      </header>
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        <section className="rounded-sm border border-error/40 bg-surface-container-lowest p-space-md">
          <p className="font-label-caps text-error">BAG-118 · CAM-12 · DWELL 6 MIN</p>
          <p className="font-body-md text-on-surface pt-space-xs">Stationary luggage, owner separation 25m. Confidence 91.4%.</p>
          <div className="flex gap-space-sm pt-space-sm">
            <button className="font-label-caps bg-error px-space-sm py-1 text-on-error rounded-sm">FLAG CRITICAL</button>
            <button className="font-label-caps border border-outline px-space-sm py-1 text-on-surface-variant rounded-sm">DISMISS</button>
          </div>
        </section>
        <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
          <p className="font-label-caps text-on-surface-variant">OWNER TRACKING · SUBJECT-219</p>
          <p className="font-data-mono-md text-on-surface pt-space-xs">LAST SEEN GATE 2 EAST · 40M RADIUS · HELD 96 FRAMES</p>
          <p className="font-data-mono-sm text-secondary pt-space-xs">RE-UNITE ETA UNKNOWN · PATROL NOTIFIED</p>
        </section>
      </div>
    </div>
  );
}

export default BaggageDetectionPage;
