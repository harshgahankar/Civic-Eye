import { create } from 'zustand';

interface TrackingState {
  activeTrackId: string | null;
  follow: boolean;
  setActiveTrack: (id: string | null) => void;
  setFollow: (v: boolean) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  activeTrackId: 'TRK-201',
  follow: true,
  setActiveTrack: (id) => set({ activeTrackId: id }),
  setFollow: (v) => set({ follow: v }),
}));
