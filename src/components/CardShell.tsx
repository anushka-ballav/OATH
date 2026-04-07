import { PropsWithChildren } from 'react';
import { classNames } from '../lib/utils';

interface CardShellProps extends PropsWithChildren {
  className?: string;
}

export const CardShell = ({ children, className }: CardShellProps) => (
  <section
    className={classNames(
      'glass panel-hover fly-enter rounded-[24px] border border-blue-100 p-4 text-black shadow-card dark:border-orange-400/30 dark:text-zinc-50 sm:rounded-[28px] sm:p-5',
      className,
    )}
  >
    {children}
  </section>
);
