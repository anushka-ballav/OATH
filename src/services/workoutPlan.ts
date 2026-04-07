import { DailyTargets, UserProfile, WorkoutPlan } from '../types';

const normalizeWorkoutPlan = (
  plan: unknown,
  fallback: WorkoutPlan,
): WorkoutPlan => {
  if (!plan || typeof plan !== 'object') return fallback;
  const candidate = plan as Partial<WorkoutPlan>;
  const checklist = Array.isArray(candidate.dailyChecklist)
    ? candidate.dailyChecklist
        .map((entry, index) => {
          const rawLabel =
            typeof entry === 'string'
              ? entry
              : typeof entry?.label === 'string'
                ? entry.label
                : '';
          const label = rawLabel.trim();
          if (!label) return null;

          const rawId =
            typeof entry === 'object' && entry && typeof entry.id === 'string'
              ? entry.id
              : `task-${index + 1}`;

          return {
            id: rawId.trim().slice(0, 64) || `task-${index + 1}`,
            label: label.slice(0, 160),
          };
        })
        .filter((item): item is { id: string; label: string } => Boolean(item))
        .slice(0, 8)
    : fallback.dailyChecklist;

  return {
    title:
      typeof candidate.title === 'string' && candidate.title.trim()
        ? candidate.title.trim().slice(0, 120)
        : fallback.title,
    summary:
      typeof candidate.summary === 'string' && candidate.summary.trim()
        ? candidate.summary.trim().slice(0, 420)
        : fallback.summary,
    dailyChecklist: checklist.length ? checklist : fallback.dailyChecklist,
    estimatedCaloriesBurned: Math.max(
      0,
      Math.round(Number(candidate.estimatedCaloriesBurned) || fallback.estimatedCaloriesBurned),
    ),
    recoveryTip:
      typeof candidate.recoveryTip === 'string' && candidate.recoveryTip.trim()
        ? candidate.recoveryTip.trim().slice(0, 220)
        : fallback.recoveryTip,
  };
};

export const generateWorkoutPlanWithGroq = async ({
  profile,
  dailyTargets,
}: {
  profile: Omit<UserProfile, 'userId' | 'dailyTargets'> | UserProfile;
  dailyTargets: DailyTargets;
}): Promise<WorkoutPlan | null> => {
  try {
    const response = await fetch('/api/ai/workout-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: {
          name: profile.name,
          goal: profile.goal,
          gender: profile.gender,
          age: profile.age,
          height: profile.height,
          weight: profile.weight,
          dailyStudyHours: profile.dailyStudyHours,
          dailyWorkoutMinutes: profile.dailyWorkoutMinutes,
          dailyAvailableHours: profile.dailyAvailableHours,
        },
        dailyTargets,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { workoutPlan?: WorkoutPlan } | null;
    if (!response.ok) return null;
    if (!payload?.workoutPlan) return null;

    return normalizeWorkoutPlan(payload.workoutPlan, dailyTargets.workoutPlan);
  } catch {
    return null;
  }
};

