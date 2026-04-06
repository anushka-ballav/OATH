import { FormEvent, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Circle,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Plus,
  StretchHorizontal,
  Trash2,
} from 'lucide-react';
import { DailyLog, UserProfile } from '../types';
import { CardShell } from './CardShell';
import { ProgressBar } from './ProgressBar';
import { MacroGrid } from './MacroGrid';

interface WorkoutPlanCardProps {
  profile: UserProfile;
  log: DailyLog;
  onToggleTask: (taskId: string) => Promise<void>;
  onAddCustomWorkout: (name: string, durationMinutes: number, caloriesBurned: number) => Promise<void>;
  onRemoveCustomWorkout: (entryId: string) => Promise<void>;
}

export const WorkoutPlanCard = ({
  profile,
  log,
  onToggleTask,
  onAddCustomWorkout,
  onRemoveCustomWorkout,
}: WorkoutPlanCardProps) => {
  const workoutPlan = profile.dailyTargets?.workoutPlan;
  const macroTargets = profile.dailyTargets?.macroTargets;
  const [customName, setCustomName] = useState('');
  const [customMinutes, setCustomMinutes] = useState('20');
  const [customCalories, setCustomCalories] = useState('');
  const [savingCustomWorkout, setSavingCustomWorkout] = useState(false);

  if (!workoutPlan) {
    return null;
  }

  const customWorkoutEntries = log.customWorkoutEntries ?? [];
  const completedCount = workoutPlan.dailyChecklist.filter((task) =>
    log.completedWorkoutTasks.includes(task.id),
  ).length;
  const workoutCompletion = Math.round((completedCount / Math.max(1, workoutPlan.dailyChecklist.length)) * 100);
  const isFullPlanComplete = workoutPlan.dailyChecklist.length > 0 && completedCount === workoutPlan.dailyChecklist.length;
  const planCaloriesBurned = log.workoutPlanCaloriesBurned ?? 0;
  const manualCaloriesBurned = log.manualCaloriesBurned ?? 0;
  const customWorkoutCaloriesBurned = useMemo(
    () => customWorkoutEntries.reduce((total, entry) => total + entry.caloriesBurned, 0),
    [customWorkoutEntries],
  );

  const macroTotals = log.foodEntries.reduce(
    (acc, entry) => ({
      proteinG: acc.proteinG + (entry.proteinG ?? 0),
      carbsG: acc.carbsG + (entry.carbsG ?? 0),
      fatG: acc.fatG + (entry.fatG ?? 0),
      sugarG: acc.sugarG + (entry.sugarG ?? 0),
      fiberG: acc.fiberG + (entry.fiberG ?? 0),
      sodiumMg: acc.sodiumMg + (entry.sodiumMg ?? 0),
    }),
    {
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      sugarG: 0,
      fiberG: 0,
      sodiumMg: 0,
    },
  );

  const handleAddCustomWorkout = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = customName.trim();
    const minutes = Math.max(1, Math.round(Number(customMinutes)));
    const calories = Math.max(1, Math.round(Number(customCalories)));

    if (!trimmedName || !Number.isFinite(minutes) || !Number.isFinite(calories)) {
      return;
    }

    setSavingCustomWorkout(true);

    try {
      await onAddCustomWorkout(trimmedName, minutes, calories);
      setCustomName('');
      setCustomMinutes('20');
      setCustomCalories('');
    } finally {
      setSavingCustomWorkout(false);
    }
  };

  return (
    <CardShell className="hero-glow overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-100 dark:from-[#140f0a] dark:via-[#0c0c0c] dark:to-[#1b1208]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-black">Today's Workout</p>
          <h3 className="mt-2 font-display text-2xl">{workoutPlan.title}</h3>
          <p className="muted-text mt-3 text-sm">{workoutPlan.summary}</p>
        </div>
        <div className="rounded-2xl bg-orange-100 p-3 text-black dark:bg-orange-500/15 dark:text-orange-100">
          <Dumbbell size={18} />
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-orange-400/15 bg-white/65 px-4 py-4 dark:bg-white/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/60 dark:text-orange-100/70">
              Plan Burn Unlock
            </p>
            <p className="mt-2 text-lg font-semibold text-black">
              {workoutPlan.estimatedCaloriesBurned} kcal when the full plan is complete
            </p>
            <p className="muted-text mt-1 text-sm">
              {isFullPlanComplete
                ? 'Full daily workout complete. The plan calories are already counted in burned calories.'
                : 'Finish every workout task below to auto-add the plan burn to today.'}
            </p>
          </div>

          <span className="rounded-full border border-orange-400/25 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-100">
            {isFullPlanComplete ? 'Applied' : 'Pending'}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.22em] text-black/60 dark:text-orange-100/70">
          <span>Completion</span>
          <span>
            {completedCount}/{workoutPlan.dailyChecklist.length} • {workoutCompletion}%
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={workoutCompletion} colorClass="bg-gradient-to-r from-orange-500 via-fuchsia-500 to-sky-500" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {workoutPlan.dailyChecklist.map((task) => {
          const checked = log.completedWorkoutTasks.includes(task.id);
          const TaskIcon =
            task.id === 'warmup'
              ? Footprints
              : task.id === 'strength' || task.id === 'compound'
                ? Dumbbell
                : task.id === 'cardio'
                  ? HeartPulse
                  : task.id === 'cooldown'
                    ? StretchHorizontal
                    : Activity;

          return (
            <button
              key={task.id}
              type="button"
              onClick={() => void onToggleTask(task.id)}
              className="btn-glow soft-surface flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition duration-300 hover:-translate-y-0.5 hover:bg-orange-500/10 active:scale-[0.99]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-orange-200 dark:bg-orange-500/15">
                <TaskIcon size={18} />
              </span>
              <span className="flex-1 text-sm font-medium text-black">{task.label}</span>
              <span className={checked ? 'check-pop' : undefined}>
                {checked ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white/80 px-4 py-4 dark:bg-orange-500/10">
          <p className="text-xs uppercase tracking-[0.18em] text-black">Tasks Done</p>
          <p className="mt-2 text-2xl font-semibold text-black">
            {completedCount}/{workoutPlan.dailyChecklist.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white/80 px-4 py-4 dark:bg-orange-500/10">
          <p className="text-xs uppercase tracking-[0.18em] text-black">Plan Burn</p>
          <p className="mt-2 text-2xl font-semibold text-black">{planCaloriesBurned} kcal</p>
        </div>
        <div className="rounded-2xl bg-white/80 px-4 py-4 dark:bg-orange-500/10">
          <p className="text-xs uppercase tracking-[0.18em] text-black">Custom Burn</p>
          <p className="mt-2 text-2xl font-semibold text-black">{customWorkoutCaloriesBurned} kcal</p>
        </div>
        <div className="rounded-2xl bg-white/80 px-4 py-4 dark:bg-orange-500/10">
          <p className="text-xs uppercase tracking-[0.18em] text-black">Total Burned</p>
          <p className="mt-2 text-2xl font-semibold text-black">{log.caloriesBurned} kcal</p>
          <p className="muted-text mt-1 text-xs">Manual burn: {manualCaloriesBurned} kcal</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-orange-200/60 bg-white/70 px-4 py-4 dark:border-orange-400/25 dark:bg-orange-500/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-black">Custom Workout Add</p>
            <p className="muted-text mt-2 text-sm">
              Add any extra workout you did today, and its calories will be included in burned calories automatically.
            </p>
          </div>
          <span className="rounded-2xl bg-orange-100 p-3 text-black dark:bg-orange-500/15 dark:text-orange-100">
            <Flame size={18} />
          </span>
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr,0.8fr,0.8fr,auto]" onSubmit={handleAddCustomWorkout}>
          <label className="space-y-2 sm:col-span-2 xl:col-span-1">
            <span className="text-sm font-medium text-black">Workout name</span>
            <input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="Cycling, skipping, HIIT, yoga..."
              className="w-full rounded-2xl border border-orange-400/20 bg-white/70 px-4 py-3 text-black outline-none transition focus:border-orange-400 dark:bg-zinc-950/70"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-black">Minutes</span>
            <input
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
              inputMode="numeric"
              min="1"
              type="number"
              className="w-full rounded-2xl border border-orange-400/20 bg-white/70 px-4 py-3 text-black outline-none transition focus:border-orange-400 dark:bg-zinc-950/70"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-black">Calories burned</span>
            <input
              value={customCalories}
              onChange={(event) => setCustomCalories(event.target.value)}
              inputMode="numeric"
              min="1"
              type="number"
              placeholder="180"
              className="w-full rounded-2xl border border-orange-400/20 bg-white/70 px-4 py-3 text-black outline-none transition focus:border-orange-400 dark:bg-zinc-950/70"
            />
          </label>

          <button
            type="submit"
            disabled={savingCustomWorkout}
            className="btn-glow h-[52px] rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 font-semibold text-black transition hover:brightness-105 disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              <Plus size={18} />
              {savingCustomWorkout ? 'Adding...' : 'Add'}
            </span>
          </button>
        </form>

        <div className="mt-4 space-y-3">
          {customWorkoutEntries.length ? (
            customWorkoutEntries.map((entry) => (
              <div
                key={entry.id}
                className="soft-surface flex flex-col gap-3 rounded-2xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-black">{entry.name}</p>
                  <p className="muted-text mt-1 text-sm">
                    {entry.durationMinutes} min • {entry.caloriesBurned} kcal burned
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onRemoveCustomWorkout(entry.id)}
                  className="inline-flex items-center gap-2 self-start rounded-2xl border border-orange-400/25 bg-white/70 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-50 dark:bg-white/5 dark:text-orange-50 dark:hover:bg-white/10 sm:self-auto"
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="soft-surface rounded-2xl px-4 py-4">
              <p className="text-sm text-black">
                No custom workouts added yet. Add extra sessions here if you want them counted in burned calories.
              </p>
            </div>
          )}
        </div>
      </div>

      {macroTargets ? (
        <div className="mt-5 rounded-2xl border border-orange-200/60 bg-white/70 px-4 py-4 dark:border-orange-400/25 dark:bg-orange-500/10">
          <p className="text-sm uppercase tracking-[0.2em] text-black">Nutrition Targets</p>
          <p className="muted-text mt-2 text-sm">
            Hit protein first for your {profile.goal.toLowerCase()} goal, then keep carbs and fats balanced.
          </p>

          <div className="mt-4">
            <MacroGrid totals={macroTotals} targets={macroTargets} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-orange-200/60 bg-orange-50 px-4 py-4 text-black dark:border-orange-400/25 dark:bg-orange-500/10">
        <p className="text-sm uppercase tracking-[0.2em] text-black">Recovery Tip</p>
        <p className="mt-2 text-sm">{workoutPlan.recoveryTip}</p>
      </div>
    </CardShell>
  );
};
