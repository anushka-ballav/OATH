import { useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { classNames } from '../lib/utils';

export const AchievementToast = ({
  open,
  title,
  subtitle,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => onClose(), 2600);
    return () => window.clearTimeout(timeout);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    try {
      navigator.vibrate?.(18);
    } catch {
      // ignore
    }
  }, [open]);

  return (
    <div
      className={classNames(
        'fixed inset-0 z-[70] flex items-center justify-center px-4',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        className={classNames(
          'absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity duration-300 dark:bg-black/60',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />

      <div
        className={classNames(
          'celebrate-confetti absolute inset-0',
          open ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      />

      <div
        className={classNames(
          'relative w-full max-w-sm overflow-hidden rounded-[34px] border border-white/60 bg-white/85 p-6 shadow-card backdrop-blur-2xl transition-all duration-300 dark:border-orange-400/25 dark:bg-[#0f0f10]/75',
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        role="status"
        aria-live="polite"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-fuchsia-500/8 to-sky-500/10" />
        <div className="relative flex items-start gap-4">
          <div className="soft-surface inline-flex h-12 w-12 items-center justify-center rounded-2xl text-black dark:text-orange-50">
            <Trophy size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/70 dark:text-orange-100/70">
              Achievement Unlocked
            </p>
            <p className="mt-1 truncate font-display text-2xl text-black dark:text-orange-50">{title}</p>
            {subtitle ? <p className="muted-text mt-2 text-sm">{subtitle}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

