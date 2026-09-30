export type CameraStatus = 'online' | 'offline' | 'maintenance';

export interface Camera {
  id: string;
  name: string;
  sector: string;
  /** Mumbai operating area (Thane, Andheri, …). Mirrors the backend area taxonomy. */
  area: string;
  /** Human-readable install point, e.g. "Dadar TT Junction". */
  location: string;
  status: CameraStatus;
  fps: number;
  resolution: string;
  lat: number;
  lng: number;
  thumbnail?: string;
}
