import {
  AlarmClockCheck,
  BookOpenText,
  Dumbbell,
  Droplets,
  Flame,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { CardShell } from './CardShell';
import { ProgressBar } from './ProgressBar';
import { DailyLog, StreakRecord, UserProfile } from '../types';

interface StreakCorrelationSectionProps {
  logs: DailyLog[];
  streakHistory: StreakRecord[];
  profile: UserProfile | null;
}

type StreakSample = {
  date: string;
  streak: number;
  studyHours: number;
  waterLiters: number;
  workoutRatio: number;
  caloriesBurned: number;
  wakeLeadMinutes: number;
};

type MetricCard = {
  key: string;
  label: string;
  unit: string;
  icon: typeof BookOpenText;
  correlation: number;
  highAverage: number;
  lowAverage: number;
  description: string;
};

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
};

const toClockMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const getWakeLeadMinutes = (wakeUpTime?: string, wakeUpGoal?: string) => {
  if (!wakeUpTime || !wakeUpGoal) return 0;

  const wakeDate = new Date(wakeUpTime);
  if (Number.isNaN(wakeDate.getTime())) return 0;

  const actualMinutes = wakeDate.getHours() * 60 + wakeDate.getMinutes();
  return toClockMinutes(wakeUpGoal) - actualMinutes;
};

const pearsonCorrelation = (pairs: Array<{ x: number; y: number }>) => {
  if (pairs.length < 2) return 0;

  const meanX = average(pairs.map((pair) => pair.x));
  const meanY = average(pairs.map((pair) => pair.y));
  const numerator = pairs.reduce((total, pair) => total + (pair.x - meanX) * (pair.y - meanY), 0);
  const denominatorX = Math.sqrt(pairs.reduce((total, pair) => total + (pair.x - meanX) ** 2, 0));
  const denominatorY = Math.sqrt(pairs.reduce((total, pair) => total + (pair.y - meanY) ** 2, 0));

  if (!denominatorX || !denominatorY) return 0;
  return numerator / (denominatorX * denominatorY);
};

const describeCorrelation = (value: number) => {
  const magnitude = Math.abs(value);

  if (magnitude >= 0.65) return 'Strong';
  if (magnitude >= 0.35) return 'Moderate';
  if (magnitude >= 0.15) return 'Light';
  return 'Weak';
};

const describeDirection = (value: number, positiveText: string, negativeText: string) => {
  if (value >= 0.15) return positiveText;
  if (value <= -0.15) return negativeText;
  return 'No stable signal yet across your streak history.';
};

const formatSignedMinutes = (minutes: number) => {
  if (Math.abs(minutes) < 1) return 'about on target';
  return minutes > 0 ? `${Math.round(minutes)} min earlier` : `${Math.abs(Math.round(minutes))} min later`;
};

export const StreakCorrelationSection = ({
  logs,
  streakHistory,
  profile,
}: StreakCorrelationSectionProps) => {
  const streakDays = streakHistory
    .map((record) => {
      const log = logs.find((entry) => entry.date === record.date);
      if (!log || !profile) return null;

      const workoutTargetCount = profile.dailyTargets.workoutPlan.dailyChecklist.length;
      const workoutRatio = workoutTargetCount
        ? log.completedWorkoutTasks.length / workoutTargetCount
        : log.completedWorkoutTasks.length > 0
          ? 1
          : 0;

      return {
        date: record.date,
        streak: record.streak,
        studyHours: log.studyMinutes / 60,
        waterLiters: log.waterIntakeMl / 1000,
        workoutRatio,
        caloriesBurned: log.caloriesBurned,
        wakeLeadMinutes: getWakeLeadMinutes(log.wakeUpTime, profile.dailyTargets.wakeUpGoal),
      } satisfies StreakSample;
    })
    .filter(Boolean) as StreakSample[];

  if (!profile || streakDays.length < 2) {
    return (
      <CardShell>
        <p className="text-sm uppercase tracking-[0.24em] text-black">Streak Correlation</p>
        <div className="soft-surface mt-4 rounded-2xl px-4 py-4">
          <p className="text-sm text-black">
            Keep building streak days first. Once you have at least 2 logged streak checkpoints, this section will
            study the full streak history and show which habits are most connected to stronger streaks.
          </p>
        </div>
      </CardShell>
    );
  }

  const sortedByStreak = [...streakDays].sort((first, second) => first.streak - second.streak);
  const cohortSize = Math.max(1, Math.ceil(sortedByStreak.length / 3));
  const earlyStreakDays = sortedByStreak.slice(0, cohortSize);
  const longStreakDays = sortedByStreak.slice(-cohortSize);

  const metricCards: MetricCard[] = [
    {
      key: 'study',
      label: 'Study Depth',
      unit: 'h',
      icon: BookOpenText,
      correlation: pearsonCorrelation(streakDays.map((item) => ({ x: item.streak, y: item.studyHours }))),
      highAverage: average(longStreakDays.map((item) => item.studyHours)),
      lowAverage: average(earlyStreakDays.map((item) => item.studyHours)),
      description: 'Longer streaks usually grow with deeper study sessions.',
    },
    {
      key: 'water',
      label: 'Hydration',
      unit: 'L',
      icon: Droplets,
      correlation: pearsonCorrelation(streakDays.map((item) => ({ x: item.streak, y: item.waterLiters }))),
      highAverage: average(longStreakDays.map((item) => item.waterLiters)),
      lowAverage: average(earlyStreakDays.map((item) => item.waterLiters)),
      description: 'Hydration consistency often supports longer streak runs.',
    },
    {
      key: 'workout',
      label: 'Workout Completion',
      unit: '%',
      icon: Dumbbell,
      correlation: pearsonCorrelation(streakDays.map((item) => ({ x: item.streak, y: item.workoutRatio }))),
      highAverage: average(longStreakDays.map((item) => item.workoutRatio)) * 100,
      lowAverage: average(earlyStreakDays.map((item) => item.workoutRatio)) * 100,
      description: 'Workout completion helps show whether action consistency backs long streaks.',
    },
    {
      key: 'burn',
      label: 'Calories Burned',
      unit: 'kcal',
      icon: Flame,
      correlation: pearsonCorrelation(streakDays.map((item) => ({ x: item.streak, y: item.caloriesBurned }))),
      highAverage: average(longStreakDays.map((item) => item.caloriesBurned)),
      lowAverage: average(earlyStreakDays.map((item) => item.caloriesBurned)),
      description: 'Energy output can reveal how active you are on stronger streak days.',
    },
    {
      key: 'wake',
      label: 'Wake-Up Lead',
      unit: 'min',
      icon: AlarmClockCheck,
      correlation: pearsonCorrelation(streakDays.map((item) => ({ x: item.streak, y: item.wakeLeadMinutes }))),
      highAverage: average(longStreakDays.map((item) => item.wakeLeadMinutes)),
      lowAverage: average(earlyStreakDays.map((item) => item.wakeLeadMinutes)),
      description: 'Earlier wake-ups can be a quiet indicator of streak control.',
    },
  ];

  const strongestMetric = [...metricCards].sort(
    (first, second) => Math.abs(second.correlation) - Math.abs(first.correlation),
  )[0];
  const longestStreak = Math.max(...streakDays.map((item) => item.streak));
  const averageStreak = average(streakDays.map((item) => item.streak));
  const positiveLinks = metricCards.filter((item) => item.correlation >= 0.15).length;

  return (
    <CardShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-black">Streak Correlation</p>
          <h3 className="mt-2 font-display text-2xl text-black">Patterns learned from your full streak history</h3>
          <p className="muted-text mt-2 max-w-3xl text-sm">
            This section studies every saved streak checkpoint and compares habit intensity against streak length, so
            you can see which behaviors tend to show up when your streaks get stronger.
          </p>
        </div>

        <span className="rounded-full border border-orange-400/25 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-100">
          {streakDays.length} streak days analyzed
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="hero-glow rounded-[24px] border border-orange-400/20 bg-gradient-to-br from-white/80 via-orange-50/70 to-sky-50/60 px-4 py-4 dark:from-white/5 dark:via-orange-500/10 dark:to-sky-500/10">
          <div className="inline-flex rounded-2xl bg-blue-100 p-3 text-black">
            <Sparkles size={18} />
          </div>
          <p className="mt-4 text-sm uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/70">
            Strongest Link
          </p>
          <p className="mt-2 font-display text-2xl text-black">{strongestMetric.label}</p>
          <p className="mt-2 text-sm text-black/75 dark:text-orange-100/80">
            {describeCorrelation(strongestMetric.correlation)} correlation.{' '}
            {describeDirection(
              strongestMetric.correlation,
              strongestMetric.description,
              'Lower values on this metric tend to pair with stronger streaks.',
            )}
          </p>
        </div>

        <div className="soft-surface rounded-[24px] px-4 py-4">
          <div className="inline-flex rounded-2xl bg-blue-100 p-3 text-black">
            <TrendingUp size={18} />
          </div>
          <p className="mt-4 text-sm uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/70">
            Streak Stability
          </p>
          <p className="mt-2 font-display text-2xl text-black">{averageStreak.toFixed(1)} days avg</p>
          <p className="mt-2 text-sm text-black/75 dark:text-orange-100/80">
            Longest streak reached {longestStreak} days, with {positiveLinks} habit signals showing a meaningful
            upward link.
          </p>
        </div>

        <div className="soft-surface rounded-[24px] px-4 py-4">
          <div className="inline-flex rounded-2xl bg-blue-100 p-3 text-black">
            <AlarmClockCheck size={18} />
          </div>
          <p className="mt-4 text-sm uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/70">
            Wake Pattern
          </p>
          <p className="mt-2 font-display text-2xl text-black">
            {formatSignedMinutes(average(longStreakDays.map((item) => item.wakeLeadMinutes)))}
          </p>
          <p className="mt-2 text-sm text-black/75 dark:text-orange-100/80">
            On your longer streak days, your wake-up time trends {formatSignedMinutes(
              average(longStreakDays.map((item) => item.wakeLeadMinutes)),
            )} compared with the target.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          const strength = Math.round(Math.abs(metric.correlation) * 100);
          const delta = metric.highAverage - metric.lowAverage;

          return (
            <div key={metric.key} className="soft-surface rounded-[24px] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/65 text-black dark:bg-white/10 dark:text-orange-50">
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="font-semibold text-black">{metric.label}</p>
                    <p className="muted-text text-sm">{describeCorrelation(metric.correlation)} signal</p>
                  </div>
                </div>

                <span className="rounded-full border border-orange-400/25 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-100">
                  {metric.correlation >= 0 ? '+' : '-'}
                  {strength}%
                </span>
              </div>

              <div className="mt-4">
                <ProgressBar
                  value={strength}
                  colorClass="bg-gradient-to-r from-orange-500 via-amber-400 to-blue-500"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/40 bg-white/60 px-4 py-3 dark:border-orange-400/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/70">
                    Early Streak Avg
                  </p>
                  <p className="mt-2 text-lg font-semibold text-black">
                    {metric.unit === '%'
                      ? `${Math.round(metric.lowAverage)}${metric.unit}`
                      : metric.unit === 'min'
                        ? formatSignedMinutes(metric.lowAverage)
                        : `${metric.lowAverage.toFixed(1)} ${metric.unit}`}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/40 bg-white/60 px-4 py-3 dark:border-orange-400/10 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/70">
                    Long Streak Avg
                  </p>
                  <p className="mt-2 text-lg font-semibold text-black">
                    {metric.unit === '%'
                      ? `${Math.round(metric.highAverage)}${metric.unit}`
                      : metric.unit === 'min'
                        ? formatSignedMinutes(metric.highAverage)
                        : `${metric.highAverage.toFixed(1)} ${metric.unit}`}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm text-black/75 dark:text-orange-100/80">
                {metric.unit === 'min'
                  ? `Longer streaks trend with wake-ups that are ${formatSignedMinutes(delta)} relative to your earlier streak days.`
                  : `Longer streak days average ${delta >= 0 ? '+' : ''}${metric.unit === '%' ? Math.round(delta) : delta.toFixed(1)} ${metric.unit} versus your shorter streak days.`}
              </p>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
};
