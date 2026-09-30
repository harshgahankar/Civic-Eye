import { useState } from 'react';
import IncidentChart from '../../components/analytics/IncidentChart';
import SeverityChart from '../../components/analytics/SeverityChart';
import SafetyPulse from '../../components/analytics/SafetyPulse';
import ResponseTimeChart from '../../components/analytics/ResponseTimeChart';
import { downloadCSV, stamp } from '../../utils/actions';
import { useUiStore } from '../../store/uiStore';

const COHORTS = ['LAST 30 DAYS', 'LAST 7 DAYS', 'LAST 24 HOURS'] as const;
type Cohort = (typeof COHORTS)[number];

interface CohortData {
  metrics: { k: string; v: string; d: string }[];
  bars: { k: string; v: number }[];
  audit: { id: string; q: string; o: string; s: string }[];
  reported: number[];
  verified: number[];
  rangeLabel: string;
  segs: { k: string; v: number; c: string }[];
  pulse: { score: number; delta: string; trend: string };
  sectors: { k: string; v: number }[];
  auc: string;
  drift: string;
}

/** Per-period ledger. Backend: GET /analytics?cohort=30d|7d|24h */
const COHORT_DATA: Record<Cohort, CohortData> = {
  'LAST 30 DAYS': {
    metrics: [
      { k: 'TOTAL INCIDENTS', v: '312', d: '+4.1%' },
      { k: 'VERIFIED', v: '268', d: '85.9%' },
      { k: 'FALSE ALARMS', v: '19', d: '-2.3%' },
      { k: 'AVG RESPONSE', v: '4m 12s', d: '-38s' },
      { k: 'AI PRECISION', v: '93.9%', d: '+1.2' },
      { k: 'DISPATCH RATE', v: '78%', d: '+3.0' },
    ],
    bars: [
      { k: 'CAM-07', v: 88 },
      { k: 'CAM-04', v: 64 },
      { k: 'CAM-12', v: 52 },
      { k: 'CAM-01', v: 41 },
      { k: 'CAM-09', v: 33 },
    ],
    audit: [
      { id: 'AUD-2201', q: 'Q3 detection precision review', o: 'INSP. RAO', s: 'CERTIFIED' },
      { id: 'AUD-2200', q: 'Dispatch SLA conformance', o: 'INSP. IBARRA', s: 'CERTIFIED' },
      { id: 'AUD-2199', q: 'False-alarm drift audit', o: 'SYS. AUDIT', s: 'PENDING' },
      { id: 'AUD-2198', q: 'Retention & chain-of-custody', o: 'SYS. AUDIT', s: 'CERTIFIED' },
      { id: 'AUD-2197', q: 'Camera calibration sweep', o: 'INSP. RAO', s: 'CERTIFIED' },
      { id: 'AUD-2196', q: 'Night-shift coverage review', o: 'INSP. IBARRA', s: 'CERTIFIED' },
    ],
    reported: [12, 9, 14, 11, 16, 10, 13, 15, 9, 12, 14, 11, 10, 13, 16, 12, 9, 11, 14, 12, 10, 13, 15, 11, 9, 12, 14, 10, 11, 13],
    verified: [8, 7, 9, 8, 10, 7, 8, 9, 6, 8, 9, 7, 7, 8, 10, 8, 6, 7, 9, 8, 7, 8, 9, 7, 6, 8, 9, 7, 7, 8],
    rangeLabel: '30 DAY DUAL-LINE',
    segs: [
      { k: 'CRITICAL', v: 8, c: 'bg-error' },
      { k: 'HIGH', v: 22, c: 'bg-amber-500' },
      { k: 'MEDIUM', v: 35, c: 'bg-secondary' },
      { k: 'LOW', v: 35, c: 'bg-surface-container-high' },
    ],
    pulse: { score: 87, delta: '+2.4 vs 30d avg', trend: '0,30 15,28 30,24 45,26 60,18 75,20 90,12 105,14 120,8' },
    sectors: [
      { k: 'MIDTOWN', v: 92 },
      { k: 'HERALD', v: 74 },
      { k: 'PENN', v: 61 },
      { k: 'UNION', v: 48 },
    ],
    auc: 'AUC 0.97 · THRESHOLD 0.85',
    drift: '6.1% · WITHIN TOLERANCE',
  },
  'LAST 7 DAYS': {
    metrics: [
      { k: 'TOTAL INCIDENTS', v: '74', d: '+1.8%' },
      { k: 'VERIFIED', v: '61', d: '82.4%' },
      { k: 'FALSE ALARMS', v: '6', d: '-1.1%' },
      { k: 'AVG RESPONSE', v: '3m 58s', d: '-12s' },
      { k: 'AI PRECISION', v: '94.6%', d: '+0.7' },
      { k: 'DISPATCH RATE', v: '81%', d: '+1.4' },
    ],
    bars: [
      { k: 'CAM-07', v: 21 },
      { k: 'CAM-04', v: 17 },
      { k: 'CAM-12', v: 14 },
      { k: 'CAM-01', v: 11 },
      { k: 'CAM-09', v: 8 },
    ],
    audit: [
      { id: 'AUD-2201', q: 'Q3 detection precision review', o: 'INSP. RAO', s: 'CERTIFIED' },
      { id: 'AUD-2200', q: 'Dispatch SLA conformance', o: 'INSP. IBARRA', s: 'CERTIFIED' },
      { id: 'AUD-2199', q: 'False-alarm drift audit', o: 'SYS. AUDIT', s: 'PENDING' },
      { id: 'AUD-2195', q: 'Weekly roster coverage check', o: 'INSP. RAO', s: 'CERTIFIED' },
    ],
    reported: [11, 9, 13, 10, 12, 8, 9],
    verified: [8, 7, 9, 7, 8, 6, 7],
    rangeLabel: '7 DAY DUAL-LINE',
    segs: [
      { k: 'CRITICAL', v: 6, c: 'bg-error' },
      { k: 'HIGH', v: 25, c: 'bg-amber-500' },
      { k: 'MEDIUM', v: 38, c: 'bg-secondary' },
      { k: 'LOW', v: 31, c: 'bg-surface-container-high' },
    ],
    pulse: { score: 89, delta: '+1.1 vs 7d avg', trend: '0,32 20,30 40,26 60,27 80,18 100,16 120,10' },
    sectors: [
      { k: 'MIDTOWN', v: 88 },
      { k: 'HERALD', v: 71 },
      { k: 'PENN', v: 63 },
      { k: 'UNION', v: 50 },
    ],
    auc: 'AUC 0.96 · THRESHOLD 0.85',
    drift: '5.4% · WITHIN TOLERANCE',
  },
  'LAST 24 HOURS': {
    metrics: [
      { k: 'TOTAL INCIDENTS', v: '9', d: '-2 vs prior day' },
      { k: 'VERIFIED', v: '7', d: '77.8%' },
      { k: 'FALSE ALARMS', v: '1', d: '11.1%' },
      { k: 'AVG RESPONSE', v: '3m 41s', d: '-22s' },
      { k: 'AI PRECISION', v: '95.8%', d: '+1.9' },
      { k: 'DISPATCH RATE', v: '86%', d: '+4.2' },
    ],
    bars: [
      { k: 'CAM-07', v: 4 },
      { k: 'CAM-12', v: 2 },
      { k: 'CAM-04', v: 2 },
      { k: 'CAM-01', v: 1 },
      { k: 'CAM-09', v: 1 },
    ],
    audit: [
      { id: 'AUD-2202', q: 'Shift handover log — night watch', o: 'DIR. VANCE', s: 'CERTIFIED' },
      { id: 'AUD-2201', q: 'Q3 detection precision review', o: 'INSP. RAO', s: 'CERTIFIED' },
      { id: 'AUD-2199', q: 'False-alarm drift audit', o: 'SYS. AUDIT', s: 'PENDING' },
    ],
    reported: [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1],
    verified: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1],
    rangeLabel: '24 HOUR DUAL-LINE',
    segs: [
      { k: 'CRITICAL', v: 11, c: 'bg-error' },
      { k: 'HIGH', v: 33, c: 'bg-amber-500' },
      { k: 'MEDIUM', v: 34, c: 'bg-secondary' },
      { k: 'LOW', v: 22, c: 'bg-surface-container-high' },
    ],
    pulse: { score: 92, delta: '+0.6 vs 24h avg', trend: '0,34 20,33 40,30 60,28 80,22 100,18 120,12' },
    sectors: [
      { k: 'MIDTOWN', v: 95 },
      { k: 'HERALD', v: 78 },
      { k: 'PENN', v: 66 },
      { k: 'UNION', v: 55 },
    ],
    auc: 'AUC 0.98 · THRESHOLD 0.85',
    drift: '4.2% · WITHIN TOLERANCE',
  },
};

const AUDIT_PAGE_SIZE = 4;

export function AnalyticsPage() {
  const [cohort, setCohort] = useState<Cohort>(COHORTS[0]);
  const [auditPage, setAuditPage] = useState(0);
  const pushToast = useUiStore((s) => s.pushToast);
  const data = COHORT_DATA[cohort];

  const auditPages = Math.ceil(data.audit.length / AUDIT_PAGE_SIZE);
  const auditRows = data.audit.slice(auditPage * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE + AUDIT_PAGE_SIZE);

  const switchCohort = (c: Cohort) => {
    setCohort(c);
    setAuditPage(0);
  };

  const exportLedger = () => {
    downloadCSV(
      `civiceye_analytics_${stamp()}`,
      ['METRIC', 'VALUE', 'DELTA', 'COHORT'],
      [
        ...data.metrics.map((m) => [m.k, m.v, m.d, cohort] as (string | number)[]),
        ...data.audit.map((a) => [`AUDIT ${a.id}`, a.q, a.s, a.o] as (string | number)[]),
      ],
    );
    pushToast(`Exported performance ledger (${cohort}) to CSV.`, 'success');
  };

  return (
    <div className="flex flex-col gap-space-lg" key={cohort}>
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
                type="button"
                role="tab"
                aria-selected={cohort === c}
                onClick={() => switchCohort(c)}
                className={`font-label-caps rounded-sm border px-space-sm py-1 ${
                  cohort === c ? 'border-secondary bg-secondary text-on-primary' : 'border-outline text-on-surface-variant'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <button type="button" onClick={exportLedger} className="font-label-caps bg-secondary px-space-md py-2 text-on-primary rounded-sm hover:bg-blue-700 transition">EXPORT</button>
        </div>
      </header>

      {/* 6-metric strip */}
      <div className="grid grid-cols-2 gap-space-sm md:grid-cols-3 xl:grid-cols-6 anim-fade-up">
        {data.metrics.map((m) => (
          <div key={m.k} className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-sm">
            <p className="font-label-caps text-on-surface-variant">{m.k}</p>
            <p className="font-headline-lg text-on-surface">{m.v}</p>
            <p className="font-data-mono-sm text-secondary">{m.d}</p>
          </div>
        ))}
      </div>

      {/* range chart + severity composition */}
      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-12">
        <div className="xl:col-span-8">
          <IncidentChart reported={data.reported} verified={data.verified} rangeLabel={data.rangeLabel} />
        </div>
        <div className="xl:col-span-4">
          <SeverityChart segs={data.segs} />
        </div>
      </div>

      {/* Quad charts */}
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
          <p className="font-label-caps text-on-surface-variant">INCIDENTS BY CAMERA · {cohort}</p>
          <ul className="flex flex-col gap-space-xs pt-space-sm">
            {data.bars.map((b) => (
              <li key={b.k} className="flex items-center gap-space-sm">
                <span className="w-20 font-data-mono-sm text-on-surface">{b.k}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                  <span className="block h-full bg-secondary" style={{ width: `${Math.min(100, (b.v / Math.max(...data.bars.map((x) => x.v))) * 100)}%` }} />
                </span>
                <span className="font-data-mono-sm tabular-nums text-on-surface-variant">{b.v}</span>
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
          <p className="font-data-mono-sm text-on-surface-variant">{data.auc}</p>
        </section>
        <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
          <p className="font-label-caps text-on-surface-variant">FALSE-ALARM DRIFT · {cohort}</p>
          <svg viewBox="0 0 200 60" className="h-24 w-full pt-space-sm" aria-hidden>
            <polyline points="0,20 40,24 80,18 120,26 160,30 200,34" fill="none" stroke="#e8a33d" strokeWidth="2" />
          </svg>
          <p className="font-data-mono-sm text-on-surface-variant">{data.drift}</p>
        </section>
        <div className="flex flex-col gap-space-md">
          <SafetyPulse score={data.pulse.score} delta={data.pulse.delta} trend={data.pulse.trend} />
          <ResponseTimeChart sectors={data.sectors} />
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
            {auditRows.map((a) => (
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
      <footer className="flex flex-wrap items-center justify-between gap-space-sm font-data-mono-sm text-on-surface-variant">
        <span>CERTIFIED LEDGER &middot; ISO 27001 &middot; RETENTION 7Y &middot; {cohort} &middot; PAGE {Math.min(auditPage + 1, auditPages)}/{auditPages}</span>
        <div className="flex gap-space-sm">
          <button
            type="button"
            disabled={auditPage === 0}
            onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
            className="border border-outline rounded-sm px-space-sm py-1 hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:pointer-events-none transition"
          >
            PREV
          </button>
          <button
            type="button"
            disabled={auditPage >= auditPages - 1}
            onClick={() => setAuditPage((p) => Math.min(auditPages - 1, p + 1))}
            className="border border-outline rounded-sm px-space-sm py-1 hover:border-secondary hover:text-secondary disabled:opacity-40 disabled:pointer-events-none transition"
          >
            NEXT
          </button>
        </div>
      </footer>
    </div>
  );
}

export default AnalyticsPage;
