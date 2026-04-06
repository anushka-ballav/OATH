import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { MoonStar, SunMedium } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { BrandLogo } from './components/BrandLogo';
import { LoadingSkeleton } from './components/LoadingSkeleton';
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

const readViewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

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
  const { isReady, session, profile, login, completeOnboarding, darkMode, toggleDarkMode, logout } = useApp();
  const [tab, setTab] = useState<AppTab>(() => getInitialTab());
  const [viewport, setViewport] = useState(() => readViewport());
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
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            collapsed={isSidebarCollapsed}
            onToggleCollapsed={toggleSidebarCollapsed}
            userName={profile.name}
            userEmail={session.identifier}
            onLogout={logout}
          />
        </div>

        <section className="min-w-0 pb-32 sm:pb-36 xl:pb-10" style={contentStyle}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:hidden">
            <BrandLogo compact className="w-full sm:w-auto" />
            <button
              type="button"
              onClick={toggleDarkMode}
              className="soft-surface panel-hover flex w-full items-center justify-center rounded-2xl border border-blue-100 px-4 py-3 text-sm font-semibold text-black dark:border-orange-400/30 dark:bg-orange-500/15 dark:text-orange-100 sm:w-auto"
            >
              <span className="inline-flex items-center gap-2">
                {darkMode ? <SunMedium size={16} /> : <MoonStar size={16} />}
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </span>
            </button>
          </div>

          {tab === 'home' && <HomePage />}
          {tab === 'progress' && <ProgressPage />}
          {tab === 'correlation' && <CorrelationPage />}
          {tab === 'leaderboard' && <LeaderboardPage />}
          {tab === 'companion' && <AICompanionPage />}
          {tab === 'scan' && <ScanFoodPage />}
          {tab === 'profile' && <ProfilePage />}
        </section>
      </div>

      <div className="xl:hidden">
        <BottomNav activeTab={tab} onChange={setTab} />
      </div>
    </main>
  );
};

export default App;
