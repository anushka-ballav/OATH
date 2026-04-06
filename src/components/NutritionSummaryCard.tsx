import { useEffect, useMemo, useState } from 'react';
import { DailyLog, UserProfile } from '../types';
import { CardShell } from './CardShell';
import { MacroGrid } from './MacroGrid';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const ringDelay = (index: number) => ({
  ['--enter-delay' as any]: `calc(var(--enter-base, 0ms) + ${120 + index * 70}ms)`,
});

const RadialRing = ({
  label,
  value,
  gradientStops,
  delayIndex = 0,
}: {
  label: string;
  value: number;
  gradientStops: [string, string, string?];
  delayIndex?: number;
}) => {
  const size = 64;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const [renderValue, setRenderValue] = useState(0);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setRenderValue(value));
    return () => window.cancelAnimationFrame(id);
  }, [value]);

  const safeValue = Math.max(0, Math.min(100, renderValue));
  const dashOffset = circumference * (1 - safeValue / 100);
  const gradientId = `okra-ring-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const [start, mid, end] = gradientStops;

  return (
    <div className="page-enter flex flex-col items-center gap-2" style={ringDelay(delayIndex)}>
      <div className="relative grid place-items-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={start} stopOpacity="1" />
              <stop offset="55%" stopColor={mid} stopOpacity="1" />
              <stop offset="100%" stopColor={end ?? mid} stopOpacity="1" />
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
        </svg>
        <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-black dark:text-orange-50">
          {Math.round(safeValue)}%
        </div>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/60 dark:text-orange-100/70">
        {label}
      </p>
    </div>
  );
};

export const NutritionSummaryCard = ({
  profile,
  log,
  goalCompletionPercent,
}: {
  profile: UserProfile;
  log: DailyLog;
  goalCompletionPercent: number;
}) => {
  const macroTotals = useMemo(
    () =>
      log.foodEntries.reduce(
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
      ),
    [log.foodEntries],
  );

  const remainingCalories = Math.max(0, profile.dailyTargets.calories - log.caloriesConsumed);
  const caloriesPercent = clamp01(log.caloriesConsumed / Math.max(1, profile.dailyTargets.calories)) * 100;
  const waterPercent =
    clamp01(log.waterIntakeMl / Math.max(1, profile.dailyTargets.waterLiters * 1000)) * 100;
  const safeGoalPercent = clamp01(goalCompletionPercent / 100) * 100;

  return (
    <CardShell className="hero-glow relative overflow-hidden rounded-[32px] border border-orange-400/20 bg-transparent">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 via-fuchsia-500/6 to-sky-500/8" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-black/70 dark:text-orange-200/80">
            Today&apos;s nutrition
          </p>
          <h2 className="mt-3 flex flex-wrap items-baseline gap-3 font-display text-5xl sm:text-6xl">
            {Math.round(log.caloriesConsumed)} <span className="text-xl opacity-70">kcal</span>
          </h2>
          <p className="muted-text mt-3 text-sm">{remainingCalories} kcal remaining for the day.</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <RadialRing
            label="Goals"
            value={safeGoalPercent}
            gradientStops={['#f97316', '#fbbf24', '#60a5fa']}
            delayIndex={0}
          />
          <RadialRing
            label="Water"
            value={waterPercent}
            gradientStops={['#38bdf8', '#60a5fa', '#22d3ee']}
            delayIndex={1}
          />
          <RadialRing
            label="Calories"
            value={caloriesPercent}
            gradientStops={['#a855f7', '#f97316', '#fbbf24']}
            delayIndex={2}
          />
        </div>
      </div>

      <div className="relative mt-7">
        <MacroGrid totals={macroTotals} targets={profile.dailyTargets.macroTargets} />
      </div>
    </CardShell>
  );
};
