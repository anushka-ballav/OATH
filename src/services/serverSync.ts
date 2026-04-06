import { DailyLog, UserProfile, UserSession } from '../types';

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
