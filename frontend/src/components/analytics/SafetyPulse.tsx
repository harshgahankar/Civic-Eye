export interface SafetyPulseProps {
  score?: number;
  delta?: string;
  trend?: string;
}

export function SafetyPulse({
  score = 0,
  delta = 'no data yet',
  trend = '',
}: SafetyPulseProps) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const clamped = Math.min(100, Math.max(0, score));
  const ring = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ba1a1a';
  void trend;
  return (
    <section className="bg-primary-container rounded-xl p-space-md flex items-center gap-space-md">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={`Safety pulse ${clamped} of 100`}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="11" />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={ring}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * C} ${C}`}
            transform="rotate(-90 50 50)"
            className="transition-all"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-headline-md text-on-primary">{clamped}</span>
          <span className="font-data-mono-sm text-secondary-fixed-dim">/100</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-label-caps text-secondary-fixed-dim">SAFETY PULSE</p>
        <p className="font-body-md font-medium text-on-primary">
          {clamped >= 80 ? 'Citywide watch nominal' : clamped >= 50 ? 'Elevated activity — monitor' : clamped > 0 ? 'High incident load — respond' : 'Awaiting incident data'}
        </p>
        <p className="pt-1 font-data-mono-sm text-secondary-fixed-dim">{delta}</p>
      </div>
    </section>
  );
}

export default SafetyPulse;
