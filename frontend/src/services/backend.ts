/**
 * Backend adapter — maps the FastAPI backend (Steps 1–5) onto the
 * frontend's domain types. All calls throw on failure so callers can
 * fall back to mock data (backend offline / empty DB).
 */
import { api, API_BASE } from './api';
import type { Incident, IncidentSeverity, IncidentStatus, IncidentType } from '../types/incident';

/* ---------- backend shapes (subset we consume) ---------- */

export interface BackendIncidentSummary {
  incident_id: string;
  camera_id: string | null;
  incident_type: string;
  status: string;
  severity: string;
  confidence: number | null;
  first_detected_at: number | null;
  last_updated_at: number | null;
  track_ids: number[];
  recommended_action: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BackendIncidentDetail extends BackendIncidentSummary {
  evidence: { type: string; timestamp: number; confidence: number; track_ids: number[] }[];
  reasons: string[];
  recommended_priority: string | null;
  metadata: Record<string, unknown>;
}

export interface BackendCameraHealth {
  camera_id: string;
  status: string;
  last_seen_at: number;
  fps: number;
  frames_processed: number;
  errors: number;
}

export interface BackendSnapshot {
  active_incidents: number;
  critical_incidents: number;
  high_incidents: number;
  cameras_online: number;
  cameras_degraded: number;
  cameras_offline: number;
  recent_incidents: { incident_id: string; camera_id: string | null; incident_type: string; status: string; severity: string; confidence: number | null }[];
  camera_health: BackendCameraHealth[];
  system_timestamp: string;
}

export interface BackendJob {
  job_id: string;
  camera_id: string;
  status: string;
  source: string;
  output_path?: string | null;
  frames_processed: number;
  detections_count: number;
  behavior_events_count: number;
  incidents_count: number;
  confirmed_incidents_count: number;
  average_fps: number;
  incident_ids?: string[];
  error?: string | null;
}

/* ---------- mappers ---------- */

const TYPE_MAP: Record<string, IncidentType> = {
  ACCIDENT: 'traffic-accident',
  CROWD_ANOMALY: 'crowd-anomaly',
  UNATTENDED_BAGGAGE: 'unattended-object',
};

const STATUS_MAP: Record<string, IncidentStatus> = {
  DETECTED: 'pending',
  VERIFYING: 'monitoring',
  CONFIRMED: 'active',
  DISPATCHED: 'dispatched',
  RESOLVED: 'resolved',
  FALSE_ALARM: 'resolved',
};

export function mapIncident(b: BackendIncidentSummary): Incident {
  const type = TYPE_MAP[b.incident_type] ?? 'security';
  const severity = (b.severity?.toLowerCase() ?? 'low') as IncidentSeverity;
  return {
    id: b.incident_id,
    title: `${labelFor(b.incident_type)} — ${b.camera_id ?? 'unknown camera'}`,
    type,
    severity,
    status: STATUS_MAP[b.status] ?? 'pending',
    cameraId: b.camera_id ?? 'CAM-UNKNOWN',
    sector: 'Live',
    confidence: Math.round((b.confidence ?? 0) * 1000) / 10,
    timestamp: b.created_at ?? '',
    description:
      b.recommended_action ??
      `Tracks [${(b.track_ids ?? []).join(', ')}] · confidence ${Math.round((b.confidence ?? 0) * 100)}%`,
    lat: 0,
    lng: 0,
  };
}

function labelFor(t: string): string {
  if (t === 'ACCIDENT') return 'Traffic accident';
  if (t === 'CROWD_ANOMALY') return 'Crowd anomaly';
  if (t === 'UNATTENDED_BAGGAGE') return 'Unattended bag';
  return t;
}

/* ---------- calls ---------- */

export const backend = {
  async incidents(limit = 100): Promise<Incident[]> {
    const rows = await api.get<BackendIncidentSummary[]>(`/incidents?limit=${limit}`);
    return rows.map(mapIncident);
  },
  async resolved(limit = 100): Promise<{ id: string; title: string; severity: Incident['severity']; resolvedAt: string; duration: string }[]> {
    const rows = await api.get<BackendIncidentSummary[]>(`/incidents?status=RESOLVED&limit=${limit}`);
    return rows.map((r) => ({
      id: r.incident_id,
      title: `${r.incident_type} — ${r.camera_id ?? ''}`,
      severity: (r.severity?.toLowerCase() ?? 'low') as Incident['severity'],
      resolvedAt: r.updated_at ?? '',
      duration: '',
    }));
  },
  async incident(id: string): Promise<BackendIncidentDetail> {
    return api.get<BackendIncidentDetail>(`/incidents/${encodeURIComponent(id)}`);
  },
  async resolve(id: string): Promise<void> {
    await api.post(`/incidents/${encodeURIComponent(id)}/resolve`, { reason: 'resolved from dashboard' });
  },
  async dispatch(id: string): Promise<void> {
    await api.post(`/incidents/${encodeURIComponent(id)}/dispatch`, { reason: 'dispatched from dashboard' });
  },
  async snapshot(): Promise<BackendSnapshot> {
    return api.get<BackendSnapshot>('/dashboard/snapshot');
  },
  async cameraHealth(): Promise<BackendCameraHealth[]> {
    const res = await api.get<{ cameras: BackendCameraHealth[] }>('/cameras/health');
    return res.cameras;
  },
  async topology(): Promise<Record<string, { neighbors: string[]; zone: string | null }>> {
    const res = await api.get<{ cameras: Record<string, { neighbors: string[]; zone: string | null }> }>('/cameras/topology');
    return res.cameras;
  },
  async recentEvents(limit = 50): Promise<{ event_type: string; camera_id: string | null; incident_id: string | null; timestamp: number; payload: Record<string, unknown> }[]> {
    return api.get(`/events/recent?limit=${limit}`);
  },
  async recentBehavior(limit = 100): Promise<{ camera_id: string; behavior_type: string; score: number; timestamp: number; track_ids: number[] }[]> {
    const rows = await api.get<{ event_type: string; camera_id: string | null; timestamp: number; payload: Record<string, unknown> }[]>(`/events/recent?limit=${limit}`);
    return rows
      .filter((r) => r.event_type === 'BEHAVIOR_EVENT_CREATED')
      .map((r) => ({
        camera_id: r.camera_id ?? 'CAM-UNKNOWN',
        behavior_type: String(r.payload.behavior_type ?? 'unknown'),
        score: Number(r.payload.score ?? 0),
        timestamp: r.timestamp,
        track_ids: (r.payload.track_ids ?? []) as number[],
      }));
  },
  async startJob(videoPath: string, cameraId: string): Promise<{ job_id: string }> {
    return api.post('/processing/video', { video_path: videoPath, camera_id: cameraId });
  },
  async job(id: string): Promise<BackendJob> {
    return api.get<BackendJob>(`/processing/${encodeURIComponent(id)}`);
  },
  /** Incidents recorded by a finished job (used for accident alerts). */
  async jobIncidents(id: string): Promise<BackendIncidentSummary[]> {
    return api.get<BackendIncidentSummary[]>(`/processing/${encodeURIComponent(id)}/incidents`);
  },
  /** Durable stream URL for a pipeline output by filename (survives restarts). */
  outputVideoUrl(filename: string): string {
    return `${API_BASE}/processing/videos/${encodeURIComponent(filename.split(/[/\\]/).pop() ?? filename)}`;
  },
  /** Direct stream URL for the finished job's tracked video (inline preview). */
  jobVideoUrl(id: string): string {
    return `${API_BASE}/processing/${encodeURIComponent(id)}/video`;
  },
  /** Download URL (Content-Disposition: attachment) for the tracked video. */
  jobDownloadUrl(id: string): string {
    return `${API_BASE}/processing/${encodeURIComponent(id)}/video?download=true`;
  },
};
