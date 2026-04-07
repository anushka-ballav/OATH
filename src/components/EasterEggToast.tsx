import { useEffect } from 'react';
import { classNames } from '../lib/utils';

export const EasterEggToast = ({
  open,
  title,
  onClose,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => onClose(), 2200);
    return () => window.clearTimeout(timeout);
  }, [onClose, open]);

  return (
    <div
      className={classNames(
        'fixed inset-0 z-[60] flex items-center justify-center px-4',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <div
        className={classNames(
          'absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 dark:bg-black/55',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />

      <div
        className={classNames(
          'relative w-full max-w-sm rounded-[32px] border border-white/60 bg-white/80 p-5 shadow-card backdrop-blur-2xl transition-all duration-300 dark:border-orange-400/25 dark:bg-[#0f0f10]/75',
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-4">
          <div className="egg-crack" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/70 dark:text-orange-100/70">
              Easter Egg Found
            </p>
            <p className="mt-1 truncate font-display text-xl text-black dark:text-orange-50">{title}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

