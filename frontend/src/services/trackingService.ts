import { api } from './api';
import { mockDetections } from '../data/mockDetections';

const USE_MOCK = true;

export const trackingService = {
  detections: async () => {
    if (USE_MOCK) return mockDetections;
    return api.get('/tracking/detections');
  },
  track: async (id: string) => {
    if (USE_MOCK) return mockDetections.find((d) => d.id === id) ?? null;
    return api.get(`/tracking/${id}`);
  },
};
