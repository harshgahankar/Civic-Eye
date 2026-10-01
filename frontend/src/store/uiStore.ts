import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

/** On-screen popup for a freshly CONFIRMED live incident. */
export interface LiveAlert {
  id: string; // incident_id (dedupe key)
  incidentType: string; // ACCIDENT | UNATTENDED_BAGGAGE | …
  title: string;
  cameraId: string;
  severity: string;
  confidence: number | null;
  at: number;
}

interface UiState {
  sidebarOpen: boolean;
  dispatchModalOpen: boolean;
  verifyPanelOpen: boolean;
  toasts: Toast[];
  alerts: LiveAlert[];
  searchQuery: string;
  toggleSidebar: () => void;
  setDispatchModal: (v: boolean) => void;
  setVerifyPanel: (v: boolean) => void;
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  pushAlert: (alert: Omit<LiveAlert, 'at'>) => void;
  dismissAlert: (id: string) => void;
  setSearchQuery: (q: string) => void;
}

let toastId = 0;

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  dispatchModalOpen: false,
  verifyPanelOpen: false,
  toasts: [],
  alerts: [],
  searchQuery: '',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setDispatchModal: (v) => set({ dispatchModalOpen: v }),
  setVerifyPanel: (v) => set({ verifyPanelOpen: v }),
  pushToast: (message, tone = 'info') =>
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id: ++toastId, message, tone }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  pushAlert: (alert) =>
    set((s) => ({
      alerts: s.alerts.some((a) => a.id === alert.id)
        ? s.alerts
        : [...s.alerts.slice(-2), { ...alert, at: Date.now() }],
    })),
  dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
