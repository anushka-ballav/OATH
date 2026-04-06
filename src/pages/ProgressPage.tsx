import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { CardShell } from '../components/CardShell';
import { WeeklyChart } from '../components/WeeklyChart';
import { getLastNDays, getLastSevenDays } from '../lib/date';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const ProgressPage = () => {
  const { logs, streakHistory, profile, currentLog, tasks } = useApp();
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const rangeDays = range === 'daily' ? 1 : range === 'monthly' ? 30 : 7;
  const dateKeys = useMemo(() => getLastNDays(rangeDays), [rangeDays]);

  const buildSeries = (field: 'studyMinutes' | 'waterIntakeMl' | 'caloriesConsumed') =>
    dateKeys.map((date) => {
      const log = logs.find((entry) => entry.date === date);
      const value =
        field === 'studyMinutes'
          ? Math.round((log?.studyMinutes ?? 0) / 60)
          : field === 'waterIntakeMl'
            ? Number(((log?.waterIntakeMl ?? 0) / 1000).toFixed(2))
            : log?.caloriesConsumed ?? 0;

      return {
        day: date.slice(5),
        value,
      };
    });

  const streakSeries = useMemo(
    () => streakHistory.slice(-7).map((item) => ({ day: item.date.slice(5), value: item.streak })),
    [streakHistory],
  );

  const taskSeries = useMemo(() => {
    return dateKeys.map((date) => {
      const due = (tasks || []).filter((task) => task.dueDate === date);
      const completed = due.filter((task) => task.completed).length;
      const pending = due.filter((task) => !task.completed).length;

      return {
        day: date.slice(5),
        completed,
        pending,
      };
    });
  }, [dateKeys, tasks]);

  const caloriesSeries = useMemo(() => {
    return dateKeys.map((date) => {
      const log = logs.find((entry) => entry.date === date);
      return {
        day: date.slice(5),
        consumed: log?.caloriesConsumed ?? 0,
        burned: log?.caloriesBurned ?? 0,
      };
    });
  }, [dateKeys, logs]);

  const guideItems = useMemo(() => {
    if (!profile) return [];

    const items = [
      `Finish your ${profile.dailyTargets.workoutMinutes}-minute workout and tick off all workout tasks today.`,
      `Study target is ${profile.dailyTargets.studyHours} hours. You are currently at ${(currentLog.studyMinutes / 60).toFixed(1)} hours.`,
      `Hydration goal is ${profile.dailyTargets.waterLiters}L and calorie target is ${profile.dailyTargets.calories} kcal.`,
    ];

    if (profile.goal === 'Lose Fat') {
      items.push('Keep meals protein-focused and add a short walk after eating whenever you can.');
    } else if (profile.goal === 'Gain Muscle') {
      items.push('Train with control, eat enough protein, and recover well so strength can go up steadily.');
    } else {
      items.push('Stay balanced today: moderate workout intensity, steady meals, and enough sleep tonight.');
    }

    return items;
  }, [currentLog.studyMinutes, profile]);

  return (
    <div className="space-y-5 pb-28 sm:pb-24">
      <header className="glass rounded-[32px] border border-blue-100 p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">Progress Dashboard</p>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl">{range === 'daily' ? 'Today' : range === 'monthly' ? 'Monthly' : 'Weekly'} insight</h1>
            <p className="muted-text mt-2 text-sm">
              Tasks, calories, water, and study with smooth visual trends.
            </p>
          </div>

          <label className="soft-surface inline-flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-black dark:text-orange-100 sm:w-auto sm:justify-start">
            <span className="muted-text text-xs uppercase tracking-[0.24em]">Range</span>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as typeof range)}
              className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-black outline-none dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
      </header>

      <CardShell>
        <p className="text-sm uppercase tracking-[0.24em] text-black">AI Fitness Guide</p>
        <div className="mt-4 space-y-3">
          {guideItems.map((item) => (
            <div key={item} className="soft-surface rounded-2xl px-4 py-3">
              <p className="text-sm text-black">{item}</p>
            </div>
          ))}
        </div>
      </CardShell>

      <div className="grid gap-5 xl:grid-cols-2">
        <CardShell>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Tasks Completed vs Pending</p>
              <h3 className="font-display text-xl">{range === 'daily' ? 'Today' : 'Trend'} overview</h3>
            </div>
          </div>
          <div className="h-56 sm:h-64 xl:h-72" key={`tasks-${range}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="day" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
                <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" stackId="a" fill="#34d399" radius={[10, 10, 0, 0]} isAnimationActive />
                <Bar dataKey="pending" stackId="a" fill="#fb923c" radius={[10, 10, 0, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardShell>

        <CardShell>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Calories Intake vs Burn</p>
              <h3 className="font-display text-xl">{range === 'daily' ? 'Today' : 'Trend'} overview</h3>
            </div>
          </div>
          <div className="h-56 sm:h-64 xl:h-72" key={`calories-${range}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={caloriesSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="day" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
                <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="consumed" stroke="#fb923c" strokeWidth={3} dot={{ r: 3 }} isAnimationActive />
                <Line type="monotone" dataKey="burned" stroke="#34d399" strokeWidth={3} dot={{ r: 3 }} isAnimationActive />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardShell>
      </div>

      <div className="grid gap-5 2xl:grid-cols-3">
        <WeeklyChart title="Study Hours" data={buildSeries('studyMinutes')} color="#1d7f82" />
        <WeeklyChart title="Water Intake (L)" data={buildSeries('waterIntakeMl')} color="#0ea5e9" />
        <WeeklyChart title="Calories Consumed" data={buildSeries('caloriesConsumed')} color="#4d7b58" />
      </div>

      <CardShell>
        <p className="text-sm uppercase tracking-[0.24em] text-black">Streak History</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {streakSeries.length ? (
            streakSeries.map((item) => (
              <div key={item.day} className="soft-surface rounded-2xl px-4 py-4">
                <p className="muted-text text-sm">{item.day}</p>
                <p className="mt-2 font-display text-2xl">{item.value} days</p>
              </div>
            ))
          ) : (
            <p className="muted-text text-sm">Complete your goals to start a streak history.</p>
          )}
        </div>
      </CardShell>
    </div>
  );
};
