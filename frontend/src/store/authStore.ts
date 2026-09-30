import { create } from 'zustand';
import * as authService from '../services/authService';
import type { AuthUser, LoginPayload, RegisterPayload } from '../types/auth';

interface AuthState {
  user: AuthUser | null;
  initialized: boolean;
  authError: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: Partial<Pick<AuthUser, 'name' | 'phone' | 'organization'>>) => Promise<void>;
  changePassword: (currentPw: string, nextPw: string) => Promise<void>;
  clearError: () => void;
}

const initialSession = authService.getSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialSession?.user ?? null,
  initialized: true,
  authError: null,
  login: async (payload) => {
    set({ authError: null });
    try {
      const session = await authService.login(payload);
      set({ user: session.user });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Login failed. Try again.';
      set({ authError: message });
      throw e;
    }
  },
  register: async (payload) => {
    set({ authError: null });
    try {
      const session = await authService.register(payload);
      set({ user: session.user });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Registration failed. Try again.';
      set({ authError: message });
      throw e;
    }
  },
  logout: () => {
    authService.logout();
    set({ user: null, authError: null });
  },
  updateProfile: async (patch) => {
    const user = get().user;
    if (!user) throw new Error('Not signed in.');
    const updated = await authService.updateProfile(user.id, patch);
    set({ user: updated });
  },
  changePassword: async (currentPw, nextPw) => {
    const user = get().user;
    if (!user) throw new Error('Not signed in.');
    await authService.changePassword(user.id, currentPw, nextPw);
  },
  clearError: () => set({ authError: null }),
}));
