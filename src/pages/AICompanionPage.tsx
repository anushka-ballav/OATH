import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, SendHorizonal } from 'lucide-react';
import { CardShell } from '../components/CardShell';
import { useApp } from '../context/AppContext';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CompanionExercise = {
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
};

type CompanionAction =
  | {
      type: 'add_workout_exercises';
      exercises: CompanionExercise[];
    }
  | {
      type: 'remove_workout_exercises';
      exercises: Array<{ name: string; durationMinutes?: number }>;
    }
  | {
      type: 'log_completed_workout';
      exercise: CompanionExercise;
    };

type QuickWorkoutCommand =
  | {
      type: 'add';
      exercise: CompanionExercise;
    }
  | {
      type: 'remove';
      exercise: { name: string; durationMinutes?: number };
    };

const normalizeExerciseName = (value: string) =>
  String(value || '')
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const estimateWorkoutCalories = (weightKg: number, durationMinutes: number) => {
  const safeWeight = Math.max(35, Math.round(weightKg || 70));
  const safeMinutes = Math.max(5, Math.round(durationMinutes));
  const moderateMet = 6.2;
  return Math.max(30, Math.round(((moderateMet * 3.5 * safeWeight) / 200) * safeMinutes));
};

const parseQuickWorkoutCommand = (input: string, weightKg: number): QuickWorkoutCommand | null => {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  const addMatch = normalized.match(/\b(add|include|append|put)\b/);
  const removeMatch = normalized.match(/\b(remove|delete|undo)\b/);
  const minutesMatch = raw.match(/(\d+(\.\d+)?)\s*(min|mins|minute|minutes|ins)\b/i);
  const caloriesMatch = raw.match(/(\d+(\.\d+)?)\s*(kcal|cal(?:ories)?|cals?)\b/i);

  const extractName = (commandWord: string) =>
    normalizeExerciseName(
      raw
        .replace(new RegExp(`\\b${commandWord}\\b`, 'i'), ' ')
        .replace(/(\d+(\.\d+)?)\s*(min|mins|minute|minutes|ins)\b/gi, ' ')
        .replace(/(\d+(\.\d+)?)\s*(kcal|cal(?:ories)?|cals?)\b/gi, ' ')
        .replace(/\b(workout|exercise|routine|plan|daily|today|to|my|the|from)\b/gi, ' '),
    );

  if (addMatch) {
    const durationMinutes = Math.max(1, Math.round(Number(minutesMatch?.[1]) || 0));
    const name = extractName(addMatch[1]);
    if (!name || !durationMinutes) return null;
    const caloriesBurned = Math.max(
      1,
      Math.round(Number(caloriesMatch?.[1]) || estimateWorkoutCalories(weightKg, durationMinutes)),
    );

    return {
      type: 'add',
      exercise: {
        name,
        durationMinutes,
        caloriesBurned,
      },
    };
  }

  if (removeMatch) {
    const name = extractName(removeMatch[1]);
    if (!name) return null;
    const durationMinutes = minutesMatch?.[1] ? Math.max(1, Math.round(Number(minutesMatch[1]))) : undefined;
    return {
      type: 'remove',
      exercise: {
        name,
        durationMinutes,
      },
    };
  }

  return null;
};

export const AICompanionPage = () => {
  const {
    profile,
    currentLog,
    markEasterEggFound,
    addWorkoutExercises,
    removeWorkoutExercises,
    addCustomWorkoutEntry,
  } = useApp();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('AI is ready. Add your Groq key to use the smarter companion.');
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'I am your AI companion. Ask me about study focus, workouts, water, calories, or staying disciplined today.',
    },
  ]);

  const quickPrompts = useMemo(
    () => ['How should I study today?', 'What should I eat next?', 'Motivate me to work out', 'How much water should I drink?'],
    [],
  );

  if (!profile) return null;

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [conversation.length, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase().replace(/\s+/g, ' ') === 'up up down down left right left right') {
      markEasterEggFound('konami-companion');
    }

    const nextConversation = [...conversation, { role: 'user' as const, text: trimmed }];
    setConversation(nextConversation);
    setMessage('');
    const quickCommand = parseQuickWorkoutCommand(trimmed, profile.weight);

    if (quickCommand) {
      setLoading(true);
      try {
        if (quickCommand.type === 'add') {
          const addedCount = await addWorkoutExercises([quickCommand.exercise]);
          if (addedCount > 0) {
            await addCustomWorkoutEntry(
              quickCommand.exercise.name,
              quickCommand.exercise.durationMinutes,
              quickCommand.exercise.caloriesBurned,
              'companion',
            );
            const doneText = `Done. Added ${quickCommand.exercise.durationMinutes} min ${quickCommand.exercise.name} to today's workout and logged ${quickCommand.exercise.caloriesBurned} kcal in custom workouts.`;
            setConversation((prev) => [...prev, { role: 'assistant', text: doneText }]);
            setStatus('Done: workout updated.');
          } else {
            setConversation((prev) => [
              ...prev,
              { role: 'assistant', text: 'That workout is already present, so I did not add a duplicate.' },
            ]);
            setStatus('No changes made.');
          }
          return;
        }

        const removedCount = await removeWorkoutExercises([quickCommand.exercise]);
        const removeText =
          removedCount > 0
            ? `Done. Removed ${quickCommand.exercise.durationMinutes ? `${quickCommand.exercise.durationMinutes} min ` : ''}${quickCommand.exercise.name} from companion-added workouts.`
            : 'I could not find that companion-added workout to remove.';
        setConversation((prev) => [...prev, { role: 'assistant', text: removeText }]);
        setStatus(removedCount > 0 ? 'Done: workout removed.' : 'No matching companion workout found.');
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unable to process workout command.';
        setConversation((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `I could not process that workout command: ${errorMessage}`,
          },
        ]);
        setStatus(`Companion error: ${errorMessage}`);
        return;
      } finally {
        setLoading(false);
      }
    }

    setStatus('AI is thinking...');

    setLoading(true);
    const requestStartedAt = Date.now();

    try {
      const response = await fetch('/api/ai/companion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          conversation,
          profile,
          dailyLog: currentLog,
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        source: 'groq' | 'local-fallback' | 'groq-error';
        actions?: CompanionAction[];
        message?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Unable to get companion response.');
      }

      if (!data.reply) {
        throw new Error('AI did not return a reply.');
      }

      const reply = data.reply;
      const elapsed = Date.now() - requestStartedAt;

      if (elapsed < 1200) {
        await delay(1200 - elapsed);
      }

      const actionNotes: string[] = [];
      const actions = Array.isArray(data.actions) ? data.actions : [];

      for (const action of actions) {
        if (action.type === 'add_workout_exercises' && Array.isArray(action.exercises)) {
          const addedCount = await addWorkoutExercises(action.exercises);
          let loggedCount = 0;

          for (const exercise of action.exercises) {
            const name = String(exercise?.name || '').trim();
            const durationMinutes = Math.max(1, Math.round(Number(exercise?.durationMinutes) || 0));
            const caloriesBurned = Math.max(1, Math.round(Number(exercise?.caloriesBurned) || 0));
            if (!name) continue;
            await addCustomWorkoutEntry(name, durationMinutes, caloriesBurned, 'companion');
            loggedCount += 1;
          }

          if (addedCount > 0) {
            actionNotes.push(
              `${addedCount} exercise${addedCount > 1 ? 's were' : ' was'} added to today's workout plan.`,
            );
          }
          if (loggedCount > 0) {
            actionNotes.push(
              `${loggedCount} exercise${loggedCount > 1 ? 's' : ''} logged in custom workout calories.`,
            );
          }
          continue;
        }

        if (action.type === 'remove_workout_exercises' && Array.isArray(action.exercises)) {
          const removed = await removeWorkoutExercises(action.exercises);
          if (removed > 0) {
            actionNotes.push(`Removed ${removed} companion-added workout task${removed > 1 ? 's' : ''}.`);
          }
          continue;
        }

        if (action.type === 'log_completed_workout' && action.exercise) {
          const name = String(action.exercise.name || '').trim();
          const durationMinutes = Math.max(1, Math.round(Number(action.exercise.durationMinutes) || 0));
          const caloriesBurned = Math.max(1, Math.round(Number(action.exercise.caloriesBurned) || 0));
          if (!name) continue;
          await addCustomWorkoutEntry(name, durationMinutes, caloriesBurned, 'companion');
          actionNotes.push(`Logged: ${name} (${durationMinutes} min, ${caloriesBurned} kcal).`);
        }
      }

      const replyWithActions = actionNotes.length
        ? `${reply}\n\n${actionNotes.map((note) => `• ${note}`).join('\n')}`
        : reply;

      setConversation((prev) => [...prev, { role: 'assistant', text: replyWithActions }]);
      setStatus(
        actionNotes.length
          ? `Companion updated your workout: ${actionNotes[0]}`
          : data.source === 'groq'
            ? 'Live Groq AI response generated.'
            : 'Using local fallback because no Groq key is configured or the AI request failed.',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message.includes('invalid_request_error')
          ? 'The selected AI model rejected this request. Please try again after the backend reloads.'
          : error instanceof Error
            ? error.message
            : 'Unable to get companion response.';

      setConversation((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `AI unavailable: ${errorMessage}`,
        },
      ]);
      setStatus(`Companion error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(message);
  };

  return (
    <div className="space-y-5 pb-28 sm:pb-24">
      <header className="glass rounded-[32px] border border-blue-100 p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl bg-blue-100 p-3 text-black">
            <Bot size={18} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">AI Companion</p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl">Your daily guide</h1>
          </div>
        </div>
        <p className="muted-text mt-3 text-sm">
          Get quick guidance based on your current plan, calories, study target, and workout routine.
        </p>
      </header>

      <CardShell>
        <p className="text-sm uppercase tracking-[0.24em] text-black">Quick Prompts</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              className="rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-black"
            >
              {prompt}
            </button>
          ))}
        </div>
      </CardShell>

      <CardShell>
        <p className="text-sm uppercase tracking-[0.24em] text-black">Conversation</p>
        <div className="mt-4 max-h-[55dvh] space-y-3 overflow-y-auto pr-1 sm:max-h-[32rem]">
          {conversation.map((entry, index) => (
            <div
              key={`${entry.role}-${index}`}
              className={
                entry.role === 'assistant'
                  ? 'rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-400/35 dark:bg-[#18110a]'
                  : 'rounded-2xl bg-blue-100 px-4 py-3'
              }
            >
              <p
                className={
                  entry.role === 'assistant'
                    ? 'text-xs uppercase tracking-[0.18em] text-orange-700 dark:text-orange-300'
                    : 'text-xs uppercase tracking-[0.18em] text-black'
                }
              >
                {entry.role === 'assistant' ? 'AI Companion' : 'You'}
              </p>
              <p
                className={
                  entry.role === 'assistant'
                    ? 'mt-2 whitespace-pre-wrap text-sm leading-6 text-orange-900 [overflow-wrap:anywhere] dark:text-orange-100'
                    : 'mt-2 whitespace-pre-wrap text-sm leading-6 text-black [overflow-wrap:anywhere]'
                }
              >
                {entry.text}
              </p>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-400/35 dark:bg-[#18110a] dark:text-orange-100">
          {status}
        </div>

        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask for advice..."
            rows={2}
            className="flex-1 resize-none rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none focus:border-clay dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              if (event.shiftKey) return;
              event.preventDefault();
              void sendMessage(message);
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-2xl bg-blue-100 px-4 py-3 text-black disabled:opacity-60 dark:bg-orange-500/20 dark:text-orange-50 sm:w-auto sm:px-5"
          >
            <SendHorizonal size={18} />
          </button>
        </form>
        <div style={{ height: 'env(safe-area-inset-bottom)' }} aria-hidden="true" />
      </CardShell>
    </div>
  );
};
