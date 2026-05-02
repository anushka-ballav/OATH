self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = null;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'OATH reminder',
      body: event.data.text() || 'Open OATH to continue your routine.',
      kind: 'generic',
    };
  }

  const title = String(payload?.title || 'OATH reminder');
  const body = String(payload?.body || 'Open OATH to continue your routine.');
  const kind = String(payload?.kind || 'generic');
  const iconMap = {
    wake: '/icons/notification-oath.svg',
    study: '/icons/notification-study.svg',
    workout: '/icons/notification-workout.svg',
    water: '/icons/notification-water.svg',
    tasks: '/icons/notification-oath.svg',
    generic: '/icons/notification-oath.svg',
  };
  const icon = iconMap[kind] || iconMap.generic;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icons/icon.svg',
      tag: `oath-push-${kind}`,
      data: {
        url: '/',
      },
      renotify: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const activeClient = allClients.find((client) => 'focus' in client);
      if (activeClient) {
        activeClient.focus();
        if ('navigate' in activeClient) {
          activeClient.navigate('/');
        }
        return;
      }
      await clients.openWindow('/');
    })(),
  );
});
