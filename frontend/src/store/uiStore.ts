import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface UiState {
  sidebarOpen: boolean;
  dispatchModalOpen: boolean;
  verifyPanelOpen: boolean;
  toasts: Toast[];
  searchQuery: string;
  toggleSidebar: () => void;
  setDispatchModal: (v: boolean) => void;
  setVerifyPanel: (v: boolean) => void;
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  setSearchQuery: (q: string) => void;
}

let toastId = 0;

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  dispatchModalOpen: false,
  verifyPanelOpen: false,
  toasts: [],
  searchQuery: '',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setDispatchModal: (v) => set({ dispatchModalOpen: v }),
  setVerifyPanel: (v) => set({ verifyPanelOpen: v }),
  pushToast: (message, tone = 'info') =>
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id: ++toastId, message, tone }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
