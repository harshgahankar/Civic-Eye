export type CameraStatus = 'online' | 'offline' | 'maintenance';

export interface Camera {
  id: string;
  name: string;
  sector: string;
  status: CameraStatus;
  fps: number;
  resolution: string;
  lat: number;
  lng: number;
  thumbnail?: string;
}
