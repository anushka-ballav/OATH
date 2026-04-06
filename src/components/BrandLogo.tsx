import { classNames } from '../lib/utils';

interface BrandLogoProps {
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export const BrandLogo = ({ compact = false, iconOnly = false, className }: BrandLogoProps) => (
  <div className={classNames('inline-flex items-center gap-3', className)}>
    <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-400 to-blue-500 text-white shadow-[0_16px_32px_rgba(249,115,22,0.28)] sm:h-12 sm:w-12">
      <div className="absolute inset-[1px] rounded-2xl bg-black/10" />
      <span className="relative font-display text-base tracking-[0.22em] sm:text-lg">O</span>
    </div>
    {!iconOnly ? (
      <div className="min-w-0">
        <p className="font-display text-xl leading-none tracking-[0.28em] text-black dark:text-orange-50 sm:text-2xl sm:tracking-[0.32em]">
          OATH
        </p>
        {!compact ? (
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-black/70 dark:text-orange-100/70 sm:text-xs sm:tracking-[0.22em]">
            Discipline AI Tracker
          </p>
        ) : null}
      </div>
    ) : null}
  </div>
);
