import { useEffect, useState } from 'react';
import { classNames } from '../lib/utils';

interface ProgressBarProps {
  value: number;
  colorClass?: string;
}

export const ProgressBar = ({ value, colorClass = 'bg-moss' }: ProgressBarProps) => {
  const [renderValue, setRenderValue] = useState(0);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setRenderValue(value));
    return () => window.cancelAnimationFrame(id);
  }, [value]);

  const normalized = Math.max(0, Math.min(100, renderValue));
  const width = normalized === 0 ? 0 : Math.max(6, normalized);

  return (
    <div className="progress-glow h-3 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
      <div
        className={classNames(
          'progress-fill-3d relative h-full rounded-full shadow-[0_0_22px_rgba(249,115,22,0.22)] transition-[width,transform] duration-700 ease-out',
          colorClass,
        )}
        style={{ width: `${width}%` }}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/35 to-white/0 opacity-70" />
      </div>
    </div>
  );
};
