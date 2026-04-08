import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { todayKey } from '../lib/date';
import { normalizeGender } from '../lib/gender';
import { generatePlan } from '../lib/plan';
import {
  clearGlobalState,
  clearUserState,
  loadGlobalState,
  loadUserState,
  saveGlobalState,
  saveUserState,
} from '../lib/storage';
import { EASTER_EGGS_TOTAL, normalizeEasterEggIds, type EasterEggId } from '../lib/easterEggs';
import { achievementMeta, normalizeAchievementIds, type AchievementId } from '../lib/achievements';
import { computeUserScore } from '../lib/score';
import { randomId } from '../lib/utils';
import { defaultNotifications, processScheduledNotifications } from '../services/notifications';
import { fetchBmiHistory as apiFetchBmiHistory, recordBmi as apiRecordBmi } from '../services/bmi';
import {
  createTask as apiCreateTask,
  deleteTask as apiDeleteTask,
  fetchTasks as apiFetchTasks,
  updateTask as apiUpdateTask,
} from '../services/tasks';
import {
  fetchUserStateFromServer,
  syncDailyLogToServer,
  syncProfileToServer,
} from '../services/serverSync';
import { generateWorkoutPlanWithGroq } from '../services/workoutPlan';
import {
  clearCloudData,
  subscribeToLeaderboard,
  syncDailyLog,
  syncLeaderboardPresence,
  syncProfile,
} from '../services/persistence';
import {
  AppState,
  BMIEntry,
  CustomWorkoutEntry,
  DailyLog,
  FoodEntry,
  LeaderboardEntry,
  NotificationItem,
  TaskItem,
  UserProfile,
  UserSession,
} from '../types';

interface CompanionWorkoutExercise {
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
}

interface CompanionWorkoutRemovalRequest {
  name: string;
  durationMinutes?: number;
}

interface AppContextValue extends AppState {
  isReady: boolean;
  currentLog: DailyLog;
  easterEggsTotal: number;
  markEasterEggFound(id: EasterEggId): void;
  lastEasterEggFound: { id: EasterEggId; title: string; foundAt: string } | null;
  clearLastEasterEggFound(): void;
  lastAchievementUnlocked: { id: AchievementId; title: string; subtitle: string; unlockedAt: string } | null;
  clearLastAchievementUnlocked(): void;
  login(session: UserSession): Promise<void>;
  logout(): void;
  completeOnboarding(payload: Omit<UserProfile, 'userId' | 'dailyTargets'>): Promise<void>;
  updateProfile(profile: Partial<UserProfile>): Promise<void>;
  markWakeUp(timeValue?: string): Promise<void>;
  addStudyMinutes(minutes: number): Promise<void>;
  addWater(amount: number): Promise<void>;
  removeWater(amount: number): Promise<void>;
  addCaloriesBurned(value: number): Promise<void>;
  addFoodEntry(entry: FoodEntry): Promise<void>;
  removeFoodEntry(entryId: string): Promise<void>;
  toggleWorkoutTask(taskId: string): Promise<void>;
  addCustomWorkoutEntry(
    name: string,
    durationMinutes: number,
    caloriesBurned: number,
    source?: 'manual' | 'companion',
  ): Promise<void>;
  addWorkoutExercises(exercises: CompanionWorkoutExercise[]): Promise<number>;
  removeWorkoutExercises(removals: CompanionWorkoutRemovalRequest[]): Promise<number>;
  removeCustomWorkoutEntry(entryId: string): Promise<void>;
  addLeaderboardEntry(name: string, points: number): void;
  toggleDarkMode(): void;
  toggleNotification(id: string): void;
  updateNotificationTime(id: string, time: string): void;
  refreshTasks(): Promise<void>;
  createTask(title: string, dueAt?: string | null): Promise<void>;
  toggleTask(taskId: string): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  refreshBmi(): Promise<void>;
  recordBmi(heightCm: number, weightKg: number): Promise<void>;
  resetAllData(): Promise<void>;
}

const defaultLog = (): DailyLog => ({
  date: todayKey(),
  studyMinutes: 0,
  waterIntakeMl: 0,
  caloriesBurned: 0,
  manualCaloriesBurned: 0,
  workoutPlanCaloriesBurned: 0,
  caloriesConsumed: 0,
  foodEntries: [],
  completedWorkoutTasks: [],
  customWorkoutEntries: [],
});

const initialState: AppState = {
  session: null,
  profile: null,
  logs: [defaultLog()],
  tasks: [],
  bmiHistory: [],
  streakHistory: [],
  notifications: defaultNotifications,
  leaderboard: [],
  darkMode: true,
  easterEggsFound: [],
  achievementsUnlocked: [],
};

const AppContext = createContext<AppContextValue | undefined>(undefined);
const FIRST_LAUNCH_KEY_PREFIX = 'oath-first-launch-done-';
const LEGACY_FIRST_LAUNCH_KEY = 'oath-first-launch-done';

const lastItem = <T,>(items: T[]) => items[items.length - 1];
const isFriendLeaderboardEntry = (entry: LeaderboardEntry) => entry.id.startsWith('friend-') && !entry.userId;

const normalizeCustomWorkoutEntries = (
  entries: DailyLog['customWorkoutEntries'],
): CustomWorkoutEntry[] =>
  Array.isArray(entries)
    ? entries
        .map((entry) => ({
          id: typeof entry?.id === 'string' ? entry.id : randomId(),
          name: typeof entry?.name === 'string' ? entry.name : 'Custom workout',
          durationMinutes: Math.max(1, Math.round(Number(entry?.durationMinutes) || 0)),
          caloriesBurned: Math.max(0, Math.round(Number(entry?.caloriesBurned) || 0)),
          createdAt:
            typeof entry?.createdAt === 'string' && entry.createdAt
              ? entry.createdAt
              : new Date().toISOString(),
          source: entry?.source === 'companion' ? ('companion' as const) : ('manual' as const),
        }))
        .filter((entry) => entry.name.trim() && entry.caloriesBurned > 0)
    : [];

const calculateCaloriesBurned = ({
  manualCaloriesBurned = 0,
  workoutPlanCaloriesBurned = 0,
  customWorkoutEntries = [],
}: Pick<DailyLog, 'manualCaloriesBurned' | 'workoutPlanCaloriesBurned' | 'customWorkoutEntries'>) =>
  Math.max(
    0,
    Math.round(manualCaloriesBurned) +
      Math.round(workoutPlanCaloriesBurned) +
      normalizeCustomWorkoutEntries(customWorkoutEntries).reduce((total, entry) => total + entry.caloriesBurned, 0),
  );

const withCaloriesBreakdown = (log: DailyLog): DailyLog => {
  const customWorkoutEntries = normalizeCustomWorkoutEntries(log.customWorkoutEntries);
  const manualCaloriesBurned = Math.max(
    0,
    Math.round(
      log.manualCaloriesBurned ??
        (!log.workoutPlanCaloriesBurned && !customWorkoutEntries.length ? log.caloriesBurned : 0) ??
        0,
    ),
  );
  const workoutPlanCaloriesBurned = Math.max(0, Math.round(log.workoutPlanCaloriesBurned ?? 0));

  return {
    ...log,
    manualCaloriesBurned,
    workoutPlanCaloriesBurned,
    customWorkoutEntries,
    caloriesBurned: calculateCaloriesBurned({
      manualCaloriesBurned,
      workoutPlanCaloriesBurned,
      customWorkoutEntries,
    }),
  };
};

const getWorkoutPlanCaloriesForLog = (profile: UserProfile | null, completedWorkoutTasks: string[]) => {
  const checklist = profile?.dailyTargets?.workoutPlan?.dailyChecklist ?? [];
  const estimatedCaloriesBurned = profile?.dailyTargets?.workoutPlan?.estimatedCaloriesBurned ?? 0;
  if (!checklist.length || !estimatedCaloriesBurned) return 0;

  const completedSet = new Set(completedWorkoutTasks);
  const hasCompletedFullPlan = checklist.every((task) => completedSet.has(task.id));

  return hasCompletedFullPlan ? estimatedCaloriesBurned : 0;
};

const parseMinutesFromWorkoutTaskLabel = (label: string) => {
  const match = String(label).trim().match(/^(\d+)\s*(?:min|mins|minute|minutes)\b/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : null;
};

const normalizeExerciseName = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseWorkoutTaskParts = (task: { id: string; label: string }) => {
  const match = String(task.label).trim().match(/^(\d+)\s*(?:min|mins|minute|minutes)\b\s*(.+)$/i);
  const durationMinutes = match ? Math.max(1, Math.round(Number(match[1]) || 0)) : null;
  const name = normalizeExerciseName(match?.[2] ?? task.label);

  return {
    id: task.id,
    durationMinutes,
    name,
    isCompanionTask: String(task.id || '').startsWith('companion-'),
  };
};

const summaryWithWorkoutMinutes = (summary: string, workoutMinutes: number) => {
  const safeMinutes = Math.max(1, Math.round(workoutMinutes));
  const normalized = String(summary || '').trim();
  if (!normalized) {
    return `Use ${safeMinutes} minutes today to complete your workout plan.`;
  }

  if (/^use\s+\d+\s+minutes\b/i.test(normalized)) {
    return normalized.replace(/^use\s+\d+\s+minutes\b/i, `Use ${safeMinutes} minutes`);
  }

  if (/^aim\s+for\s+\d+\s+minutes\b/i.test(normalized)) {
    return normalized.replace(/^aim\s+for\s+\d+\s+minutes\b/i, `Aim for ${safeMinutes} minutes`);
  }

  return `Use ${safeMinutes} minutes today. ${normalized}`;
};

const normalizeWorkoutExerciseAction = (entry: Partial<CompanionWorkoutExercise>): CompanionWorkoutExercise | null => {
  const name = String(entry?.name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (!name) return null;

  const durationMinutes = Math.max(1, Math.round(Number(entry?.durationMinutes) || 0));
  const caloriesBurned = Math.max(1, Math.round(Number(entry?.caloriesBurned) || 0));

  return {
    name,
    durationMinutes,
    caloriesBurned,
  };
};

const toTaskIdSlug = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'exercise';

const buildCompanionWorkoutTaskId = (name: string, usedIds: Set<string>) => {
  const base = `companion-${toTaskIdSlug(name)}`;
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }

  let index = 2;
  let candidate = `${base}-${index}`;

  while (usedIds.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}`;
  }

  usedIds.add(candidate);
  return candidate;
};

const hasChecklistMinutesMatchingTarget = (
  checklist: Array<{ label: string }>,
  targetMinutes: number,
) => {
  if (!checklist.length) return false;
  const parsed = checklist.map((task) => parseMinutesFromWorkoutTaskLabel(task.label));
  const parsedMinutes = parsed.filter((value): value is number => value !== null);
  if (parsedMinutes.length !== checklist.length) return false;
  const total = parsedMinutes.reduce((sum, value) => sum + value, 0);
  return total === targetMinutes;
};

const sanitizeStudyHours = (value: unknown, fallback = 3) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10, Math.max(1, parsed));
};

const sanitizeWorkoutMinutes = (value: unknown, fallback = 45) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(180, Math.max(15, Math.round(parsed)));
};

const deriveDailyAvailableHours = (studyHours: number, workoutMinutes: number) =>
  Math.min(12, Math.max(1, studyHours + workoutMinutes / 60));

const normalizeProfile = (profile: UserProfile | null): UserProfile | null => {
  if (!profile) return null;
  const normalizedGender = normalizeGender(profile.gender);
  const generatedTargets = generatePlan({
    gender: normalizedGender,
    age: profile.age,
    height: profile.height,
    weight: profile.weight,
    goal: profile.goal,
    dailyAvailableHours: profile.dailyAvailableHours,
    dailyStudyHours: profile.dailyStudyHours,
    dailyWorkoutMinutes: profile.dailyWorkoutMinutes,
  });

  const persistedWorkoutPlan = profile.dailyTargets?.workoutPlan;
  const hasPersistedChecklist =
    Array.isArray(persistedWorkoutPlan?.dailyChecklist) &&
    hasChecklistMinutesMatchingTarget(
      persistedWorkoutPlan.dailyChecklist,
      generatedTargets.workoutMinutes,
    );

  return {
    ...profile,
    gender: normalizedGender,
    dailyTargets: hasPersistedChecklist
      ? {
          ...generatedTargets,
          workoutPlan: {
            ...generatedTargets.workoutPlan,
            ...persistedWorkoutPlan,
            dailyChecklist: persistedWorkoutPlan!.dailyChecklist,
          },
        }
      : generatedTargets,
  };
};

const normalizeState = (state: AppState): AppState => ({
  ...initialState,
  ...state,
  profile: normalizeProfile(state.profile),
  logs: state.logs?.length
    ? state.logs.map((log) => ({
        ...withCaloriesBreakdown({
          ...defaultLog(),
          ...log,
          completedWorkoutTasks: log.completedWorkoutTasks ?? [],
        }),
      }))
    : [defaultLog()],
  tasks: Array.isArray(state.tasks) ? state.tasks : [],
  bmiHistory: Array.isArray(state.bmiHistory) ? state.bmiHistory : [],
  notifications: defaultNotifications.map((defaultItem) => {
    const match = state.notifications?.find((item) => item.id === defaultItem.id);
    return {
      ...defaultItem,
      enabled: typeof match?.enabled === 'boolean' ? match.enabled : defaultItem.enabled,
      time: typeof match?.time === 'string' && /^\d{2}:\d{2}$/.test(match.time) ? match.time : defaultItem.time,
    };
  }),
  leaderboard: state.leaderboard ?? [],
  streakHistory: state.streakHistory ?? [],
  darkMode: state.darkMode ?? true,
  easterEggsFound: normalizeEasterEggIds(state.easterEggsFound),
  achievementsUnlocked: normalizeAchievementIds(state.achievementsUnlocked),
});

const isGoalMet = (profile: UserProfile | null, log: DailyLog) => {
  if (!profile) return false;

  return (
    Boolean(log.wakeUpTime) &&
    log.studyMinutes >= profile.dailyTargets.studyHours * 60 &&
    log.waterIntakeMl >= profile.dailyTargets.waterLiters * 1000 &&
    log.caloriesConsumed <= profile.dailyTargets.calories
  );
};

const hasMeaningfulLogData = (log: DailyLog) =>
  Boolean(
    log.wakeUpTime ||
      log.studyMinutes ||
      log.waterIntakeMl ||
      log.caloriesBurned ||
      log.caloriesConsumed ||
      log.completedWorkoutTasks?.length ||
      log.foodEntries?.length ||
      log.customWorkoutEntries?.length,
  );

const buildStreakHistoryFromLogs = (profile: UserProfile | null, logs: DailyLog[]) => {
  if (!profile) return [];

  let currentStreak = 0;

  return [...logs]
    .sort((first, second) => first.date.localeCompare(second.date))
    .reduce<{ date: string; streak: number }[]>((history, log) => {
      if (!isGoalMet(profile, log)) {
        currentStreak = 0;
        return history;
      }

      currentStreak += 1;
      history.push({ date: log.date, streak: currentStreak });
      return history;
    }, []);
};

const shouldUseRemoteLogs = (logs: DailyLog[]) => !logs.some(hasMeaningfulLogData);

export const AppProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<AppState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [currentDayKey, setCurrentDayKey] = useState(todayKey());
  const [lastEasterEggFound, setLastEasterEggFound] = useState<AppContextValue['lastEasterEggFound']>(null);
  const [lastAchievementUnlocked, setLastAchievementUnlocked] = useState<AppContextValue['lastAchievementUnlocked']>(null);

  const hydrateSessionState = async (baseState: AppState) => {
    const userId = baseState.session?.userId;
    const identifier = baseState.session?.identifier;

    if (!userId && !identifier) {
      return normalizeState(baseState);
    }

    try {
      const remoteState = await fetchUserStateFromServer(userId || '', identifier);
      const resolvedUserId = remoteState.userId || userId || '';
      const aliasLocalState =
        resolvedUserId && resolvedUserId !== userId ? loadUserState(resolvedUserId) : null;
      const localProfile = baseState.profile ?? aliasLocalState?.profile ?? null;
      const localLogs =
        shouldUseRemoteLogs(baseState.logs) && aliasLocalState?.logs?.length ? aliasLocalState.logs : baseState.logs;
      const localTasks = baseState.tasks.length ? baseState.tasks : aliasLocalState?.tasks ?? [];
      const localBmiHistory =
        baseState.bmiHistory.length ? baseState.bmiHistory : aliasLocalState?.bmiHistory ?? [];

      const nextProfile = remoteState.profile ?? localProfile ?? null;
      const nextLogs = remoteState.logs.length ? remoteState.logs : localLogs;
      const nextTasks = remoteState.tasks.length ? remoteState.tasks : localTasks;
      const nextBmiHistory = remoteState.bmiHistory.length ? remoteState.bmiHistory : localBmiHistory;
      const nextNotifications = remoteState.notifications.length
        ? remoteState.notifications
        : baseState.notifications?.length
          ? baseState.notifications
          : aliasLocalState?.notifications ?? defaultNotifications;
      const nextStreakHistory =
        baseState.streakHistory.length || !nextProfile
          ? baseState.streakHistory
          : buildStreakHistoryFromLogs(nextProfile, nextLogs);

      return normalizeState({
        ...baseState,
        session: baseState.session
          ? {
              ...baseState.session,
              userId: resolvedUserId || baseState.session.userId,
            }
          : null,
        profile: nextProfile,
        logs: nextLogs,
        tasks: nextTasks,
        bmiHistory: nextBmiHistory,
        notifications: nextNotifications,
        streakHistory: nextStreakHistory,
      });
    } catch {
      return normalizeState(baseState);
    }
  };

  useEffect(() => {
    const boot = async () => {
      const globalState = loadGlobalState();
      const userState = globalState?.session?.userId ? loadUserState(globalState.session.userId) : null;
      const localState = normalizeState({
        ...initialState,
        ...globalState,
        ...userState,
      });
      const hydrated = await hydrateSessionState(localState);
      setState(hydrated);
      setIsReady(true);
    };

    void boot();
  }, []);

  useEffect(() => {
    setCurrentDayKey(todayKey());

    const interval = window.setInterval(() => {
      setCurrentDayKey(todayKey());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isReady) {
      saveGlobalState({
        session: state.session,
        darkMode: state.darkMode,
      });

      if (state.session?.userId) {
        saveUserState(state.session.userId, {
          profile: state.profile,
          logs: state.logs,
          tasks: state.tasks,
          bmiHistory: state.bmiHistory,
          streakHistory: state.streakHistory,
          notifications: state.notifications,
          leaderboard: state.leaderboard,
          easterEggsFound: state.easterEggsFound,
          achievementsUnlocked: state.achievementsUnlocked,
        });
      }

      document.documentElement.classList.toggle('dark', state.darkMode);
    }
  }, [isReady, state]);

  const currentLog = useMemo(() => {
    return state.logs.find((log) => log.date === currentDayKey) ?? { ...defaultLog(), date: currentDayKey };
  }, [currentDayKey, state.logs]);

  const markEasterEggFound = (id: EasterEggId) => {
    setState((prev) => {
      const current = normalizeEasterEggIds(prev.easterEggsFound);
      if (current.includes(id)) return prev;

      const titleMap = new Map(
        [
          ['logo-taps', 'Logo Tapper'],
          ['nav-avatar-taps', 'Secret Avatar'],
          ['konami-companion', 'Konami Coach'],
          ['arena-title', 'Arena Whisper'],
          ['theme-spinner', 'Theme Spinner'],
          ['version-tap', 'Version Vault'],
        ] as Array<[EasterEggId, string]>,
      );

      setLastEasterEggFound({
        id,
        title: titleMap.get(id) ?? 'Easter Egg',
        foundAt: new Date().toISOString(),
      });

      return { ...prev, easterEggsFound: [...current, id] };
    });
  };

  const clearLastEasterEggFound = () => setLastEasterEggFound(null);
  const clearLastAchievementUnlocked = () => setLastAchievementUnlocked(null);

  const unlockAchievement = (id: AchievementId) => {
    setState((prev) => {
      const current = normalizeAchievementIds(prev.achievementsUnlocked);
      if (current.includes(id)) return prev;

      const meta = achievementMeta(id);
      if (meta) {
        setLastAchievementUnlocked({
          id,
          title: meta.title,
          subtitle: meta.subtitle,
          unlockedAt: new Date().toISOString(),
        });
      }

      return { ...prev, achievementsUnlocked: [...current, id] };
    });
  };

  const currentScore = useMemo(
    () => computeUserScore(currentLog, state.streakHistory),
    [currentLog, state.streakHistory],
  );

  useEffect(() => {
    if (!state.profile) return;
    if (!isGoalMet(state.profile, currentLog)) return;
    unlockAchievement('daily-goal');
  }, [currentLog, state.profile]);

  useEffect(() => {
    const streak = lastItem(state.streakHistory)?.streak ?? 0;
    if (streak >= 7) unlockAchievement('streak-7');
    if (streak >= 30) unlockAchievement('streak-30');
  }, [state.streakHistory]);

  useEffect(() => {
    if (!state.session || !state.profile) return;

    const unsubscribe = subscribeToLeaderboard((entries) => {
      setState((prev) => ({
        ...prev,
        leaderboard: [...entries, ...prev.leaderboard.filter(isFriendLeaderboardEntry)].sort(
          (first, second) => second.points - first.points,
        ),
      }));
    });

    return () => {
      unsubscribe?.();
    };
  }, [state.session, state.profile]);

  useEffect(() => {
    if (!state.session || !state.profile) return;

    const publish = () =>
      syncLeaderboardPresence({
        userId: state.session!.userId,
        name: state.profile!.name,
        identifier: state.session!.identifier,
        points: currentScore,
      });

    void publish();
    const interval = window.setInterval(() => {
      void publish();
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [currentScore, state.profile, state.session]);

  useEffect(() => {
    if (!isReady || !state.session) return;

    let cancelled = false;
    const userId = state.session.userId;

    const hydrateServer = async () => {
      try {
        const tasks = await apiFetchTasks(userId, state.session?.identifier);
        if (!cancelled) {
          setState((prev) => ({ ...prev, tasks }));
        }
      } catch {
        // Server data is optional; fall back to local cache.
      }

      try {
        const bmiHistory = await apiFetchBmiHistory(userId, state.session?.identifier);
        if (!cancelled) {
          setState((prev) => ({ ...prev, bmiHistory }));
        }
      } catch {
        // Server data is optional; fall back to local cache.
      }
    };

    void hydrateServer();

    return () => {
      cancelled = true;
    };
  }, [isReady, state.session]);

  useEffect(() => {
    if (!isReady || !state.session || !state.profile) return;
    void syncProfileToServer(state.session, state.profile, state.notifications);
  }, [isReady, state.notifications, state.profile, state.session]);

  useEffect(() => {
    if (!isReady || !state.session) return;
    void syncDailyLogToServer(state.session, state.profile, currentLog);
  }, [currentLog, isReady, state.profile, state.session]);

  useEffect(() => {
    if (!isReady || !state.session || !state.profile) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await processScheduledNotifications({
        userId: state.session!.userId,
        profile: state.profile,
        log: currentLog,
        tasks: state.tasks,
        notifications: state.notifications,
      });
    };

    void run();
    const interval = window.setInterval(() => {
      void run();
    }, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void run();
      }
    };
    const handleFocus = () => {
      void run();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentLog, isReady, state.notifications, state.profile, state.session, state.tasks]);

  const upsertLog = async (updater: (log: DailyLog) => DailyLog) => {
    let nextLog: DailyLog | null = null;
    let sessionUserId: string | null = state.session?.userId ?? null;

    setState((prev) => {
      sessionUserId = prev.session?.userId ?? sessionUserId;
      const today = currentDayKey;
      const logs = prev.logs.some((log) => log.date === today)
        ? prev.logs.map((log) => {
            if (log.date !== today) return log;
            nextLog = updater(log);
            return nextLog;
          })
        : [...prev.logs, updater(defaultLog())];

      if (!nextLog) {
        nextLog = logs[logs.length - 1];
      }

      const safeNextLog = nextLog;
      const previousStreak = lastItem(prev.streakHistory);
      const streakValue =
        prev.profile && safeNextLog && isGoalMet(prev.profile, safeNextLog)
          ? (previousStreak?.date === today ? previousStreak.streak : (previousStreak?.streak ?? 0) + 1)
          : previousStreak?.streak ?? 0;

      const streakHistory =
        prev.profile && safeNextLog && isGoalMet(prev.profile, safeNextLog)
          ? [...prev.streakHistory.filter((entry) => entry.date !== today), { date: today, streak: streakValue }]
          : prev.streakHistory;

      return { ...prev, logs, streakHistory };
    });

    if (sessionUserId && nextLog) {
      try {
        await syncDailyLog(sessionUserId, nextLog);
      } catch {
        // Local state is already updated; background persistence can fail silently.
      }
    }

    if (state.session && nextLog) {
      void syncDailyLogToServer(state.session, state.profile, nextLog);
    }
  };

  const value: AppContextValue = {
    ...state,
    isReady,
    currentLog,
    easterEggsTotal: EASTER_EGGS_TOTAL,
    markEasterEggFound,
    lastEasterEggFound,
    clearLastEasterEggFound,
    lastAchievementUnlocked,
    clearLastAchievementUnlocked,
    async login(session) {
      const savedUserState = loadUserState(session.userId);
      setIsReady(false);

      const nextState = await hydrateSessionState(
        normalizeState({
          ...initialState,
          ...savedUserState,
          session,
          darkMode: state.darkMode,
        }),
      );

      setState(nextState);
      setIsReady(true);
    },
    logout() {
      try {
        if (state.session?.userId) {
          window.localStorage.removeItem(`${FIRST_LAUNCH_KEY_PREFIX}${state.session.userId}`);
        }
        window.localStorage.removeItem(LEGACY_FIRST_LAUNCH_KEY);
      } catch {
        // Ignore storage errors and continue logout.
      }

      clearGlobalState();
      setState((prev) => ({
        ...initialState,
        notifications: prev.notifications,
        leaderboard: prev.leaderboard,
      }));
    },
    async completeOnboarding(payload) {
      if (!state.session) return;

      const dailyStudyHours = sanitizeStudyHours(payload.dailyStudyHours, 3);
      const dailyWorkoutMinutes = sanitizeWorkoutMinutes(payload.dailyWorkoutMinutes, 45);
      const dailyAvailableHours = deriveDailyAvailableHours(dailyStudyHours, dailyWorkoutMinutes);
      const baseTargets = generatePlan({
        ...payload,
        dailyStudyHours,
        dailyWorkoutMinutes,
        dailyAvailableHours,
      });
      const aiWorkoutPlan = await generateWorkoutPlanWithGroq({
        profile: {
          ...payload,
          dailyStudyHours,
          dailyWorkoutMinutes,
          dailyAvailableHours,
        },
        dailyTargets: baseTargets,
      });

      const profile: UserProfile = {
        ...payload,
        userId: state.session.userId,
        dailyAvailableHours,
        dailyStudyHours,
        dailyWorkoutMinutes,
        dailyTargets: {
          ...baseTargets,
          workoutPlan: aiWorkoutPlan ?? baseTargets.workoutPlan,
        },
      };

      setState((prev) => ({
        ...prev,
        profile,
        logs: prev.logs.map((log) =>
          log.date === currentDayKey
            ? withCaloriesBreakdown({
                ...log,
                workoutPlanCaloriesBurned: getWorkoutPlanCaloriesForLog(profile, log.completedWorkoutTasks),
              })
            : log,
        ),
      }));
      await syncProfile(profile);
      void syncProfileToServer(state.session, profile);
    },
    async updateProfile(profileUpdate) {
      const profile = state.profile ? { ...state.profile, ...profileUpdate } : null;
      if (!profile) return;
      const dailyStudyHours = sanitizeStudyHours(profile.dailyStudyHours, 3);
      const dailyWorkoutMinutes = sanitizeWorkoutMinutes(profile.dailyWorkoutMinutes, 45);
      const dailyAvailableHours = deriveDailyAvailableHours(dailyStudyHours, dailyWorkoutMinutes);

      const recalculatedTargets = generatePlan({
        ...profile,
        dailyStudyHours,
        dailyWorkoutMinutes,
        dailyAvailableHours,
      });
      const aiWorkoutPlan = await generateWorkoutPlanWithGroq({
        profile: {
          ...profile,
          dailyStudyHours,
          dailyWorkoutMinutes,
          dailyAvailableHours,
        },
        dailyTargets: recalculatedTargets,
      });
      const nextProfile = {
        ...profile,
        dailyAvailableHours,
        dailyStudyHours,
        dailyWorkoutMinutes,
        dailyTargets: {
          ...recalculatedTargets,
          workoutPlan: aiWorkoutPlan ?? recalculatedTargets.workoutPlan,
        },
      };

      setState((prev) => ({
        ...prev,
        profile: nextProfile,
        logs: prev.logs.map((log) =>
          log.date === currentDayKey
            ? withCaloriesBreakdown({
                ...log,
                workoutPlanCaloriesBurned: getWorkoutPlanCaloriesForLog(nextProfile, log.completedWorkoutTasks),
              })
            : log,
        ),
      }));
      await syncProfile(nextProfile);
      if (state.session) {
        void syncProfileToServer(state.session, nextProfile);
      }
    },
    async markWakeUp(timeValue) {
      const wakeUpTimestamp = (() => {
        if (!timeValue) {
          return new Date().toISOString();
        }

        const [hours, minutes] = timeValue.split(':').map(Number);
        const date = new Date();
        date.setHours(hours || 0, minutes || 0, 0, 0);
        return date.toISOString();
      })();

      await upsertLog((log) => ({ ...log, wakeUpTime: wakeUpTimestamp }));
    },
    async addStudyMinutes(minutes) {
      await upsertLog((log) => ({ ...log, studyMinutes: Math.max(0, log.studyMinutes + minutes) }));
    },
    async addWater(amount) {
      await upsertLog((log) => ({ ...log, waterIntakeMl: Math.max(0, log.waterIntakeMl + Math.max(0, amount)) }));
    },
    async removeWater(amount) {
      await upsertLog((log) => ({
        ...log,
        waterIntakeMl: Math.max(0, log.waterIntakeMl - Math.max(0, amount)),
      }));
    },
    async addCaloriesBurned(value) {
      await upsertLog((log) =>
        withCaloriesBreakdown({
          ...log,
          manualCaloriesBurned: Math.max(0, (log.manualCaloriesBurned ?? 0) + Math.max(0, value)),
        }),
      );
    },
    async addFoodEntry(entry) {
      await upsertLog((log) => ({
        ...log,
        caloriesConsumed: log.caloriesConsumed + entry.calories,
        foodEntries: [entry, ...log.foodEntries],
      }));
    },
    async removeFoodEntry(entryId) {
      await upsertLog((log) => {
        const entry = log.foodEntries.find((item) => item.id === entryId);
        if (!entry) return log;

        return {
          ...log,
          caloriesConsumed: Math.max(0, log.caloriesConsumed - entry.calories),
          foodEntries: log.foodEntries.filter((item) => item.id !== entryId),
        };
      });
    },
    async toggleWorkoutTask(taskId) {
      await upsertLog((log) => {
        const completedWorkoutTasks = log.completedWorkoutTasks.includes(taskId)
          ? log.completedWorkoutTasks.filter((item) => item !== taskId)
          : [...log.completedWorkoutTasks, taskId];

        return withCaloriesBreakdown({
          ...log,
          completedWorkoutTasks,
          workoutPlanCaloriesBurned: getWorkoutPlanCaloriesForLog(state.profile, completedWorkoutTasks),
        });
      });
    },
    async addCustomWorkoutEntry(name, durationMinutes, caloriesBurned, source = 'manual') {
      await upsertLog((log) =>
        withCaloriesBreakdown({
          ...log,
          customWorkoutEntries: [
            {
              id: `workout-${randomId()}`,
              name: name.trim(),
              durationMinutes: Math.max(1, Math.round(durationMinutes)),
              caloriesBurned: Math.max(1, Math.round(caloriesBurned)),
              createdAt: new Date().toISOString(),
              source: source === 'companion' ? 'companion' : 'manual',
            },
            ...(log.customWorkoutEntries ?? []),
          ],
        }),
      );
    },
    async addWorkoutExercises(exercises) {
      const normalizedExercises = (Array.isArray(exercises) ? exercises : [])
        .map((entry) => normalizeWorkoutExerciseAction(entry))
        .filter((entry): entry is CompanionWorkoutExercise => Boolean(entry));
      if (!normalizedExercises.length) return 0;

      let nextProfile: UserProfile | null = null;
      let addedCount = 0;

      setState((prev) => {
        if (!prev.profile?.dailyTargets?.workoutPlan) {
          return prev;
        }

        const workoutPlan = prev.profile.dailyTargets.workoutPlan;
        const existingLabels = new Set(
          workoutPlan.dailyChecklist.map((task) => task.label.trim().toLowerCase()),
        );
        const usedIds = new Set(workoutPlan.dailyChecklist.map((task) => task.id));

        const additions = normalizedExercises
          .map((entry) => ({
            ...entry,
            label: `${entry.durationMinutes} minutes ${entry.name}`,
          }))
          .filter((entry) => !existingLabels.has(entry.label.toLowerCase()));

        if (!additions.length) {
          return prev;
        }

        addedCount = additions.length;
        const totalAddedMinutes = additions.reduce((sum, entry) => sum + entry.durationMinutes, 0);
        const totalAddedCalories = additions.reduce((sum, entry) => sum + entry.caloriesBurned, 0);

        const appendedChecklist = [
          ...workoutPlan.dailyChecklist,
          ...additions.map((entry) => ({
            id: buildCompanionWorkoutTaskId(entry.name, usedIds),
            label: entry.label,
          })),
        ];

        const currentWorkoutMinutes = Math.max(
          15,
          Math.round(prev.profile.dailyWorkoutMinutes ?? prev.profile.dailyTargets.workoutMinutes ?? 0),
        );
        const nextWorkoutMinutes = Math.min(360, currentWorkoutMinutes + totalAddedMinutes);
        const studyHours = sanitizeStudyHours(
          prev.profile.dailyStudyHours ?? prev.profile.dailyTargets.studyHours,
          3,
        );

        nextProfile = {
          ...prev.profile,
          dailyWorkoutMinutes: nextWorkoutMinutes,
          dailyAvailableHours: deriveDailyAvailableHours(studyHours, nextWorkoutMinutes),
          dailyTargets: {
            ...prev.profile.dailyTargets,
            workoutMinutes: nextWorkoutMinutes,
            workoutPlan: {
              ...workoutPlan,
              summary: summaryWithWorkoutMinutes(workoutPlan.summary, nextWorkoutMinutes),
              dailyChecklist: appendedChecklist,
              estimatedCaloriesBurned: Math.max(
                0,
                Math.round(workoutPlan.estimatedCaloriesBurned + totalAddedCalories),
              ),
            },
          },
        };

        return {
          ...prev,
          profile: nextProfile,
          logs: prev.logs.map((log) =>
            log.date === currentDayKey
              ? withCaloriesBreakdown({
                  ...log,
                  workoutPlanCaloriesBurned: getWorkoutPlanCaloriesForLog(nextProfile, log.completedWorkoutTasks),
                })
              : log,
          ),
        };
      });

      if (nextProfile) {
        await syncProfile(nextProfile);
        if (state.session) {
          void syncProfileToServer(state.session, nextProfile);
        }
      }

      return addedCount;
    },
    async removeWorkoutExercises(removals) {
      const normalizedRemovals = (Array.isArray(removals) ? removals : [])
        .map((entry) => ({
          name: normalizeExerciseName(String(entry?.name || '')),
          durationMinutes: Number.isFinite(Number(entry?.durationMinutes))
            ? Math.max(1, Math.round(Number(entry?.durationMinutes)))
            : null,
        }))
        .filter((entry) => entry.name);
      if (!normalizedRemovals.length) return 0;

      let removedCount = 0;
      let nextProfile: UserProfile | null = null;
      let nextLog: DailyLog | null = null;
      let sessionUserId: string | null = state.session?.userId ?? null;

      setState((prev) => {
        sessionUserId = prev.session?.userId ?? sessionUserId;
        if (!prev.profile?.dailyTargets?.workoutPlan) {
          return prev;
        }

        const workoutPlan = prev.profile.dailyTargets.workoutPlan;
        const currentTasks = workoutPlan.dailyChecklist;
        const removedTaskIds = new Set<string>();
        let removedMinutesTotal = 0;

        for (const removal of normalizedRemovals) {
          const match = currentTasks.find((task) => {
            if (removedTaskIds.has(task.id)) return false;
            const parts = parseWorkoutTaskParts(task);
            if (!parts.isCompanionTask) return false;
            if (!parts.name.includes(removal.name) && !removal.name.includes(parts.name)) return false;
            if (removal.durationMinutes !== null && parts.durationMinutes !== removal.durationMinutes) return false;
            return true;
          });

          if (!match) continue;
          removedTaskIds.add(match.id);
          removedMinutesTotal += parseWorkoutTaskParts(match).durationMinutes ?? 0;
        }

        if (!removedTaskIds.size) {
          return prev;
        }

        removedCount = removedTaskIds.size;

        const nextLogs = prev.logs.map((item) => {
          if (item.date !== currentDayKey) return item;

          const currentEntries = normalizeCustomWorkoutEntries(item.customWorkoutEntries);
          const removalState = normalizedRemovals.map((entry) => ({ ...entry, consumed: false }));
          const removedEntryIds = new Set<string>();
          let removedCaloriesTotal = 0;

          for (const entry of currentEntries) {
            if (entry.source !== 'companion') continue;
            const entryName = normalizeExerciseName(entry.name);
            const matchedRemoval = removalState.find((removal) => {
              if (removal.consumed) return false;
              if (!entryName.includes(removal.name) && !removal.name.includes(entryName)) return false;
              if (removal.durationMinutes !== null && entry.durationMinutes !== removal.durationMinutes) return false;
              return true;
            });

            if (!matchedRemoval) continue;
            matchedRemoval.consumed = true;
            removedEntryIds.add(entry.id);
            removedCaloriesTotal += entry.caloriesBurned;
          }

          const nextChecklist = currentTasks.filter((task) => !removedTaskIds.has(task.id));
          const nextCustomEntries = currentEntries.filter((entry) => !removedEntryIds.has(entry.id));
          const currentWorkoutMinutes = Math.max(
            15,
            Math.round(prev.profile!.dailyWorkoutMinutes ?? prev.profile!.dailyTargets.workoutMinutes ?? 0),
          );
          const nextWorkoutMinutes = Math.max(15, currentWorkoutMinutes - removedMinutesTotal);
          const studyHours = sanitizeStudyHours(
            prev.profile!.dailyStudyHours ?? prev.profile!.dailyTargets.studyHours,
            3,
          );

          nextProfile = {
            ...prev.profile!,
            dailyWorkoutMinutes: nextWorkoutMinutes,
            dailyAvailableHours: deriveDailyAvailableHours(studyHours, nextWorkoutMinutes),
            dailyTargets: {
              ...prev.profile!.dailyTargets,
              workoutMinutes: nextWorkoutMinutes,
              workoutPlan: {
                ...workoutPlan,
                summary: summaryWithWorkoutMinutes(workoutPlan.summary, nextWorkoutMinutes),
                dailyChecklist: nextChecklist,
                estimatedCaloriesBurned: Math.max(
                  0,
                  Math.round(workoutPlan.estimatedCaloriesBurned - removedCaloriesTotal),
                ),
              },
            },
          };

          const remainingCompleted = item.completedWorkoutTasks.filter((taskId) => !removedTaskIds.has(taskId));
          nextLog = withCaloriesBreakdown({
            ...item,
            customWorkoutEntries: nextCustomEntries,
            completedWorkoutTasks: remainingCompleted,
            workoutPlanCaloriesBurned: getWorkoutPlanCaloriesForLog(nextProfile, remainingCompleted),
          });

          return nextLog;
        });

        return {
          ...prev,
          profile: nextProfile ?? prev.profile,
          logs: nextLogs,
        };
      });

      if (nextProfile) {
        await syncProfile(nextProfile);
        if (state.session) {
          void syncProfileToServer(state.session, nextProfile);
        }
      }

      if (sessionUserId && nextLog) {
        try {
          await syncDailyLog(sessionUserId, nextLog);
        } catch {
          // Local state is already updated; background persistence can fail silently.
        }
      }

      if (state.session && nextLog) {
        void syncDailyLogToServer(state.session, nextProfile ?? state.profile, nextLog);
      }

      return removedCount;
    },
    async removeCustomWorkoutEntry(entryId) {
      await upsertLog((log) =>
        withCaloriesBreakdown({
          ...log,
          customWorkoutEntries: (log.customWorkoutEntries ?? []).filter((entry) => entry.id !== entryId),
        }),
      );
    },
    addLeaderboardEntry(name, points) {
      setState((prev) => ({
        ...prev,
        leaderboard: [
          ...prev.leaderboard.filter((entry) => entry.name.toLowerCase() !== name.trim().toLowerCase()),
          {
            id: `friend-${randomId()}`,
            name: name.trim(),
            points,
          } satisfies LeaderboardEntry,
        ],
      }));
    },
    toggleDarkMode() {
      setState((prev) => ({ ...prev, darkMode: !prev.darkMode }));
    },
    toggleNotification(id) {
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((item: NotificationItem) =>
          item.id === id ? { ...item, enabled: !item.enabled } : item,
        ),
      }));
    },
    updateNotificationTime(id, time) {
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((item: NotificationItem) =>
          item.id === id ? { ...item, time } : item,
        ),
      }));
    },
    async refreshTasks() {
      if (!state.session) return;
      const tasks = await apiFetchTasks(state.session.userId, state.session.identifier);
      setState((prev) => ({ ...prev, tasks }));
    },
    async createTask(title, dueAt) {
      if (!state.session) return;

      const userId = state.session.userId;
      const identifier = state.session.identifier;
      const name = state.profile?.name;
      const dueDate = dueAt ? String(dueAt).slice(0, 10) : todayKey();

      const task = await apiCreateTask({
        userId,
        identifier,
        name,
        title,
        dueAt: dueAt || null,
        dueDate,
      });

      setState((prev) => ({
        ...prev,
        tasks: [task, ...prev.tasks.filter((item) => item.id !== task.id)],
      }));
    },
    async toggleTask(taskId) {
      if (!state.session) return;
      const existing = state.tasks.find((task) => task.id === taskId);
      if (!existing) return;

      const updated = await apiUpdateTask({
        userId: state.session.userId,
        identifier: state.session.identifier,
        name: state.profile?.name,
        taskId,
        patch: {
          completed: !existing.completed,
        },
      });

      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => (task.id === taskId ? updated : task)),
      }));
    },
    async deleteTask(taskId) {
      if (!state.session) return;
      await apiDeleteTask(state.session.userId, taskId, state.session.identifier);
      setState((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.id !== taskId) }));
    },
    async refreshBmi() {
      if (!state.session) return;
      const bmiHistory = await apiFetchBmiHistory(state.session.userId, state.session.identifier);
      setState((prev) => ({ ...prev, bmiHistory }));
    },
    async recordBmi(heightCm, weightKg) {
      if (!state.session) return;

      const entry = await apiRecordBmi({
        userId: state.session.userId,
        identifier: state.session.identifier,
        name: state.profile?.name,
        heightCm,
        weightKg,
      });

      setState((prev) => ({
        ...prev,
        bmiHistory: [entry, ...prev.bmiHistory.filter((item) => item.id !== entry.id)],
      }));
    },
    async resetAllData() {
      const currentSession = state.session;
      const preservedDarkMode = state.darkMode;

      if (currentSession?.userId) {
        clearUserState(currentSession.userId);
      }

      setState({
        ...initialState,
        logs: [defaultLog()],
        darkMode: preservedDarkMode,
        session: currentSession
          ? {
              ...currentSession,
              userId: currentSession.userId || `user-${randomId()}`,
            }
          : null,
      });

      if (currentSession?.userId) {
        try {
          await clearCloudData(currentSession.userId);
        } catch (error) {
          console.error('Failed to clear remote user data', error);
        }
      }

      if (currentSession?.userId) {
        try {
          await fetch('/api/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentSession.userId, identifier: currentSession.identifier }),
          });
        } catch (error) {
          console.error('Failed to clear server user data', error);
        }
      }
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }

  return context;
};
