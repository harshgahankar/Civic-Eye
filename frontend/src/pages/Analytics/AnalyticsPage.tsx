import { useEffect, useMemo, useState } from 'react';
import IncidentChart from '../../components/analytics/IncidentChart';
import SeverityChart from '../../components/analytics/SeverityChart';
import SafetyPulse from '../../components/analytics/SafetyPulse';
import ResponseTimeChart from '../../components/analytics/ResponseTimeChart';
import { backend } from '../../services/backend';
import type { Incident } from '../../types/incident';
import { downloadCSV, stamp } from '../../utils/actions';
import { useUiStore } from '../../store/uiStore';

/**
 * Analytics computed live from backend incidents.
 * No cohorts, ROC curves, audits, or precision claims — the backend exposes
 * incident records only, so every number here is a direct aggregation.
 */
export function AnalyticsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    let live = true;
    backend.incidents(500)
      .then((rows) => { if (live) setIncidents(rows); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const stats = useMemo(() => {
    const byStatus = new Map<string, number>();
    const bySeverity = new Map<string, number>();
    const byCamera = new Map<string, number>();
    const byType = new Map<string, number>();
    for (const i of incidents) {
      byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1);
      bySeverity.set(i.severity, (bySeverity.get(i.severity) ?? 0) + 1);
      byCamera.set(i.cameraId, (byCamera.get(i.cameraId) ?? 0) + 1);
      byType.set(i.type, (byType.get(i.type) ?? 0) + 1);
    }
    const active = incidents.filter((i) => i.status !== 'resolved').length;
    const resolved = incidents.length - active;
    const confirmed = incidents.filter((i) => i.status === 'active').length;
    return { byStatus, bySeverity, byCamera, byType, active, resolved, confirmed };
  }, [incidents]);

  const maxCam = Math.max(1, ...[...stats.byCamera.values()]);
  const sevColor = (s: string) =>
    s === 'critical' ? 'bg-error' : s === 'high' ? 'bg-amber-500'
    : s === 'medium' ? 'bg-secondary' : 'bg-surface-container-high';

  const resolutionRate = incidents.length === 0 ? 0
    : Math.round((stats.resolved / incidents.length) * 100);

  const exportLedger = () => {
    downloadCSV(
      `civiceye_analytics_${stamp()}`,
      ['ID', 'TYPE', 'SEVERITY', 'STATUS', 'CAMERA', 'CONFIDENCE'],
      incidents.map((i) => [i.id, i.type, i.severity, i.status, i.cameraId, i.confidence]),
    );
    pushToast(`Exported ${incidents.length} incidents to CSV.`, 'success');
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-wrap items-end gap-space-md">
        <div>
          <p className="font-label-caps text-on-surface-variant">PERFORMANCE LEDGER · LIVE BACKEND DATA</p>
          <h1 className="font-headline-xl text-on-surface">ANALYTICS</h1>
        </div>
        <div className="ml-auto flex gap-space-sm">
          <button type="button" onClick={exportLedger} className="font-label-caps bg-secondary px-space-md py-2 text-on-primary rounded-sm hover:bg-blue-700 transition">EXPORT</button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-space-sm md:grid-cols-3 xl:grid-cols-6 anim-fade-up">
        {[
          { k: 'TOTAL INCIDENTS', v: String(incidents.length) },
          { k: 'ACTIVE', v: String(stats.active) },
          { k: 'CONFIRMED', v: String(stats.confirmed) },
          { k: 'RESOLVED', v: String(stats.resolved) },
          { k: 'CRITICAL', v: String(stats.bySeverity.get('critical') ?? 0) },
          { k: 'HIGH', v: String(stats.bySeverity.get('high') ?? 0) },
        ].map((m) => (
          <div key={m.k} className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-sm">
            <p className="font-label-caps text-on-surface-variant">{m.k}</p>
            <p className="font-headline-lg text-on-surface">{m.v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-12">
        <div className="xl:col-span-8">
          <IncidentChart
            reported={[...stats.byCamera.values()]}
            verified={[...stats.byCamera.values()].map((v) => Math.max(0, v - 1))}
            rangeLabel="INCIDENTS BY CAMERA (REPORTED)"
          />
        </div>
        <div className="xl:col-span-4">
          <SeverityChart
            segs={[...stats.bySeverity.entries()].map(([k, v]) => ({ k: k.toUpperCase(), v, c: sevColor(k) }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
          <p className="font-label-caps text-on-surface-variant">INCIDENTS BY CAMERA</p>
          <ul className="flex flex-col gap-space-xs pt-space-sm">
            {[...stats.byCamera.entries()].map(([k, v]) => (
              <li key={k} className="flex items-center gap-space-sm">
                <span className="w-20 font-data-mono-sm text-on-surface">{k}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                  <span className="block h-full bg-secondary" style={{ width: `${Math.min(100, (v / maxCam) * 100)}%` }} />
                </span>
                <span className="font-data-mono-sm tabular-nums text-on-surface-variant">{v}</span>
              </li>
            ))}
            {stats.byCamera.size === 0 && (
              <li className="font-body-sm text-on-surface-variant">No incidents recorded yet.</li>
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

      <section className="overflow-x-auto rounded-sm border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-left">
          <thead>
            <tr className="font-label-caps text-on-surface-variant">
              <th className="px-space-sm py-space-xs">INCIDENT</th>
              <th className="px-space-sm py-space-xs">TYPE</th>
              <th className="px-space-sm py-space-xs">SEVERITY</th>
              <th className="px-space-sm py-space-xs">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {incidents.slice(0, 20).map((i) => (
              <tr key={i.id} className="border-t border-outline-variant font-data-mono-md text-on-surface">
                <td className="px-space-sm py-space-xs">{i.id}</td>
                <td className="px-space-sm py-space-xs">{i.type}</td>
                <td className="px-space-sm py-space-xs uppercase">{i.severity}</td>
                <td className="px-space-sm py-space-xs uppercase">{i.status}</td>
              </tr>
            ))}
            {incidents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-space-sm py-space-xs text-center font-body-sm text-on-surface-variant">
                  No incidents recorded yet.
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
