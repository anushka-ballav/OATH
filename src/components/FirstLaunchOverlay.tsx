import { useEffect, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { classNames } from '../lib/utils';

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const FirstLaunchOverlay = ({
  open,
  name,
  onDone,
}: {
  open: boolean;
  name: string;
  onDone: () => void;
}) => {
  const greeting = useMemo(() => getGreeting(), []);
  const safeName = name?.trim() || 'there';

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => onDone(), 10_000);
    return () => window.clearTimeout(timeout);
  }, [onDone, open]);

  return (
    <div
      className={classNames(
        'fixed inset-0 z-[80] flex items-center justify-center px-4',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        className={classNames(
          'absolute inset-0 bg-black/10 transition-opacity duration-500 dark:bg-black/35',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        className={classNames(
          'relative w-full max-w-md overflow-hidden rounded-[36px] border border-white/60 bg-white/70 p-6 shadow-card backdrop-blur-xl transition-all duration-500 dark:border-orange-400/25 dark:bg-[#0f0f10]/62',
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        role="status"
        aria-live="polite"
      >
        <div className="absolute inset-0 bg-white/30 dark:bg-black/15" />

        <div className="relative flex items-start gap-4">
          <div className="soft-surface inline-flex h-12 w-12 items-center justify-center rounded-2xl text-black dark:text-orange-50">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/70 dark:text-orange-100/70">
              {greeting}, {safeName}
            </p>
            <p className="mt-2 font-display text-2xl text-black dark:text-orange-50">Tailoring OATH for you</p>
            <p className="muted-text mt-2 text-sm">
              Setting up your goals, streaks, and arena - watch your dashboard cards fly in behind this.
            </p>
          </div>
        </div>

        <div className="relative mt-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className="intro-progress h-full w-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-sky-500" />
          </div>
          <p className="muted-text mt-3 text-xs uppercase tracking-[0.22em]">Tailoring your experience...</p>
        </div>
      </div>
    </div>
  );
};
