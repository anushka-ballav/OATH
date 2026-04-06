import { FormEvent, useMemo, useState } from 'react';
import { Bot, SendHorizonal } from 'lucide-react';
import { CardShell } from '../components/CardShell';
import { useApp } from '../context/AppContext';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const AICompanionPage = () => {
  const { profile, currentLog } = useApp();
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

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const nextConversation = [...conversation, { role: 'user' as const, text: trimmed }];
    setConversation(nextConversation);
    setMessage('');
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

      setConversation((prev) => [...prev, { role: 'assistant', text: reply }]);
      setStatus(
        data.source === 'groq'
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
    <div className="space-y-5 pb-24">
      <header className="glass rounded-[32px] border border-blue-100 p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-blue-100 p-3 text-black">
            <Bot size={18} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-black">AI Companion</p>
            <h1 className="mt-1 font-display text-3xl">Your daily guide</h1>
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
        <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
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
        </div>

        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-400/35 dark:bg-[#18110a] dark:text-orange-100">
          {status}
        </div>

        <form className="mt-4 flex gap-3" onSubmit={handleSubmit}>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask for advice..."
            className="flex-1 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-blue-100 px-4 py-3 text-black disabled:opacity-60"
          >
            <SendHorizonal size={18} />
          </button>
        </form>
      </CardShell>
    </div>
  );
};
