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
 * Global live-alert listener: every INCIDENT_CONFIRMED for a collision or
 * unattended-baggage incident (file upload or live camera alike) raises a
 * prominent on-screen popup. Mount once (App) — the WS is already app-wide.
 */
export function useLiveAlerts() {
  const pushAlert = useUiStore((s) => s.pushAlert);

  useEffect(() => {
    const onConfirmed = (msg: unknown) => {
      const env = msg as RealtimeEnvelope;
      if (!env || !env.incident_id) return;
      const p = (env.payload ?? {}) as Record<string, unknown>;
      const type = String(p.incident_type ?? '');
      if (!POPUP_TYPES.has(type)) return;
      const conf = Number(p.confidence ?? NaN);
      pushAlert({
        id: env.incident_id,
        incidentType: type,
        title: TITLES[type] ?? 'Incident confirmed',
        cameraId: String(env.camera_id ?? 'unknown camera'),
        severity: String(p.severity ?? 'low'),
        confidence: Number.isFinite(conf) ? Math.round(conf * 1000) / 10 : null,
      });
    };
    const off = websocketService.subscribe('INCIDENT_CONFIRMED', onConfirmed);
    return off;
  }, [pushAlert]);
}
