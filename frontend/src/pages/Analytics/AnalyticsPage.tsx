import { useState } from 'react';
import IncidentChart from '../../components/analytics/IncidentChart';
import SeverityChart from '../../components/analytics/SeverityChart';
import SafetyPulse from '../../components/analytics/SafetyPulse';
import ResponseTimeChart from '../../components/analytics/ResponseTimeChart';

const COHORTS = ['LAST 30 DAYS', 'LAST 7 DAYS', 'LAST 24 HOURS'] as const;
const METRICS = [
  { k: 'TOTAL INCIDENTS', v: '312', d: '+4.1%' },
  { k: 'VERIFIED', v: '268', d: '85.9%' },
  { k: 'FALSE ALARMS', v: '19', d: '-2.3%' },
  { k: 'AVG RESPONSE', v: '4m 12s', d: '-38s' },
  { k: 'AI PRECISION', v: '93.9%', d: '+1.2' },
  { k: 'DISPATCH RATE', v: '78%', d: '+3.0' },
];
const BARS = [
  { k: 'CAM-07', v: 88 },
  { k: 'CAM-04', v: 64 },
  { k: 'CAM-12', v: 52 },
  { k: 'CAM-01', v: 41 },
  { k: 'CAM-09', v: 33 },
];
const AUDIT = [
  { id: 'AUD-2201', q: 'Q3 detection precision review', o: 'INSP. RAO', s: 'CERTIFIED' },
  { id: 'AUD-2200', q: 'Dispatch SLA conformance', o: 'INSP. IBARRA', s: 'CERTIFIED' },
  { id: 'AUD-2199', q: 'False-alarm drift audit', o: 'SYS. AUDIT', s: 'PENDING' },
  { id: 'AUD-2198', q: 'Retention & chain-of-custody', o: 'SYS. AUDIT', s: 'CERTIFIED' },
];

export function AnalyticsPage() {
  const [cohort, setCohort] = useState<(typeof COHORTS)[number]>(COHORTS[0]);

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-wrap items-end gap-space-md">
        <div>
          <p className="font-label-caps text-on-surface-variant">PERFORMANCE LEDGER &middot; {cohort}</p>
          <h1 className="font-headline-xl text-on-surface">ANALYTICS</h1>
        </div>
        <div className="ml-auto flex gap-space-sm">
          <div className="flex gap-space-sm" role="tablist" aria-label="Cohort switcher">
            {COHORTS.map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={cohort === c}
                onClick={() => setCohort(c)}
                className={`font-label-caps rounded-sm border px-space-sm py-1 ${
                  cohort === c ? 'border-secondary bg-secondary text-on-primary' : 'border-outline text-on-surface-variant'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <button className="font-label-caps bg-secondary px-space-md py-2 text-on-primary rounded-sm">EXPORT</button>
        </div>
      </header>

      {/* 6-metric strip */}
      <div className="grid grid-cols-2 gap-space-sm md:grid-cols-3 xl:grid-cols-6">
        {METRICS.map((m) => (
          <div key={m.k} className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-sm">
            <p className="font-label-caps text-on-surface-variant">{m.k}</p>
            <p className="font-headline-lg text-on-surface">{m.v}</p>
            <p className="font-data-mono-sm text-secondary">{m.d}</p>
          </div>
        ))}
      </div>

      {/* 30-day + severity composition */}
      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-12">
        <div className="xl:col-span-8"><IncidentChart /></div>
        <div className="xl:col-span-4"><SeverityChart /></div>
      </div>

      {/* Quad charts */}
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
          <p className="font-label-caps text-on-surface-variant">INCIDENTS BY CAMERA</p>
          <ul className="flex flex-col gap-space-xs pt-space-sm">
            {BARS.map((b) => (
              <li key={b.k} className="flex items-center gap-space-sm">
                <span className="w-20 font-data-mono-sm text-on-surface">{b.k}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                  <span className="block h-full bg-secondary" style={{ width: `${b.v}%` }} />
                </span>
                <span className="font-data-mono-sm text-on-surface-variant">{b.v}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
          <p className="font-label-caps text-on-surface-variant">ROC · MODEL CONFIDENCE</p>
          <svg viewBox="0 0 120 80" className="h-32 w-full pt-space-sm" aria-hidden>
            <rect x="0" y="0" width="120" height="80" fill="none" stroke="#828da7" strokeWidth="1" />
            <polyline points="0,80 30,60 60,32 90,14 120,6" fill="none" stroke="#436086" strokeWidth="2" />
            <line x1="0" y1="80" x2="120" y2="0" stroke="#ba1a1a" strokeWidth="1" strokeDasharray="4 3" />
          </svg>
          <p className="font-data-mono-sm text-on-surface-variant">AUC 0.97 &middot; THRESHOLD 0.85</p>
        </section>
        <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
          <p className="font-label-caps text-on-surface-variant">FALSE-ALARM DRIFT</p>
          <svg viewBox="0 0 200 60" className="h-24 w-full pt-space-sm" aria-hidden>
            <polyline points="0,20 40,24 80,18 120,26 160,30 200,34" fill="none" stroke="#e8a33d" strokeWidth="2" />
          </svg>
          <p className="font-data-mono-sm text-on-surface-variant">6.1% &middot; WITHIN TOLERANCE</p>
        </section>
        <div className="flex flex-col gap-space-md">
          <SafetyPulse />
          <ResponseTimeChart />
        </div>
      </div>

      {/* Audit archive */}
      <section className="overflow-x-auto rounded-sm border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-left">
          <thead>
            <tr className="font-label-caps text-on-surface-variant">
              <th className="px-space-sm py-space-xs">AUDIT</th>
              <th className="px-space-sm py-space-xs">SUBJECT</th>
              <th className="px-space-sm py-space-xs">OFFICER</th>
              <th className="px-space-sm py-space-xs">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {AUDIT.map((a) => (
              <tr key={a.id} className="border-t border-outline-variant font-data-mono-md text-on-surface">
                <td className="px-space-sm py-space-xs">{a.id}</td>
                <td className="px-space-sm py-space-xs">{a.q}</td>
                <td className="px-space-sm py-space-xs">{a.o}</td>
                <td className="px-space-sm py-space-xs font-label-caps text-secondary">{a.s}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <footer className="flex items-center justify-between font-data-mono-sm text-on-surface-variant">
        <span>CERTIFIED LEDGER &middot; ISO 27001 &middot; RETENTION 7Y</span>
        <div className="flex gap-space-sm">
          <button className="border border-outline rounded-sm px-space-sm py-1">PREV</button>
          <button className="border border-outline rounded-sm px-space-sm py-1">NEXT</button>
        </div>
      </footer>
    </div>
  );
}

export default AnalyticsPage;
