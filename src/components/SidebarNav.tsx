import {
  BarChart3,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  House,
  LogOut,
  TrendingUp,
  ScanSearch,
  Trophy,
  UserCircle2,
  MoonStar,
  SunMedium,
} from 'lucide-react';
import { AppTab } from '../types';
import { classNames } from '../lib/utils';
import { BrandLogo } from './BrandLogo';

const items: Array<{ id: AppTab; label: string; icon: typeof House }> = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'correlation', label: 'Correlation', icon: TrendingUp },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'companion', label: 'AI Companion', icon: Bot },
  { id: 'scan', label: 'Scan Food', icon: ScanSearch },
  { id: 'profile', label: 'Profile', icon: UserCircle2 },
];

export const SidebarNav = ({
  activeTab,
  onChange,
  darkMode,
  onToggleDarkMode,
  collapsed,
  onToggleCollapsed,
  userName,
  userEmail,
  onLogout,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
}) => (
  <aside
    className={classNames(
      'glass sticky top-6 rounded-[32px] border border-white/60 shadow-card transition-[padding,width] duration-300 dark:border-orange-400/30',
      collapsed ? 'px-3 py-4' : 'p-5',
    )}
  >
    <div className={classNames('flex gap-3', collapsed ? 'flex-col items-center' : 'items-center justify-between')}>
      <BrandLogo compact={collapsed} iconOnly={collapsed} className={collapsed ? 'mx-auto' : ''} />
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="btn-glow soft-surface panel-hover inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-black dark:text-orange-100"
        aria-label={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
    </div>

    {(userName || userEmail) && !collapsed ? (
      <div className="mt-4 rounded-[26px] border border-white/40 bg-white/60 px-4 py-3 shadow-inner dark:border-orange-400/10 dark:bg-white/5">
        {userName ? (
          <p className="truncate font-display text-lg text-black dark:text-zinc-50">{userName}</p>
        ) : null}
        {userEmail ? (
          <p className="muted-text mt-1 truncate text-xs uppercase tracking-[0.22em]">{userEmail}</p>
        ) : null}
      </div>
    ) : null}

    {(userName || userEmail) && collapsed ? (
      <div className="mt-4 flex justify-center">
        <div
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-white/60 font-display text-lg text-black shadow-inner dark:border-orange-400/10 dark:bg-white/5 dark:text-orange-50"
          title={userName || userEmail}
        >
          {(userName || userEmail || 'O').slice(0, 1).toUpperCase()}
        </div>
      </div>
    ) : null}

    <nav className={classNames('mt-5 space-y-2', collapsed ? 'flex flex-col items-center' : '')}>
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          title={label}
          aria-label={label}
          className={classNames(
            'btn-glow panel-hover flex items-center rounded-[22px] text-left text-sm font-semibold transition-all duration-300 active:scale-[0.99]',
            collapsed ? 'w-14 justify-center px-0 py-3' : 'w-full gap-3 px-4 py-3',
            activeTab === id
              ? 'bg-gradient-to-r from-orange-500/90 to-amber-400/80 text-white shadow-[0_18px_40px_rgba(249,115,22,0.25)]'
              : 'text-black hover:bg-white/70 dark:text-zinc-100 dark:hover:bg-orange-500/10',
          )}
        >
          <span
            className={classNames(
              'inline-flex h-10 w-10 items-center justify-center rounded-2xl',
              activeTab === id ? 'bg-white/10 text-white' : 'soft-surface text-orange-200/90',
            )}
          >
            <Icon size={18} />
          </span>
          {!collapsed ? <span className="flex-1">{label}</span> : null}
        </button>
      ))}
    </nav>

    <div className="mt-6 border-t border-white/40 pt-5 dark:border-orange-400/10">
      <button
        type="button"
        onClick={onToggleDarkMode}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        className={classNames(
          'btn-glow soft-surface panel-hover flex w-full rounded-[22px] text-sm font-semibold text-black active:scale-[0.99] dark:text-orange-100',
          collapsed ? 'justify-center px-0 py-3' : 'items-center justify-between px-4 py-3',
        )}
      >
        <span className="inline-flex items-center gap-2">
          {darkMode ? <SunMedium size={18} /> : <MoonStar size={18} />}
          {!collapsed ? (darkMode ? 'Light mode' : 'Dark mode') : null}
        </span>
        {!collapsed ? <span className="muted-text text-xs uppercase tracking-[0.24em]">Theme</span> : null}
      </button>

      {onLogout ? (
        <button
          type="button"
          onClick={onLogout}
          title="Log out"
          aria-label="Log out"
          className={classNames(
            'btn-glow mt-3 flex w-full rounded-[22px] border border-white/50 bg-white/60 text-sm font-semibold text-black transition hover:bg-white/70 active:scale-[0.99] dark:border-orange-400/20 dark:bg-white/5 dark:text-orange-50 dark:hover:bg-white/10',
            collapsed ? 'justify-center px-0 py-3' : 'items-center justify-between px-4 py-3',
          )}
        >
          <span className="inline-flex items-center gap-2">
            <LogOut size={18} />
            {!collapsed ? 'Log out' : null}
          </span>
          {!collapsed ? <span className="muted-text text-xs uppercase tracking-[0.24em]">Session</span> : null}
        </button>
      ) : null}
    </div>
  </aside>
);
