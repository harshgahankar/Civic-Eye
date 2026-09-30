import { create } from 'zustand';
import type { IncidentSeverity, IncidentStatus } from '../types/incident';

interface IncidentState {
  selectedId: string | null;
  severityFilter: IncidentSeverity | 'all';
  statusFilter: IncidentStatus | 'all';
  setSelected: (id: string | null) => void;
  setSeverityFilter: (s: IncidentSeverity | 'all') => void;
  setStatusFilter: (s: IncidentStatus | 'all') => void;
}

export const useIncidentStore = create<IncidentState>((set) => ({
  selectedId: 'INC-1042',
  severityFilter: 'all',
  statusFilter: 'all',
  setSelected: (id) => set({ selectedId: id }),
  setSeverityFilter: (s) => set({ severityFilter: s }),
  setStatusFilter: (s) => set({ statusFilter: s }),
}));
