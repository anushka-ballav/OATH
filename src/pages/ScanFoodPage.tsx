import { ChangeEvent, useMemo, useState } from 'react';
import { Camera, LoaderCircle, Sparkles, Trash2 } from 'lucide-react';
import { CardShell } from '../components/CardShell';
import { MacroGrid } from '../components/MacroGrid';
import { useApp } from '../context/AppContext';
import {
  analyzeFoodImage,
  createFoodEntry,
  estimateCaloriesFromName,
  estimateNutritionFromName,
} from '../services/foodRecognition';
import { FoodEntry } from '../types';

export const ScanFoodPage = () => {
  const { currentLog, addFoodEntry, removeFoodEntry, profile } = useApp();
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState('Upload a meal photo to estimate calories.');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingEntry, setPendingEntry] = useState<FoodEntry | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');

  const formatG = (value?: number) => {
    if (value === undefined || value === null || !Number.isFinite(value)) return '—';
    return `${Number.isInteger(value) ? value : Number(value.toFixed(1))}g`;
  };

  const formatMg = (value?: number) => {
    if (value === undefined || value === null || !Number.isFinite(value)) return '—';
    return `${Math.round(value)}mg`;
  };

  const remainingCalories = useMemo(() => {
    if (!profile) return 0;
    return Math.max(0, profile.dailyTargets.calories - currentLog.caloriesConsumed);
  }, [currentLog.caloriesConsumed, profile]);

  const macroTotals = useMemo(() => {
    return currentLog.foodEntries.reduce(
      (acc, entry) => ({
        proteinG: acc.proteinG + (entry.proteinG ?? 0),
        carbsG: acc.carbsG + (entry.carbsG ?? 0),
        fatG: acc.fatG + (entry.fatG ?? 0),
        sugarG: acc.sugarG + (entry.sugarG ?? 0),
        fiberG: acc.fiberG + (entry.fiberG ?? 0),
        sodiumMg: acc.sodiumMg + (entry.sodiumMg ?? 0),
      }),
      {
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        sugarG: 0,
        fiberG: 0,
        sodiumMg: 0,
      },
    );
  }, [currentLog.foodEntries]);

  const canShowManualInput = retryCount >= 1;

  const runAnalysis = async (file: File, attempt: number) => {
    setLoading(true);
    setStatus('Analyzing image...');

    try {
      const entry = await analyzeFoodImage(file, attempt);
      setPendingEntry(entry);
      setStatus(
        `Guess: ${entry.name} - ${entry.calories} kcal. Tap Done if correct, or Retry if the guess is wrong.${entry.source === 'groq' ? ' Powered by Groq AI image analysis.' : ''}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to analyze food image.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setRetryCount(0);
    setManualName('');
    setManualCalories('');
    setPendingEntry(null);
    await runAnalysis(file, 0);
  };

  const handleDone = async () => {
    if (!pendingEntry) return;

    await addFoodEntry(pendingEntry);
    setStatus(`Added ${pendingEntry.name} - ${pendingEntry.calories} kcal to today's intake.`);
    setPendingEntry(null);
    setSelectedFile(null);
    setPreview(null);
    setRetryCount(0);
    setManualName('');
    setManualCalories('');
  };

  const handleRetry = async () => {
    if (!selectedFile) return;

    const nextAttempt = retryCount + 1;
    setRetryCount(nextAttempt);
    await runAnalysis(selectedFile, nextAttempt);
  };

  const handleManualAdd = async () => {
    const trimmedName = manualName.trim();
    if (!trimmedName) {
      setStatus('Please enter a food name for manual entry.');
      return;
    }

    const caloriesValue = manualCalories.trim()
      ? Number(manualCalories)
      : estimateCaloriesFromName(trimmedName);
    const calories = Number.isFinite(caloriesValue) && caloriesValue > 0 ? caloriesValue : estimateCaloriesFromName(trimmedName);
    const nutrition = estimateNutritionFromName(trimmedName, calories);

    const entry = createFoodEntry({
      name: trimmedName,
      calories,
      ...nutrition,
      imageName: selectedFile?.name,
      source: 'mock',
    });

    await addFoodEntry(entry);
    setStatus(`Added ${entry.name} - ${entry.calories} kcal from manual entry.`);
    setPendingEntry(null);
    setSelectedFile(null);
    setPreview(null);
    setRetryCount(0);
    setManualName('');
    setManualCalories('');
  };

  return (
    <div className="space-y-5 pb-28 sm:pb-24">
      <header className="glass rounded-[32px] border border-blue-100 p-5 shadow-card">
        <p className="text-sm uppercase tracking-[0.24em] text-black">Food Recognition</p>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl">Scan your meals</h1>
        <p className="muted-text mt-2 text-sm">
          Review the guess before it is added. If the result is wrong, retry once and then use manual entry.
        </p>
      </header>

      <CardShell>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-blue-200 bg-white px-6 py-10 text-center text-black sm:rounded-[28px]">
          <Camera size={32} />
          <p className="mt-4 font-display text-xl sm:text-2xl">Scan Food</p>
          <p className="muted-text mt-2 text-sm">Tap to upload a food image</p>
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>

        {preview && <img src={preview} alt="Food preview" className="mt-5 h-48 w-full rounded-[24px] object-cover sm:h-64" />}

        <div className="soft-surface mt-5 rounded-2xl px-4 py-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Sparkles size={18} />}
            <span>{status}</span>
          </div>
        </div>

        {pendingEntry && !loading && (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
            <p className="text-sm uppercase tracking-[0.2em] text-black">Current Guess</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold">{pendingEntry.name}</p>
                <p className="text-sm text-black">{pendingEntry.calories} kcal</p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => void handleDone()}
                  className="flex-1 rounded-2xl bg-blue-100 px-4 py-2 text-sm font-semibold text-black sm:flex-none"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => void handleRetry()}
                  className="flex-1 rounded-2xl border border-blue-200 px-4 py-2 text-sm font-semibold text-black sm:flex-none"
                >
                  Retry
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="soft-surface rounded-2xl px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-black/70 dark:text-orange-100/70">Protein</p>
                <p className="mt-1 text-sm font-semibold text-black">{formatG(pendingEntry.proteinG)}</p>
              </div>
              <div className="soft-surface rounded-2xl px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-black/70 dark:text-orange-100/70">Carbs</p>
                <p className="mt-1 text-sm font-semibold text-black">{formatG(pendingEntry.carbsG)}</p>
              </div>
              <div className="soft-surface rounded-2xl px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-black/70 dark:text-orange-100/70">Fat</p>
                <p className="mt-1 text-sm font-semibold text-black">{formatG(pendingEntry.fatG)}</p>
              </div>
              <div className="soft-surface rounded-2xl px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-black/70 dark:text-orange-100/70">Sugar</p>
                <p className="mt-1 text-sm font-semibold text-black">{formatG(pendingEntry.sugarG)}</p>
              </div>
              <div className="soft-surface rounded-2xl px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-black/70 dark:text-orange-100/70">Fiber</p>
                <p className="mt-1 text-sm font-semibold text-black">{formatG(pendingEntry.fiberG)}</p>
              </div>
              <div className="soft-surface rounded-2xl px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-black/70 dark:text-orange-100/70">Sodium</p>
                <p className="mt-1 text-sm font-semibold text-black">{formatMg(pendingEntry.sodiumMg)}</p>
              </div>
            </div>
            <p className="muted-text mt-3 text-xs">
              Nutrition from images is an estimate. Use manual entry if something looks off.
            </p>
          </div>
        )}

        {canShowManualInput && selectedFile && (
          <div className="mt-4 rounded-2xl border border-blue-100 bg-white px-4 py-4">
            <p className="text-sm uppercase tracking-[0.2em] text-black">Manual Entry</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]">
              <input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="Food name"
                className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none"
              />
              <input
                type="number"
                value={manualCalories}
                onChange={(event) => setManualCalories(event.target.value)}
                placeholder="Calories"
                className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-black outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleManualAdd()}
              className="mt-3 w-full rounded-2xl bg-blue-100 px-4 py-3 font-semibold text-black"
            >
              Add manual food
            </button>
          </div>
        )}
      </CardShell>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <CardShell>
          <p className="text-sm uppercase tracking-[0.24em] text-black">Today's Nutrition</p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl">{currentLog.caloriesConsumed} kcal</h2>
          <p className="muted-text mt-2 text-sm">{remainingCalories} kcal remaining for the day.</p>

          {profile ? (
            <div className="mt-5">
              <MacroGrid totals={macroTotals} targets={profile.dailyTargets.macroTargets} />
            </div>
          ) : null}
        </CardShell>

        <CardShell>
          <p className="text-sm uppercase tracking-[0.24em] text-black">Detected Foods</p>
          <div className="mt-4 space-y-3">
            {currentLog.foodEntries.length ? (
              currentLog.foodEntries.map((entry) => (
                <div key={entry.id} className="soft-surface rounded-2xl px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{entry.name}</p>
                      <p className="muted-text text-sm">{entry.imageName ?? 'Uploaded meal'}</p>
                      <p className="muted-text mt-1 text-xs">
                        P {formatG(entry.proteinG)} • C {formatG(entry.carbsG)} • F {formatG(entry.fatG)} • Sugar{' '}
                        {formatG(entry.sugarG)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-black">
                        {entry.calories} kcal
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeFoodEntry(entry.id)}
                        className="rounded-full border border-blue-200 p-2 text-black"
                        aria-label={`Remove ${entry.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted-text text-sm">No meals scanned today.</p>
            )}
          </div>
        </CardShell>
      </div>
    </div>
  );
};
