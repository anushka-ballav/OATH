interface StreakBadgeProps {
  streak: number;
}

export const StreakBadge = ({ streak }: StreakBadgeProps) => (
  <div className="hero-glow page-enter relative overflow-hidden rounded-[28px] border border-orange-200/70 bg-gradient-to-br from-orange-50 via-white to-amber-100 px-5 py-5 text-black shadow-card dark:border-orange-400/25 dark:from-[#17100a] dark:via-[#100d0a] dark:to-[#1f1208] dark:text-orange-50">
    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-orange-200/50 dark:bg-orange-500/15" />
    <p className="text-sm uppercase tracking-[0.24em] text-black dark:text-orange-200">Current Streak</p>
    <div className="mt-2 flex items-end gap-2">
      <span className="font-display text-4xl">{streak}</span>
      <span className="pb-1 text-sm text-black dark:text-orange-100">days</span>
    </div>
    <p className="mt-3 text-sm text-black/75 dark:text-orange-100/80">
      {streak > 0 ? 'Keep the momentum going with one clean day at a time.' : 'Start strong today and lock in your first streak.'}
    </p>
  </div>
);
