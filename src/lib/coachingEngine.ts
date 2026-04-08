import { getDelayInMinutes, getLastNDays } from './date';
import { DailyLog, NotificationItem, UserProfile } from '../types';

export type CoachingPriority = 'high' | 'medium' | 'low';
export type CoachingCategory = 'study' | 'sleep' | 'hydration' | 'workout' | 'nutrition' | 'consistency';

export interface CoachingRecommendation {
  id: string;
  category: CoachingCategory;
  priority: CoachingPriority;
  title: string;
  insight: string;
  action: string;
}

interface GenerateRecommendationsInput {
  profile: UserProfile | null;
  logs: DailyLog[];
  currentLog: DailyLog;
  notifications: NotificationItem[];
}

const toMinutes = (time: string) => {
  const [hours, mins] = String(time || '00:00')
    .split(':')
    .map((value) => Math.max(0, Number(value) || 0));
  return Math.min(23, hours) * 60 + Math.min(59, mins);
};

const toClock = (totalMinutes: number) => {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const toRecentWindow = (logs: DailyLog[], currentLog: DailyLog, days = 7) => {
  const dateKeys = getLastNDays(days);
  const logByDate = new Map<string, DailyLog>();
  logs.forEach((entry) => {
    if (entry?.date) logByDate.set(entry.date, entry);
  });
  if (currentLog?.date) logByDate.set(currentLog.date, currentLog);

  return dateKeys.map((date) => {
    const log = logByDate.get(date);
    return {
      date,
      wakeUpTime: log?.wakeUpTime,
      studyMinutes: Math.max(0, Number(log?.studyMinutes) || 0),
      waterIntakeMl: Math.max(0, Number(log?.waterIntakeMl) || 0),
      caloriesConsumed: Math.max(0, Number(log?.caloriesConsumed) || 0),
      completedWorkoutTasks: Array.isArray(log?.completedWorkoutTasks) ? log.completedWorkoutTasks.length : 0,
    };
  });
};

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const priorityWeight: Record<CoachingPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const generateCoachingRecommendations = ({
  profile,
  logs,
  currentLog,
  notifications,
}: GenerateRecommendationsInput): CoachingRecommendation[] => {
  if (!profile) return [];

  const recent = toRecentWindow(logs, currentLog, 7);
  const dailyTargets = profile.dailyTargets;
  const studyTargetMinutes = Math.max(0, Math.round(dailyTargets.studyHours * 60));
  const waterTargetMl = Math.max(0, Math.round(dailyTargets.waterLiters * 1000));
  const calorieTarget = Math.max(0, Math.round(dailyTargets.calories));
  const workoutTargetCount = Math.max(0, dailyTargets.workoutPlan.dailyChecklist.length);

  const studyHitDays = recent.filter((entry) => entry.studyMinutes >= studyTargetMinutes).length;
  const waterHitDays = recent.filter((entry) => entry.waterIntakeMl >= waterTargetMl).length;
  const workoutHitDays = recent.filter((entry) =>
    workoutTargetCount > 0 ? entry.completedWorkoutTasks >= workoutTargetCount : entry.completedWorkoutTasks > 0,
  ).length;
  const calorieHitDays = recent.filter(
    (entry) => entry.caloriesConsumed > 0 && entry.caloriesConsumed <= calorieTarget,
  ).length;

  const avgStudyHours = average(recent.map((entry) => entry.studyMinutes / 60));
  const avgWaterLiters = average(recent.map((entry) => entry.waterIntakeMl / 1000));

  const wakeLateOrMissingDays = recent.filter((entry) => {
    if (!entry.wakeUpTime) return true;
    const lateMinutes = getDelayInMinutes(entry.wakeUpTime, dailyTargets.wakeUpGoal) ?? 0;
    return lateMinutes > 35;
  }).length;

  const recent3 = recent.slice(-3);
  const previous4 = recent.slice(0, 4);
  const recentWaterAvg = average(recent3.map((entry) => entry.waterIntakeMl / 1000));
  const previousWaterAvg = average(previous4.map((entry) => entry.waterIntakeMl / 1000));
  const waterReminder = notifications.find((item) => item.id === 'water');
  const suggestedWaterReminder =
    waterReminder && waterReminder.enabled ? toClock(toMinutes(waterReminder.time) - 30) : null;

  const recommendations: CoachingRecommendation[] = [];

  if (studyHitDays <= 4) {
    recommendations.push({
      id: 'study-focus-blocks',
      category: 'study',
      priority: studyHitDays <= 2 ? 'high' : 'medium',
      title: 'Study consistency is below target',
      insight: `You hit your study goal on ${studyHitDays}/7 days (${avgStudyHours.toFixed(1)}h avg vs ${dailyTargets.studyHours.toFixed(1)}h target).`,
      action: 'Try 2-hour focus blocks today: 2 x 60 min deep-work sessions with a 10-min break between them.',
    });
  }

  if (wakeLateOrMissingDays >= 3 && studyHitDays <= 4) {
    recommendations.push({
      id: 'sleep-productivity-link',
      category: 'sleep',
      priority: 'high',
      title: 'Sleep timing is affecting productivity',
      insight: `Wake-up was late/missed on ${wakeLateOrMissingDays}/7 days, and study consistency dropped this week.`,
      action: `Start wind-down 45 minutes earlier and target wake logging around ${dailyTargets.wakeUpGoal} for the next 3 days.`,
    });
  }

  if (waterHitDays <= 4 || (previousWaterAvg - recentWaterAvg > 0.35 && recentWaterAvg < dailyTargets.waterLiters)) {
    recommendations.push({
      id: 'hydration-drop-adjust',
      category: 'hydration',
      priority: waterHitDays <= 2 ? 'high' : 'medium',
      title: 'Hydration trend is dropping',
      insight: `Water goal hit on ${waterHitDays}/7 days (${avgWaterLiters.toFixed(1)}L avg vs ${dailyTargets.waterLiters.toFixed(1)}L target).`,
      action: suggestedWaterReminder
        ? `Move your water reminder from ${waterReminder?.time} to ${suggestedWaterReminder} and drink 300ml at each reminder.`
        : 'Enable water reminders and split intake into 6 smaller hydration checkpoints.',
    });
  }

  if (workoutHitDays <= 4) {
    recommendations.push({
      id: 'workout-activation',
      category: 'workout',
      priority: workoutHitDays <= 2 ? 'high' : 'medium',
      title: 'Workout completion is inconsistent',
      insight: `Workout checklist completed on ${workoutHitDays}/7 days.`,
      action: 'Use a minimum-action rule: do at least the first 10 minutes of your workout daily to preserve streak momentum.',
    });
  }

  if (calorieHitDays <= 4) {
    recommendations.push({
      id: 'nutrition-stability',
      category: 'nutrition',
      priority: calorieHitDays <= 2 ? 'high' : 'medium',
      title: 'Calorie control needs stabilization',
      insight: `Calorie target was met on ${calorieHitDays}/7 days.`,
      action: 'Pre-log your next meal and keep dinner lighter on low-activity days to stay under target.',
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: 'consistency-maintain',
      category: 'consistency',
      priority: 'low',
      title: 'Momentum is strong this week',
      insight: 'Your consistency signals are stable across study, hydration, workout, and calorie control.',
      action: 'Maintain your current routine and raise one goal slightly for controlled progression.',
    });
  }

  return recommendations
    .sort((first, second) => {
      const delta = priorityWeight[second.priority] - priorityWeight[first.priority];
      if (delta !== 0) return delta;
      return first.title.localeCompare(second.title);
    })
    .slice(0, 4);
};
