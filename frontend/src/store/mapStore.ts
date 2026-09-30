import { create } from 'zustand';

interface MapState {
  center: { lat: number; lng: number };
  zoom: number;
  showCameras: boolean;
  showUnits: boolean;
  setCenter: (lat: number, lng: number) => void;
  setZoom: (z: number) => void;
  toggleCameras: () => void;
  toggleUnits: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  center: { lat: 28.6145, lng: 77.208 },
  zoom: 13,
  showCameras: true,
  showUnits: true,
  setCenter: (lat, lng) => set({ center: { lat, lng } }),
  setZoom: (zoom) => set({ zoom }),
  toggleCameras: () => set((s) => ({ showCameras: !s.showCameras })),
  toggleUnits: () => set((s) => ({ showUnits: !s.showUnits })),
}));
