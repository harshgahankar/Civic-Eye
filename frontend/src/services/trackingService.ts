import { backend } from './backend';
import type { Detection } from '../types/detection';

/** Detections derived from the backend's recent behavior-event envelopes. */
async function liveDetections(): Promise<Detection[]> {
  const events = await backend.recentBehavior(100);
  return events.map((e, n) => ({
    id: `DET-${e.timestamp.toFixed(2)}-${n}`,
    timestamp: new Date(e.timestamp * 1000).toISOString(),
    cameraId: e.camera_id,
    sector: 'Live',
    label: e.behavior_type,
    confidence: Math.round(e.score * 1000) / 10,
    delta: '',
    action: 'Review',
  }));
}

export const trackingService = {
  detections: async (): Promise<Detection[]> => liveDetections(),
  track: async (id: string) => {
    const rows = await liveDetections();
    return rows.find((d) => d.id === id) ?? null;
  },
};
