import { api } from './api';
import { mockCameras } from '../data/mockCameras';
import type { Camera } from '../types/camera';

const USE_MOCK = true;

export const cameraService = {
  list: async (): Promise<Camera[]> => {
    if (USE_MOCK) return mockCameras;
    return api.get<Camera[]>('/cameras');
  },
  get: async (id: string): Promise<Camera | undefined> => {
    if (USE_MOCK) return mockCameras.find((c) => c.id === id);
    return api.get<Camera>(`/cameras/${id}`);
  },
};
