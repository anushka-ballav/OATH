import { CheckCircle2, Circle, Dumbbell } from 'lucide-react';
import { GymPlan } from '../types';
import { CardShell } from './CardShell';

interface GymWeeklyPlanCardProps {
  plan: GymPlan;
  onMarkDayCompleted: (day: string, completed: boolean) => Promise<void>;
}

const getTodayDay = (date = new Date()) =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

export const GymWeeklyPlanCard = ({ plan, onMarkDayCompleted }: GymWeeklyPlanCardProps) => {
  const todayDay = getTodayDay();
  const progress = plan.progress;
  const todayCompleted = progress?.lastCompletedDay === todayDay && progress?.lastCompletedDate;

  return (
    <CardShell className="overflow-hidden border-orange-300/30 bg-gradient-to-br from-[#140f0a] via-[#0f0f0f] to-[#1d1309]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-orange-200/80">Gym Weekly Split</p>
          <h3 className="mt-1 text-2xl font-semibold text-orange-50">Structured plan</h3>
          <p className="mt-2 text-sm text-orange-100/80">
            Equipment: {(plan.equipment || []).join(', ') || 'General gym setup'}
          </p>
          {plan.otherEquipment ? (
            <p className="mt-1 text-xs text-orange-100/70">Other: {plan.otherEquipment}</p>
          ) : null}
        </div>
        <span className="rounded-2xl border border-orange-300/30 bg-orange-500/15 p-3 text-orange-100">
          <Dumbbell size={18} />
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {plan.weeklySplit.map((dayPlan) => {
          const isToday = dayPlan.day === todayDay;
          const completedToday = isToday && Boolean(todayCompleted);

          return (
            <div
              key={`${dayPlan.day}-${dayPlan.focus}`}
              className={`rounded-2xl border px-3 py-3 ${
                isToday
                  ? 'border-emerald-300/45 bg-emerald-500/15'
                  : 'border-orange-300/25 bg-orange-500/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-orange-50">
                    {dayPlan.day} • {dayPlan.focus}
                  </p>
                  <p className="mt-1 text-xs text-orange-100/75">
                    {dayPlan.isRestDay ? 'Recovery / active rest day' : `${dayPlan.tasks.length} tasks planned`}
                  </p>
                </div>
                {isToday ? (
                  <button
                    type="button"
                    onClick={() => void onMarkDayCompleted(dayPlan.day, !completedToday)}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200/35 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
                  >
                    {completedToday ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    {completedToday ? 'Completed' : 'Mark done'}
                  </button>
                ) : null}
              </div>

              <div className="mt-2 grid gap-1">
                {dayPlan.tasks.map((task) => (
                  <p key={`${dayPlan.day}-${task.id}`} className="text-xs text-orange-100/80">
                    • {task.label}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-orange-300/25 bg-orange-500/10 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-orange-100/70">Gym Streak</p>
          <p className="mt-1 text-xl font-semibold text-orange-50">{progress?.streak ?? 0} days</p>
        </div>
        <div className="rounded-2xl border border-orange-300/25 bg-orange-500/10 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-orange-100/70">Sessions Done</p>
          <p className="mt-1 text-xl font-semibold text-orange-50">
            {progress?.totalCompletedSessions ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-orange-300/25 bg-orange-500/10 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-orange-100/70">Updated</p>
          <p className="mt-1 text-sm font-semibold text-orange-50">
            {new Date(plan.generatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </CardShell>
  );
};
