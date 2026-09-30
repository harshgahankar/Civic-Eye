import type { Detection } from '../types/detection';

export const mockDetections: Detection[] = [
  { id: 'DET-5001', timestamp: '2026-09-30T08:42:10Z', cameraId: 'CAM-07', sector: 'Sector C', label: 'Vehicle collision detected', confidence: 94.2, delta: '+2.1%', action: 'Dispatch' },
  { id: 'DET-5002', timestamp: '2026-09-30T08:40:55Z', cameraId: 'CAM-04', sector: 'Sector B', label: 'Crowd surge anomaly', confidence: 88.7, delta: '+5.4%', action: 'Monitor' },
  { id: 'DET-5003', timestamp: '2026-09-30T08:38:31Z', cameraId: 'CAM-12', sector: 'Sector D', label: 'Unattended baggage flagged', confidence: 91.4, delta: '+1.2%', action: 'Verify' },
  { id: 'DET-5004', timestamp: '2026-09-30T08:36:12Z', cameraId: 'CAM-01', sector: 'Sector A', label: 'Stalled truck — lane 2', confidence: 93.1, delta: '-0.6%', action: 'Track' },
  { id: 'DET-5005', timestamp: '2026-09-30T08:33:48Z', cameraId: 'CAM-09', sector: 'Sector D', label: 'Pedestrian in restricted zone', confidence: 94.8, delta: '+0.9%', action: 'Review' },
];
