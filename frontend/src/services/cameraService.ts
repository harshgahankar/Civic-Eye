import { api } from './api';
import { directoryAreas, directoryCameras } from '../data/cameraDirectory';
import type { Camera } from '../types/camera';

/** Backend registry first, install directory second (both live-sourced). */
export const cameraService = {
  list: async (): Promise<Camera[]> => {
    try {
      const rows = await api.get<Camera[]>('/cameras');
      if (rows.length) return rows;
    } catch { /* fall through to directory */ }
    return directoryCameras;
  },
  listByArea: async (area: string): Promise<Camera[]> => {
    const cams = await cameraService.list();
    if (area === 'ALL AREAS') return cams;
    return cams.filter((c) => c.area === area);
  },
  areas: async (): Promise<{ name: string; count: number }[]> => {
    const cams = await cameraService.list();
    const counts = new Map<string, number>();
    cams.forEach((c) => counts.set(c.area, (counts.get(c.area) ?? 0) + 1));
    const names = counts.size ? [...counts.keys()] : [...directoryAreas];
    return names.map((name) => ({ name, count: counts.get(name) ?? 0 }));
  },
  get: async (id: string): Promise<Camera | undefined> => {
    try {
      return await api.get<Camera>(`/cameras/${id}`);
    } catch {
      return directoryCameras.find((c) => c.id === id);
    }
  },
};
