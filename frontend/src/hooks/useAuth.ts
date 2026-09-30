import { useAuthStore } from '../store/authStore';

/** Thin hook over the auth store; add session-refresh side effects here later. */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const authError = useAuthStore((s) => s.authError);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const clearError = useAuthStore((s) => s.clearError);
  return { user, initialized, authError, login, register, logout, clearError };
}

export default useAuth;
