import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import { BrandLogo } from './components/BrandLogo';
import { FirstLaunchOverlay } from './components/FirstLaunchOverlay';
import { EasterEggToast } from './components/EasterEggToast';
import { AchievementToast } from './components/AchievementToast';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { MobileNavDrawer } from './components/MobileNavDrawer';
import { OTPLoginForm } from './components/OTPLoginForm';
import { OnboardingForm } from './components/OnboardingForm';
import { SidebarNav } from './components/SidebarNav';
import { useApp } from './context/AppContext';
import { AppTab } from './types';
import { HomePage } from './pages/HomePage';
import { ProgressPage } from './pages/ProgressPage';
import { CorrelationPage } from './pages/CorrelationPage';
import { ProfilePage } from './pages/ProfilePage';
import { ScanFoodPage } from './pages/ScanFoodPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { AICompanionPage } from './pages/AICompanionPage';
import { classNames } from './lib/utils';

const getInitialTab = (): AppTab => {
  const params = new URLSearchParams(window.location.search);
  return params.get('invite') ? 'leaderboard' : 'home';
};

const SIDEBAR_COLLAPSED_KEY = 'oath-sidebar-collapsed';
const FIRST_LAUNCH_KEY_PREFIX = 'oath-first-launch-done-';
const LEGACY_FIRST_LAUNCH_KEY = 'oath-first-launch-done';

const getFirstLaunchKey = (userId: string) => `${FIRST_LAUNCH_KEY_PREFIX}${userId}`;

const readViewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const scrollPageToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

const getViewportShellMetrics = (viewportWidth: number, viewportHeight: number, collapsed: boolean) => {
  const safeWidth = Math.max(360, viewportWidth);
  const safeHeight = Math.max(640, viewportHeight);
  const horizontalGutter = safeWidth >= 1800 ? 40 : safeWidth >= 1536 ? 32 : safeWidth >= 1280 ? 24 : 0;
  const maxWidth = Math.min(2200, Math.max(0, safeWidth - horizontalGutter * 2));
  const sidebarWidth = collapsed ? 108 : Math.min(360, Math.max(280, Math.round(maxWidth * 0.18)));
  const gridGap = safeWidth >= 1800 ? 36 : safeWidth >= 1536 ? 32 : 24;
  const contentMinHeight = Math.max(720, safeHeight - (safeWidth >= 1536 ? 48 : 32));

  return {
    maxWidth,
    sidebarWidth,
    gridGap,
    contentMinHeight,
  };
};

const App = () => {
  const {
    isReady,
    session,
    profile,
    login,
    completeOnboarding,
    logout,
    markEasterEggFound,
    lastEasterEggFound,
    clearLastEasterEggFound,
    lastAchievementUnlocked,
    clearLastAchievementUnlocked,
  } = useApp();
  const [tab, setTab] = useState<AppTab>(() => getInitialTab());
  const [viewport, setViewport] = useState(() => readViewport());
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [swipeProfilePhase, setSwipeProfilePhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [profileSwipeTopResetKey, setProfileSwipeTopResetKey] = useState(0);
  const [logoTapState, setLogoTapState] = useState<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });
  const [showFirstLaunch, setShowFirstLaunch] = useState(false);
  const [launchAnimationKey, setLaunchAnimationKey] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;

      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore storage errors and keep the UI responsive.
      }

      return next;
    });
  };

  useEffect(() => {
    const handleResize = () => {
      setViewport(readViewport());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isReady || !session || !profile) return;

    try {
      const done = window.localStorage.getItem(getFirstLaunchKey(session.userId)) === 'true';
      if (!done) {
        setTab('home');
        setLaunchAnimationKey((prev) => prev + 1);
        setShowFirstLaunch(true);
      }
    } catch {
      setTab('home');
      setLaunchAnimationKey((prev) => prev + 1);
      setShowFirstLaunch(true);
    }
  }, [isReady, profile, session]);

  useEffect(() => {
    document.documentElement.classList.toggle('intro-minimal', showFirstLaunch);
    return () => document.documentElement.classList.remove('intro-minimal');
  }, [showFirstLaunch]);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    if (swipeProfilePhase !== 'enter') return;

    const timeout = window.setTimeout(() => {
      setSwipeProfilePhase('idle');
    }, 520);

    return () => window.clearTimeout(timeout);
  }, [swipeProfilePhase]);

  useEffect(() => {
    if (tab !== 'profile' || profileSwipeTopResetKey === 0) return;

    scrollPageToTop();
    const animationFrame = window.requestAnimationFrame(scrollPageToTop);
    const timeout = window.setTimeout(scrollPageToTop, 180);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [profileSwipeTopResetKey, tab]);

  useEffect(() => {
    if (!session || !profile) return;
    if (viewport.width >= 1280) return;

    const EDGE_SLOP_PX = 32;
    const SWIPE_MIN_DISTANCE_PX = 70;
    const SWIPE_MAX_OFF_AXIS_PX = 55;

    let startX: number | null = null;
    let startY: number | null = null;
    let startTime = 0;
    let startedFromEdge: 'left' | 'right' | null = null;

    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const interactiveSelector =
        'input, textarea, select, button, a, [role="button"], [contenteditable="true"], [data-no-swipe]';
      return Boolean(target.closest(interactiveSelector));
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (isInteractiveTarget(event.target)) return;

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();

      if (touch.clientX <= EDGE_SLOP_PX) startedFromEdge = 'left';
      else if (touch.clientX >= viewport.width - EDGE_SLOP_PX) startedFromEdge = 'right';
      else startedFromEdge = null;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (startX == null || startY == null) return;
      if (!startedFromEdge) {
        startX = null;
        startY = null;
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const elapsedMs = Date.now() - startTime;

      startX = null;
      startY = null;
      startTime = 0;

      if (absX < SWIPE_MIN_DISTANCE_PX) return;
      if (absY > SWIPE_MAX_OFF_AXIS_PX) return;
      if (elapsedMs > 650) return;

      if (startedFromEdge === 'left' && deltaX > 0) {
        setIsMobileNavOpen(true);
        return;
      }

      if (startedFromEdge === 'right' && deltaX < 0) {
        if (isMobileNavOpen) {
          setIsMobileNavOpen(false);
          return;
        }
        if (tab === 'profile') {
          setProfileSwipeTopResetKey((previous) => previous + 1);
          setSwipeProfilePhase('enter');
          return;
        }

        setSwipeProfilePhase('exit');
        window.setTimeout(() => {
          setTab('profile');
          setProfileSwipeTopResetKey((previous) => previous + 1);
          setSwipeProfilePhase('enter');
        }, 130);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobileNavOpen, profile, session, tab, viewport.width]);

  const shellMetrics = useMemo(
    () => getViewportShellMetrics(viewport.width, viewport.height, isSidebarCollapsed),
    [isSidebarCollapsed, viewport.height, viewport.width],
  );
  const mainStyle = useMemo<CSSProperties>(
    () => ({
      maxWidth: `${shellMetrics.maxWidth}px`,
    }),
    [shellMetrics.maxWidth],
  );
  const desktopGridStyle = useMemo<CSSProperties | undefined>(() => {
    if (viewport.width < 1280) return undefined;

    return {
      gridTemplateColumns: `${shellMetrics.sidebarWidth}px minmax(0, 1fr)`,
      gap: `${shellMetrics.gridGap}px`,
    };
  }, [shellMetrics.gridGap, shellMetrics.sidebarWidth, viewport.width]);
  const contentStyle = useMemo<CSSProperties | undefined>(() => {
    if (viewport.width < 1280) return undefined;

    return {
      minHeight: `${shellMetrics.contentMinHeight}px`,
    };
  }, [shellMetrics.contentMinHeight, viewport.width]);

  if (!isReady) {
    return <LoadingSkeleton />;
  }

  if (!session) {
    return (
      <main
        className="mx-auto flex min-h-dvh w-full items-center justify-center px-4 py-6 sm:px-6 lg:px-8 2xl:px-10"
        style={mainStyle}
      >
        <OTPLoginForm onLogin={login} />
      </main>
    );
  }

  if (!profile) {
    return (
      <main
        className="mx-auto flex min-h-dvh w-full items-center justify-center px-4 py-6 sm:px-6 lg:px-8 2xl:px-10"
        style={mainStyle}
      >
        <OnboardingForm onSubmit={completeOnboarding} />
      </main>
    );
  }

  return (
    <main
      className="mx-auto min-h-dvh w-full px-3 py-4 sm:px-5 sm:py-5 lg:px-6 xl:px-8 2xl:px-10"
      style={mainStyle}
    >
      {session && profile ? (
        <FirstLaunchOverlay
          open={showFirstLaunch}
          name={profile.name}
          onDone={() => {
            setShowFirstLaunch(false);
            try {
              window.localStorage.removeItem(LEGACY_FIRST_LAUNCH_KEY);
              window.localStorage.setItem(getFirstLaunchKey(session.userId), 'true');
            } catch {
              // ignore
            }
          }}
        />
      ) : null}
      <EasterEggToast
        open={Boolean(lastEasterEggFound)}
        title={lastEasterEggFound?.title ?? ''}
        onClose={clearLastEasterEggFound}
      />
      <AchievementToast
        open={Boolean(lastAchievementUnlocked)}
        title={lastAchievementUnlocked?.title ?? ''}
        subtitle={lastAchievementUnlocked?.subtitle ?? ''}
        onClose={clearLastAchievementUnlocked}
      />
      <MobileNavDrawer
        open={isMobileNavOpen}
        activeTab={tab}
        onChange={setTab}
        onClose={() => setIsMobileNavOpen(false)}
        userName={profile.name}
        userEmail={session.identifier}
        onLogout={logout}
      />
      <div
        className={classNames(
          'xl:grid',
          isSidebarCollapsed ? 'xl:grid-cols-[108px_minmax(0,1fr)]' : 'xl:grid-cols-[280px_minmax(0,1fr)]',
        )}
        style={desktopGridStyle}
      >
        <div className="hidden xl:block">
          <SidebarNav
            activeTab={tab}
            onChange={setTab}
            collapsed={isSidebarCollapsed}
            onToggleCollapsed={toggleSidebarCollapsed}
            userName={profile.name}
            userEmail={session.identifier}
            onLogout={logout}
          />
        </div>

        <section
          className={classNames(
            'min-w-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))] xl:pb-10',
            swipeProfilePhase === 'exit' ? 'swipe-profile-exit' : '',
            swipeProfilePhase === 'enter' ? 'swipe-profile-enter' : '',
          )}
          style={contentStyle}
        >
          <div className="mb-4 flex items-center justify-between gap-3 xl:hidden">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="btn-glow soft-surface panel-hover inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 text-black dark:border-orange-400/30 dark:bg-orange-500/15 dark:text-orange-100"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                setLogoTapState((prev) => {
                  const now = Date.now();
                  const count = now - prev.lastAt > 2500 ? 1 : prev.count + 1;
                  if (count >= 7) {
                    markEasterEggFound('logo-taps');
                    return { count: 0, lastAt: 0 };
                  }
                  return { count, lastAt: now };
                });
              }}
              title="OATH"
            >
              <BrandLogo compact className="min-w-0" />
            </button>
            <div className="h-11 w-11 shrink-0" aria-hidden="true" />
          </div>

          {tab === 'home' && <HomePage key={`home-${launchAnimationKey}`} />}
          {tab === 'progress' && <ProgressPage />}
          {tab === 'correlation' && <CorrelationPage />}
          {tab === 'leaderboard' && <LeaderboardPage />}
          {tab === 'companion' && <AICompanionPage />}
          {tab === 'scan' && <ScanFoodPage />}
          {tab === 'profile' && <ProfilePage />}
        </section>
      </div>
    </main>
  );
};

export default App;
