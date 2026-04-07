import { FormEvent, useRef, useState } from 'react';
import { MoonStar, RotateCcw, SunMedium, UserRoundPen } from 'lucide-react';
import { CardShell } from '../components/CardShell';
import { useApp } from '../context/AppContext';
import { genderOptions, savePreferredGender } from '../lib/gender';
import { exportStateBundle, importStateBundle } from '../lib/storage';
import { requestNotificationPermission } from '../services/notifications';

const sanitizeIntegerInput = (value: string) => {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
};

const sanitizeDecimalInput = (value: string) => {
  const cleaned = String(value || '').replace(/[^0-9.]/g, '');
  const [whole = '', ...fractionParts] = cleaned.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  const fraction = fractionParts.join('');

  if (!cleaned) return '';
  if (!fractionParts.length) return normalizedWhole || '0';
  return `${normalizedWhole || '0'}.${fraction}`;
};

const parseNumberInput = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const ProfilePage = () => {
  const {
    profile,
    session,
    updateProfile,
    resetAllData,
    notifications,
    toggleNotification,
    updateNotificationTime,
    logout,
    darkMode,
    toggleDarkMode,
    easterEggsFound,
    easterEggsTotal,
    markEasterEggFound,
    achievementsUnlocked,
  } = useApp();
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [dataMessage, setDataMessage] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [themeTapState, setThemeTapState] = useState<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });
  const [form, setForm] = useState({
    gender: profile?.gender ?? 'Other',
    age: String(profile?.age ?? 0),
    height: String(profile?.height ?? 0),
    weight: String(profile?.weight ?? 0),
    goal: profile?.goal ?? 'Maintain',
    dailyStudyHours: String(profile?.dailyStudyHours ?? profile?.dailyTargets?.studyHours ?? 3),
    dailyWorkoutMinutes: String(profile?.dailyWorkoutMinutes ?? profile?.dailyTargets?.workoutMinutes ?? 45),
  });

  if (!profile || !session) return null;

  const inviteUrl = `${window.location.origin}/?invite=1`;

  const showDataMessage = (message: string) => {
    setDataMessage(message);
    window.setTimeout(() => setDataMessage(''), 2600);
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showDataMessage('Invite link copied.');
    } catch {
      showDataMessage('Copy failed. Long-press to copy from the address bar.');
    }
  };

  const handleExport = () => {
    const bundle = exportStateBundle(profile.userId);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `oath-export-${profile.userId}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showDataMessage('Export downloaded.');
  };

  const handleImportSelected = async (file: File) => {
    const raw = await file.text();
    const bundle = JSON.parse(raw);
    importStateBundle(profile.userId, bundle);
    showDataMessage('Import complete. Reloading…');
    window.setTimeout(() => window.location.reload(), 500);
  };

  const handleSendFeedback = () => {
    const subject = encodeURIComponent('OATH Feedback');
    const body = encodeURIComponent(
      `App version: ${__APP_VERSION__}\nUser: ${session.identifier}\n\nWhat happened?\n\nWhat did you expect?\n\n`,
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleThemeToggleWithEgg = () => {
    toggleDarkMode();
    setThemeTapState((prev) => {
      const now = Date.now();
      const count = now - prev.lastAt > 3000 ? 1 : prev.count + 1;
      if (count >= 10) {
        markEasterEggFound('theme-spinner');
        return { count: 0, lastAt: 0 };
      }
      return { count, lastAt: now };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSavedMessage('');

    try {
      const age = Math.min(90, Math.max(10, Math.round(parseNumberInput(form.age, profile.age))));
      const height = Math.min(240, Math.max(100, Math.round(parseNumberInput(form.height, profile.height))));
      const weight = Math.min(200, Math.max(30, Math.round(parseNumberInput(form.weight, profile.weight))));
      const dailyStudyHours = Math.min(
        10,
        Math.max(1, parseNumberInput(form.dailyStudyHours, profile.dailyTargets.studyHours)),
      );
      const dailyWorkoutMinutes = Math.min(
        180,
        Math.max(15, Math.round(parseNumberInput(form.dailyWorkoutMinutes, profile.dailyTargets.workoutMinutes))),
      );
      await updateProfile({
        ...form,
        age,
        height,
        weight,
        dailyStudyHours,
        dailyWorkoutMinutes,
        dailyAvailableHours: Math.min(12, Math.max(1, dailyStudyHours + dailyWorkoutMinutes / 60)),
      });
      savePreferredGender(form.gender);
      setSavedMessage('Saved successfully.');
      window.setTimeout(() => setSavedMessage(''), 2200);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset your profile, daily logs, streaks, and saved data for this account?')) {
      return;
    }

    setResetting(true);

    try {
      await resetAllData();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-5 pb-28 sm:pb-24">
      <header className="glass rounded-[32px] border border-blue-100 p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Profile</p>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl">{profile.name}</h1>
            <p className="muted-text mt-2 text-sm">{session.identifier}</p>
          </div>
          <div className="soft-surface rounded-2xl p-3">
            <UserRoundPen size={18} />
          </div>
        </div>
      </header>

      <CardShell>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Appearance</p>
            <p className="muted-text mt-2 text-sm">Theme is controlled from your profile on mobile.</p>
          </div>
          <button
            type="button"
            onClick={handleThemeToggleWithEgg}
            className="soft-surface panel-hover inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-100 px-4 py-3 text-sm font-semibold text-black dark:border-orange-400/30 dark:bg-orange-500/15 dark:text-orange-100 sm:w-auto"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <SunMedium size={18} /> : <MoonStar size={18} />}
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </CardShell>

      <CardShell>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Easter Eggs</p>
            <p className="muted-text mt-2 text-sm">Hidden surprises you can discover across the app.</p>
          </div>
          <div className="self-start rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-black dark:border-orange-400/25 dark:bg-orange-500/10 dark:text-orange-50 sm:self-auto">
            {easterEggsFound?.length || 0}/{easterEggsTotal} found
          </div>
        </div>
      </CardShell>

      <CardShell>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Achievements</p>
            <p className="muted-text mt-2 text-sm">Milestones unlocked automatically as you progress.</p>
          </div>
          <div className="self-start rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-black dark:border-orange-400/25 dark:bg-orange-500/10 dark:text-orange-50 sm:self-auto">
            {achievementsUnlocked?.length || 0} unlocked
          </div>
        </div>
      </CardShell>

      <CardShell>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Share</p>
            <p className="muted-text mt-2 text-sm">Invite friends to join your leaderboard.</p>
          </div>
          <button
            type="button"
            onClick={() => void handleCopyInvite()}
            className="w-full rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-black transition hover:bg-blue-100 dark:bg-orange-500/10 dark:text-orange-50 dark:hover:bg-orange-500/15 sm:w-auto"
          >
            Copy invite link
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-blue-100 bg-white/70 px-4 py-3 text-sm text-black dark:border-orange-400/20 dark:bg-white/5 dark:text-orange-50">
          <p className="muted-text break-all">{inviteUrl}</p>
        </div>

        {dataMessage ? (
          <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-black dark:border-orange-400/25 dark:bg-orange-500/10 dark:text-orange-100">
            {dataMessage}
          </div>
        ) : null}
      </CardShell>

      <CardShell>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Data</p>
            <p className="muted-text mt-2 text-sm">Export or import your local app data.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleExport}
              className="w-full rounded-2xl bg-blue-100 px-4 py-3 text-sm font-semibold text-black transition hover:bg-blue-200 dark:bg-orange-500/20 dark:text-orange-50 dark:hover:bg-orange-500/30 sm:w-auto"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-blue-50 dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50 dark:hover:bg-orange-500/15 sm:w-auto"
            >
              Import
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void handleImportSelected(file).catch(() => showDataMessage('Import failed.'));
              }}
            />
          </div>
        </div>
      </CardShell>

      <CardShell>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Support</p>
            <p className="muted-text mt-2 text-sm">Send feedback or report a bug from your email app.</p>
          </div>
          <button
            type="button"
            onClick={handleSendFeedback}
            className="w-full rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-black transition hover:bg-blue-100 dark:bg-orange-500/10 dark:text-orange-50 dark:hover:bg-orange-500/15 sm:w-auto"
          >
            Send feedback
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-blue-100 bg-white/70 px-4 py-3 text-sm text-black dark:border-orange-400/20 dark:bg-white/5 dark:text-orange-50">
          <button
            type="button"
            className="muted-text w-full text-left"
            onClick={() => markEasterEggFound('version-tap')}
            title="Version"
          >
            Version {__APP_VERSION__}
          </button>
        </div>
      </CardShell>

      <CardShell>
        <p className="text-sm uppercase tracking-[0.24em] text-black">Edit Goals</p>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label>
            <span className="mb-2 block text-sm font-medium">Gender</span>
            <select
              value={form.gender}
              onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value as typeof form.gender }))}
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            >
              {genderOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Age</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.age}
              onChange={(event) => setForm((prev) => ({ ...prev, age: sanitizeIntegerInput(event.target.value) }))}
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Height</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.height}
              onChange={(event) => setForm((prev) => ({ ...prev, height: sanitizeIntegerInput(event.target.value) }))}
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Weight</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.weight}
              onChange={(event) => setForm((prev) => ({ ...prev, weight: sanitizeIntegerInput(event.target.value) }))}
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Daily study hours</span>
            <input
              type="text"
              inputMode="decimal"
              min={1}
              max={10}
              step={0.5}
              value={form.dailyStudyHours}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dailyStudyHours: sanitizeDecimalInput(event.target.value) }))
              }
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Daily workout minutes</span>
            <input
              type="text"
              inputMode="numeric"
              min={15}
              max={180}
              step={5}
              value={form.dailyWorkoutMinutes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dailyWorkoutMinutes: sanitizeIntegerInput(event.target.value) }))
              }
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium">Goal</span>
            <select
              value={form.goal}
              onChange={(event) => setForm((prev) => ({ ...prev, goal: event.target.value as typeof form.goal }))}
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            >
              <option>Lose Fat</option>
              <option>Gain Muscle</option>
              <option>Maintain</option>
            </select>
          </label>
          <div className="sm:col-span-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-black dark:border-orange-400/25 dark:bg-orange-500/10 dark:text-orange-100">
            Daily calories, hydration, and macros are recalculated from your selected study hours, workout minutes, and body metrics.
          </div>
          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 rounded-2xl bg-blue-100 px-4 py-3 font-semibold text-black transition duration-300 hover:bg-blue-200 dark:bg-orange-500/20 dark:text-orange-50 dark:hover:bg-orange-500/30"
          >
            {saving ? 'Saving...' : 'Update profile'}
          </button>
          {savedMessage ? (
            <div className="sm:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200">
              {savedMessage}
            </div>
          ) : null}
        </form>
      </CardShell>

      <CardShell>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Notifications</p>
            <p className="muted-text mt-2 text-sm">Choose when each reminder should alert you and turn any reminder on or off.</p>
          </div>
          <button
            type="button"
            onClick={() => void requestNotificationPermission()}
            className="w-full rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-black sm:w-auto"
          >
            Ask browser
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-blue-50 px-4 py-4 text-black dark:bg-orange-500/10 dark:text-orange-50"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="muted-text text-sm">{item.enabled ? 'Reminder enabled' : 'Reminder disabled'}</p>
                </div>
                <div className="flex flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <input
                    type="time"
                    value={item.time}
                    onChange={(event) => updateNotificationTime(item.id, event.target.value)}
                    className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none transition focus:border-clay dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
                  />
                  <button
                    type="button"
                    onClick={() => toggleNotification(item.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition duration-300 ${
                      item.enabled
                        ? 'bg-blue-100 text-black hover:bg-blue-200 dark:bg-orange-500/20 dark:text-orange-50 dark:hover:bg-orange-500/30'
                        : 'bg-white text-black hover:bg-blue-50 dark:bg-[#17110b] dark:text-orange-100 dark:hover:bg-orange-500/15'
                    }`}
                  >
                    {item.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardShell>

      <div className="grid gap-4 sm:grid-cols-2">
        <CardShell>
          <p className="text-sm uppercase tracking-[0.24em] text-black">Reset Data</p>
          <p className="muted-text mt-2 text-sm">
            Clears local logs and attempts to remove synced Firebase data.
          </p>
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={resetting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-100 px-4 py-3 font-semibold text-black transition duration-300 hover:-translate-y-0.5 hover:bg-blue-200 disabled:opacity-60 dark:bg-orange-500/20 dark:text-orange-50 dark:hover:bg-orange-500/30"
          >
            <RotateCcw size={18} />
            {resetting ? 'Resetting...' : 'Reset app data'}
          </button>
        </CardShell>

        <CardShell>
          <p className="text-sm uppercase tracking-[0.24em] text-black">Session</p>
          <p className="muted-text mt-2 text-sm">
            Auth mode:{' '}
            {session.provider === 'email-otp' || session.provider === 'email-smtp'
              ? 'Email OTP'
              : session.provider === 'firebase-auth'
                ? 'Firebase-ready simulation'
                : 'Simulated OTP'}
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full rounded-2xl border border-blue-200 px-4 py-3 font-semibold text-black"
          >
            Log out
          </button>
        </CardShell>
      </div>
    </div>
  );
};
