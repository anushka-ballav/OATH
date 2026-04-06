import { useEffect, useState } from 'react';
import { Pause, Play, Square, BookOpenText } from 'lucide-react';
import { formatMinutes } from '../lib/date';
import { percent } from '../lib/utils';
import { CardShell } from './CardShell';

interface StudyTimerCardProps {
  onSave: (minutes: number) => Promise<void>;
  todayMinutes?: number;
  goalMinutes?: number;
}

const formatTimerDisplay = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const StudyTimerCard = ({ onSave, todayMinutes = 0, goalMinutes = 0 }: StudyTimerCardProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  const commitSession = async () => {
    setIsRunning(false);
    const sessionSeconds = elapsedSeconds;
    setElapsedSeconds(0);
    const minutes = Math.max(1, Math.round(sessionSeconds / 60));
    await onSave(minutes);
  };

  return (
    <CardShell className="relative overflow-hidden rounded-[28px] border border-orange-400/20 bg-transparent">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-black">Study Timer</p>
          <p className="muted-text mt-2 text-sm">
            {formatMinutes(todayMinutes)} / {goalMinutes ? `${formatMinutes(goalMinutes)} goal` : 'Goal not set'}
          </p>
        </div>
        <div className="soft-surface inline-flex h-12 w-12 items-center justify-center rounded-2xl text-orange-200">
          <BookOpenText size={18} />
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center justify-center">
        <div className="font-display text-6xl tabular-nums">{formatTimerDisplay(elapsedSeconds)}</div>
        <p className="muted-text mt-3 text-sm">{isRunning ? 'Session running' : elapsedSeconds ? 'Paused' : 'Ready to focus'}</p>
      </div>

      <button
        type="button"
        onClick={() => setIsRunning((value) => !value)}
        className="btn-glow mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-orange-600 active:scale-[0.99]"
      >
        {isRunning ? <Pause size={18} /> : <Play size={18} />}
        {isRunning ? 'Pause' : elapsedSeconds ? 'Resume' : 'Start'}
      </button>

      <button
        type="button"
        onClick={commitSession}
        disabled={elapsedSeconds === 0}
        className="btn-glow mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-400/25 bg-transparent px-4 py-3 font-semibold text-black transition active:scale-[0.99] disabled:opacity-40 dark:text-orange-100"
      >
        <Square size={18} />
        Stop & save
      </button>

      <p className="muted-text mt-3 text-center text-sm">
        Total today: {formatMinutes(todayMinutes)} • {goalMinutes ? `${percent(todayMinutes, goalMinutes)}% of goal` : 'No goal'}
      </p>
    </CardShell>
  );
};
