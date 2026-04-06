import { FormEvent, useState } from 'react';
import { genderOptions, readPreferredGender, savePreferredGender } from '../lib/gender';
import { UserProfile } from '../types';
import { BrandLogo } from './BrandLogo';
import { CardShell } from './CardShell';

interface OnboardingFormProps {
  onSubmit: (payload: Omit<UserProfile, 'userId' | 'dailyTargets'>) => Promise<void>;
}

export const OnboardingForm = ({ onSubmit }: OnboardingFormProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    gender: readPreferredGender(),
    age: 21,
    height: 170,
    weight: 70,
    goal: 'Maintain' as UserProfile['goal'],
    dailyAvailableHours: 4,
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      savePreferredGender(form.gender);
      await onSubmit(form);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CardShell className="mx-auto w-full max-w-2xl bg-gradient-to-br from-white/95 via-white/90 to-orange-50/80 dark:from-[#0d0d0d] dark:via-[#111111] dark:to-[#1a120a]">
      <div className="mb-6">
        <BrandLogo />
        <p className="text-sm uppercase tracking-[0.24em] text-ink/75 dark:text-orange-200">First-Time Setup</p>
        <h2 className="font-display text-3xl">Build your discipline blueprint</h2>
        <p className="muted-text mt-2 text-sm">
          We'll create a simple daily plan for workouts, study, hydration, and calorie balance.
        </p>
      </div>

      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-medium">Name</span>
          <input
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:border-clay dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
          />
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium">Gender</span>
          <select
            value={form.gender}
            onChange={(event) => {
              const gender = event.target.value as UserProfile['gender'];
              setForm((prev) => ({ ...prev, gender }));
              savePreferredGender(gender);
            }}
            className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:border-clay dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
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
            min={10}
            max={90}
            value={form.age}
            onChange={(event) => setForm((prev) => ({ ...prev, age: Number(event.target.value) }))}
            className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:border-clay dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
          />
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium">Daily available time (hours)</span>
          <input
            type="number"
            min={1}
            max={12}
            value={form.dailyAvailableHours}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, dailyAvailableHours: Number(event.target.value) }))
            }
            className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:border-clay dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
          />
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium">Height (cm)</span>
          <input
            type="number"
            min={100}
            max={240}
            value={form.height}
            onChange={(event) => setForm((prev) => ({ ...prev, height: Number(event.target.value) }))}
            className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:border-clay dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
          />
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium">Weight (kg)</span>
          <input
            type="number"
            min={30}
            max={200}
            value={form.weight}
            onChange={(event) => setForm((prev) => ({ ...prev, weight: Number(event.target.value) }))}
            className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:border-clay dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-medium">Goal</span>
          <select
            value={form.goal}
            onChange={(event) => setForm((prev) => ({ ...prev, goal: event.target.value as UserProfile['goal'] }))}
            className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 outline-none focus:border-clay dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
          >
            <option>Lose Fat</option>
            <option>Gain Muscle</option>
            <option>Maintain</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="sm:col-span-2 rounded-2xl bg-ink px-4 py-3 font-semibold text-paper transition hover:opacity-90 disabled:opacity-60 dark:bg-orange-500/20 dark:text-orange-50 dark:hover:bg-orange-500/30"
        >
          {loading ? 'Generating plan...' : 'Create my plan'}
        </button>
      </form>
    </CardShell>
  );
};
