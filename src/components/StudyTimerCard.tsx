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

interface StudyTimerState {
  status: 'idle' | 'running' | 'paused';
  elapsedSeconds: number;
  startedAtMs: number | null;
}

const STUDY_TIMER_STORAGE_KEY = 'oath-study-timer-state';
const defaultStudyTimerState: StudyTimerState = {
  status: 'idle',
  elapsedSeconds: 0,
  startedAtMs: null,
};

const formatTimerDisplay = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const normalizeStudyTimerState = (value: unknown): StudyTimerState => {
  if (!value || typeof value !== 'object') return defaultStudyTimerState;

  const candidate = value as Partial<StudyTimerState>;
  const status =
    candidate.status === 'running' || candidate.status === 'paused' || candidate.status === 'idle'
      ? candidate.status
      : 'idle';
  const elapsedSeconds = Math.max(0, Math.round(Number(candidate.elapsedSeconds) || 0));
  const startedAtMs =
    status === 'running' && Number.isFinite(candidate.startedAtMs)
      ? Number(candidate.startedAtMs)
      : null;

  return {
    status,
    elapsedSeconds,
    startedAtMs,
  };
};

const readStudyTimerState = (): StudyTimerState => {
  try {
    return normalizeStudyTimerState(JSON.parse(window.localStorage.getItem(STUDY_TIMER_STORAGE_KEY) || 'null'));
  } catch {
    return defaultStudyTimerState;
  }
};

const persistStudyTimerState = (state: StudyTimerState) => {
  try {
    if (state.status === 'idle' && state.elapsedSeconds === 0 && state.startedAtMs === null) {
      window.localStorage.removeItem(STUDY_TIMER_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STUDY_TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the timer usable even if storage is unavailable.
  }
};

const getElapsedSeconds = (state: StudyTimerState, nowMs = Date.now()) => {
  if (state.status !== 'running' || !state.startedAtMs) {
    return state.elapsedSeconds;
  }

  return state.elapsedSeconds + Math.max(0, Math.floor((nowMs - state.startedAtMs) / 1000));
};

export const StudyTimerCard = ({ onSave, todayMinutes = 0, goalMinutes = 0 }: StudyTimerCardProps) => {
  const [timerState, setTimerState] = useState<StudyTimerState>(() => readStudyTimerState());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    persistStudyTimerState(timerState);
  }, [timerState]);

  useEffect(() => {
    if (timerState.status !== 'running') return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [timerState.status, timerState.startedAtMs]);

  const elapsedSeconds = getElapsedSeconds(timerState, nowMs);
  const isRunning = timerState.status === 'running';

  const handleToggleTimer = () => {
    setTimerState((previous) => {
      const computedElapsedSeconds = getElapsedSeconds(previous);

      if (previous.status === 'running') {
        return {
          status: 'paused',
          elapsedSeconds: computedElapsedSeconds,
          startedAtMs: null,
        };
      }

      return {
        status: 'running',
        elapsedSeconds: computedElapsedSeconds,
        startedAtMs: Date.now(),
      };
    });
  };

  const commitSession = async () => {
    const sessionSeconds = getElapsedSeconds(timerState);
    if (!sessionSeconds || isSaving) return;

    const minutes = Math.max(1, Math.round(sessionSeconds / 60));
    setIsSaving(true);

    try {
      await onSave(minutes);
      setTimerState(defaultStudyTimerState);
    } finally {
      setIsSaving(false);
    }
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
        onClick={handleToggleTimer}
        className="btn-glow mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-orange-600 active:scale-[0.99]"
      >
        {isRunning ? <Pause size={18} /> : <Play size={18} />}
        {isRunning ? 'Pause' : elapsedSeconds ? 'Resume' : 'Start'}
      </button>

      <button
        type="button"
        onClick={commitSession}
        disabled={elapsedSeconds === 0 || isSaving}
        className="btn-glow mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-400/25 bg-transparent px-4 py-3 font-semibold text-black transition active:scale-[0.99] disabled:opacity-40 dark:text-orange-100"
      >
        <Square size={18} />
        {isSaving ? 'Saving...' : 'Stop & save'}
      </button>

      <p className="muted-text mt-3 text-center text-sm">
        Total today: {formatMinutes(todayMinutes)} • {goalMinutes ? `${percent(todayMinutes, goalMinutes)}% of goal` : 'No goal'}
      </p>
    </CardShell>
  );
};
