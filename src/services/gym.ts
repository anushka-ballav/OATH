import { GymPlan } from '../types';

const safeJson = async <T,>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const generateGymPlan = async ({
  userId,
  identifier,
  equipment,
  otherEquipment,
}: {
  userId: string;
  identifier?: string;
  equipment: string[];
  otherEquipment?: string;
}): Promise<{ plan: GymPlan; todayWorkoutPlan?: { title: string; summary: string; dailyChecklist: { id: string; label: string }[]; estimatedCaloriesBurned: number; recoveryTip: string } | null }> => {
  const response = await fetch('/api/gym/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      identifier,
      equipment,
      otherEquipment,
    }),
  });

  const payload = await safeJson<{
    message?: string;
    plan?: GymPlan;
    todayWorkoutPlan?: {
      title: string;
      summary: string;
      dailyChecklist: { id: string; label: string }[];
      estimatedCaloriesBurned: number;
      recoveryTip: string;
    } | null;
  }>(response);

  if (!response.ok || !payload?.plan) {
    throw new Error(payload?.message || 'Unable to generate gym plan.');
  }

  return {
    plan: payload.plan,
    todayWorkoutPlan: payload.todayWorkoutPlan ?? null,
  };
};

export const fetchGymPlan = async ({
  userId,
  identifier,
}: {
  userId: string;
  identifier?: string;
}): Promise<{ plan: GymPlan | null; todayWorkoutPlan: { title: string; summary: string; dailyChecklist: { id: string; label: string }[]; estimatedCaloriesBurned: number; recoveryTip: string } | null }> => {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (identifier) params.set('identifier', identifier.trim().toLowerCase());

  const response = await fetch(`/api/gym/plan?${params.toString()}`);
  const payload = await safeJson<{
    message?: string;
    plan?: GymPlan | null;
    todayWorkoutPlan?: {
      title: string;
      summary: string;
      dailyChecklist: { id: string; label: string }[];
      estimatedCaloriesBurned: number;
      recoveryTip: string;
    } | null;
  }>(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to load gym plan.');
  }

  return {
    plan: payload?.plan ?? null,
    todayWorkoutPlan: payload?.todayWorkoutPlan ?? null,
  };
};

export const markGymWorkoutCompleted = async ({
  userId,
  identifier,
  day,
  completed = true,
}: {
  userId: string;
  identifier?: string;
  day: string;
  completed?: boolean;
}): Promise<{ progress: NonNullable<GymPlan['progress']> }> => {
  const response = await fetch('/api/gym/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      identifier,
      day,
      completed,
    }),
  });

  const payload = await safeJson<{ message?: string; progress?: NonNullable<GymPlan['progress']> }>(response);

  if (!response.ok || !payload?.progress) {
    throw new Error(payload?.message || 'Unable to update gym progress.');
  }

  return { progress: payload.progress };
};
