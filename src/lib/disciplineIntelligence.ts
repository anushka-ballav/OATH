import { getLastNDays, todayKey } from './date';
import { DailyLog, NotificationItem, StreakRecord, TaskItem, UserProfile } from '../types';

export interface DisciplineScoreSummary {
  score: number;
  trend: 'up' | 'down' | 'flat';
  trendDelta: number;
  breakdown: {
    study: number;
    health: number;
    tasks: number;
  };
}

export interface PlannerTask {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface PlannerBlock {
  time: string;
  title: string;
  detail: string;
}

export interface SmartDailyPlanner {
  summary: string;
  blocks: PlannerBlock[];
  priorityTasks: PlannerTask[];
}

export interface HabitPrediction {
  id: string;
  title: string;
  riskPercent: number;
  direction: 'warning' | 'stable';
  message: string;
  action: string;
}

interface EngineInput {
  profile: UserProfile | null;
  logs: DailyLog[];
  currentLog: DailyLog;
  tasks: TaskItem[];
  notifications: NotificationItem[];
  streakHistory: StreakRecord[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const isMeaningfulLog = (log: DailyLog | null | undefined) =>
  Boolean(
    log &&
      (log.wakeUpTime ||
        (log.studyMinutes || 0) > 0 ||
        (log.waterIntakeMl || 0) > 0 ||
        (log.caloriesConsumed || 0) > 0 ||
        (log.caloriesBurned || 0) > 0 ||
        (log.completedWorkoutTasks?.length || 0) > 0),
  );

const toDateMap = (logs: DailyLog[], currentLog: DailyLog) => {
  const map = new Map<string, DailyLog>();
  logs.forEach((entry) => {
    if (entry?.date) map.set(entry.date, entry);
  });
  if (currentLog?.date) {
    map.set(currentLog.date, currentLog);
  }
  return map;
};

const toMinutes = (time: string) => {
  const [hours, mins] = String(time || '00:00')
    .split(':')
    .map((value) => Number(value) || 0);
  return Math.max(0, Math.min(23, hours)) * 60 + Math.max(0, Math.min(59, mins));
};

const toClock = (minutes: number) => {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getCustomTaskCompletionRatioForDate = (tasks: TaskItem[], dateKey: string) => {
  const relevant = tasks.filter((task) => task?.dueDate && task.dueDate <= dateKey);
  if (!relevant.length) return null;

  const dayEndMs = new Date(`${dateKey}T23:59:59.999`).getTime();
  const completedCount = relevant.filter((task) => {
    if (!task.completed && !task.completedAt) return false;
    if (task.completedAt) return new Date(task.completedAt).getTime() <= dayEndMs;
    return task.completed;
  }).length;

  return clamp01(completedCount / relevant.length);
};

const getDailyGoalTaskCompletionRatio = ({
  profile,
  log,
}: {
  profile: UserProfile;
  log: DailyLog;
}) => {
  const studyTargetMinutes = Math.max(0, Math.round(profile.dailyTargets.studyHours * 60));
  const waterTargetMl = Math.max(0, Math.round(profile.dailyTargets.waterLiters * 1000));
  const workoutTargetCount = Math.max(0, profile.dailyTargets.workoutPlan.dailyChecklist.length);
  const completedWorkoutCount = Array.isArray(log.completedWorkoutTasks) ? log.completedWorkoutTasks.length : 0;

  const checks = [
    {
      applicable: studyTargetMinutes > 0,
      completed: (log.studyMinutes || 0) >= studyTargetMinutes,
    },
    {
      applicable: waterTargetMl > 0,
      completed: (log.waterIntakeMl || 0) >= waterTargetMl,
    },
    {
      applicable: workoutTargetCount > 0,
      completed: completedWorkoutCount >= workoutTargetCount,
    },
  ];

  const applicableChecks = checks.filter((check) => check.applicable);
  if (!applicableChecks.length) return 0;

  const completedChecks = applicableChecks.filter((check) => check.completed).length;
  return clamp01(completedChecks / applicableChecks.length);
};

const calorieCompliance = (log: DailyLog, calorieTarget: number) => {
  if (calorieTarget <= 0) return 1;
  const consumed = Math.max(0, Number(log.caloriesConsumed) || 0);
  if (consumed <= 0) return 0.5;
  if (consumed <= calorieTarget) return 1;
  return clamp01(1 - (consumed - calorieTarget) / calorieTarget);
};

const getWorkoutRatio = (log: DailyLog, workoutTargetCount: number) => {
  const completed = Array.isArray(log.completedWorkoutTasks) ? log.completedWorkoutTasks.length : 0;
  if (workoutTargetCount <= 0) return completed > 0 ? 1 : 0.5;
  return clamp01(completed / workoutTargetCount);
};

const computeScoreForDate = ({
  profile,
  log,
  tasks,
  dateKey,
}: {
  profile: UserProfile;
  log: DailyLog;
  tasks: TaskItem[];
  dateKey: string;
}) => {
  const studyTargetMinutes = Math.max(1, Math.round(profile.dailyTargets.studyHours * 60));
  const waterTargetMl = Math.max(1, Math.round(profile.dailyTargets.waterLiters * 1000));
  const calorieTarget = Math.max(1, Math.round(profile.dailyTargets.calories));
  const workoutTargetCount = profile.dailyTargets.workoutPlan.dailyChecklist.length;

  const studyRatio = clamp01((log.studyMinutes || 0) / studyTargetMinutes);
  const waterRatio = clamp01((log.waterIntakeMl || 0) / waterTargetMl);
  const workoutRatio = getWorkoutRatio(log, workoutTargetCount);
  const wakeRatio = log.wakeUpTime ? 1 : 0;
  const calorieRatio = calorieCompliance(log, calorieTarget);
  const healthRatio = clamp01((waterRatio + workoutRatio + wakeRatio + calorieRatio) / 4);
  const dailyGoalTaskRatio = getDailyGoalTaskCompletionRatio({ profile, log });
  const customTaskRatio = getCustomTaskCompletionRatioForDate(tasks, dateKey);
  const taskRatio =
    customTaskRatio == null ? dailyGoalTaskRatio : clamp01((dailyGoalTaskRatio + customTaskRatio) / 2);

  const study = Math.round(studyRatio * 30);
  const health = Math.round(healthRatio * 30);
  const task = Math.round(taskRatio * 40);
  const score = Math.max(0, Math.min(100, study + health + task));

  return {
    score,
    breakdown: {
      study,
      health,
      tasks: task,
    },
  };
};

export const buildDisciplineScoreSummary = ({
  profile,
  logs,
  currentLog,
  tasks,
}: Pick<EngineInput, 'profile' | 'logs' | 'currentLog' | 'tasks'>): DisciplineScoreSummary | null => {
  if (!profile) return null;

  const dateKey = todayKey();
  const logByDate = toDateMap(logs, currentLog);
  const todayLog = logByDate.get(dateKey) || currentLog;
  const todayScore = computeScoreForDate({
    profile,
    log: todayLog,
    tasks,
    dateKey,
  });

  const previousKeys = getLastNDays(8).slice(0, 7);
  const previousScores = previousKeys
    .map((key) => {
      const log = logByDate.get(key);
      if (!log || !isMeaningfulLog(log)) return null;
      return computeScoreForDate({
        profile,
        log,
        tasks,
        dateKey: key,
      }).score;
    })
    .filter((value): value is number => typeof value === 'number');

  const previousAverage = previousScores.length
    ? previousScores.reduce((sum, value) => sum + value, 0) / previousScores.length
    : todayScore.score;
  const trendDelta = Math.round(todayScore.score - previousAverage);
  const trend: DisciplineScoreSummary['trend'] = trendDelta >= 2 ? 'up' : trendDelta <= -2 ? 'down' : 'flat';

  return {
    score: todayScore.score,
    trend,
    trendDelta,
    breakdown: todayScore.breakdown,
  };
};

const resolvePriority = (task: TaskItem, dateKey: string): PlannerTask['priority'] => {
  if (task.dueDate < dateKey) return 'high';
  if (task.dueDate === dateKey) return 'medium';
  return 'low';
};

const priorityReason = (task: TaskItem, dateKey: string) => {
  if (task.dueDate < dateKey) return 'Overdue task';
  if (task.dueDate === dateKey) return 'Due today';
  return 'Upcoming';
};

export const buildSmartDailyPlanner = ({
  profile,
  logs,
  currentLog,
  tasks,
  notifications,
}: Pick<EngineInput, 'profile' | 'logs' | 'currentLog' | 'tasks' | 'notifications'>): SmartDailyPlanner | null => {
  if (!profile) return null;

  const dateKey = todayKey();
  const recent = getLastNDays(7)
    .map((key) => (key === currentLog.date ? currentLog : logs.find((entry) => entry.date === key)))
    .filter((entry): entry is DailyLog => Boolean(entry));
  const studyTargetMinutes = profile.dailyTargets.studyHours * 60;
  const studyHitDays = recent.filter((entry) => (entry.studyMinutes || 0) >= studyTargetMinutes).length;
  const splitStudy = studyHitDays <= 4;

  const reminderTime = (id: string, fallback: string) => {
    const item = notifications.find((notification) => notification.id === id);
    if (!item || !item.enabled) return fallback;
    return item.time;
  };

  const wakeTime = profile.dailyTargets.wakeUpGoal || '06:00';
  const studyTimeBase = reminderTime('study', '18:00');
  const workoutTime = reminderTime('workout', '19:00');
  const waterReminder = reminderTime('water', '10:00');

  const studyStartMinutes = splitStudy ? toMinutes(studyTimeBase) - 30 : toMinutes(studyTimeBase);
  const firstStudyBlockMinutes = splitStudy ? Math.round(studyTargetMinutes * 0.55) : studyTargetMinutes;
  const secondStudyBlockMinutes = Math.max(0, studyTargetMinutes - firstStudyBlockMinutes);

  const pendingPriorityTasks = tasks
    .filter((task) => !task.completed && task.dueDate <= dateKey)
    .sort((first, second) => {
      if (first.dueDate !== second.dueDate) return first.dueDate.localeCompare(second.dueDate);
      return first.createdAt.localeCompare(second.createdAt);
    })
    .slice(0, 4)
    .map((task) => ({
      id: task.id,
      title: task.title,
      priority: resolvePriority(task, dateKey),
      reason: priorityReason(task, dateKey),
    }));

  const blocks: PlannerBlock[] = [
    {
      time: wakeTime,
      title: 'Wake + quick reset',
      detail: 'Hydrate and lock wake-up log to protect your streak.',
    },
    {
      time: toClock(studyStartMinutes),
      title: splitStudy ? `${Math.round(firstStudyBlockMinutes / 60)}h focus block` : `${Math.round(studyTargetMinutes / 60)}h study block`,
      detail: `Study when your consistency is best (based on your reminder rhythm at ${studyTimeBase}).`,
    },
  ];

  if (secondStudyBlockMinutes > 0) {
    blocks.push({
      time: toClock(studyStartMinutes + firstStudyBlockMinutes + 45),
      title: `${Math.round(secondStudyBlockMinutes / 60)}h reinforcement block`,
      detail: 'Second session to close target without night overload.',
    });
  }

  blocks.push(
    {
      time: workoutTime,
      title: `${profile.dailyTargets.workoutMinutes} min workout`,
      detail: 'Complete full checklist to protect streak and leaderboard XP.',
    },
    {
      time: waterReminder,
      title: 'Hydration checkpoint',
      detail: `Drink ~300ml per checkpoint until you reach ${profile.dailyTargets.waterLiters.toFixed(1)}L.`,
    },
  );

  return {
    summary: splitStudy
      ? 'AI suggests split focus blocks today because your weekly study consistency dipped.'
      : 'AI suggests one continuous focus block since your recent study rhythm is stable.',
    blocks,
    priorityTasks: pendingPriorityTasks,
  };
};

export const buildHabitPredictions = ({
  profile,
  logs,
  currentLog,
  tasks,
  streakHistory,
}: Pick<EngineInput, 'profile' | 'logs' | 'currentLog' | 'tasks' | 'streakHistory'>): HabitPrediction[] => {
  if (!profile) return [];

  const dateKey = todayKey();
  const recent = getLastNDays(7)
    .map((key) => (key === currentLog.date ? currentLog : logs.find((entry) => entry.date === key)))
    .filter((entry): entry is DailyLog => Boolean(entry));

  const studyRatioToday = clamp01((currentLog.studyMinutes || 0) / Math.max(1, profile.dailyTargets.studyHours * 60));
  const waterRatioToday = clamp01((currentLog.waterIntakeMl || 0) / Math.max(1, profile.dailyTargets.waterLiters * 1000));
  const workoutRatioToday = getWorkoutRatio(currentLog, profile.dailyTargets.workoutPlan.dailyChecklist.length);
  const wakeRatioToday = currentLog.wakeUpTime ? 1 : 0;
  const todayCoreProgress = (studyRatioToday + waterRatioToday + workoutRatioToday + wakeRatioToday) / 4;

  const recentConsistency = recent.length
    ? recent.reduce((sum, entry) => {
        const studyRatio = clamp01((entry.studyMinutes || 0) / Math.max(1, profile.dailyTargets.studyHours * 60));
        const waterRatio = clamp01((entry.waterIntakeMl || 0) / Math.max(1, profile.dailyTargets.waterLiters * 1000));
        const workoutRatio = getWorkoutRatio(entry, profile.dailyTargets.workoutPlan.dailyChecklist.length);
        const wakeRatio = entry.wakeUpTime ? 1 : 0;
        return sum + (studyRatio + waterRatio + workoutRatio + wakeRatio) / 4;
      }, 0) / recent.length
    : 0.5;

  const pendingDueTasks = tasks.filter((task) => !task.completed && task.dueDate <= dateKey).length;
  const overdueTasks = tasks.filter((task) => !task.completed && task.dueDate < dateKey).length;
  const dueTasks = tasks.filter((task) => task.dueDate <= dateKey).length;
  const completedDueTasks = tasks.filter((task) => task.dueDate <= dateKey && task.completed).length;
  const taskCompletionRatio = dueTasks > 0 ? completedDueTasks / dueTasks : 1;

  const taskRisk = Math.round(
    Math.min(
      95,
      Math.max(
        5,
        pendingDueTasks * 12 +
          overdueTasks * 18 +
          (1 - taskCompletionRatio) * 40 +
          (todayCoreProgress < 0.45 ? 12 : 0),
      ),
    ),
  );

  const currentStreak = streakHistory[streakHistory.length - 1]?.streak || 0;
  const streakRisk = Math.round(
    Math.min(
      95,
      Math.max(
        5,
        (1 - todayCoreProgress) * 50 +
          (1 - recentConsistency) * 35 +
          (currentStreak >= 5 ? 10 : 0) +
          (!currentLog.wakeUpTime ? 8 : 0),
      ),
    ),
  );

  return [
    {
      id: 'task-miss-prediction',
      title: taskRisk >= 55 ? 'You are likely to miss tasks today' : 'Task completion outlook is stable',
      riskPercent: taskRisk,
      direction: taskRisk >= 55 ? 'warning' : 'stable',
      message:
        taskRisk >= 55
          ? `${pendingDueTasks} pending tasks and ${overdueTasks} overdue tasks increase miss risk.`
          : 'Current completion pattern supports finishing your daily task list.',
      action:
        taskRisk >= 55
          ? 'Do one high-priority task in the next 30 minutes to reduce risk fast.'
          : 'Keep your current pace and close remaining tasks before evening.',
    },
    {
      id: 'streak-break-prediction',
      title: streakRisk >= 58 ? 'Your streak may break today' : 'Your streak is likely to hold',
      riskPercent: streakRisk,
      direction: streakRisk >= 58 ? 'warning' : 'stable',
      message:
        streakRisk >= 58
          ? `Core progress is at ${Math.round(todayCoreProgress * 100)}%, below your usual consistency baseline.`
          : `Core progress is at ${Math.round(todayCoreProgress * 100)}%, aligned with recent consistency.`,
      action:
        streakRisk >= 58
          ? 'Secure wake-up, hydration, and one study block now to stabilize streak probability.'
          : 'Lock workout and calorie targets to strengthen streak confidence by tonight.',
    },
  ];
};
