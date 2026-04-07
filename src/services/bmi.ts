import { BMIEntry } from '../types';

const safeJson = async <T,>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const fetchBmiHistory = async (userId: string, identifier?: string): Promise<BMIEntry[]> => {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (identifier) params.set('identifier', identifier.trim().toLowerCase());
  const response = await fetch(`/api/bmi?${params.toString()}`);
  const payload = await safeJson<{ history?: BMIEntry[]; message?: string }>(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to load BMI history.');
  }

  return Array.isArray(payload?.history) ? payload!.history : [];
};

export const recordBmi = async ({
  userId,
  identifier,
  name,
  heightCm,
  weightKg,
}: {
  userId: string;
  identifier: string;
  name?: string;
  heightCm: number;
  weightKg: number;
}): Promise<BMIEntry> => {
  const response = await fetch('/api/bmi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      identifier,
      name,
      heightCm,
      weightKg,
    }),
  });

  const payload = await safeJson<{ entry?: BMIEntry; message?: string }>(response);

  if (!response.ok || !payload?.entry) {
    throw new Error(payload?.message || 'Unable to save BMI.');
  }

  return payload.entry;
};
