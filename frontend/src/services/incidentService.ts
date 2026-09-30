import { api } from './api';
import { mockArchivedIncidents, mockIncidents } from '../data/mockIncidents';
import type { Incident } from '../types/incident';

const USE_MOCK = true;

export const incidentService = {
  list: async (): Promise<Incident[]> => {
    if (USE_MOCK) return mockIncidents;
    return api.get<Incident[]>('/incidents');
  },
  get: async (id: string): Promise<Incident | undefined> => {
    if (USE_MOCK) return mockIncidents.find((i) => i.id === id);
    return api.get<Incident>(`/incidents/${id}`);
  },
  archived: async () => {
    if (USE_MOCK) return mockArchivedIncidents;
    return api.get('/incidents?status=resolved');
  },
};
