import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import IncidentChart from '../../components/analytics/IncidentChart';
import SeverityChart from '../../components/analytics/SeverityChart';
import SafetyPulse from '../../components/analytics/SafetyPulse';
import ResponseTimeChart from '../../components/analytics/ResponseTimeChart';
import { backend } from '../../services/backend';
import type { Incident } from '../../types/incident';
import { downloadCSV, stamp } from '../../utils/actions';
import { useUiStore } from '../../store/uiStore';

type Range = 'ALL' | '24H' | '7D';
const RANGE_MS: Record<Range, number> = { ALL: Infinity, '24H': 86400000, '7D': 604800000 };

/**
 * Analytics computed live from backend incidents — including incidents from
 * uploaded videos. Refreshes automatically so new uploads show up without
 * a page reload. Every number here is a direct aggregation of incident
 * records (no cohorts, ROC curves, or precision claims).
 */
export function AnalyticsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('ALL');
  const [showAllCams, setShowAllCams] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);

  const refresh = async () => {
    try {
      const rows = await backend.incidents(500);
      setIncidents(rows);
      setUpdatedAt(new Date());
    } catch {
      /* backend offline — keep last snapshot */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let live = true;
    refresh().catch(() => {});
    const timer = setInterval(() => { if (live) refresh().catch(() => {}); }, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (range === 'ALL') return incidents;
    const cutoff = Date.now() - RANGE_MS[range];
    return incidents.filter((i) => {
      const t = new Date(i.timestamp).getTime();
      return !Number.isNaN(t) && t >= cutoff;
    });
  }, [incidents, range]);

  const rangeCounts = useMemo(() => {
    const now = Date.now();
    const counts: Record<Range, number> = { ALL: incidents.length, '24H': 0, '7D': 0 };
    for (const i of incidents) {
      const t = new Date(i.timestamp).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= now - RANGE_MS['24H']) counts['24H'] += 1;
      if (t >= now - RANGE_MS['7D']) counts['7D'] += 1;
    }
    return counts;
  }, [incidents]);

  const stats = useMemo(() => {
    const byStatus = new Map<string, number>();
    const bySeverity = new Map<string, number>();
    const byCamera = new Map<string, number>();
    const byCameraVerified = new Map<string, number>();
    const byType = new Map<string, number>();
    for (const i of filtered) {
      byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);
      bySeverity.set(i.severity, (bySeverity.get(i.severity) ?? 0) + 1);
      byCamera.set(i.cameraId, (byCamera.get(i.cameraId) ?? 0) + 1);
      if (i.status === 'active' || i.status === 'dispatched') {
        byCameraVerified.set(i.cameraId, (byCameraVerified.get(i.cameraId) ?? 0) + 1);
      }
      byType.set(i.type, (byType.get(i.type) ?? 0) + 1);
    }
    const active = filtered.filter((i) => i.status !== 'resolved').length;
    const resolved = filtered.length - active;
    const confirmed = filtered.filter((i) => i.status === 'active').length;
    return { byStatus, bySeverity, byCamera, byCameraVerified, byType, active, resolved, confirmed };
  }, [filtered]);

  const camKeys = [...stats.byCamera.keys()];

  const maxCam = Math.max(1, ...[...stats.byCamera.values()]);
  const sevColor = (s: string) =>
    s === 'critical' ? 'bg-error' : s === 'high' ? 'bg-amber-500'
    : s === 'medium' ? 'bg-secondary' : 'bg-surface-container-high';
  const sevText = (s: string) =>
    s === 'high' ? 'text-black' : s === 'low' ? 'text-on-surface-variant' : 'text-white';

  const resolutionRate = filtered.length === 0 ? 0
    : Math.round((stats.resolved / filtered.length) * 100);

  const exportLedger = () => {
    downloadCSV(
      `civiceye_analytics_${range.toLowerCase()}_${stamp()}`,
      ['ID', 'TYPE', 'SEVERITY', 'STATUS', 'CAMERA', 'CONFIDENCE'],
      filtered.map((i) => [i.id, i.type, i.severity, i.status, i.cameraId, i.confidence]),
    );
    pushToast(`Exported ${filtered.length} incidents (${range}) to CSV.`, 'success');
  };

  const kpis = [
    { k: 'TOTAL INCIDENTS', v: String(filtered.length), icon: 'insights', sub: `${stats.byCamera.size} cameras reporting` },
    { k: 'ACTIVE', v: String(stats.active), icon: 'sensors', sub: 'needs attention' },
    { k: 'CONFIRMED', v: String(stats.confirmed), icon: 'verified', sub: 'verified threats' },
    { k: 'RESOLVED', v: String(stats.resolved), icon: 'check_circle', sub: `${resolutionRate}% resolution rate` },
    { k: 'CRITICAL', v: String(stats.bySeverity.get('critical') ?? 0), icon: 'error', sub: 'highest severity' },
    { k: 'HIGH', v: String(stats.bySeverity.get('high') ?? 0), icon: 'warning', sub: 'elevated severity' },
  ];

  const camEntries = [...stats.byCamera.entries()].sort((a, b) => b[1] - a[1]);
  const visibleCams = showAllCams ? camEntries : camEntries.slice(0, 8);
  const ledgerRows = showAllRows ? filtered.slice(0, 100) : filtered.slice(0, 10);

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-wrap items-end gap-space-md">
        <div>
          <p className="font-label-caps text-on-surface-variant">PERFORMANCE LEDGER · LIVE BACKEND DATA</p>
          <h1 className="font-headline-xl text-on-surface">ANALYTICS</h1>
        </div>
        <div className="ml-auto flex items-center gap-space-sm">
          {updatedAt && (
            <span className="font-data-mono-sm text-on-surface-variant">
              UPDATED {updatedAt.toLocaleTimeString()} · AUTO-REFRESH 15S
            </span>
          )}
          <button type="button" onClick={() => { refresh().catch(() => {}); pushToast('Analytics refreshed from live backend data.', 'info'); }} className="font-label-caps border border-outline px-space-md py-2 text-on-surface-variant rounded-lg hover:border-secondary hover:text-secondary transition">REFRESH</button>
          <button type="button" onClick={exportLedger} className="font-label-caps bg-secondary px-space-md py-2 text-on-primary rounded-lg hover:bg-blue-700 transition">EXPORT</button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-space-sm md:grid-cols-3 xl:grid-cols-6 anim-fade-up">
        {loading && filtered.length === 0 ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-sm">
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-container-high" />
              <div className="mt-2 h-7 w-1/2 animate-pulse rounded-lg bg-surface-container-high" />
              <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-surface-container-high" />
            </div>
          ))
        ) : (
          kpis.map((m) => (
            <div key={m.k} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-sm transition hover:border-secondary hover:shadow-card">
              <p className="flex items-center gap-1 font-label-caps text-on-surface-variant">
                <span className="material-symbols-outlined text-[15px] text-secondary">{m.icon}</span>
                {m.k}
              </p>
              <p className="font-headline-lg text-on-surface">{m.v}</p>
              <p className="font-data-mono-sm text-on-surface-variant">{m.sub}</p>
            </div>
          ))
        )}
      </div>

      {/* Time-range filter */}
      <div className="flex flex-wrap items-center gap-space-sm" role="toolbar" aria-label="Time range">
        <span className="font-label-caps text-on-surface-variant">RANGE</span>
        {(['ALL', '24H', '7D'] as Range[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => { setRange(r); setShowAllRows(false); }}
            aria-pressed={range === r}
            className={`font-label-caps rounded-lg border px-space-sm py-1.5 transition ${
              range === r ? 'border-secondary bg-secondary text-on-primary' : 'border-outline text-on-surface-variant hover:border-secondary'
            }`}
          >
            {r === 'ALL' ? 'ALL TIME' : r === '24H' ? 'LAST 24H' : 'LAST 7D'} · {rangeCounts[r]}
          </button>
        ))}
        <span className="font-data-mono-sm text-on-surface-variant">
          SHOWING {filtered.length} OF {incidents.length} INCIDENTS
        </span>
      </div>

      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-12">
        <div className="xl:col-span-8">
          <IncidentChart
            reported={camKeys.map((k) => stats.byCamera.get(k) ?? 0)}
            verified={camKeys.map((k) => stats.byCameraVerified.get(k) ?? 0)}
            rangeLabel="INCIDENTS BY CAMERA (REPORTED VS CONFIRMED+DISPATCHED)"
            labels={camKeys}
          />
        </div>
        <div className="xl:col-span-4">
          <SeverityChart
            segs={[...stats.bySeverity.entries()].map(([k, v]) => ({ k: k.toUpperCase(), v, c: sevColor(k) }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
          <div className="flex items-center justify-between">
            <p className="font-label-caps text-on-surface-variant">INCIDENTS BY CAMERA</p>
            {camEntries.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllCams((v) => !v)}
                className="font-label-caps text-secondary hover:text-blue-800 transition"
              >
                {showAllCams ? 'SHOW LESS' : `SHOW ALL ${camEntries.length}`}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-space-xs pt-space-sm">
            {visibleCams.map(([k, v]) => {
              const verified = stats.byCameraVerified.get(k) ?? 0;
              return (
                <li key={k} className="flex items-center gap-space-sm">
                  <span className="w-20 truncate font-data-mono-sm text-on-surface" title={k}>{k}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-container-high" title={`${v} reported · ${verified} confirmed`}>
                    <span className="block h-full rounded-full bg-gradient-to-r from-secondary to-blue-400 transition-all" style={{ width: `${Math.min(100, (v / maxCam) * 100)}%` }} />
                  </span>
                  <span className="w-16 text-right font-data-mono-sm tabular-nums text-on-surface-variant">{v} · {verified}✓</span>
                </li>
              );
            })}
            {camEntries.length === 0 && (
              <li className="font-body-sm text-on-surface-variant">
                {loading ? 'Loading live data…' : 'No incidents in this range yet — upload a video to populate analytics.'}
              </li>
            )}
          </ul>
        </section>
        <div className="flex flex-col gap-space-md">
          <SafetyPulse score={resolutionRate} delta="share of incidents resolved" trend="" />
          <ResponseTimeChart
            sectors={[...stats.byType.entries()].map(([k, v]) => ({ k: k.toUpperCase(), v }))}
            title="INCIDENTS BY TYPE"
          />
        </div>
      </div>

      <section className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center justify-between px-space-sm pt-space-sm">
          <p className="font-label-caps text-on-surface-variant">INCIDENT LEDGER · LATEST {ledgerRows.length}</p>
          {filtered.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAllRows((v) => !v)}
              className="font-label-caps text-secondary hover:text-blue-800 transition"
            >
              {showAllRows ? 'SHOW LESS' : `SHOW MORE (${Math.min(100, filtered.length)})`}
            </button>
          )}
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="font-label-caps text-on-surface-variant">
              <th className="px-space-sm py-space-xs">INCIDENT</th>
              <th className="px-space-sm py-space-xs">TYPE</th>
              <th className="px-space-sm py-space-xs">SEVERITY</th>
              <th className="px-space-sm py-space-xs">STATUS</th>
              <th className="px-space-sm py-space-xs">CONFIDENCE</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map((i) => (
              <tr key={i.id} className="border-t border-outline-variant font-data-mono-md text-on-surface transition hover:bg-surface-container-low">
                <td className="px-space-sm py-space-xs">
                  <Link to={`/incidents/${i.id}`} className="font-semibold text-secondary hover:text-blue-800 hover:underline transition">
                    {i.id}
                  </Link>
                </td>
                <td className="px-space-sm py-space-xs">{i.type}</td>
                <td className="px-space-sm py-space-xs">
                  <span className={`inline-block rounded-full px-2 py-0.5 font-label-caps ${sevColor(i.severity)} ${sevText(i.severity)}`}>
                    {i.severity.toUpperCase()}
                  </span>
                </td>
                <td className="px-space-sm py-space-xs uppercase">{i.status}</td>
                <td className="px-space-sm py-space-xs">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-container-high">
                      <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, i.confidence))}%` }} />
                    </span>
                    <span className="tabular-nums">{i.confidence > 0 ? `${i.confidence.toFixed(1)}%` : '—'}</span>
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-space-sm py-space-xs text-center font-body-sm text-on-surface-variant">
                  {loading ? 'Loading live data…' : 'No incidents in this range yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default AnalyticsPage;
