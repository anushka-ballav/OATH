import { useMemo, useState } from 'react';
import {
  AlarmClock,
  ArrowDownRight,
  ArrowUpRight,
  BookOpenText,
  Brain,
  CalendarClock,
  Droplets,
  Flame,
  ListChecks,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CardShell } from '../components/CardShell';
import { ProgressBar } from '../components/ProgressBar';
import { WeeklyChart } from '../components/WeeklyChart';
import { getLastNDays, todayKey } from '../lib/date';
import { CoachingRecommendation, generateCoachingRecommendations } from '../lib/coachingEngine';
import {
  buildDisciplineScoreSummary,
  buildHabitPredictions,
  buildSmartDailyPlanner,
} from '../lib/disciplineIntelligence';
import {
  isPlannerReminderEnabled,
  requestNotificationPermission,
  setPlannerReminderEnabled,
} from '../services/notifications';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const recommendationTone = (priority: CoachingRecommendation['priority']) => {
  if (priority === 'high') return 'border-rose-300/25 bg-rose-500/10';
  if (priority === 'medium') return 'border-amber-300/25 bg-amber-500/10';
  return 'border-emerald-300/25 bg-emerald-500/10';
};

const RecommendationIcon = ({ category }: { category: CoachingRecommendation['category'] }) => {
  if (category === 'study') return <BookOpenText size={16} />;
  if (category === 'hydration') return <Droplets size={16} />;
  if (category === 'workout') return <Flame size={16} />;
  if (category === 'sleep') return <AlarmClock size={16} />;
  return <Sparkles size={16} />;
};

export const ProgressPage = () => {
  const { logs, streakHistory, profile, currentLog, notifications, tasks } = useApp();
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [plannerReminderEnabled, setPlannerReminderEnabledState] = useState(() =>
    isPlannerReminderEnabled(),
  );
  const [plannerReminderMessage, setPlannerReminderMessage] = useState('');
  const rangeDays = range === 'daily' ? 1 : range === 'monthly' ? 30 : 7;
  const dateKeys = useMemo(() => getLastNDays(rangeDays), [rangeDays]);
  const trackingToday = todayKey();

  const logsByDate = useMemo(() => {
    const map = new Map(logs.map((entry) => [entry.date, entry]));
    if (!map.has(currentLog.date)) {
      map.set(currentLog.date, currentLog);
    }
    if (!map.has(trackingToday)) {
      map.set(trackingToday, currentLog);
    }
    return map;
  }, [currentLog, logs, trackingToday]);

  const buildSeries = (field: 'studyMinutes' | 'waterIntakeMl' | 'caloriesConsumed') =>
    dateKeys.map((date) => {
      const log = logsByDate.get(date);
      const value =
        field === 'studyMinutes'
          ? Math.round((log?.studyMinutes ?? 0) / 60)
          : field === 'waterIntakeMl'
            ? Number(((log?.waterIntakeMl ?? 0) / 1000).toFixed(2))
            : log?.caloriesConsumed ?? 0;

      return {
        day: date.slice(5),
        value,
      };
    });

  const streakSeries = useMemo(
    () => streakHistory.slice(-7).map((item) => ({ day: item.date.slice(5), value: item.streak })),
    [streakHistory],
  );

  const taskSeries = useMemo(() => {
    const studyTargetMinutes = Math.max(0, Math.round((profile?.dailyTargets.studyHours ?? 0) * 60));
    const waterTargetMl = Math.max(0, Math.round((profile?.dailyTargets.waterLiters ?? 0) * 1000));
    const workoutChecklist = Array.isArray(profile?.dailyTargets.workoutPlan.dailyChecklist)
      ? profile!.dailyTargets.workoutPlan.dailyChecklist
      : [];

    return dateKeys.map((date) => {
      const log = logsByDate.get(date);
      const completedWorkoutTasks = new Set(log?.completedWorkoutTasks || []);
      const studyDone = studyTargetMinutes > 0 && (log?.studyMinutes ?? 0) >= studyTargetMinutes;
      const waterDone = waterTargetMl > 0 && (log?.waterIntakeMl ?? 0) >= waterTargetMl;
      const workoutDone =
        workoutChecklist.length > 0 &&
        workoutChecklist.every((task) => task.id && completedWorkoutTasks.has(task.id));
      const completed = [studyDone, waterDone, workoutDone].filter(Boolean).length;
      const pending = 3 - completed;

      return {
        day: date.slice(5),
        completed,
        pending,
      };
    });
  }, [dateKeys, logsByDate, profile]);

  const caloriesSeries = useMemo(() => {
    return dateKeys.map((date) => {
      const log = logsByDate.get(date);
      return {
        day: date.slice(5),
        consumed: log?.caloriesConsumed ?? 0,
        burned: log?.caloriesBurned ?? 0,
      };
    });
  }, [dateKeys, logsByDate]);

  const coachingRecommendations = useMemo(
    () =>
      generateCoachingRecommendations({
        profile,
        logs,
        currentLog,
        notifications,
      }),
    [currentLog, logs, notifications, profile],
  );
  const disciplineScore = useMemo(
    () =>
      buildDisciplineScoreSummary({
        profile,
        logs,
        currentLog,
        tasks,
      }),
    [currentLog, logs, profile, tasks],
  );
  const smartPlanner = useMemo(
    () =>
      buildSmartDailyPlanner({
        profile,
        logs,
        currentLog,
        tasks,
        notifications,
      }),
    [currentLog, logs, notifications, profile, tasks],
  );
  const habitPredictions = useMemo(
    () =>
      buildHabitPredictions({
        profile,
        logs,
        currentLog,
        tasks,
        streakHistory,
      }),
    [currentLog, logs, profile, streakHistory, tasks],
  );

  const handlePlannerReminderToggle = async () => {
    if (plannerReminderEnabled) {
      setPlannerReminderEnabled(false);
      setPlannerReminderEnabledState(false);
      setPlannerReminderMessage('AI planner reminders disabled on this device.');
      window.setTimeout(() => setPlannerReminderMessage(''), 2400);
      return;
    }

    const permission = await requestNotificationPermission();
    if (permission.permission === 'granted') {
      setPlannerReminderEnabled(true);
      setPlannerReminderEnabledState(true);
      setPlannerReminderMessage('AI planner reminders enabled on mobile for this device.');
    } else {
      setPlannerReminderMessage(permission.message);
    }

    window.setTimeout(() => setPlannerReminderMessage(''), 2800);
  };

  return (
    <div className="space-y-5 pb-28 sm:pb-24">
      <header className="glass rounded-[32px] border border-blue-100 p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Progress Dashboard</p>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl">{range === 'daily' ? 'Today' : range === 'monthly' ? 'Monthly' : 'Weekly'} insight</h1>
            <p className="muted-text mt-2 text-sm">
              Tasks, calories, water, and study with smooth visual trends.
            </p>
          </div>

          <label className="soft-surface inline-flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-black dark:text-orange-100 sm:w-auto sm:justify-start">
            <span className="muted-text text-xs uppercase tracking-[0.24em]">Range</span>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as typeof range)}
              className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-black outline-none dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <CardShell>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Discipline Score</p>
              <h3 className="mt-1 font-display text-2xl text-black">Unified daily signal</h3>
            </div>
            <div className="rounded-2xl bg-blue-100 p-3 text-black">
              <TrendingUp size={18} />
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-orange-400/20 bg-white/60 px-4 py-4 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-3xl font-semibold text-black">
                {disciplineScore?.score ?? 0}
                <span className="ml-1 text-lg font-medium text-black/70 dark:text-orange-100/70">/100</span>
              </p>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  disciplineScore?.trend === 'up'
                    ? 'bg-emerald-500/20 text-emerald-100'
                    : disciplineScore?.trend === 'down'
                      ? 'bg-rose-500/20 text-rose-100'
                      : 'bg-white/65 text-black dark:bg-white/10 dark:text-orange-100'
                }`}
              >
                {disciplineScore?.trend === 'up' ? <ArrowUpRight size={12} className="mr-1" /> : null}
                {disciplineScore?.trend === 'down' ? <ArrowDownRight size={12} className="mr-1" /> : null}
                Trend{' '}
                {disciplineScore?.trend === 'flat'
                  ? 'steady'
                  : `${disciplineScore?.trend === 'up' ? 'up' : 'down'} ${Math.abs(disciplineScore?.trendDelta || 0)}`}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-black/70 dark:text-orange-100/75">
                  <span>Study (30%)</span>
                  <span>{disciplineScore?.breakdown.study || 0}/30</span>
                </div>
                <ProgressBar value={((disciplineScore?.breakdown.study || 0) / 30) * 100} colorClass="bg-gradient-to-r from-sky-500 to-blue-500" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-black/70 dark:text-orange-100/75">
                  <span>Health (30%)</span>
                  <span>{disciplineScore?.breakdown.health || 0}/30</span>
                </div>
                <ProgressBar value={((disciplineScore?.breakdown.health || 0) / 30) * 100} colorClass="bg-gradient-to-r from-emerald-500 to-lime-500" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-black/70 dark:text-orange-100/75">
                  <span>Tasks (40%)</span>
                  <span>{disciplineScore?.breakdown.tasks || 0}/40</span>
                </div>
                <ProgressBar value={((disciplineScore?.breakdown.tasks || 0) / 40) * 100} colorClass="bg-gradient-to-r from-orange-500 to-amber-400" />
              </div>
            </div>
          </div>
        </CardShell>

        <CardShell>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Smart Daily Planner</p>
              <h3 className="mt-1 font-display text-2xl text-black">AI-generated schedule</h3>
            </div>
            <div className="rounded-2xl bg-blue-100 p-3 text-black">
              <CalendarClock size={18} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handlePlannerReminderToggle()}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                plannerReminderEnabled
                  ? 'bg-emerald-500/20 text-emerald-100'
                  : 'bg-blue-100 text-black hover:bg-blue-200 dark:bg-orange-500/20 dark:text-orange-50 dark:hover:bg-orange-500/30'
              }`}
            >
              {plannerReminderEnabled ? 'Planner reminders enabled' : 'Enable planner reminders'}
            </button>
            <span className="text-xs uppercase tracking-[0.15em] text-black/65 dark:text-orange-100/75">
              Mobile notifications
            </span>
          </div>

          <p className="muted-text mt-2 text-sm">{smartPlanner?.summary || 'Planner will appear once profile targets are set.'}</p>

          {plannerReminderMessage ? (
            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-black dark:border-orange-400/25 dark:bg-orange-500/10 dark:text-orange-100">
              {plannerReminderMessage}
            </div>
          ) : null}

          <div className="mt-4 space-y-2.5">
            {(smartPlanner?.blocks || []).map((block) => (
              <div key={`${block.time}-${block.title}`} className="soft-surface rounded-[18px] border border-orange-400/15 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-black">{block.title}</p>
                  <span className="rounded-full bg-white/65 px-2.5 py-1 text-xs font-semibold text-black dark:bg-white/10 dark:text-orange-100">
                    {block.time}
                  </span>
                </div>
                <p className="muted-text mt-1 text-sm">{block.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black">
              <ListChecks size={16} />
              Priority Tasks
            </div>
            <div className="space-y-2">
              {(smartPlanner?.priorityTasks || []).length ? (
                smartPlanner!.priorityTasks.map((task) => (
                  <div key={task.id} className="soft-surface rounded-[16px] border border-orange-400/15 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-black">{task.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          task.priority === 'high'
                            ? 'bg-rose-500/20 text-rose-100'
                            : task.priority === 'medium'
                              ? 'bg-amber-500/20 text-amber-100'
                              : 'bg-emerald-500/20 text-emerald-100'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <p className="muted-text mt-1 text-xs">{task.reason}</p>
                  </div>
                ))
              ) : (
                <div className="soft-surface rounded-[16px] border border-orange-400/15 px-3 py-2 text-sm text-black">
                  No pending due tasks right now.
                </div>
              )}
            </div>
          </div>
        </CardShell>
      </div>

      <CardShell>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Habit Prediction</p>
            <h3 className="mt-1 font-display text-2xl text-black">Risk forecast for today</h3>
          </div>
          <div className="rounded-2xl bg-blue-100 p-3 text-black">
            <Sparkles size={18} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {habitPredictions.map((prediction) => (
            <div
              key={prediction.id}
              className={`soft-surface rounded-[20px] border px-4 py-3 ${
                prediction.direction === 'warning'
                  ? 'border-rose-300/25 bg-rose-500/10'
                  : 'border-emerald-300/25 bg-emerald-500/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-black">{prediction.title}</p>
                <span className="rounded-full bg-white/65 px-2.5 py-1 text-xs font-semibold text-black dark:bg-white/10 dark:text-orange-100">
                  {prediction.riskPercent}%
                </span>
              </div>
              <p className="muted-text mt-2 text-sm">{prediction.message}</p>
              <p className="mt-2 text-sm text-black dark:text-orange-100">{prediction.action}</p>
            </div>
          ))}
        </div>
      </CardShell>

      <CardShell>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">AI Recommendation Engine</p>
            <h3 className="mt-1 font-display text-2xl text-black">Smart coaching insights</h3>
          </div>
          <div className="rounded-2xl bg-blue-100 p-3 text-black">
            <Brain size={18} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {coachingRecommendations.map((recommendation) => (
            <div
              key={recommendation.id}
              className={`soft-surface rounded-2xl border px-4 py-3 ${recommendationTone(recommendation.priority)}`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/65 text-black dark:bg-white/10 dark:text-orange-50">
                  <RecommendationIcon category={recommendation.category} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-black">{recommendation.title}</p>
                  <p className="muted-text mt-1 text-sm">{recommendation.insight}</p>
                  <p className="mt-2 text-sm text-black dark:text-orange-100">{recommendation.action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardShell>

      <div className="grid gap-5 xl:grid-cols-2">
        <CardShell>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Daily Goals Completed vs Pending</p>
              <h3 className="font-display text-xl">{range === 'daily' ? 'Today' : 'Trend'} overview</h3>
            </div>
          </div>
          <div className="h-56 sm:h-64 xl:h-72" key={`tasks-${range}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="day" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
                <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" stackId="a" fill="#34d399" radius={[10, 10, 0, 0]} isAnimationActive />
                <Bar dataKey="pending" stackId="a" fill="#fb923c" radius={[10, 10, 0, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardShell>

        <CardShell>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Calories Intake vs Burn</p>
              <h3 className="font-display text-xl">{range === 'daily' ? 'Today' : 'Trend'} overview</h3>
            </div>
          </div>
          <div className="h-56 sm:h-64 xl:h-72" key={`calories-${range}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={caloriesSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="day" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
                <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="consumed" stroke="#fb923c" strokeWidth={3} dot={{ r: 3 }} isAnimationActive />
                <Line type="monotone" dataKey="burned" stroke="#34d399" strokeWidth={3} dot={{ r: 3 }} isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardShell>
      </div>

      <div className="grid gap-5 2xl:grid-cols-3">
        <WeeklyChart title="Study Hours" data={buildSeries('studyMinutes')} color="#1d7f82" />
        <WeeklyChart title="Water Intake (L)" data={buildSeries('waterIntakeMl')} color="#0ea5e9" />
        <WeeklyChart title="Calories Consumed" data={buildSeries('caloriesConsumed')} color="#4d7b58" />
      </div>

      <CardShell>
        <p className="text-sm uppercase tracking-[0.24em] text-black">Streak History</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {streakSeries.length ? (
            streakSeries.map((item) => (
              <div key={item.day} className="soft-surface rounded-2xl px-4 py-4">
                <p className="muted-text text-sm">{item.day}</p>
                <p className="mt-2 font-display text-2xl">{item.value} days</p>
              </div>
            ))
          ) : (
            <p className="muted-text text-sm">Complete your goals to start a streak history.</p>
          )}
        </div>
      </CardShell>
    </div>
  );
};
