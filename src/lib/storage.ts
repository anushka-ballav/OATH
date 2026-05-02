import { AppState } from '../types';

const GLOBAL_STORAGE_KEY = 'discipline-ai-tracker-global-state-v3';
const USER_STORAGE_PREFIX = 'discipline-ai-tracker-user-state-v3';
const GLOBAL_COOKIE_KEY = 'oath_global_state_v1';

type GlobalState = Pick<AppState, 'session' | 'darkMode'>;
type UserScopedState = Omit<AppState, 'session' | 'darkMode'>;

const getUserStorageKey = (userId: string) => `${USER_STORAGE_PREFIX}-${userId}`;

const readCookie = (key: string) => {
  try {
    const prefix = `${encodeURIComponent(key)}=`;
    const cookie = document.cookie
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(prefix));
    if (!cookie) return null;
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return null;
  }
};

const writeCookie = (key: string, value: string) => {
  try {
    const oneYearSeconds = 60 * 60 * 24 * 365;
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; max-age=${oneYearSeconds}; path=/; samesite=lax`;
  } catch {
    // Ignore cookie failures and continue with localStorage only.
  }
};

const deleteCookie = (key: string) => {
  try {
    document.cookie = `${encodeURIComponent(key)}=; max-age=0; path=/; samesite=lax`;
  } catch {
    // Ignore cookie failures.
  }
};

export const loadGlobalState = (): GlobalState | null => {
  try {
    const raw = window.localStorage.getItem(GLOBAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as GlobalState;
  } catch {
    window.localStorage.removeItem(GLOBAL_STORAGE_KEY);
  }

  try {
    const cookieRaw = readCookie(GLOBAL_COOKIE_KEY);
    if (!cookieRaw) return null;
    return JSON.parse(cookieRaw) as GlobalState;
  } catch {
    return null;
  }
};

export const saveGlobalState = (state: GlobalState) => {
  const payload = JSON.stringify(state);
  try {
    window.localStorage.setItem(GLOBAL_STORAGE_KEY, payload);
  } catch {
    // Continue with cookie fallback.
  }
  writeCookie(GLOBAL_COOKIE_KEY, payload);
};

export const clearGlobalState = () => {
  try {
    window.localStorage.removeItem(GLOBAL_STORAGE_KEY);
  } catch {
    // Ignore local storage failures.
  }
  deleteCookie(GLOBAL_COOKIE_KEY);
};

export const loadUserState = (userId: string): UserScopedState | null => {
  try {
    const raw = window.localStorage.getItem(getUserStorageKey(userId));
    return raw ? (JSON.parse(raw) as UserScopedState) : null;
  } catch {
    window.localStorage.removeItem(getUserStorageKey(userId));
    return null;
  }
};

export const saveUserState = (userId: string, state: UserScopedState) => {
  try {
    window.localStorage.setItem(getUserStorageKey(userId), JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }
};

export const clearUserState = (userId: string) => {
  try {
    window.localStorage.removeItem(getUserStorageKey(userId));
  } catch {
    // Ignore storage failures.
  }
};

export type ExportedAppStateBundle = {
  version: 1;
  exportedAt: string;
  global: GlobalState | null;
  user: UserScopedState | null;
};

export const exportStateBundle = (userId: string): ExportedAppStateBundle => {
  const global = loadGlobalState();
  const user = loadUserState(userId);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    global,
    user,
  };
};

export const importStateBundle = (userId: string, bundle: ExportedAppStateBundle) => {
  if (!bundle || bundle.version !== 1) {
    throw new Error('Unsupported export file.');
  }

  if (bundle.global) saveGlobalState(bundle.global);
  if (bundle.user) saveUserState(userId, bundle.user);
};
