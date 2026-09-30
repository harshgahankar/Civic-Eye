import { create } from 'zustand';

interface CameraState {
  selectedId: string | null;
  sectorFilter: string | 'all';
  setSelected: (id: string | null) => void;
  setSectorFilter: (s: string | 'all') => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  selectedId: null,
  sectorFilter: 'all',
  setSelected: (id) => set({ selectedId: id }),
  setSectorFilter: (s) => set({ sectorFilter: s }),
}));
