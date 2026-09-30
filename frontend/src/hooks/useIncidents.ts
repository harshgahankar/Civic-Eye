import { useEffect, useMemo, useState } from 'react';
import { useIncidentStore } from '../store/incidentStore';
import { backend } from '../services/backend';
import type { ArchivedAlert } from '../types/incident';
import { websocketService, type RealtimeEnvelope } from '../services/websocketService';
import type { Incident } from '../types/incident';

function fromLiveEnvelope(env: RealtimeEnvelope): Incident | null {
  if (!env.incident_id) return null;
  const p = env.payload ?? {};
  const typeMap: Record<string, Incident['type']> = {
    ACCIDENT: 'traffic-accident',
    CROWD_ANOMALY: 'crowd-anomaly',
    UNATTENDED_BAGGAGE: 'unattended-object',
  };
  const rawType = String(p.incident_type ?? 'security');
  const rawSev = String(p.severity ?? 'low').toLowerCase();
  return {
    id: env.incident_id,
    title: `${rawType} — ${env.camera_id ?? 'unknown camera'}`,
    type: typeMap[rawType] ?? 'security',
    severity: (['critical', 'high', 'medium', 'low'] as const).includes(rawSev as never)
      ? (rawSev as Incident['severity']) : 'low',
    status: env.event_type === 'INCIDENT_CONFIRMED' ? 'active' : 'pending',
    cameraId: env.camera_id ?? 'CAM-UNKNOWN',
    sector: 'Live',
    confidence: Math.round(Number(p.confidence ?? 0) * 1000) / 10,
    timestamp: new Date((env.timestamp ?? Date.now() / 1000) * 1000).toISOString(),
    description: 'Live event from backend',
    lat: 0,
    lng: 0,
  };
}

export function useIncidents() {
  const { selectedId, severityFilter, statusFilter, setSelected } = useIncidentStore();
  const [live, setLive] = useState<Incident[]>([]);
  const [archived, setArchived] = useState<ArchivedAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    backend.incidents()
      .then((rows) => { if (!cancelled) setLive(rows); })
      .catch(() => {});
    backend.resolved()
      .then((rows) => { if (!cancelled) setArchived(rows); })
      .catch(() => {});
    const merge = (m: unknown) => {
      const inc = fromLiveEnvelope(m as RealtimeEnvelope);
      if (inc) setLive((prev) => [inc, ...prev.filter((i) => i.id !== inc.id)]);
    };
    const off1 = websocketService.subscribe('INCIDENT_CREATED', merge);
    const off2 = websocketService.subscribe('INCIDENT_CONFIRMED', merge);
    return () => { cancelled = true; off1(); off2(); };
  }, []);

  const incidents = useMemo(() => {
    return live.filter((i) => {
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      return true;
    });
  }, [live, severityFilter, statusFilter]);
  const selected = live.find((i) => i.id === selectedId) ?? incidents[0] ?? null;
  return { incidents, archived, selected, selectedId, setSelected, live: true };
}
