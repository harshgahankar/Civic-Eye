export function SafetyPulse() {
  return (
    <section className="bg-primary-container rounded-sm p-space-md flex items-center gap-space-md">
      <div>
        <p className="font-label-caps text-secondary-fixed-dim">SAFETY PULSE</p>
        <p className="font-headline-lg text-on-primary">87<span className="font-body-md text-secondary-fixed-dim">/100</span></p>
      </div>
      <svg viewBox="0 0 120 40" className="w-40 h-10" aria-hidden>
        <polyline points="0,30 15,28 30,24 45,26 60,18 75,20 90,12 105,14 120,8" fill="none" stroke="#abc8f4" strokeWidth="2" />
      </svg>
      <p className="font-data-mono-sm text-secondary-fixed-dim ml-auto">+2.4 vs 7d avg</p>
    </section>
  );
}

export default SafetyPulse;
