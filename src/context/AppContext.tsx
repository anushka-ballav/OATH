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
import { computeUserScore } from '../lib/score';
import { randomId } from '../lib/utils';
import { defaultNotifications } from '../services/notifications';
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

interface AppContextValue extends AppState {
  isReady: boolean;
  currentLog: DailyLog;
  login(session: UserSession): Promise<void>;
  logout(): void;
  completeOnboarding(payload: Omit<UserProfile, 'userId' | 'dailyTargets'>): Promise<void>;
  updateProfile(profile: Partial<UserProfile>): Promise<void>;
  markWakeUp(timeValue?: string): Promise<void>;
  addStudyMinutes(minutes: number): Promise<void>;
  addWater(amount: number): Promise<void>;
  addCaloriesBurned(value: number): Promise<void>;
  addFoodEntry(entry: FoodEntry): Promise<void>;
  removeFoodEntry(entryId: string): Promise<void>;
  toggleWorkoutTask(taskId: string): Promise<void>;
  addCustomWorkoutEntry(name: string, durationMinutes: number, caloriesBurned: number): Promise<void>;
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
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

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

const normalizeProfile = (profile: UserProfile | null): UserProfile | null => {
  if (!profile) return null;

  return {
    ...profile,
    gender: normalizeGender(profile.gender),
    dailyTargets: generatePlan({
      gender: normalizeGender(profile.gender),
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
      goal: profile.goal,
      dailyAvailableHours: profile.dailyAvailableHours,
    }),
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
  notifications: state.notifications?.length ? state.notifications : defaultNotifications,
  leaderboard: state.leaderboard ?? [],
  streakHistory: state.streakHistory ?? [],
  darkMode: state.darkMode ?? true,
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

  const hydrateSessionState = async (baseState: AppState) => {
    const userId = baseState.session?.userId;

    if (!userId) {
      return normalizeState(baseState);
    }

    try {
      const remoteState = await fetchUserStateFromServer(userId);
      const nextProfile = baseState.profile ?? remoteState.profile ?? null;
      const nextLogs =
        shouldUseRemoteLogs(baseState.logs) && remoteState.logs.length ? remoteState.logs : baseState.logs;
      const nextTasks = baseState.tasks.length ? baseState.tasks : remoteState.tasks;
      const nextBmiHistory = baseState.bmiHistory.length ? baseState.bmiHistory : remoteState.bmiHistory;
      const nextStreakHistory =
        baseState.streakHistory.length || !nextProfile
          ? baseState.streakHistory
          : buildStreakHistoryFromLogs(nextProfile, nextLogs);

      return normalizeState({
        ...baseState,
        profile: nextProfile,
        logs: nextLogs,
        tasks: nextTasks,
        bmiHistory: nextBmiHistory,
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
        });
      }

      document.documentElement.classList.toggle('dark', state.darkMode);
    }
  }, [isReady, state]);

  const currentLog = useMemo(() => {
    return state.logs.find((log) => log.date === currentDayKey) ?? { ...defaultLog(), date: currentDayKey };
  }, [currentDayKey, state.logs]);

  const currentScore = useMemo(
    () => computeUserScore(currentLog, state.streakHistory),
    [currentLog, state.streakHistory],
  );

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
        const tasks = await apiFetchTasks(userId);
        if (!cancelled) {
          setState((prev) => ({ ...prev, tasks }));
        }
      } catch {
        // Server data is optional; fall back to local cache.
      }

      try {
        const bmiHistory = await apiFetchBmiHistory(userId);
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
    void syncProfileToServer(state.session, state.profile);
  }, [isReady, state.profile?.userId, state.session?.userId]);

  useEffect(() => {
    if (!isReady || !state.session) return;
    void syncDailyLogToServer(state.session, state.profile, currentLog);
  }, [currentLog.date, isReady, state.session?.userId]);

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
      await syncDailyLog(sessionUserId, nextLog);
    }

    if (state.session && nextLog) {
      void syncDailyLogToServer(state.session, state.profile, nextLog);
    }
  };

  const value: AppContextValue = {
    ...state,
    isReady,
    currentLog,
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
      clearGlobalState();
      setState((prev) => ({
        ...initialState,
        notifications: prev.notifications,
        leaderboard: prev.leaderboard,
      }));
    },
    async completeOnboarding(payload) {
      if (!state.session) return;

      const profile: UserProfile = {
        ...payload,
        userId: state.session.userId,
        dailyTargets: generatePlan(payload),
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

      const recalculatedTargets = generatePlan(profile);
      const nextProfile = { ...profile, dailyTargets: recalculatedTargets };

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
      await upsertLog((log) => ({ ...log, waterIntakeMl: log.waterIntakeMl + amount }));
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
    async addCustomWorkoutEntry(name, durationMinutes, caloriesBurned) {
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
            },
            ...(log.customWorkoutEntries ?? []),
          ],
        }),
      );
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
      const tasks = await apiFetchTasks(state.session.userId);
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
      await apiDeleteTask(state.session.userId, taskId);
      setState((prev) => ({ ...prev, tasks: prev.tasks.filter((task) => task.id !== taskId) }));
    },
    async refreshBmi() {
      if (!state.session) return;
      const bmiHistory = await apiFetchBmiHistory(state.session.userId);
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
            body: JSON.stringify({ userId: currentSession.userId }),
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
