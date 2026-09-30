export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IncidentStatus = 'active' | 'monitoring' | 'pending' | 'resolved' | 'dispatched';

export type IncidentType =
  | 'traffic-accident'
  | 'crowd-anomaly'
  | 'unattended-object'
  | 'medical'
  | 'fire'
  | 'security'
  | 'vehicle'
  | 'pedestrian';

export interface Incident {
  id: string;
  title: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  cameraId: string;
  sector: string;
  confidence: number;
  timestamp: string;
  description: string;
  lat: number;
  lng: number;
  assignedUnits?: string[];
}

export interface ArchivedAlert {
  id: string;
  title: string;
  severity: IncidentSeverity;
  resolvedAt: string;
  duration: string;
}
