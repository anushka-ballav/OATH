import { AppState } from '../types';

const GLOBAL_STORAGE_KEY = 'discipline-ai-tracker-global-state-v3';
const USER_STORAGE_PREFIX = 'discipline-ai-tracker-user-state-v3';

type GlobalState = Pick<AppState, 'session' | 'darkMode'>;
type UserScopedState = Omit<AppState, 'session' | 'darkMode'>;

const getUserStorageKey = (userId: string) => `${USER_STORAGE_PREFIX}-${userId}`;

export const loadGlobalState = (): GlobalState | null => {
  try {
    const raw = window.localStorage.getItem(GLOBAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GlobalState) : null;
  } catch {
    window.localStorage.removeItem(GLOBAL_STORAGE_KEY);
    return null;
  }
};

export const saveGlobalState = (state: GlobalState) => {
  window.localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(state));
};

export const clearGlobalState = () => {
  window.localStorage.removeItem(GLOBAL_STORAGE_KEY);
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
  window.localStorage.setItem(getUserStorageKey(userId), JSON.stringify(state));
};

export const clearUserState = (userId: string) => {
  window.localStorage.removeItem(getUserStorageKey(userId));
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
