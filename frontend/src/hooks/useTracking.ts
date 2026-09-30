import { useMemo } from 'react';
import type { Track } from '../types/tracking';
import { useTrackingStore } from '../store/trackingStore';

const mockTracks: Track[] = [
  {
    id: 'TRK-201', label: 'White sedan · DL-8C-4421', cameraId: 'CAM-07', sector: 'Sector C',
    confidence: 93.1, status: 'active', color: '#436086', updatedAt: '2026-09-30T08:42:10Z',
    path: [
      { lat: 28.6095, lng: 77.2125, timestamp: '2026-09-30T08:40:00Z', cameraId: 'CAM-07' },
      { lat: 28.61, lng: 77.213, timestamp: '2026-09-30T08:42:10Z', cameraId: 'CAM-07' },
    ],
  },
  {
    id: 'TRK-202', label: 'Individual · blue jacket', cameraId: 'CAM-12', sector: 'Sector D',
    confidence: 91.4, status: 'monitoring', color: '#ba1a1a', updatedAt: '2026-09-30T08:38:31Z',
    path: [{ lat: 28.6225, lng: 77.199, timestamp: '2026-09-30T08:38:31Z', cameraId: 'CAM-12' }],
  },
];

export function useTracking() {
  const { activeTrackId, follow, setActiveTrack, setFollow } = useTrackingStore();
  const tracks = useMemo(() => mockTracks, []);
  const active = tracks.find((t) => t.id === activeTrackId) ?? tracks[0] ?? null;
  return { tracks, active, activeTrackId, follow, setActiveTrack, setFollow };
}
