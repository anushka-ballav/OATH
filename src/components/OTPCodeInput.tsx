import { useEffect, useMemo, useRef } from 'react';
import { classNames } from '../lib/utils';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

export const OTPCodeInput = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const normalized = onlyDigits(String(value || '')).slice(0, length);
    return Array.from({ length }, (_, index) => normalized[index] || '');
  }, [length, value]);

  useEffect(() => {
    if (!autoFocus) return;
    const firstEmpty = digits.findIndex((item) => !item);
    const target = refs.current[firstEmpty === -1 ? length - 1 : firstEmpty];
    target?.focus();
  }, [autoFocus, digits, length]);

  const focusIndex = (index: number) => {
    refs.current[index]?.focus();
    refs.current[index]?.select();
  };

  const setDigits = (nextDigits: string[]) => {
    onChange(nextDigits.join(''));
  };

  const handleInput = (index: number, raw: string) => {
    const cleaned = onlyDigits(raw);
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const next = [...digits];
    const chars = cleaned.split('');

    for (let offset = 0; offset < chars.length; offset += 1) {
      const nextIndex = index + offset;
      if (nextIndex >= length) break;
      next[nextIndex] = chars[offset];
    }

    setDigits(next);
    focusIndex(Math.min(length - 1, index + chars.length));
  };

  return (
    <div className="flex items-center justify-between gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          aria-label={`OTP digit ${index + 1}`}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Backspace') {
              if (digits[index]) {
                const next = [...digits];
                next[index] = '';
                setDigits(next);
                return;
              }

              if (index > 0) {
                focusIndex(index - 1);
              }
            }

            if (event.key === 'ArrowLeft' && index > 0) {
              focusIndex(index - 1);
            }

            if (event.key === 'ArrowRight' && index < length - 1) {
              focusIndex(index + 1);
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const text = onlyDigits(event.clipboardData.getData('text')).slice(0, length);
            if (!text) return;

            const next = Array.from({ length }, (_, idx) => text[idx] || '');
            setDigits(next);
            const nextIndex = Math.min(length - 1, text.length);
            focusIndex(nextIndex);
          }}
          onFocus={(event) => event.currentTarget.select()}
          className={classNames(
            'h-14 w-12 rounded-2xl border text-center text-lg font-semibold outline-none transition',
            'border-slate-300 bg-white text-black focus:border-clay focus:ring-2 focus:ring-blue-100',
            'dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50 dark:focus:ring-orange-500/20',
            disabled ? 'opacity-60' : 'hover:-translate-y-0.5',
          )}
        />
      ))}
    </div>
  );
};

