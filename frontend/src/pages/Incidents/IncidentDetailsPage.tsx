import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import IncidentDetails from '../../components/incidents/IncidentDetails';
import AIAnalysis from '../../components/ai/AIAnalysis';
import AIDecisionTrail from '../../components/ai/AIDecisionTrail';
import EmergencyPanel from '../../components/emergency/EmergencyPanel';
import DispatchModal from '../../components/emergency/DispatchModal';
import { backend, type BackendIncidentDetail } from '../../services/backend';
import { printPage } from '../../utils/actions';
import { useUiStore } from '../../store/uiStore';

export function IncidentDetailsPage() {
  const { id } = useParams();
  const incidentId = id ?? '';
  const pushToast = useUiStore((s) => s.pushToast);
  const [forwarded, setForwarded] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [detail, setDetail] = useState<BackendIncidentDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    if (!incidentId) {
      setMissing(true);
      return;
    }
    backend.incident(incidentId)
      .then((d) => { if (live) setDetail(d); })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, [incidentId]);

  const forward = () => {
    setForwarded(true);
    pushToast(`${incidentId} dossier forwarded to watch command.`, 'success');
  };

  if (missing || (!detail && incidentId)) {
    if (!detail && !missing) {
      return <p className="font-body-md text-on-surface-variant">Loading incident dossier…</p>;
    }
  }
  if (!detail) {
    return (
      <div className="card card-pad text-center">
        <p className="font-body-md font-medium text-on-surface">Incident not found.</p>
        <p className="pt-1 font-body-sm text-on-surface-variant">The backend has no record of “{incidentId}”.</p>
      </div>
    );
  }

  const phases = (detail.evidence ?? []).map((e) => ({
    t: e.type,
    d: `conf ${(e.confidence ?? 0).toFixed(2)} · t=${(e.timestamp ?? 0).toFixed(1)}s · tracks [${(e.track_ids ?? []).join(', ')}]`,
  }));
  const confPct = `${((detail.confidence ?? 0) * 100).toFixed(1)}%`;
  const firstSeen = detail.first_detected_at != null ? `${detail.first_detected_at.toFixed(1)}s` : '—';
  const updatedAt = detail.last_updated_at != null
    ? new Date(detail.last_updated_at * 1000).toISOString()
    : (detail.updated_at ?? '—');

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-wrap items-end gap-space-md">
        <div>
          <p className="font-label-caps text-on-surface-variant">CASE FILE &middot; {detail.incident_type}</p>
          <h1 className="font-headline-xl text-on-surface">INCIDENT {detail.incident_id}</h1>
        </div>
        <div className="ml-auto flex gap-space-sm">
          <button type="button" onClick={printPage} className="font-label-caps rounded-sm border border-outline px-space-md py-2 text-on-surface-variant hover:border-on-surface-variant transition">PRINT</button>
          <button
            type="button"
            onClick={forward}
            disabled={forwarded}
            className="font-label-caps rounded-sm bg-secondary px-space-md py-2 text-on-primary hover:bg-blue-700 disabled:opacity-60 disabled:pointer-events-none transition"
          >
            {forwarded ? 'FORWARDED ✓' : 'FORWARD'}
          </button>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-space-sm md:grid-cols-5">
        {[
          { k: 'SEVERITY', v: detail.severity },
          { k: 'STATUS', v: detail.status },
          { k: 'CAMERA', v: detail.camera_id },
          { k: 'FIRST SEEN', v: firstSeen },
          { k: 'CONFIDENCE', v: confPct },
        ].map((m) => (
          <div key={m.k} className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-sm">
            <p className="font-label-caps text-on-surface-variant">{m.k}</p>
            <p className="font-data-mono-md text-on-surface pt-1">{m.v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-12">
        <div className="flex flex-col gap-space-md xl:col-span-7">
          <AIDecisionTrail phases={phases} />
          <section className="grid grid-cols-2 gap-space-sm md:grid-cols-4">
            {[
              { k: 'TRACKS', v: (detail.track_ids ?? []).length ? (detail.track_ids ?? []).join(', ') : '—' },
              { k: 'EVIDENCE ITEMS', v: String((detail.evidence ?? []).length) },
              { k: 'RECOMMENDED', v: detail.recommended_action || '—' },
              { k: 'PRIORITY', v: detail.recommended_priority || '—' },
            ].map((e) => (
              <div key={e.k} className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-sm">
                <p className="font-label-caps text-on-surface-variant">{e.k}</p>
                <p className="font-data-mono-md text-on-surface pt-1">{e.v}</p>
              </div>
            ))}
          </section>
          <IncidentDetails
            dossier={{
              id: detail.incident_id,
              title: `${detail.incident_type} — ${detail.camera_id}`,
              severity: detail.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low',
              status: detail.status === 'DISPATCHED' ? 'dispatched'
                : detail.status === 'RESOLVED' || detail.status === 'FALSE_ALARM' ? 'resolved'
                : detail.status === 'CONFIRMED' ? 'open' : 'ack',
              cam: detail.camera_id ?? 'CAM-UNKNOWN',
              time: updatedAt,
              narrative: (detail.reasons ?? []).join(' · ') || (detail.recommended_action ?? ''),
            }}
          />
        </div>

        <div className="flex flex-col gap-space-md xl:col-span-5">
          <AIAnalysis
            analysis={{
              title: detail.incident_type,
              confidence: (detail.confidence ?? 0) * 100,
              detail: (detail.reasons ?? []).join(' · '),
            }}
          />
          <EmergencyPanel onDispatch={() => setDispatchOpen(true)} incidentId={detail.incident_id} />
        </div>
      </div>
      <DispatchModal open={dispatchOpen} incidentId={detail.incident_id} onClose={() => setDispatchOpen(false)} />
    </div>
  );
}

export default IncidentDetailsPage;
