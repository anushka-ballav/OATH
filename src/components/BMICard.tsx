import { useMemo, useState } from 'react';
import { Activity, Scale, Ruler, Weight } from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BMIEntry } from '../types';
import { CardShell } from './CardShell';
import { ProgressBar } from './ProgressBar';
import { classNames } from '../lib/utils';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const computeBmi = (heightCm: number, weightKg: number) => {
  const heightM = Math.max(0.5, heightCm / 100);
  const bmi = weightKg > 0 ? weightKg / (heightM * heightM) : 0;

  const category =
    bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';

  return {
    bmi: Math.round(bmi * 10) / 10,
    category,
  } as const;
};

const categoryStyle = (category: BMIEntry['category'] | 'Underweight' | 'Normal' | 'Overweight' | 'Obese') => {
  switch (category) {
    case 'Underweight':
      return {
        pill: 'bg-blue-500/15 text-blue-200',
        bar: 'bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400',
      };
    case 'Normal':
      return {
        pill: 'bg-emerald-500/15 text-emerald-200',
        bar: 'bg-gradient-to-r from-emerald-500 via-lime-400 to-amber-400',
      };
    case 'Overweight':
      return {
        pill: 'bg-amber-500/15 text-amber-200',
        bar: 'bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400',
      };
    case 'Obese':
    default:
      return {
        pill: 'bg-rose-500/15 text-rose-200',
        bar: 'bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400',
      };
  }
};

export const BMICard = ({
  heightCm,
  weightKg,
  history,
  onRecord,
}: {
  heightCm: number;
  weightKg: number;
  history: BMIEntry[];
  onRecord: (heightCm: number, weightKg: number) => Promise<void>;
}) => {
  const [saving, setSaving] = useState(false);
  const computed = useMemo(() => computeBmi(heightCm, weightKg), [heightCm, weightKg]);

  const styles = categoryStyle(computed.category);

  const bmiPercent = useMemo(() => {
    const min = 15;
    const max = 35;
    const pct = clamp01((computed.bmi - min) / (max - min)) * 100;
    return Math.round(pct);
  }, [computed.bmi]);

  const chartData = useMemo(() => {
    const items = (history || []).slice(0, 10).reverse();
    return items.map((entry) => ({
      label: new Date(entry.measuredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      bmi: entry.bmi,
    }));
  }, [history]);

  const handleRecord = async () => {
    setSaving(true);
    try {
      await onRecord(heightCm, weightKg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardShell className="relative overflow-hidden rounded-[28px] border border-orange-400/20 bg-transparent">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-black dark:text-orange-100">BMI</p>
          <h3 className="mt-2 font-display text-2xl text-black dark:text-zinc-50">Body Mass Index</h3>
          <p className="muted-text mt-2 text-sm">Track your BMI trend as your routine improves.</p>
        </div>
        <div className="soft-surface inline-flex h-12 w-12 items-center justify-center rounded-2xl text-orange-400">
          <Scale size={18} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="soft-surface flex items-center justify-between rounded-2xl px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-black dark:text-orange-100">
            <Ruler size={16} />
            Height
          </span>
          <span className="font-display text-lg text-black dark:text-zinc-50">{heightCm} cm</span>
        </div>
        <div className="soft-surface flex items-center justify-between rounded-2xl px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-black dark:text-orange-100">
            <Weight size={16} />
            Weight
          </span>
          <span className="font-display text-lg text-black dark:text-zinc-50">{weightKg} kg</span>
        </div>
        <p className="muted-text sm:col-span-2 text-sm">
          Synced from your Profile. Update height or weight there and BMI updates automatically.
        </p>
      </div>

      <div className="mt-5 rounded-3xl border border-orange-400/10 bg-white/60 p-4 shadow-inner dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-black/60 dark:text-orange-100/70">Current BMI</p>
            <p className="mt-2 font-display text-4xl text-black dark:text-zinc-50">{computed.bmi || '--'}</p>
          </div>
          <div
            className={classNames(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold',
              styles.pill,
            )}
          >
            <Activity size={16} />
            {computed.category}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-black/70 dark:text-orange-100/70">
            <span>15</span>
            <span>35+</span>
          </div>
          <ProgressBar value={bmiPercent} colorClass={styles.bar} />
        </div>

        <button
          type="button"
          onClick={() => void handleRecord()}
          disabled={saving || !computed.bmi}
          className="btn-glow mt-4 w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-600 active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save BMI entry'}
        </button>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.24em] text-black dark:text-orange-100">History</p>
          <p className="muted-text text-sm">{history?.length ? `${history.length} entries` : 'No entries yet'}</p>
        </div>

        <div className="h-44 rounded-3xl border border-orange-400/10 bg-white/60 p-3 shadow-inner dark:bg-white/5">
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="label" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} />
                <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="bmi"
                  stroke="#fb923c"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-black/70 dark:text-orange-100/70">
              Add 2 BMI entries to see your trend.
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
};
