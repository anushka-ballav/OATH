import { BMIEntry, DailyLog, TaskItem, UserProfile, UserSession } from '../types';

const safePost = async (path: string, body: unknown) => {
  try {
    await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Server sync is best-effort.
  }
};

export const syncProfileToServer = async (session: UserSession, profile: UserProfile) => {
  if (!session?.userId || !session?.identifier) return;
  await safePost('/api/sync/profile', {
    userId: session.userId,
    identifier: session.identifier,
    name: profile.name,
    gender: profile.gender,
    age: profile.age,
    height: profile.height,
    weight: profile.weight,
    goal: profile.goal,
    dailyAvailableHours: profile.dailyAvailableHours,
    dailyTargets: profile.dailyTargets,
  });
};

export const syncDailyLogToServer = async (session: UserSession, profile: UserProfile | null, log: DailyLog) => {
  if (!session?.userId || !session?.identifier) return;
  await safePost('/api/sync/daily-log', {
    userId: session.userId,
    identifier: session.identifier,
    name: profile?.name || '',
    date: log.date,
    log,
  });
};

export const fetchUserStateFromServer = async (userId: string): Promise<{
  profile: UserProfile | null;
  logs: DailyLog[];
  tasks: TaskItem[];
  bmiHistory: BMIEntry[];
}> => {
  const response = await fetch(`/api/state?userId=${encodeURIComponent(userId)}`);
  const payload = (await response.json().catch(() => null)) as
    | {
        profile?: UserProfile | null;
        logs?: DailyLog[];
        tasks?: TaskItem[];
        bmiHistory?: BMIEntry[];
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to load saved account data.');
  }

  return {
    profile: payload?.profile ?? null,
    logs: Array.isArray(payload?.logs) ? payload.logs : [],
    tasks: Array.isArray(payload?.tasks) ? payload.tasks : [],
    bmiHistory: Array.isArray(payload?.bmiHistory) ? payload.bmiHistory : [],
  };
};
