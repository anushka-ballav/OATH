import { FormEvent, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Dumbbell, X } from 'lucide-react';
import { classNames } from '../lib/utils';

const EQUIPMENT_OPTIONS = [
  'Dumbbells',
  'Barbell',
  'Bench Press',
  'Cable Machine',
  'Resistance Bands',
  'Treadmill',
  'Pull-up Bar',
  'Leg Press Machine',
  'Other',
] as const;

interface GymModeSetupModalProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (equipment: string[], otherEquipment?: string) => Promise<void>;
}

export const GymModeSetupModal = ({
  open,
  loading = false,
  onClose,
  onSubmit,
}: GymModeSetupModalProps) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [otherEquipment, setOtherEquipment] = useState('');
  const [error, setError] = useState('');

  const hasOther = useMemo(() => selected.includes('Other'), [selected]);

  if (!open) return null;

  const toggleItem = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!selected.length) {
      setError('Select at least one equipment option.');
      return;
    }

    if (hasOther && !otherEquipment.trim()) {
      setError('Please mention the other equipment.');
      return;
    }

    try {
      await onSubmit(selected, hasOther ? otherEquipment.trim() : '');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save equipment.');
    }
  };

  return (
    <div className="gym-sheet-backdrop fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <div className="gym-sheet w-full max-w-2xl rounded-b-[28px] rounded-t-[20px] border border-orange-300/35 bg-[#120c09] p-5 shadow-2xl shadow-black/60">
        <div className="mb-3 flex justify-center">
          <span className="h-1.5 w-12 rounded-full bg-orange-200/35" aria-hidden="true" />
        </div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-orange-200/80">Gym Mode Setup</p>
            <h2 className="mt-1 text-2xl font-semibold text-orange-50">
              What gym equipment do you have access to?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-orange-300/30 bg-orange-500/10 p-2 text-orange-100 transition hover:bg-orange-500/20 disabled:opacity-60"
            aria-label="Close gym mode setup"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {EQUIPMENT_OPTIONS.map((item) => {
              const checked = selected.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem(item)}
                  className={classNames(
                    'flex items-center gap-2 rounded-2xl border px-3 py-3 text-left transition',
                    checked
                      ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-100'
                      : 'border-orange-300/25 bg-orange-500/10 text-orange-100 hover:bg-orange-500/15',
                  )}
                >
                  {checked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  <span className="text-sm font-semibold">{item}</span>
                </button>
              );
            })}
          </div>

          {hasOther ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-orange-100">Other equipment</span>
              <input
                value={otherEquipment}
                onChange={(event) => setOtherEquipment(event.target.value)}
                placeholder="Battle ropes, kettlebells..."
                className="w-full rounded-2xl border border-orange-300/30 bg-[#1a120d] px-4 py-3 text-orange-50 outline-none transition focus:border-orange-400"
              />
            </label>
          ) : null}

          {error ? (
            <p className="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-orange-300/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/20 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-60"
            >
              <Dumbbell size={16} />
              {loading ? 'Generating Plan...' : 'Generate Gym Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
