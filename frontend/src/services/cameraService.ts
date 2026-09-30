import { api } from './api';
import { MUMBAI_AREAS, mockCameras } from '../data/mockCameras';
import type { Camera } from '../types/camera';

const USE_MOCK = true;

export const cameraService = {
  list: async (): Promise<Camera[]> => {
    if (USE_MOCK) return mockCameras;
    return api.get<Camera[]>('/cameras');
  },
  /** Area-filtered wall. Real backend: GET /cameras?area=Andheri */
  listByArea: async (area: string): Promise<Camera[]> => {
    if (area === 'ALL AREAS') return cameraService.list();
    if (USE_MOCK) return mockCameras.filter((c) => c.area === area);
    return api.get<Camera[]>(`/cameras?area=${encodeURIComponent(area)}`);
  },
  /** Area taxonomy with live camera counts. Real backend: GET /cameras/areas */
  areas: async (): Promise<{ name: string; count: number }[]> => {
    if (USE_MOCK) {
      return MUMBAI_AREAS.map((name) => ({
        name,
        count: mockCameras.filter((c) => c.area === name).length,
      }));
    }
    return api.get<{ name: string; count: number }[]>('/cameras/areas');
  },
  get: async (id: string): Promise<Camera | undefined> => {
    if (USE_MOCK) return mockCameras.find((c) => c.id === id);
    return api.get<Camera>(`/cameras/${id}`);
  },
};
