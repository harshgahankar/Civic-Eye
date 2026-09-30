export type CrowdStatus = 'normal' | 'elevated' | 'critical';
export type CrowdTrend = 'up' | 'down' | 'stable';

export interface CrowdZone {
  id: string;
  name: string;
  cameraId: string;
  sector: string;
  density: number;
  count: number;
  capacity: number;
  status: CrowdStatus;
  trend: CrowdTrend;
  updatedAt: string;
}
