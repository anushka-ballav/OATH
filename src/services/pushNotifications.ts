import { UserSession } from '../types';

const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64Safe);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

type PushPublicKeyResponse = {
  enabled: boolean;
  publicKey?: string;
  message?: string;
};

export const registerBackgroundPush = async (session: UserSession) => {
  if (!isPushSupported()) {
    return { ok: false, message: 'Push is not supported on this browser/device.' };
  }

  if (Notification.permission !== 'granted') {
    return { ok: false, message: 'Allow notifications first, then enable background reminders.' };
  }

  const keyResponse = await fetch('/api/notifications/push/public-key');
  if (!keyResponse.ok) {
    return { ok: false, message: 'Could not load push settings from server.' };
  }

  const keyPayload = (await keyResponse.json()) as PushPublicKeyResponse;
  if (!keyPayload.enabled || !keyPayload.publicKey) {
    return { ok: false, message: keyPayload.message || 'Web push is not configured on the server.' };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
    }));

  const subscribeResponse = await fetch('/api/notifications/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: session.userId,
      identifier: session.identifier,
      subscription: subscription.toJSON(),
    }),
  });

  if (!subscribeResponse.ok) {
    return { ok: false, message: 'Failed to register device for background reminders.' };
  }

  return { ok: true, message: 'Background reminders enabled for this device.' };
};

export const unregisterBackgroundPush = async (session: UserSession) => {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await fetch('/api/notifications/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: session.userId,
        identifier: session.identifier,
        endpoint: existing.endpoint,
      }),
    }).catch(() => undefined);
    await existing.unsubscribe().catch(() => undefined);
  }
};
