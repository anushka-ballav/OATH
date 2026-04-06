import { MacroTargets } from '../types';
import { ProgressBar } from './ProgressBar';
import { classNames } from '../lib/utils';

type MacroTotals = {
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  fiberG: number;
  sodiumMg: number;
};

type MacroCardConfig = {
  key: keyof MacroTotals;
  label: string;
  icon: string;
  unit: 'g' | 'mg';
  gradient: string;
  bar: string;
  goalLabel: string;
  getGoalValue: (targets: MacroTargets) => number;
  kind: 'target' | 'max' | 'min';
};

const cards: MacroCardConfig[] = [
  {
    key: 'proteinG',
    label: 'Protein',
    icon: '🥩',
    unit: 'g',
    gradient: 'from-rose-500/22 via-orange-500/14 to-amber-300/10',
    bar: 'bg-gradient-to-r from-rose-500 via-orange-500 to-amber-300',
    goalLabel: 'goal',
    getGoalValue: (targets) => targets.proteinG,
    kind: 'target',
  },
  {
    key: 'carbsG',
    label: 'Carbs',
    icon: '🍞',
    unit: 'g',
    gradient: 'from-amber-400/24 via-orange-500/14 to-amber-200/10',
    bar: 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-200',
    goalLabel: 'goal',
    getGoalValue: (targets) => targets.carbsG,
    kind: 'target',
  },
  {
    key: 'fatG',
    label: 'Fat',
    icon: '🥑',
    unit: 'g',
    gradient: 'from-fuchsia-500/18 via-purple-500/16 to-pink-400/12',
    bar: 'bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-400',
    goalLabel: 'goal',
    getGoalValue: (targets) => targets.fatG,
    kind: 'target',
  },
  {
    key: 'sugarG',
    label: 'Sugar',
    icon: '🍬',
    unit: 'g',
    gradient: 'from-pink-500/20 via-rose-500/14 to-fuchsia-400/10',
    bar: 'bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-400',
    goalLabel: 'max',
    getGoalValue: (targets) => targets.sugarMaxG,
    kind: 'max',
  },
  {
    key: 'fiberG',
    label: 'Fiber',
    icon: '🥦',
    unit: 'g',
    gradient: 'from-emerald-500/18 via-green-400/14 to-lime-300/10',
    bar: 'bg-gradient-to-r from-emerald-500 via-green-400 to-lime-300',
    goalLabel: 'min',
    getGoalValue: (targets) => targets.fiberMinG,
    kind: 'min',
  },
  {
    key: 'sodiumMg',
    label: 'Sodium',
    icon: '🧂',
    unit: 'mg',
    gradient: 'from-sky-500/22 via-blue-500/16 to-cyan-400/12',
    bar: 'bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-400',
    goalLabel: 'max',
    getGoalValue: (targets) => targets.sodiumMaxMg,
    kind: 'max',
  },
];

const formatValue = (value: number, unit: 'g' | 'mg') => {
  if (!Number.isFinite(value)) return '0';
  if (unit === 'mg') return String(Math.round(value));
  return String(Math.round(value));
};

const cardDelay = (index: number) => ({
  ['--enter-delay' as any]: `calc(var(--enter-base, 0ms) + ${120 + index * 70}ms)`,
});

export const MacroGrid = ({
  totals,
  targets,
  className,
}: {
  totals: MacroTotals;
  targets: MacroTargets;
  className?: string;
}) => (
  <div className={classNames('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
    {cards.map((card, index) => {
      const goal = card.getGoalValue(targets);
      const current = totals[card.key] ?? 0;
      const rawPct = goal ? Math.round((current / goal) * 100) : 0;
      const pct = Math.max(0, Math.min(100, rawPct));

      const isOverMax = card.kind === 'max' && rawPct > 100;
      const isUnderMin = card.kind === 'min' && rawPct < 100;

      return (
        <div
          key={card.key}
          className={classNames(
            'panel-hover page-enter relative overflow-hidden rounded-[26px] border border-white/10 bg-white/5 p-4 text-black backdrop-blur-xl dark:text-orange-50',
            'shadow-[0_18px_60px_rgba(0,0,0,0.35)]',
          )}
          style={cardDelay(index)}
        >
          <div className={classNames('absolute inset-0 bg-gradient-to-br opacity-100', card.gradient)} />
          <div className="absolute -right-3 -top-4 text-6xl opacity-[0.16] blur-[0.2px]">
            <span className="floaty-slow">{card.icon}</span>
          </div>

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl text-black/80 dark:bg-white/10 dark:text-orange-50">
                  {card.icon}
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-black/70 dark:text-orange-100/70">
                  {card.label}
                </p>
              </div>
              <p className="mt-3 font-display text-xl sm:text-2xl">
                {formatValue(current, card.unit)}
                {card.unit}
                <span className="mx-1 opacity-70">/</span>
                {formatValue(goal, card.unit)}
                {card.unit}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.22em] text-black/60 dark:text-orange-100/60">
                <span>consumed</span>
                <span>{card.goalLabel}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span
                className={classNames(
                  'rounded-full border px-2.5 py-1 text-xs font-semibold',
                  isOverMax ? 'border-red-400/40 bg-red-500/15 text-red-100' : 'border-white/15 bg-white/10 text-black dark:text-orange-100',
                )}
              >
                {rawPct}%
              </span>
              {card.kind !== 'target' ? (
                <span className="text-[11px] font-semibold text-black/60 dark:text-orange-100/60">
                  {isOverMax ? 'over limit' : isUnderMin ? 'below goal' : 'on track'}
                </span>
              ) : null}
            </div>
          </div>

          <div className="relative mt-4">
            <ProgressBar value={pct} colorClass={card.bar} />
          </div>
        </div>
      );
    })}
  </div>
);
