/** Console-wide settings (persisted locally; sync to backend profile later). */

export interface ConsoleSettings {
  retention: string;
  autoDispatch: boolean;
  threshold: number;
  landing: string;
  notifyEnabled: boolean;
  criticalOnly: boolean;
  soundEnabled: boolean;
  emailDigest: boolean;
}

const KEY = 'civiceye_settings';

export const DEFAULT_SETTINGS: ConsoleSettings = {
  retention: '90 DAYS',
  autoDispatch: true,
  threshold: 85,
  landing: '/command-center',
  notifyEnabled: false,
  criticalOnly: false,
  soundEnabled: true,
  emailDigest: false,
};

export function loadConsoleSettings(): ConsoleSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ConsoleSettings>) };
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveConsoleSettings(s: ConsoleSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
