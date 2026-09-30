import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  dispatchModalOpen: boolean;
  verifyPanelOpen: boolean;
  toggleSidebar: () => void;
  setDispatchModal: (v: boolean) => void;
  setVerifyPanel: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  dispatchModalOpen: false,
  verifyPanelOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setDispatchModal: (v) => set({ dispatchModalOpen: v }),
  setVerifyPanel: (v) => set({ verifyPanelOpen: v }),
}));
