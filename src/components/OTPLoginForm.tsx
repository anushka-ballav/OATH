import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { sendOtp, verifyOtp } from '../services/auth';
import { UserSession } from '../types';
import { BrandLogo } from './BrandLogo';
import { CardShell } from './CardShell';
import { OTPCodeInput } from './OTPCodeInput';
import { classNames } from '../lib/utils';

interface OTPLoginFormProps {
  onLogin: (session: UserSession) => Promise<void>;
}

export const OTPLoginForm = ({ onLogin }: OTPLoginFormProps) => {
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState('Enter your email address to receive an OTP.');
  const [statusTone, setStatusTone] = useState<'info' | 'success' | 'error'>('info');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;

    const interval = window.setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [cooldown]);

  const canVerify = useMemo(() => otp.trim().length === 6, [otp]);

  const handleSendOtp = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const result = await sendOtp(identifier.trim());
      setStatus(result.code ? `${result.message} Demo code: ${result.code}` : result.message);
      setStatusTone('success');
      setOtpSent(true);
      setOtp('');
      setCooldown(30);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to send OTP.');
      setStatusTone('error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const session = await verifyOtp(identifier.trim(), otp.trim());
      await onLogin(session);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Verification failed.');
      setStatusTone('error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);

    try {
      const result = await sendOtp(identifier.trim());
      setStatus(result.code ? `${result.message} Demo code: ${result.code}` : result.message);
      setStatusTone('success');
      setCooldown(30);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to resend OTP.');
      setStatusTone('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CardShell className="mx-auto w-full max-w-md border-blue-100 bg-gradient-to-br from-white/95 via-white/90 to-orange-50/80 shadow-2xl shadow-blue-100/60 dark:from-[#0d0d0d] dark:via-[#111111] dark:to-[#1a120a] dark:shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
      <div className="mb-6 space-y-3">
        <BrandLogo />
        <div className="inline-flex rounded-full bg-blue-100 px-3 py-2 text-black dark:bg-orange-500/15 dark:text-orange-100">
          <Mail size={18} />
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-clay dark:text-orange-200">Welcome Back</p>
          <h1 className="font-display text-2xl sm:text-3xl">Discipline AI Tracker</h1>
        </div>
        <p className="muted-text text-sm sm:text-base">
          Secure your routine with email OTP login. Email delivery works when configured, and demo mode still keeps the app usable.
        </p>
      </div>

      <form className="space-y-4" onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Email address</span>
          <input
            required
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (otpSent) {
                setOtpSent(false);
                setOtp('');
                setCooldown(0);
                setStatusTone('info');
                setStatus('Enter your email address to receive an OTP.');
              }
            }}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-black outline-none transition focus:border-clay focus:ring-2 focus:ring-blue-100 dark:border-orange-400/25 dark:bg-[#17110b] dark:text-orange-50 dark:focus:ring-orange-500/20"
            placeholder="you@example.com"
          />
          <span className="muted-text mt-2 block text-xs">
            We&apos;ll ask for profile details like gender after you log in.
          </span>
        </label>

        {otpSent && (
          <div className="space-y-3">
            <div>
              <span className="mb-2 block text-sm font-medium">Enter OTP</span>
              <OTPCodeInput value={otp} onChange={setOtp} autoFocus disabled={loading} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={loading || !canVerify}
                className="btn-glow flex items-center justify-center gap-2 rounded-2xl bg-blue-100 px-4 py-3 font-semibold text-black transition hover:bg-blue-200 active:scale-[0.99] disabled:opacity-60 dark:bg-orange-500/20 dark:text-orange-50 dark:hover:bg-orange-500/30"
              >
                <KeyRound size={18} />
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={loading || cooldown > 0}
                className="soft-surface panel-hover btn-glow w-full rounded-2xl px-4 py-3 text-sm font-semibold text-black transition active:scale-[0.99] disabled:opacity-60 dark:text-orange-100"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </div>
        )}

        {!otpSent ? (
          <button
            type="submit"
            disabled={loading}
            className="btn-glow flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-100 px-4 py-3 font-semibold text-black transition hover:bg-blue-200 active:scale-[0.99] disabled:opacity-60 dark:bg-orange-500/20 dark:text-orange-50 dark:hover:bg-orange-500/30"
          >
            <ArrowRight size={18} />
            {loading ? 'Please wait...' : 'Send OTP'}
          </button>
        ) : null}
      </form>

      <p
        className={classNames(
          'mt-4 rounded-2xl border px-4 py-3 text-sm',
          statusTone === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200'
            : statusTone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
              : 'border-blue-100 bg-blue-50 text-black dark:border-orange-400/25 dark:bg-orange-500/10 dark:text-orange-100',
        )}
      >
        {status}
      </p>
    </CardShell>
  );
};
