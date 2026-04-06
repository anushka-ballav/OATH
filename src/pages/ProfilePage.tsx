import { FormEvent, useState } from 'react';
import { RotateCcw, UserRoundPen } from 'lucide-react';
import { CardShell } from '../components/CardShell';
import { useApp } from '../context/AppContext';
import { genderOptions, savePreferredGender } from '../lib/gender';
import { requestNotificationPermission } from '../services/notifications';

export const ProfilePage = () => {
  const { profile, session, updateProfile, resetAllData, notifications, toggleNotification, updateNotificationTime, logout } = useApp();
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [form, setForm] = useState({
    gender: profile?.gender ?? 'Other',
    age: profile?.age ?? 0,
    height: profile?.height ?? 0,
    weight: profile?.weight ?? 0,
    goal: profile?.goal ?? 'Maintain',
    dailyAvailableHours: profile?.dailyAvailableHours ?? 4,
  });

  if (!profile || !session) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSavedMessage('');

    try {
      await updateProfile(form);
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
    <div className="space-y-5 pb-24">
      <header className="glass rounded-[32px] border border-blue-100 p-5 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Profile</p>
            <h1 className="mt-2 font-display text-3xl">{profile.name}</h1>
            <p className="muted-text mt-2 text-sm">{session.identifier}</p>
          </div>
          <div className="soft-surface rounded-2xl p-3">
            <UserRoundPen size={18} />
          </div>
        </div>
      </header>

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
              type="number"
              value={form.age}
              onChange={(event) => setForm((prev) => ({ ...prev, age: Number(event.target.value) }))}
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Height</span>
            <input
              type="number"
              value={form.height}
              onChange={(event) => setForm((prev) => ({ ...prev, height: Number(event.target.value) }))}
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Weight</span>
            <input
              type="number"
              value={form.weight}
              onChange={(event) => setForm((prev) => ({ ...prev, weight: Number(event.target.value) }))}
              className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium">Daily available hours</span>
            <input
              type="number"
              value={form.dailyAvailableHours}
              onChange={(event) => setForm((prev) => ({ ...prev, dailyAvailableHours: Number(event.target.value) }))}
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
            Daily calories, hydration, and macro targets are recalculated using your selected gender, body metrics, goal, and available hours.
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Notifications</p>
            <p className="muted-text mt-2 text-sm">Choose when each reminder should alert you and turn any reminder on or off.</p>
          </div>
          <button
            type="button"
            onClick={() => void requestNotificationPermission()}
            className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-black"
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
