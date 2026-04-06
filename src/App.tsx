import { MoonStar, SunMedium } from 'lucide-react';
import { useState } from 'react';
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

const App = () => {
  const { isReady, session, profile, login, completeOnboarding, darkMode, toggleDarkMode, logout } = useApp();
  const [tab, setTab] = useState<AppTab>(() => getInitialTab());
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

  if (!isReady) {
    return <LoadingSkeleton />;
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-screen-2xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <OTPLoginForm onLogin={login} />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-screen-2xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
        <OnboardingForm onSubmit={completeOnboarding} />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-screen-2xl px-3 py-4 sm:px-5 sm:py-5 lg:px-8">
      <div
        className={classNames(
          'xl:grid xl:gap-6',
          isSidebarCollapsed
            ? 'xl:grid-cols-[96px_minmax(0,1fr)]'
            : 'xl:grid-cols-[280px_minmax(0,1fr)]',
        )}
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

        <section className="min-w-0 pb-40 sm:pb-36 xl:pb-10">
          <div className="mb-4 flex items-center justify-between gap-4 xl:hidden">
            <BrandLogo compact />
            <button
              type="button"
              onClick={toggleDarkMode}
              className="soft-surface panel-hover rounded-2xl border border-blue-100 px-4 py-3 text-sm font-semibold text-black dark:border-orange-400/30 dark:bg-orange-500/15 dark:text-orange-100"
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
