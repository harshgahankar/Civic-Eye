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
  return (
    <section className="bg-primary-container rounded-sm p-space-md flex items-center gap-space-md">
      <div>
        <p className="font-label-caps text-secondary-fixed-dim">SAFETY PULSE</p>
        <p className="font-headline-lg text-on-primary">{score}<span className="font-body-md text-secondary-fixed-dim">/100</span></p>
      </div>
      <svg viewBox="0 0 120 40" className="w-40 h-10" aria-hidden>
        <polyline points={trend} fill="none" stroke="#abc8f4" strokeWidth="2" />
      </svg>
      <p className="font-data-mono-sm text-secondary-fixed-dim ml-auto">{delta}</p>
    </section>
  );
}

export default SafetyPulse;
