import { useMemo, useState } from 'react';
import { AlarmClock, Bell, BookOpenText, Flame, MoonStar, Droplets, SunMedium } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLastSevenDays } from '../lib/date';
import { CardShell } from '../components/CardShell';
import { ProgressBar } from '../components/ProgressBar';
import { StudyTimerCard } from '../components/StudyTimerCard';
import { WakeUpCard } from '../components/WakeUpCard';
import { WaterTrackerCard } from '../components/WaterTrackerCard';
import { WeeklyChart } from '../components/WeeklyChart';
import { WorkoutPlanCard } from '../components/WorkoutPlanCard';
import { NutritionSummaryCard } from '../components/NutritionSummaryCard';
import { BMICard } from '../components/BMICard';
import { TasksCard } from '../components/TasksCard';
import { percent } from '../lib/utils';
import { requestNotificationPermission, sendLocalNotification } from '../services/notifications';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const enterDelay = (ms: number) => ({ ['--enter-base' as any]: `${ms}ms` });

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const formatCalendarLabel = (date = new Date()) =>
  date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

const ProgressRing = ({ value }: { value: number }) => {
  const size = 52;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);
  const gradientId = 'okra-progress-ring';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="1" />
          <stop offset="55%" stopColor="#fbbf24" stopOpacity="1" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="1" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={stroke}
        fill="transparent"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        fill="transparent"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="currentColor"
        className="font-semibold text-black dark:text-zinc-50"
        style={{ fontSize: 12 }}
      >
        {value}%
      </text>
    </svg>
  );
};

export const HomePage = () => {
  const {
    profile,
    currentLog,
    logs,
    tasks,
    bmiHistory,
    streakHistory,
    notifications,
    markWakeUp,
    addStudyMinutes,
    addWater,
    removeWater,
    addCaloriesBurned,
    toggleWorkoutTask,
    addCustomWorkoutEntry,
    removeCustomWorkoutEntry,
    createTask,
    toggleTask,
    deleteTask,
    recordBmi,
    toggleDarkMode,
    darkMode,
  } = useApp();

  const [caloriesBurned, setCaloriesBurnedInput] = useState(0);

  const weeklyStudyData = useMemo(
    () =>
      getLastSevenDays().map((date) => ({
        day: date.slice(5),
        value: Math.round((logs.find((log) => log.date === date)?.studyMinutes ?? 0) / 60),
      })),
    [logs],
  );
  const netCaloriesToday = currentLog.caloriesConsumed - currentLog.caloriesBurned;

  if (!profile) return null;

  const goalsSummary = useMemo(() => {
    const waterTarget = profile.dailyTargets.waterLiters;
    const waterConsumed = currentLog.waterIntakeMl / 1000;
    const waterRemaining = Math.max(0, waterTarget - waterConsumed);

    const studyTarget = profile.dailyTargets.studyHours;
    const studyDone = currentLog.studyMinutes / 60;
    const studyRemaining = Math.max(0, studyTarget - studyDone);

    const checklist = profile.dailyTargets.workoutPlan.dailyChecklist || [];
    const completed = new Set(currentLog.completedWorkoutTasks || []);
    const remaining = checklist.filter((task) => !completed.has(task.id));

    return {
      waterTargetLiters: waterTarget,
      waterConsumedLiters: Number(waterConsumed.toFixed(2)),
      waterRemainingLiters: Number(waterRemaining.toFixed(2)),
      studyTargetHours: studyTarget,
      studyDoneHours: Number(studyDone.toFixed(1)),
      studyRemainingHours: Number(studyRemaining.toFixed(1)),
      workoutTotalTasks: checklist.length,
      workoutDoneTasks: checklist.length - remaining.length,
      workoutRemainingTasks: remaining.length,
      workoutRemainingLabels: remaining.map((task) => task.label),
    };
  }, [currentLog.completedWorkoutTasks, currentLog.studyMinutes, currentLog.waterIntakeMl, profile.dailyTargets.studyHours, profile.dailyTargets.waterLiters, profile.dailyTargets.workoutPlan.dailyChecklist]);

  const streak = streakHistory[streakHistory.length - 1]?.streak ?? 0;
  const calendarLabel = formatCalendarLabel();

  const workoutChecklistTotal = profile.dailyTargets.workoutPlan.dailyChecklist.length || 1;
  const dailyProgressFraction =
    ((currentLog.wakeUpTime ? 1 : 0) +
      clamp01(currentLog.studyMinutes / (profile.dailyTargets.studyHours * 60)) +
      clamp01(currentLog.waterIntakeMl / (profile.dailyTargets.waterLiters * 1000)) +
      clamp01(currentLog.completedWorkoutTasks.length / workoutChecklistTotal)) /
    4;
  const dailyProgressPercent = Math.round(dailyProgressFraction * 100);
  const progressHeadline =
    dailyProgressPercent >= 75 ? 'Almost there!' : dailyProgressPercent >= 45 ? 'On track' : 'Start strong';

  const remainingCalories = Math.max(0, profile.dailyTargets.calories - currentLog.caloriesConsumed);
  const caloriesConsumedPercent = percent(currentLog.caloriesConsumed, profile.dailyTargets.calories);

  return (
    <div className="page-enter space-y-5 pb-28 sm:pb-24">
      <header className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 font-display text-2xl font-semibold uppercase tracking-[0.18em] sm:text-3xl">
              <span className="text-black/70 dark:text-orange-100/70">{getGreeting().toUpperCase()},</span>
              <span className="relative inline-flex items-center">
                <span
                  aria-hidden="true"
                  className="absolute -inset-4 rounded-full bg-gradient-to-r from-orange-500/25 via-fuchsia-500/18 to-sky-500/20 blur-2xl"
                />
                <span className="relative z-10 font-bold">{profile.name.toUpperCase()}</span>
              </span>
              <span className="wave-emoji relative z-10 text-2xl sm:text-3xl">{'\u{1F44B}'}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => void requestNotificationPermission()}
              className="btn-glow soft-surface panel-hover rounded-2xl p-3 active:scale-[0.99]"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="btn-glow soft-surface panel-hover rounded-2xl p-3 active:scale-[0.99]"
              aria-label="Toggle theme"
            >
              {darkMode ? <SunMedium size={18} /> : <MoonStar size={18} />}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.15fr_0.85fr]">
          <div style={enterDelay(0)}>
            <CardShell className="relative overflow-hidden rounded-[28px] border border-orange-400/20 bg-transparent">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <ProgressRing value={dailyProgressPercent} />
                <div>
                  <p className="font-display text-xl">{progressHeadline}</p>
                  <p className="muted-text mt-1 text-sm">{calendarLabel}</p>
                  <div className="mt-3 flex items-center gap-2 text-black dark:text-zinc-200">
                    <span className="soft-surface inline-flex h-8 w-8 items-center justify-center rounded-2xl">
                      <AlarmClock size={16} />
                    </span>
                    <span className="soft-surface inline-flex h-8 w-8 items-center justify-center rounded-2xl">
                      <BookOpenText size={16} />
                    </span>
                    <span className="soft-surface inline-flex h-8 w-8 items-center justify-center rounded-2xl">
                      <Droplets size={16} />
                    </span>
                    <span className="soft-surface inline-flex h-8 w-8 items-center justify-center rounded-2xl">
                      <Flame size={16} />
                    </span>
                  </div>
                </div>
              </div>
            </CardShell>
          </div>

          <div style={enterDelay(90)}>
            <CardShell className="relative overflow-hidden rounded-[28px] border border-orange-400/20 bg-transparent">
              <div className="flex items-start gap-4">
                <div className="soft-surface inline-flex h-12 w-12 items-center justify-center rounded-2xl text-orange-400">
                  <span className="flame-flicker">
                    <Flame size={22} />
                  </span>
                </div>
                <div>
                  <p className="text-sm text-black dark:text-zinc-200">{streak} days streak</p>
                  <p className="muted-text mt-2 text-sm">
                    {streak > 0 ? 'Keep hitting your targets to extend the streak.' : 'Complete all goals to start a streak.'}
                  </p>
                </div>
              </div>
            </CardShell>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[0.95fr_1.05fr]">
        <div style={enterDelay(160)}>
          <WakeUpCard
            wakeUpTime={currentLog.wakeUpTime}
            profile={profile}
            onMark={async (timeValue) => {
              await markWakeUp(timeValue);
              sendLocalNotification('Wake-up saved', 'Your wake-up time has been updated for today.');
            }}
          />
        </div>
        <div style={enterDelay(240)}>
          <StudyTimerCard
            todayMinutes={currentLog.studyMinutes}
            goalMinutes={profile.dailyTargets.studyHours * 60}
            onSave={async (minutes) => {
              await addStudyMinutes(minutes);
              sendLocalNotification('Study session saved', `Added ${minutes} study minutes to today.`);
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[0.9fr_1.1fr]">
        <div style={enterDelay(320)}>
          <WaterTrackerCard
            currentMl={currentLog.waterIntakeMl}
            profile={profile}
            onAdd={async (amount) => {
              await addWater(amount);
              sendLocalNotification('Hydration update', `Added ${amount}ml water.`);
            }}
            onRemove={async (amount) => {
              await removeWater(amount);
              sendLocalNotification('Hydration update', `Removed ${amount}ml water.`);
            }}
          />
        </div>

        <div style={enterDelay(400)}>
          <CardShell className="relative overflow-hidden rounded-[28px] border border-orange-400/20 bg-transparent">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Calories</p>
              <p className="muted-text mt-2 text-sm">
                Target {profile.dailyTargets.calories} kcal • Net {netCaloriesToday} kcal
              </p>
            </div>
            <div className="soft-surface inline-flex h-12 w-12 items-center justify-center rounded-2xl text-orange-400">
              <Flame size={18} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="soft-surface rounded-2xl px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-orange-100/70">Burned</p>
              <p className="mt-2 text-xl font-semibold text-emerald-400">{currentLog.caloriesBurned}</p>
            </div>
            <div className="soft-surface rounded-2xl px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-orange-100/70">Remaining</p>
              <p className="mt-2 text-xl font-semibold text-black dark:text-zinc-50">{remainingCalories}</p>
            </div>
            <div className="soft-surface rounded-2xl px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-black/70 dark:text-orange-100/70">Eaten</p>
              <p className="mt-2 text-xl font-semibold text-orange-200">{currentLog.caloriesConsumed}</p>
            </div>
          </div>

          <div className="mt-4">
            <ProgressBar value={caloriesConsumedPercent} colorClass="bg-gradient-to-r from-orange-500 via-amber-400 to-blue-500" />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="mb-2 block text-sm font-medium text-black">Add manual burned calories</span>
              <input
                type="number"
                value={caloriesBurned}
                onChange={(event) => setCaloriesBurnedInput(Number(event.target.value))}
                min={0}
                className="w-full rounded-2xl border border-orange-400/25 bg-white px-4 py-3 text-black outline-none transition focus:border-orange-400 dark:bg-[#17110b] dark:text-orange-50"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const amount = Number(caloriesBurned);
                if (!Number.isFinite(amount) || amount <= 0) return;

                void addCaloriesBurned(amount);
                setCaloriesBurnedInput(0);
              }}
              className="btn-glow h-[52px] w-full rounded-2xl bg-orange-500 px-5 font-semibold text-white transition hover:bg-orange-600 active:scale-[0.99] sm:w-auto sm:shrink-0"
            >
              Add
            </button>
          </div>
          </CardShell>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div style={enterDelay(480)}>
          <BMICard
            heightCm={profile.height}
            weightKg={profile.weight}
            history={bmiHistory}
            onRecord={async (heightCm, weightKg) => {
              await recordBmi(heightCm, weightKg);
              sendLocalNotification('BMI saved', 'Your BMI entry has been added to history.');
            }}
          />
        </div>
        <div style={enterDelay(560)}>
          <TasksCard
            tasks={tasks}
            goals={goalsSummary}
            onCreate={async (title, dueAtIso) => {
              await createTask(title, dueAtIso);
              sendLocalNotification('Task added', 'Your checklist was updated.');
            }}
            onToggle={async (taskId) => {
              await toggleTask(taskId);
            }}
            onDelete={async (taskId) => {
              await deleteTask(taskId);
            }}
          />
        </div>
      </div>

      <div style={enterDelay(640)}>
        <NutritionSummaryCard
          profile={profile}
          log={currentLog}
          goalCompletionPercent={dailyProgressPercent}
        />
      </div>

      <div style={enterDelay(720)}>
        <WorkoutPlanCard
          profile={profile}
          log={currentLog}
          onToggleTask={toggleWorkoutTask}
          onAddCustomWorkout={addCustomWorkoutEntry}
          onRemoveCustomWorkout={removeCustomWorkoutEntry}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div style={enterDelay(800)}>
          <WeeklyChart title="Study Hours" data={weeklyStudyData} color="#1d7f82" />
        </div>

        <div style={enterDelay(880)}>
          <CardShell className="h-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-black">Reminders</p>
                <h3 className="mt-2 font-display text-2xl">Daily notifications</h3>
              </div>
              <button
                type="button"
                onClick={() => void requestNotificationPermission()}
                className="soft-surface panel-hover flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-black sm:w-auto"
              >
                <Bell size={18} />
                Enable
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {notifications.map((item) => (
                <div key={item.id} className="soft-surface flex flex-col gap-3 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="muted-text text-sm">{item.time}</p>
                  </div>
                  <span
                    className={`self-start rounded-full px-3 py-1 text-xs font-semibold sm:self-auto ${
                      item.enabled ? 'bg-blue-100 text-black' : 'bg-blue-50 text-black'
                    }`}
                  >
                    {item.enabled ? 'On' : 'Off'}
                  </span>
                </div>
              ))}
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
};
