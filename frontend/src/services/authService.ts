import { api } from './api';
import type {
  AuthSession,
  AuthUser,
  AuthorizedIdCheck,
  LoginPayload,
  RegisterPayload,
} from '../types/auth';

/* ------------------------------------------------------------------ */
/* Backend seam: flip USE_MOCK to false and point VITE_API_URL at the   */
/* real API. Each function is already shaped around the future REST     */
/* contract (see the commented api.* calls).                            */
/* ------------------------------------------------------------------ */
const USE_MOCK = true;

const SESSION_KEY = 'civiceye_session';
const SESSION_TTL_SHORT = 8 * 3600 * 1000;
const SESSION_TTL_LONG = 7 * 24 * 3600 * 1000;

/** Mock format for operator IDs. Keep in sync with the backend rule. */
export const AUTHORIZED_ID_PATTERN = /^CIVIC-[A-Z0-9]{6}$/i;
export const AUTHORIZED_ID_HINT = 'Format: CIVIC-XXXXXX';

/* ------------------------- mock persistence ------------------------ */
/* WARNING: localStorage user records are a dev-only stand-in. Real     */
/* auth must verify credentials + Authorized IDs server-side and never  */
/* store passwords in the browser.                                      */
const USERS_KEY = 'civiceye_users';

interface StoredUser extends AuthUser {
  password: string;
}

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw) as StoredUser[];
  } catch {
    /* corrupted store -> start empty below */
  }
  // No seeded accounts: operators register their own login (stored locally
  // until server-side auth lands). Never ship known passwords.
  const seed: StoredUser[] = [];
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(seed));
  } catch {
    /* storage unavailable (private mode) -> memory-only session */
  }
  return seed;
}

function saveUsers(users: StoredUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* ignore */
  }
}

const delay = (ms = 600) => new Promise((r) => setTimeout(r, ms));
const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `u-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function toPublic(u: StoredUser): AuthUser {
  const { password: _pw, ...pub } = u;
  return pub;
}

function persistSession(user: AuthUser, remember: boolean): AuthSession {
  const now = Date.now();
  const session: AuthSession = {
    user,
    issuedAt: now,
    expiresAt: now + (remember ? SESSION_TTL_LONG : SESSION_TTL_SHORT),
  };
  const store = remember ? localStorage : sessionStorage;
  try {
    store.setItem(SESSION_KEY, JSON.stringify(session));
    (remember ? sessionStorage : localStorage).removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  return session;
}

function readSession(): AuthSession | null {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY);
      if (!raw) continue;
      const s = JSON.parse(raw) as AuthSession;
      if (s.expiresAt > Date.now()) return s;
      store.removeItem(SESSION_KEY);
    } catch {
      /* ignore and try next store */
    }
  }
  return null;
}

/* ------------------------------ API -------------------------------- */

export async function verifyAuthorizedId(id: string): Promise<AuthorizedIdCheck> {
  const value = id.trim().toUpperCase();
  if (!USE_MOCK) {
    // Real backend: POST /auth/verify-authorized-id { authorizedId }
    return api.post<AuthorizedIdCheck>('/auth/verify-authorized-id', { authorizedId: value });
  }
  await delay(450);
  if (!value) return { ok: false, message: 'Authorized ID is required.' };
  if (!AUTHORIZED_ID_PATTERN.test(value)) {
    return { ok: false, message: `Invalid ID. ${AUTHORIZED_ID_HINT}` };
  }
  return { ok: true, message: 'Authorized ID verified.' };
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const identifier = payload.identifier.trim();
  if (!USE_MOCK) {
    // Real backend: POST /auth/login { identifier, password, remember }
    // -> { user, token, expiresAt }. Store token instead of the session.
    const res = await api.post<AuthSession>('/auth/login', payload);
    persistSession(res.user, payload.remember);
    return res;
  }
  await delay();
  const users = loadUsers();
  const found = users.find(
    (u) =>
      u.email.toLowerCase() === identifier.toLowerCase() ||
      u.name.toLowerCase() === identifier.toLowerCase(),
  );
  if (!found || found.password !== payload.password) {
    throw new Error('Invalid credentials. Check your email/username and password.');
  }
  return persistSession(toPublic(found), payload.remember);
}

export async function register(payload: RegisterPayload): Promise<AuthSession> {
  if (!USE_MOCK) {
    // Real backend: POST /auth/register { ...payload }
    // -> server validates + verifies the Authorized ID, returns session.
    const res = await api.post<AuthSession>('/auth/register', payload);
    persistSession(res.user, true);
    return res;
  }
  await delay(800);
  const users = loadUsers();
  if (users.some((u) => u.email.toLowerCase() === payload.email.trim().toLowerCase())) {
    throw new Error('An account with this email already exists. Try logging in.');
  }
  const check = await verifyAuthorizedId(payload.authorizedId);
  if (!check.ok) throw new Error(check.message);
  const user: StoredUser = {
    id: uid(),
    name: payload.name.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    organization: payload.organization.trim(),
    role: payload.role,
    authorizedId: payload.authorizedId.trim().toUpperCase(),
    password: payload.password,
  };
  users.push(user);
  saveUsers(users);
  return persistSession(toPublic(user), true);
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const value = email.trim();
  if (!USE_MOCK) {
    // Real backend: POST /auth/forgot-password { email }
    return api.post<{ message: string }>('/auth/forgot-password', { email: value });
  }
  await delay(500);
  return {
    message:
      'If an account exists for this email, reset instructions have been sent. (Mock mode: no email is actually dispatched.)',
  };
}

export function getSession(): AuthSession | null {
  return readSession();
}

export function logout() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  if (!USE_MOCK) {
    // Real backend: POST /auth/logout (invalidate server session/token)
    api.post('/auth/logout', {}).catch(() => undefined);
  }
}

function replaceSessionUser(user: AuthUser) {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY);
      if (!raw) continue;
      const s = JSON.parse(raw) as AuthSession;
      if (s.user.id !== user.id) continue;
      store.setItem(SESSION_KEY, JSON.stringify({ ...s, user }));
    } catch {
      /* ignore */
    }
  }
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<AuthUser, 'name' | 'phone' | 'organization'>>,
): Promise<AuthUser> {
  if (!USE_MOCK) {
    // Real backend: PATCH /auth/profile { ...patch } -> AuthUser
    const user = await api.patch<AuthUser>('/auth/profile', patch);
    replaceSessionUser(user);
    return user;
  }
  await delay(400);
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw new Error('Account not found.');
  const updated: StoredUser = {
    ...users[idx],
    name: (patch.name ?? users[idx].name).trim(),
    phone: (patch.phone ?? users[idx].phone).trim(),
    organization: (patch.organization ?? users[idx].organization).trim(),
  };
  if (updated.name.length < 2) throw new Error('Enter your full name.');
  users[idx] = updated;
  saveUsers(users);
  const pub = toPublic(updated);
  replaceSessionUser(pub);
  return pub;
}

export async function changePassword(userId: string, currentPw: string, nextPw: string): Promise<void> {
  if (!USE_MOCK) {
    // Real backend: POST /auth/change-password { currentPassword, newPassword }
    await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: nextPw });
    return;
  }
  await delay(400);
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) throw new Error('Account not found.');
  if (users[idx].password !== currentPw) throw new Error('Current password is incorrect.');
  if (nextPw.length < 8) throw new Error('New password must be at least 8 characters.');
  users[idx] = { ...users[idx], password: nextPw };
  saveUsers(users);
}
