import { useEffect, useMemo, useState } from 'react';
import { X, House, BarChart3, TrendingUp, Trophy, Bot, ScanSearch, UserCircle2, LogOut } from 'lucide-react';
import { AppTab } from '../types';
import { classNames } from '../lib/utils';
import { BrandLogo } from './BrandLogo';
import { useApp } from '../context/AppContext';

const items: Array<{ id: AppTab; label: string; icon: typeof House }> = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'progress', label: 'Progress', icon: BarChart3 },
  { id: 'correlation', label: 'Correlation', icon: TrendingUp },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'companion', label: 'AI Companion', icon: Bot },
  { id: 'scan', label: 'Scan Food', icon: ScanSearch },
  { id: 'profile', label: 'Profile', icon: UserCircle2 },
];

interface MobileNavDrawerProps {
  open: boolean;
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
}

export const MobileNavDrawer = ({ open, activeTab, onChange, onClose, userName, userEmail, onLogout }: MobileNavDrawerProps) => {
  const { markEasterEggFound } = useApp();
  const [avatarTapState, setAvatarTapState] = useState<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  const avatarLetter = useMemo(() => (userName || userEmail || 'O').slice(0, 1).toUpperCase(), [userEmail, userName]);

  return (
    <div
      className={classNames(
        'fixed inset-0 z-50 xl:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        className={classNames(
          'absolute inset-0 bg-black/35 backdrop-blur-[2px] transition-opacity duration-300 dark:bg-black/55',
          open ? 'opacity-100' : 'opacity-0',
        )}
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
      />

      <aside
        className={classNames(
          'glass absolute left-3 top-3 bottom-3 w-[min(360px,calc(100vw-1.5rem))] rounded-[32px] border border-white/60 shadow-card transition-transform duration-300 dark:border-orange-400/30',
          'pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
          open ? 'translate-x-0' : '-translate-x-[110%]',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex items-center justify-between px-5">
          <BrandLogo compact className="min-w-0" />
          <button
            type="button"
            onClick={onClose}
            className="btn-glow soft-surface panel-hover inline-flex h-11 w-11 items-center justify-center rounded-2xl text-black dark:text-orange-100"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {(userName || userEmail) ? (
          <div className="mt-5 px-5">
            <div className="flex items-center gap-3 rounded-[26px] border border-white/40 bg-white/60 px-4 py-3 shadow-inner dark:border-orange-400/10 dark:bg-white/5">
              <button
                type="button"
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 font-display text-lg text-black dark:bg-white/10 dark:text-orange-50"
                title="Profile avatar"
                onClick={() => {
                  setAvatarTapState((prev) => {
                    const now = Date.now();
                    const count = now - prev.lastAt > 2500 ? 1 : prev.count + 1;
                    if (count >= 5) {
                      markEasterEggFound('nav-avatar-taps');
                      return { count: 0, lastAt: 0 };
                    }
                    return { count, lastAt: now };
                  });
                }}
              >
                {avatarLetter}
              </button>
              <div className="min-w-0">
                {userName ? <p className="truncate font-display text-lg text-black dark:text-zinc-50">{userName}</p> : null}
                {userEmail ? <p className="muted-text mt-1 truncate text-xs uppercase tracking-[0.22em]">{userEmail}</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        <nav className="mt-5 space-y-2 px-5">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onChange(id);
                onClose();
              }}
              title={label}
              aria-label={label}
              className={classNames(
                'btn-glow panel-hover flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left text-sm font-semibold transition-all duration-300 active:scale-[0.99]',
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
              <span className="flex-1">{label}</span>
            </button>
          ))}
        </nav>

        {onLogout ? (
          <div className="mt-6 border-t border-white/40 px-5 pt-5 dark:border-orange-400/10">
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              title="Log out"
              aria-label="Log out"
              className="btn-glow panel-hover flex w-full items-center justify-between rounded-[22px] border border-white/50 bg-white/60 px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/70 active:scale-[0.99] dark:border-orange-400/20 dark:bg-white/5 dark:text-orange-50 dark:hover:bg-white/10"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut size={18} />
                Log out
              </span>
              <span className="muted-text text-xs uppercase tracking-[0.24em]">Session</span>
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
};
