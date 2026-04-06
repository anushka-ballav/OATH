import { CupSoda } from 'lucide-react';
import { UserProfile } from '../types';
import { percent } from '../lib/utils';
import { CardShell } from './CardShell';
import { ProgressBar } from './ProgressBar';

interface WaterTrackerCardProps {
  currentMl: number;
  profile: UserProfile;
  onAdd: (amount: number) => Promise<void>;
}

export const WaterTrackerCard = ({ currentMl, profile, onAdd }: WaterTrackerCardProps) => (
  <CardShell className="relative overflow-hidden rounded-[28px] border border-orange-400/20 bg-transparent">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-black">Water Intake</p>
        <h3 className="mt-2 font-display text-3xl">
          {(currentMl / 1000).toFixed(1)}L <span className="muted-text text-base">/ {profile.dailyTargets.waterLiters.toFixed(1)}L</span>
        </h3>
      </div>
      <div className="soft-surface inline-flex h-12 w-12 items-center justify-center rounded-2xl text-sky-300">
        <CupSoda size={18} />
      </div>
    </div>

    <p className="muted-text mt-3 text-sm">Hydration balance</p>
    <div className="mt-4">
      <ProgressBar value={percent(currentMl, profile.dailyTargets.waterLiters * 1000)} colorClass="bg-sky-500" />
    </div>

    <div className="mt-4 flex items-center gap-1.5">
      {Array.from({ length: 10 }, (_, index) => {
        const blocks = 10;
        const filled = Math.round((percent(currentMl, profile.dailyTargets.waterLiters * 1000) / 100) * blocks);
        const active = index < filled;
        return (
          <span
            key={index}
            className={`h-3 flex-1 rounded-full ${active ? 'bg-sky-500' : 'bg-white/10 dark:bg-white/10'}`}
          />
        );
      })}
    </div>

    <div className="mt-4 flex gap-3">
      <button
        type="button"
        onClick={() => void onAdd(250)}
        className="btn-glow flex-1 rounded-2xl border border-orange-400/25 bg-transparent px-4 py-3 font-semibold text-black transition hover:bg-white/5 active:scale-[0.99] dark:text-orange-100"
      >
        +250ml
      </button>
      <button
        type="button"
        onClick={() => void onAdd(500)}
        className="btn-glow flex-1 rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-black transition hover:bg-sky-400 active:scale-[0.99]"
      >
        +500ml
      </button>
    </div>
  </CardShell>
);
