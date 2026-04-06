import { PropsWithChildren } from 'react';
import { classNames } from '../lib/utils';

interface CardShellProps extends PropsWithChildren {
  className?: string;
}

export const CardShell = ({ children, className }: CardShellProps) => (
  <section
    className={classNames(
      'glass panel-hover page-enter rounded-[28px] border border-blue-100 p-5 text-black shadow-card dark:border-orange-400/30 dark:text-zinc-50',
      className,
    )}
  >
    {children}
  </section>
);
