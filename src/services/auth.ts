import { randomId } from '../lib/utils';
import { UserSession } from '../types';
import { isFirebaseConfigured } from './firebase';

const OTP_KEY = 'discipline-ai-tracker-pending-otp';
const normalizeIdentifier = (identifier: string) => identifier.trim().toLowerCase();
const canUseDemoFallback = () =>
  ['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.hostname.endsWith('.local');
const isEmailOtpProvider = (provider?: UserSession['provider']) => provider === 'email-otp' || provider === 'email-smtp';

const toStableUserId = (identifier: string) =>
  `user-${normalizeIdentifier(identifier).replace(/[^a-z0-9]/g, '').slice(0, 24) || randomId()}`;

export const sendOtp = async (identifier: string) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier.includes('@')) {
    throw new Error('Enter a valid email address to receive your OTP.');
  }

  try {
    const response = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier: normalizedIdentifier }),
    });

    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | {
            provider?: 'resend' | 'smtp';
            message?: string;
          }
        | null;

      window.localStorage.setItem(
        OTP_KEY,
        JSON.stringify({
          identifier: normalizedIdentifier,
          provider: 'email-otp',
        }),
      );

      return {
        code: '',
        provider: 'email-otp' as const,
        message:
          payload?.message ||
          (payload?.provider === 'resend'
            ? 'OTP sent to your email through Resend.'
            : 'OTP sent to your email.'),
      };
    }

    const errorPayload = (await response.json().catch(() => null)) as
      | {
          message?: string;
          detail?: string;
        }
      | null;

    throw new Error(errorPayload?.detail || errorPayload?.message || 'Unable to send OTP email.');
  } catch (error) {
    if (!canUseDemoFallback()) {
      throw error;
    }
  }

  const code = '123456';

  window.localStorage.setItem(
    OTP_KEY,
    JSON.stringify({
      identifier: normalizedIdentifier,
      code,
      generatedAt: new Date().toISOString(),
      provider: isFirebaseConfigured ? 'firebase-auth' : 'simulated-otp',
    }),
  );

  return {
    code,
    provider: isFirebaseConfigured ? 'firebase-auth' : 'simulated-otp',
    message: isFirebaseConfigured
      ? 'Firebase config found. Email OTP is running in safe local simulation mode until a live provider is wired.'
      : 'SMTP is not configured. Use the demo OTP 123456.',
  };
};

export const verifyOtp = async (identifier: string, code: string): Promise<UserSession> => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const raw = window.localStorage.getItem(OTP_KEY);
  const pending = raw
    ? (JSON.parse(raw) as { identifier: string; code?: string; provider: UserSession['provider'] })
    : null;

  if (!pending || pending.identifier !== normalizedIdentifier) {
    throw new Error('No OTP request found for this identifier.');
  }

  if (isEmailOtpProvider(pending.provider)) {
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier: normalizedIdentifier, code }),
    });

    if (!response.ok) {
      throw new Error('Invalid or expired email OTP.');
    }

    const data = (await response.json()) as { verified: boolean; userId?: string };

    if (!data.verified) {
      throw new Error('Invalid or expired email OTP.');
    }

    return {
      userId: data.userId ?? toStableUserId(normalizedIdentifier),
      identifier: normalizedIdentifier,
      verifiedAt: new Date().toISOString(),
      provider: 'email-otp',
    };
  }

  if (pending.code !== code) {
    throw new Error('Invalid OTP. Use 123456 in demo mode.');
  }

  return {
    userId: toStableUserId(normalizedIdentifier),
    identifier: normalizedIdentifier,
    verifiedAt: new Date().toISOString(),
    provider: pending.provider === 'firebase-auth' ? 'firebase-auth' : 'simulated-otp',
  };
};
