import { AlarmClock, BookOpenText, Droplets, Flame, Scale, UtensilsCrossed } from 'lucide-react';
import { DailyLog, UserProfile } from '../types';
import { getDelayInMinutes, toClockLabel } from '../lib/date';
import { percent } from '../lib/utils';
import { CardShell } from './CardShell';
import { ProgressBar } from './ProgressBar';

interface HomeOverviewProps {
  profile: UserProfile;
  log: DailyLog;
}

export const HomeOverview = ({ profile, log }: HomeOverviewProps) => {
  const wakeDelay = getDelayInMinutes(log.wakeUpTime, profile.dailyTargets.wakeUpGoal);
  const netCalories = log.caloriesConsumed - log.caloriesBurned;

  const cards = [
    {
      label: 'Wake-up time',
      value: toClockLabel(log.wakeUpTime),
      icon: AlarmClock,
      helper: wakeDelay !== null ? `Late by ${wakeDelay} min` : `Goal ${profile.dailyTargets.wakeUpGoal}`,
      color: 'bg-orange-500',
      cardClass: 'from-orange-50 via-white to-amber-50 dark:from-[#16100a] dark:via-[#0d0d0d] dark:to-[#1f1208]',
      iconClass: 'bg-orange-100 dark:bg-orange-500/15',
    },
    {
      label: 'Study hours',
      value: `${(log.studyMinutes / 60).toFixed(1)} / ${profile.dailyTargets.studyHours}h`,
      icon: BookOpenText,
      helper: 'Daily focus target',
      progress: percent(log.studyMinutes, profile.dailyTargets.studyHours * 60),
      color: 'bg-teal',
      cardClass: 'from-sky-50 via-white to-cyan-50 dark:from-[#0b1117] dark:via-[#0d0d0d] dark:to-[#09151b]',
      iconClass: 'bg-sky-100 dark:bg-sky-500/15',
    },
    {
      label: 'Water intake',
      value: `${(log.waterIntakeMl / 1000).toFixed(2)} / ${profile.dailyTargets.waterLiters}L`,
      icon: Droplets,
      helper: 'Hydration balance',
      progress: percent(log.waterIntakeMl, profile.dailyTargets.waterLiters * 1000),
      color: 'bg-sky-500',
      cardClass: 'from-cyan-50 via-white to-blue-50 dark:from-[#08131a] dark:via-[#0d0d0d] dark:to-[#0b1320]',
      iconClass: 'bg-cyan-100 dark:bg-cyan-500/15',
    },
    {
      label: 'Calories burned',
      value: `${log.caloriesBurned} kcal`,
      icon: Flame,
      helper: `${profile.dailyTargets.workoutMinutes} min workout target`,
      color: 'bg-orange-500',
      cardClass: 'from-orange-50 via-white to-rose-50 dark:from-[#17100a] dark:via-[#0d0d0d] dark:to-[#1a0e12]',
      iconClass: 'bg-orange-100 dark:bg-orange-500/15',
    },
    {
      label: 'Calories consumed',
      value: `${log.caloriesConsumed} / ${profile.dailyTargets.calories} kcal`,
      icon: UtensilsCrossed,
      helper: 'Food tracking',
      progress: percent(log.caloriesConsumed, profile.dailyTargets.calories),
      color: 'bg-moss',
      cardClass: 'from-indigo-50 via-white to-violet-50 dark:from-[#10101b] dark:via-[#0d0d0d] dark:to-[#151021]',
      iconClass: 'bg-indigo-100 dark:bg-indigo-500/15',
    },
    {
      label: 'Net calories today',
      value: `${netCalories} kcal`,
      icon: Scale,
      helper: 'Calories consumed minus calories burned',
      cardClass: 'from-emerald-50 via-white to-lime-50 dark:from-[#09130f] dark:via-[#0d0d0d] dark:to-[#11190d]',
      iconClass: 'bg-emerald-100 dark:bg-emerald-500/15',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map(({ label, value, icon: Icon, helper, progress, color, cardClass, iconClass }) => (
        <CardShell key={label} className={`bg-gradient-to-br ${cardClass}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-black dark:text-zinc-100">{label}</p>
              <p className="mt-2 font-display text-2xl">{value}</p>
            </div>
            <div className={`rounded-2xl p-3 text-black dark:text-white ${iconClass}`}>
              <Icon size={18} />
            </div>
          </div>
          <p className="muted-text mt-3 text-sm">{helper}</p>
          {progress !== undefined && (
            <div className="mt-4">
              <ProgressBar value={progress} colorClass={color} />
            </div>
          )}
        </CardShell>
      ))}
    </div>
  );
};
