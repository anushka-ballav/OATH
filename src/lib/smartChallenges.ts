import { DailyLog, UserProfile } from '../types';

export type SmartChallengeFocus = 'hydration' | 'study' | 'workout' | 'wake' | 'calories' | 'consistency';
export type SmartChallengeTier = 'Bronze' | 'Silver' | 'Gold';

export interface SmartChallenge {
  id: string;
  focus: SmartChallengeFocus;
  title: string;
  reason: string;
  target: string;
  durationDays: number;
  tier: SmartChallengeTier;
  xpReward: number;
}

interface WeaknessSignal {
  focus: SmartChallengeFocus;
  misses: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toSortedRecentLogs = (logs: DailyLog[], days: number) =>
  [...logs]
    .filter((log) => typeof log?.date === 'string')
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, days);

const resolveTier = (misses: number): SmartChallengeTier => {
  if (misses >= 5) return 'Gold';
  if (misses >= 3) return 'Silver';
  return 'Bronze';
};

const resolveDurationDays = (tier: SmartChallengeTier) => {
  switch (tier) {
    case 'Gold':
      return 7;
    case 'Silver':
      return 5;
    default:
      return 3;
  }
};

const resolveRewardXp = (tier: SmartChallengeTier) => {
  switch (tier) {
    case 'Gold':
      return 140;
    case 'Silver':
      return 90;
    default:
      return 60;
  }
};

const countMisses = (profile: UserProfile, logs: DailyLog[]): WeaknessSignal[] => {
  const targetStudyMinutes = profile.dailyTargets.studyHours * 60;
  const targetWaterMl = profile.dailyTargets.waterLiters * 1000;
  const targetWorkoutTasks = profile.dailyTargets.workoutPlan.dailyChecklist.length;
  const targetCalories = profile.dailyTargets.calories;

  let hydrationMisses = 0;
  let studyMisses = 0;
  let workoutMisses = 0;
  let wakeMisses = 0;
  let caloriesMisses = 0;
  let consistencyMisses = 0;

  logs.forEach((log) => {
    const missedWater = (log.waterIntakeMl || 0) < targetWaterMl;
    const missedStudy = (log.studyMinutes || 0) < targetStudyMinutes;
    const completedWorkout = Array.isArray(log.completedWorkoutTasks) ? log.completedWorkoutTasks.length : 0;
    const missedWorkout = targetWorkoutTasks > 0 ? completedWorkout < targetWorkoutTasks : completedWorkout <= 0;
    const missedWake = !log.wakeUpTime;
    const missedCalories = !(log.caloriesConsumed > 0 && log.caloriesConsumed <= targetCalories);
    const missedAnything = [missedWater, missedStudy, missedWorkout, missedWake, missedCalories].filter(Boolean).length;

    if (missedWater) hydrationMisses += 1;
    if (missedStudy) studyMisses += 1;
    if (missedWorkout) workoutMisses += 1;
    if (missedWake) wakeMisses += 1;
    if (missedCalories) caloriesMisses += 1;
    if (missedAnything >= 2) consistencyMisses += 1;
  });

  return [
    { focus: 'hydration', misses: hydrationMisses },
    { focus: 'study', misses: studyMisses },
    { focus: 'workout', misses: workoutMisses },
    { focus: 'wake', misses: wakeMisses },
    { focus: 'calories', misses: caloriesMisses },
    { focus: 'consistency', misses: consistencyMisses },
  ];
};

const buildChallenge = (
  signal: WeaknessSignal,
  profile: UserProfile,
  windowDays: number,
): SmartChallenge | null => {
  if (signal.misses <= 0) return null;

  const tier = resolveTier(signal.misses);
  const durationDays = resolveDurationDays(tier);
  const xpReward = resolveRewardXp(tier);
  const missesText = `${signal.misses}/${windowDays}`;

  if (signal.focus === 'hydration') {
    return {
      id: `ai-hydration-${tier.toLowerCase()}`,
      focus: signal.focus,
      title: `${durationDays}-Day Hydration Rebuild`,
      reason: `Water goal was missed on ${missesText} recent days.`,
      target: `Hit ${profile.dailyTargets.waterLiters.toFixed(1)}L water every day.`,
      durationDays,
      tier,
      xpReward,
    };
  }

  if (signal.focus === 'study') {
    return {
      id: `ai-study-${tier.toLowerCase()}`,
      focus: signal.focus,
      title: `${durationDays}-Day Focus Sprint`,
      reason: `Study target was missed on ${missesText} recent days.`,
      target: `Reach ${profile.dailyTargets.studyHours.toFixed(1)}h study time daily.`,
      durationDays,
      tier,
      xpReward,
    };
  }

  if (signal.focus === 'workout') {
    return {
      id: `ai-workout-${tier.toLowerCase()}`,
      focus: signal.focus,
      title: `${durationDays}-Day Workout Chain`,
      reason: `Workout checklist was incomplete on ${missesText} recent days.`,
      target: 'Finish the full daily workout checklist.',
      durationDays,
      tier,
      xpReward,
    };
  }

  if (signal.focus === 'wake') {
    return {
      id: `ai-wake-${tier.toLowerCase()}`,
      focus: signal.focus,
      title: `${durationDays}-Day Early Wake Challenge`,
      reason: `Wake-up check was missed on ${missesText} recent days.`,
      target: `Log wake-up near your ${profile.dailyTargets.wakeUpGoal} goal every day.`,
      durationDays,
      tier,
      xpReward,
    };
  }

  if (signal.focus === 'calories') {
    return {
      id: `ai-calories-${tier.toLowerCase()}`,
      focus: signal.focus,
      title: `${durationDays}-Day Calorie Control`,
      reason: `Calorie target was missed on ${missesText} recent days.`,
      target: `Stay at or below ${Math.round(profile.dailyTargets.calories)} kcal daily.`,
      durationDays,
      tier,
      xpReward,
    };
  }

  if (signal.focus === 'consistency') {
    return {
      id: `ai-consistency-${tier.toLowerCase()}`,
      focus: signal.focus,
      title: `${durationDays}-Day Consistency Comeback`,
      reason: `Multiple goals were missed together on ${missesText} recent days.`,
      target: 'Complete at least 4 of 5 core goals each day.',
      durationDays,
      tier,
      xpReward: xpReward + 20,
    };
  }

  return null;
};

export const generateSmartChallenges = (
  profile: UserProfile | null,
  logs: DailyLog[],
): SmartChallenge[] => {
  if (!profile) return [];

  const recentLogs = toSortedRecentLogs(logs, 7);
  if (!recentLogs.length) {
    return [
      {
        id: 'ai-start-bronze',
        focus: 'consistency',
        title: '3-Day Starter Challenge',
        reason: 'Once your first week logs are in, AI challenges will auto-personalize.',
        target: 'Complete at least 3 core goals each day for 3 days.',
        durationDays: 3,
        tier: 'Bronze',
        xpReward: 50,
      },
    ];
  }

  const windowDays = clamp(recentLogs.length, 1, 7);
  const signals = countMisses(profile, recentLogs)
    .sort((first, second) => second.misses - first.misses)
    .filter((signal) => signal.misses > 0);

  const challenges = signals
    .map((signal) => buildChallenge(signal, profile, windowDays))
    .filter((challenge): challenge is SmartChallenge => Boolean(challenge))
    .slice(0, 3);

  if (challenges.length) return challenges;

  return [
    {
      id: 'ai-maintain-silver',
      focus: 'consistency',
      title: '5-Day Momentum Builder',
      reason: 'You are mostly consistent — now lock in a stronger streak.',
      target: 'Complete all 5 core goals for 5 straight days.',
      durationDays: 5,
      tier: 'Silver',
      xpReward: 90,
    },
  ];
};
