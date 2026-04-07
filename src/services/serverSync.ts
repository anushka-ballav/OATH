import { BMIEntry, DailyLog, NotificationItem, TaskItem, UserProfile, UserSession } from '../types';

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

export const syncProfileToServer = async (
  session: UserSession,
  profile: UserProfile,
  notifications?: NotificationItem[],
) => {
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
    dailyStudyHours: profile.dailyStudyHours,
    dailyWorkoutMinutes: profile.dailyWorkoutMinutes,
    dailyTargets: profile.dailyTargets,
    notifications,
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

export const fetchUserStateFromServer = async (userId: string, identifier?: string): Promise<{
  userId: string;
  profile: UserProfile | null;
  logs: DailyLog[];
  tasks: TaskItem[];
  bmiHistory: BMIEntry[];
  notifications: NotificationItem[];
}> => {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (identifier) params.set('identifier', identifier.trim().toLowerCase());
  const response = await fetch(`/api/state?${params.toString()}`);
  const payload = (await response.json().catch(() => null)) as
    | {
        userId?: string;
        profile?: UserProfile | null;
        logs?: DailyLog[];
        tasks?: TaskItem[];
        bmiHistory?: BMIEntry[];
        notifications?: NotificationItem[];
        message?: string;
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to load saved account data.');
  }

  return {
    userId: payload?.userId ?? userId,
    profile: payload?.profile ?? null,
    logs: Array.isArray(payload?.logs) ? payload.logs : [],
    tasks: Array.isArray(payload?.tasks) ? payload.tasks : [],
    bmiHistory: Array.isArray(payload?.bmiHistory) ? payload.bmiHistory : [],
    notifications: Array.isArray(payload?.notifications) ? payload.notifications : [],
  };
};
