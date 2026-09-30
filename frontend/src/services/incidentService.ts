import { api } from './api';
import { mapIncident, type BackendIncidentDetail, type BackendIncidentSummary } from './backend';
import type { ArchivedAlert, Incident } from '../types/incident';

/** Live backend only — empty results when the DB has no incidents yet. */
export const incidentService = {
  list: async (): Promise<Incident[]> => {
    const rows = await api.get<BackendIncidentSummary[]>('/incidents?limit=100');
    return rows.map(mapIncident);
  },
  get: async (id: string): Promise<Incident | undefined> => {
    try {
      const row = await api.get<BackendIncidentSummary>(`/incidents/${id}`);
      return mapIncident(row);
    } catch {
      return undefined;
    }
  },
  /** Full detail incl. metadata (carries upload `output_video` for flagged videos). */
  detail: async (id: string): Promise<BackendIncidentDetail | undefined> => {
    try {
      return await api.get<BackendIncidentDetail>(`/incidents/${id}`);
    } catch {
      return undefined;
    }
  },
  archived: async (): Promise<ArchivedAlert[]> => {
    const rows = await api.get<BackendIncidentSummary[]>('/incidents?status=RESOLVED&limit=100');
    return rows.map((r) => ({
      id: r.incident_id,
      title: `${r.incident_type} — ${r.camera_id ?? ''}`,
      severity: (r.severity?.toLowerCase() ?? 'low') as Incident['severity'],
      resolvedAt: r.updated_at ?? '',
      duration: '',
    }));
  },
  resolve: async (id: string): Promise<void> => {
    await api.post(`/incidents/${id}/resolve`, { reason: 'resolved from dashboard' });
  },
  dispatch: async (id: string): Promise<void> => {
    await api.post(`/incidents/${id}/dispatch`, { reason: 'dispatched from dashboard' });
  },
};
