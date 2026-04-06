import { TrendingUp } from 'lucide-react';
import { CardShell } from '../components/CardShell';
import { StreakCorrelationSection } from '../components/StreakCorrelationSection';
import { useApp } from '../context/AppContext';

export const CorrelationPage = () => {
  const { logs, streakHistory, profile } = useApp();

  return (
    <div className="space-y-5 pb-24">
      <header className="glass hero-glow rounded-[32px] border border-orange-400/20 p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-blue-100 p-3 text-black">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Correlation Lab</p>
            <h1 className="mt-2 font-display text-3xl text-black">Habit correlation with streak growth</h1>
            <p className="muted-text mt-2 max-w-3xl text-sm">
              This page studies your saved streak history and compares it with study time, hydration, workout
              completion, calories burned, and wake-up timing to surface the habits most connected to stronger runs.
            </p>
          </div>
        </div>
      </header>

      <CardShell>
        <p className="text-sm uppercase tracking-[0.24em] text-black">How To Read It</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="soft-surface rounded-2xl px-4 py-4">
            <p className="font-semibold text-black">Positive signal</p>
            <p className="muted-text mt-2 text-sm">
              Higher values on that habit tend to show up on longer streak days.
            </p>
          </div>
          <div className="soft-surface rounded-2xl px-4 py-4">
            <p className="font-semibold text-black">Negative signal</p>
            <p className="muted-text mt-2 text-sm">
              Lower values on that habit tend to pair with longer streak days.
            </p>
          </div>
          <div className="soft-surface rounded-2xl px-4 py-4">
            <p className="font-semibold text-black">Weak signal</p>
            <p className="muted-text mt-2 text-sm">
              Your saved history does not show a stable pattern yet, so more data will help.
            </p>
          </div>
        </div>
      </CardShell>

      <StreakCorrelationSection logs={logs} streakHistory={streakHistory} profile={profile} />
    </div>
  );
};
