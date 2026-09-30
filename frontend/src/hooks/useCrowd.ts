import { useMemo } from 'react';
import type { CrowdZone } from '../types/crowd';

const mockZones: CrowdZone[] = [
  { id: 'CZ-01', name: 'Metro Central Concourse', cameraId: 'CAM-04', sector: 'Sector B', density: 88, count: 342, capacity: 400, status: 'critical', trend: 'up', updatedAt: '2026-09-30T08:40:55Z' },
  { id: 'CZ-02', name: 'Station Gate 2 Forecourt', cameraId: 'CAM-12', sector: 'Sector D', density: 62, count: 148, capacity: 300, status: 'elevated', trend: 'stable', updatedAt: '2026-09-30T08:38:00Z' },
  { id: 'CZ-03', name: 'Market Row Walkway', cameraId: 'CAM-05', sector: 'Sector B', density: 34, count: 71, capacity: 250, status: 'normal', trend: 'down', updatedAt: '2026-09-30T08:30:00Z' },
];

export function useCrowd() {
  const zones = useMemo(() => mockZones, []);
  return { zones };
}
