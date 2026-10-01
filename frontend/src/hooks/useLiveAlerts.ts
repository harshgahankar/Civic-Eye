import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';
import { websocketService, type RealtimeEnvelope } from '../services/websocketService';

/** Incident types that raise an on-screen popup when CONFIRMED live. */
const POPUP_TYPES = new Set(['ACCIDENT', 'UNATTENDED_BAGGAGE']);

const TITLES: Record<string, string> = {
  ACCIDENT: 'Vehicle collision detected',
  UNATTENDED_BAGGAGE: 'Unattended baggage detected',
};

/**
 * Global live-alert listener.
 *
 * - Live camera confirmations pop up instantly (real-time safety).
 * - File-upload confirmations carry `origin: 'upload'` — those are held
 *   back mid-video and pop up only when UPLOAD_JOB_COMPLETED arrives
 *   after the video is fully processed.
 * Mount once (App) — the WS is already app-wide.
 */
export function useLiveAlerts() {
  const pushAlert = useUiStore((s) => s.pushAlert);

  useEffect(() => {
    const raise = (incidentId: string, type: string, cameraId: string,
                   severity: string, confidence: number | null) => {
      if (!POPUP_TYPES.has(type)) return;
      pushAlert({
        id: incidentId,
        incidentType: type,
        title: TITLES[type] ?? 'Incident confirmed',
        cameraId,
        severity,
        confidence,
      });
    };
    const onConfirmed = (msg: unknown) => {
      const env = msg as RealtimeEnvelope;
      if (!env || !env.incident_id) return;
      const p = (env.payload ?? {}) as Record<string, unknown>;
      // Upload-origin flags wait for job completion — never mid-video.
      if (p.origin === 'upload') return;
      const type = String(p.incident_type ?? '');
      const conf = Number(p.confidence ?? NaN);
      raise(
        env.incident_id,
        type,
        String(env.camera_id ?? 'unknown camera'),
        String(p.severity ?? 'low'),
        Number.isFinite(conf) ? Math.round(conf * 1000) / 10 : null,
      );
    };
    const onUploadCompleted = (msg: unknown) => {
      const env = msg as RealtimeEnvelope;
      const p = (env.payload ?? {}) as Record<string, unknown>;
      const incidents = Array.isArray(p.incidents)
        ? (p.incidents as Record<string, unknown>[])
        : [];
      for (const inc of incidents) {
        const id = String(inc.incident_id ?? '');
        if (!id) continue;
        const conf = Number(inc.confidence ?? NaN);
        raise(
          id,
          String(inc.incident_type ?? ''),
          String(env.camera_id ?? 'unknown camera'),
          String(inc.severity ?? 'low'),
          Number.isFinite(conf) ? Math.round(conf * 1000) / 10 : null,
        );
      }
    };
    const offConfirmed = websocketService.subscribe('INCIDENT_CONFIRMED', onConfirmed);
    const offCompleted = websocketService.subscribe('UPLOAD_JOB_COMPLETED', onUploadCompleted);
    return () => {
      offConfirmed();
      offCompleted();
    };
  }, [pushAlert]);
}
