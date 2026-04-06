import { useEffect, useMemo, useState } from 'react';
import { AlarmClockCheck, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import { getDelayInMinutes, toClockLabel } from '../lib/date';
import { CardShell } from './CardShell';

interface WakeUpCardProps {
  wakeUpTime?: string;
  profile: UserProfile;
  onMark: (timeValue?: string) => Promise<void>;
}

export const WakeUpCard = ({ wakeUpTime, profile, onMark }: WakeUpCardProps) => {
  const delay = getDelayInMinutes(wakeUpTime, profile.dailyTargets.wakeUpGoal);
  const defaultTime = useMemo(() => {
    if (wakeUpTime) {
      const date = new Date(wakeUpTime);
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, [wakeUpTime]);
  const [selectedTime, setSelectedTime] = useState(defaultTime);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedTime(defaultTime);
  }, [defaultTime]);

  const handleSave = async (timeValue?: string) => {
    setSaving(true);

    try {
      await onMark(timeValue || selectedTime);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardShell className="relative overflow-hidden rounded-[28px] border border-orange-400/20 bg-transparent">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-black">Wake-up</p>
          <h3 className="mt-2 font-display text-3xl">{toClockLabel(wakeUpTime)}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-black dark:text-zinc-200">
            <span>Goal {profile.dailyTargets.wakeUpGoal}</span>
            {delay !== null ? (
              <span className={delay > 0 ? 'text-red-400' : 'text-emerald-400'}>
                {delay > 0 ? `${delay} min late` : 'On time'}
              </span>
            ) : (
              <span className="muted-text">Not marked yet</span>
            )}
          </div>
          <p className="muted-text mt-2 text-sm">
            {wakeUpTime
              ? 'Update the time anytime if the first mark was wrong. A new wake-up entry opens again after 5:00 AM tomorrow.'
              : 'Save the exact wake-up time for today. A new wake-up entry opens again after 5:00 AM tomorrow.'}
          </p>
        </div>
        <div className="soft-surface inline-flex h-12 w-12 items-center justify-center rounded-2xl text-orange-200">
          <AlarmClockCheck size={22} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="mb-2 block text-sm font-medium text-black">Wake-up time</span>
          <input
            type="time"
            value={selectedTime}
            onChange={(event) => setSelectedTime(event.target.value)}
            className="w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-black outline-none transition focus:border-orange-400 dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
          />
        </label>

        <div className="flex flex-col gap-3 sm:w-[240px] sm:justify-end">
          <button
            type="button"
            onClick={() => void handleSave(selectedTime)}
            disabled={saving}
            className="btn-glow rounded-2xl border border-white/10 bg-white/10 px-4 py-3 font-semibold text-black transition duration-300 hover:-translate-y-0.5 hover:bg-white/15 active:scale-[0.99] disabled:opacity-60 dark:text-zinc-50"
          >
            {saving ? 'Saving...' : wakeUpTime ? 'Update Wake-up Time' : 'Mark Wake-up Time'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-glow flex items-center justify-center gap-2 rounded-2xl border border-orange-400/25 bg-transparent px-4 py-3 font-semibold text-black transition duration-300 hover:-translate-y-0.5 hover:bg-white/5 active:scale-[0.99] disabled:opacity-60 dark:text-orange-100"
          >
            <RefreshCw size={16} />
            Use current time
          </button>
        </div>
      </div>
    </CardShell>
  );
};
