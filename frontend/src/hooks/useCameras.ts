import { useMemo } from 'react';
import { mockCameras } from '../data/mockCameras';
import { useCameraStore } from '../store/cameraStore';

export function useCameras() {
  const { selectedId, sectorFilter, setSelected } = useCameraStore();
  const cameras = useMemo(() => {
    if (sectorFilter === 'all') return mockCameras;
    return mockCameras.filter((c) => c.sector === sectorFilter);
  }, [sectorFilter]);
  const selected = mockCameras.find((c) => c.id === selectedId) ?? cameras[0] ?? null;
  return { cameras, selected, selectedId, setSelected };
}
