export type TrackStatus = 'active' | 'monitoring' | 'lost' | 'resolved';

export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp: string;
  cameraId: string;
}

export interface Track {
  id: string;
  label: string;
  cameraId: string;
  sector: string;
  confidence: number;
  status: TrackStatus;
  color: string;
  path: TrackPoint[];
  updatedAt: string;
}
