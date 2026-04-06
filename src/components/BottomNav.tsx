import { BarChart3, Bot, House, ScanSearch, Trophy, UserCircle2 } from 'lucide-react';
import { AppTab } from '../types';
import { classNames } from '../lib/utils';

const items: Array<{ id: AppTab; label: string; mobileLabel: string; icon: typeof House }> = [
  { id: 'home', label: 'Home', mobileLabel: 'Home', icon: House },
  { id: 'progress', label: 'Progress', mobileLabel: 'Stats', icon: BarChart3 },
  { id: 'leaderboard', label: 'Leaderboard', mobileLabel: 'League', icon: Trophy },
  { id: 'companion', label: 'AI Companion', mobileLabel: 'Coach', icon: Bot },
  { id: 'scan', label: 'Scan Food', mobileLabel: 'Scan', icon: ScanSearch },
  { id: 'profile', label: 'Profile', mobileLabel: 'You', icon: UserCircle2 },
];

interface BottomNavProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}

export const BottomNav = ({ activeTab, onChange }: BottomNavProps) => (
  <nav
    className="glass fixed inset-x-3 bottom-3 z-30 grid grid-cols-6 gap-1 rounded-[28px] border border-white/60 p-1.5 shadow-card dark:border-orange-400/30 sm:left-1/2 sm:right-auto sm:flex sm:w-[calc(100%-2rem)] sm:max-w-4xl sm:-translate-x-1/2 sm:items-center sm:gap-1 sm:p-2"
    style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
  >
    {items.map(({ id, label, mobileLabel, icon: Icon }) => (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        className={classNames(
          'btn-glow flex min-w-0 flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-2 text-[9px] font-medium leading-tight transition-all duration-300 active:scale-[0.98] sm:min-w-[82px] sm:flex-1 sm:rounded-[24px] sm:px-3 sm:text-[11px]',
          activeTab === id
            ? 'bg-gradient-to-r from-orange-500/90 to-amber-400/80 text-white shadow-[0_16px_32px_rgba(249,115,22,0.28)]'
            : 'text-black hover:bg-white/60 dark:text-zinc-100 dark:hover:bg-orange-500/10',
        )}
      >
        <Icon size={17} className="sm:h-[18px] sm:w-[18px]" />
        <span className="max-w-full truncate sm:hidden">{mobileLabel}</span>
        <span className="hidden max-w-full truncate sm:inline">{label}</span>
      </button>
    ))}
  </nav>
);
