import { FormEvent, useMemo, useState } from 'react';
import {
  BookOpenText,
  CheckCircle2,
  Circle,
  ClipboardList,
  Dumbbell,
  Droplets,
  Plus,
  Trash2,
} from 'lucide-react';
import { todayKey } from '../lib/date';
import { classNames } from '../lib/utils';
import { TaskItem } from '../types';
import { CardShell } from './CardShell';
import { ProgressBar } from './ProgressBar';

const formatDueTime = (isoString: string | null) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ProgressRing = ({ value }: { value: number }) => {
  const size = 46;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);
  const gradientId = 'okra-task-ring';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="55%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} fill="transparent" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={`url(#${gradientId})`}
        strokeWidth={stroke}
        fill="transparent"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="currentColor"
        className="font-semibold text-black dark:text-zinc-50"
        style={{ fontSize: 11 }}
      >
        {value}%
      </text>
    </svg>
  );
};

const shortenWorkoutLabel = (label: string) => {
  const raw = String(label || '').trim();
  if (!raw) return '';

  const simplified = raw
    .replace(/\bminutes\b/gi, 'min')
    .replace(/\bminute\b/gi, 'min')
    .replace(/\bhours\b/gi, 'h')
    .replace(/\bhour\b/gi, 'h');

  const firstChunk = simplified.split(',')[0]?.trim() || simplified;
  if (firstChunk.length <= 42) return firstChunk;
  return `${firstChunk.slice(0, 39)}...`;
};

export const TasksCard = ({
  tasks,
  goals,
  onCreate,
  onToggle,
  onDelete,
}: {
  tasks: TaskItem[];
  goals?: {
    waterTargetLiters: number;
    waterConsumedLiters: number;
    waterRemainingLiters: number;
    studyTargetHours: number;
    studyDoneHours: number;
    studyRemainingHours: number;
    workoutTotalTasks: number;
    workoutDoneTasks: number;
    workoutRemainingTasks: number;
    workoutRemainingLabels: string[];
  };
  onCreate: (title: string, dueAtIso: string | null) => Promise<void>;
  onToggle: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}) => {
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);

  const today = todayKey();

  const tasksDueToday = useMemo(
    () => (tasks || []).filter((task) => task.dueDate <= today),
    [tasks, today],
  );

  const relevantTasks = useMemo(() => {
    const sorted = [...(tasks || [])].sort((a, b) => {
      const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return dueA - dueB;
    });

    // Show today + overdue tasks first, then upcoming.
    const overdueOrToday = sorted.filter((task) => task.dueDate <= today);
    const upcoming = sorted.filter((task) => task.dueDate > today);
    return [...overdueOrToday, ...upcoming].slice(0, 12);
  }, [tasks, today]);

  const completion = useMemo(() => {
    const total = tasksDueToday.length || 0;
    const done = tasksDueToday.filter((task) => task.completed).length;
    return {
      total,
      done,
      pending: total - done,
      percent: total ? Math.round((done / total) * 100) : 0,
    };
  }, [tasksDueToday]);

  const goalsProgress = useMemo(() => {
    if (!goals) return null;

    const waterPct =
      goals.waterTargetLiters > 0 ? Math.min(1, goals.waterConsumedLiters / goals.waterTargetLiters) : 0;
    const studyPct = goals.studyTargetHours > 0 ? Math.min(1, goals.studyDoneHours / goals.studyTargetHours) : 0;
    const workoutPct = goals.workoutTotalTasks > 0 ? Math.min(1, goals.workoutDoneTasks / goals.workoutTotalTasks) : 0;

    const overall = Math.round(((waterPct + studyPct + workoutPct) / 3) * 100);

    return {
      waterPct: Math.round(waterPct * 100),
      studyPct: Math.round(studyPct * 100),
      workoutPct: Math.round(workoutPct * 100),
      overall,
      goalsLeft:
        (goals.waterRemainingLiters > 0.05 ? 1 : 0) +
        (goals.studyRemainingHours > 0.05 ? 1 : 0) +
        (goals.workoutRemainingTasks > 0 ? 1 : 0),
    };
  }, [goals]);

  const goalChecklist = useMemo(() => {
    if (!goals) return null;
    const waterDone = goals.waterRemainingLiters <= 0.05;
    const studyDone = goals.studyRemainingHours <= 0.05;
    const workoutDone = goals.workoutRemainingTasks <= 0;
    const done = (waterDone ? 1 : 0) + (studyDone ? 1 : 0) + (workoutDone ? 1 : 0);
    return {
      total: 3,
      done,
      pending: 3 - done,
      waterDone,
      studyDone,
      workoutDone,
    };
  }, [goals]);

  const overallPercent = goalsProgress
    ? completion.total
      ? Math.round((goalsProgress.overall + completion.percent) / 2)
      : goalsProgress.overall
    : completion.percent;

  const workoutNext = goals?.workoutRemainingLabels?.length
    ? goals.workoutRemainingLabels
        .map(shortenWorkoutLabel)
        .filter(Boolean)
        .slice(0, 1)
    : [];

  const checklistTotals = useMemo(() => {
    const goalsTotal = goalChecklist?.total ?? 0;
    const goalsDone = goalChecklist?.done ?? 0;
    const goalsLeft = goalsTotal - goalsDone;
    const tasksTotal = completion.total;
    const tasksDone = completion.done;
    const tasksLeft = tasksTotal - tasksDone;

    const total = goalsTotal + tasksTotal;
    const done = goalsDone + tasksDone;
    const left = total - done;

    return {
      goalsTotal,
      goalsDone,
      goalsLeft,
      tasksTotal,
      tasksDone,
      tasksLeft,
      total,
      done,
      left,
    };
  }, [completion.done, completion.total, goalChecklist?.done, goalChecklist?.total]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const safeTitle = title.trim();
    if (!safeTitle) return;

    setBusy(true);
    try {
      const dueAtIso = deadline ? new Date(deadline).toISOString() : null;
      await onCreate(safeTitle, dueAtIso);
      setTitle('');
      setDeadline('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell className="relative overflow-hidden rounded-[28px] border border-orange-400/20 bg-transparent">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-black dark:text-orange-100">Tasks</p>
          <h3 className="mt-2 font-display text-xl text-black dark:text-zinc-50 sm:text-2xl">Today&apos;s checklist</h3>
          <p className="muted-text mt-2 text-sm">Create tasks, tick them off, and get an 8 PM reminder email for anything unfinished.</p>
        </div>
        <div className="soft-surface inline-flex h-12 w-12 items-center justify-center rounded-2xl text-orange-400">
          <ClipboardList size={18} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 rounded-3xl border border-orange-400/10 bg-white/60 p-4 shadow-inner dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-black/60 dark:text-orange-100/70">Progress</p>
          <p className="mt-2 font-display text-2xl text-black dark:text-zinc-50 sm:text-3xl">
            {checklistTotals.done} / {checklistTotals.total || (goalsProgress ? 3 : 1)}
          </p>
          <p className="muted-text mt-1 text-sm">
            {goalsProgress ? `${checklistTotals.goalsLeft} daily goal${checklistTotals.goalsLeft === 1 ? '' : 's'} left` : 'Daily goals'}
            {completion.total
              ? ` | ${checklistTotals.tasksLeft} task${checklistTotals.tasksLeft === 1 ? '' : 's'} left`
              : ' | No custom tasks for today'}
          </p>
          <p className="muted-text mt-2 text-xs uppercase tracking-[0.22em]">
            Overall {overallPercent}% (counts partial progress)
          </p>
          <div className="mt-3">
            <ProgressBar
              value={overallPercent}
              colorClass="bg-gradient-to-r from-orange-500 via-amber-400 to-blue-500"
            />
          </div>
        </div>
        <ProgressRing value={overallPercent} />
      </div>

      {goals ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-black dark:text-orange-100">Daily goals</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="soft-surface rounded-2xl px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-black dark:text-orange-100">
                  <Droplets size={16} />
                  Water
                </span>
                {goalChecklist?.waterDone ? (
                  <span className="check-pop inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-500">
                    <CheckCircle2 size={14} />
                    Done
                  </span>
                ) : (
                  <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70 dark:bg-white/10 dark:text-orange-100/80">
                    {goals.waterRemainingLiters.toFixed(1)}L left
                  </span>
                )}
              </div>
              <p className="mt-4 font-display text-2xl text-black dark:text-zinc-50">
                {goals.waterConsumedLiters.toFixed(1)} / {goals.waterTargetLiters.toFixed(1)}L
              </p>
              <p className="muted-text mt-1 text-xs uppercase tracking-[0.22em]">{goalsProgress?.waterPct ?? 0}% complete</p>
              <div className="mt-3">
                <ProgressBar value={goalsProgress?.waterPct ?? 0} colorClass="bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
              </div>
            </div>

            <div className="soft-surface rounded-2xl px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-black dark:text-orange-100">
                  <BookOpenText size={16} />
                  Study
                </span>
                {goalChecklist?.studyDone ? (
                  <span className="check-pop inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-500">
                    <CheckCircle2 size={14} />
                    Done
                  </span>
                ) : (
                  <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70 dark:bg-white/10 dark:text-orange-100/80">
                    {goals.studyRemainingHours.toFixed(1)}h left
                  </span>
                )}
              </div>
              <p className="mt-4 font-display text-2xl text-black dark:text-zinc-50">
                {goals.studyDoneHours.toFixed(1)} / {goals.studyTargetHours.toFixed(1)}h
              </p>
              <p className="muted-text mt-1 text-xs uppercase tracking-[0.22em]">{goalsProgress?.studyPct ?? 0}% complete</p>
              <div className="mt-3">
                <ProgressBar value={goalsProgress?.studyPct ?? 0} colorClass="bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300" />
              </div>
            </div>

            <div className="soft-surface rounded-2xl px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-black dark:text-orange-100">
                  <Dumbbell size={16} />
                  Workout
                </span>
                {goalChecklist?.workoutDone ? (
                  <span className="check-pop inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-500">
                    <CheckCircle2 size={14} />
                    Done
                  </span>
                ) : (
                  <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/70 dark:bg-white/10 dark:text-orange-100/80">
                    {goals.workoutRemainingTasks} left
                  </span>
                )}
              </div>
              <p className="mt-4 font-display text-2xl text-black dark:text-zinc-50">
                {goals.workoutDoneTasks} / {goals.workoutTotalTasks} steps
              </p>
              <p className="muted-text mt-1 text-xs uppercase tracking-[0.22em]">{goalsProgress?.workoutPct ?? 0}% complete</p>
              <div className="mt-3">
                <ProgressBar value={goalsProgress?.workoutPct ?? 0} colorClass="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-blue-500" />
              </div>
              {workoutNext.length ? (
                <p className="muted-text mt-3 text-xs uppercase tracking-[0.22em]">
                  Next: <span className="text-black dark:text-orange-50">{workoutNext[0]}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-5 text-sm uppercase tracking-[0.24em] text-black dark:text-orange-100">Custom tasks</p>

      <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task (e.g., Finish 45m study block)"
            className="w-full rounded-2xl border border-orange-400/25 bg-white px-4 py-3 text-black outline-none transition focus:border-orange-400 dark:bg-[#17110b] dark:text-orange-50"
          />
          <input
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="w-full rounded-2xl border border-orange-400/25 bg-white px-4 py-3 text-black outline-none transition focus:border-orange-400 dark:bg-[#17110b] dark:text-orange-50"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="btn-glow inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white transition hover:bg-orange-600 active:scale-[0.99] disabled:opacity-60 sm:w-auto"
        >
          <Plus size={18} />
          Add
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {relevantTasks.length ? (
          relevantTasks.map((task) => {
            const dueTime = formatDueTime(task.dueAt);
            const isOverdue = task.dueDate < today && !task.completed;

            return (
              <div key={task.id} className="soft-surface flex flex-col gap-3 rounded-2xl px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <button
                  type="button"
                  onClick={() => void onToggle(task.id)}
                  className="btn-glow flex flex-1 items-start gap-3 text-left active:scale-[0.99]"
                >
                  <span className={task.completed ? 'check-pop text-emerald-400' : 'text-orange-200/70'}>
                    {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={classNames(
                        'block truncate text-sm font-semibold',
                        task.completed ? 'text-black/60 line-through dark:text-orange-100/60' : 'text-black dark:text-zinc-50',
                      )}
                    >
                      {task.title}
                    </span>
                    <span className={classNames('mt-1 block text-xs uppercase tracking-[0.22em]', isOverdue ? 'text-rose-300' : 'muted-text')}>
                      {task.dueDate === today ? 'Today' : task.dueDate} {dueTime ? `| ${dueTime}` : ''}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void onDelete(task.id)}
                  className="soft-surface panel-hover btn-glow inline-flex h-10 w-10 items-center justify-center self-start rounded-2xl text-orange-100/80 active:scale-[0.99] sm:self-auto"
                  aria-label="Delete task"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })
        ) : (
          <div className="soft-surface rounded-2xl px-4 py-4 text-sm text-black/70 dark:text-orange-100/70">
            Add a task to start tracking your day.
          </div>
        )}
      </div>
    </CardShell>
  );
};
