import { DailyLog, NotificationItem, TaskItem, UserProfile } from '../types';

type NotificationKind = 'wake' | 'study' | 'workout' | 'water' | 'tasks' | 'generic' | 'success';

type PermissionResult = {
  permission: NotificationPermission | 'unsupported';
  message: string;
};

type ScheduledPayload = {
  title: string;
  body: string;
  kind: NotificationKind;
};

export const defaultNotifications: NotificationItem[] = [
  { id: 'wake', label: 'Wake up reminder', time: '06:00', enabled: true },
  { id: 'study', label: 'Study reminder', time: '18:00', enabled: true },
  { id: 'workout', label: 'Workout reminder', time: '19:00', enabled: true },
  { id: 'water', label: 'Drink water reminder', time: '10:00', enabled: true },
  { id: 'tasks', label: '8 PM unfinished tasks reminder', time: '20:00', enabled: true },
];

const REMINDER_STORAGE_PREFIX = 'oath-reminder-sent-v1';

const normalizeTime = (value: string, fallback: string) =>
  /^\d{2}:\d{2}$/.test(String(value || '').trim()) ? String(value).trim() : fallback;

const toDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

const toMinutes = (time: string) => {
  const [hours, minutes] = normalizeTime(time, '00:00').split(':').map(Number);
  return hours * 60 + minutes;
};

const reminderStorageKey = (userId: string, dateKey: string, reminderId: string) =>
  `${REMINDER_STORAGE_PREFIX}-${userId}-${dateKey}-${reminderId}`;

const readSentReminder = (userId: string, dateKey: string, reminderId: string) => {
  try {
    return window.localStorage.getItem(reminderStorageKey(userId, dateKey, reminderId));
  } catch {
    return null;
  }
};

const markReminderSent = (userId: string, dateKey: string, reminderId: string) => {
  try {
    window.localStorage.setItem(reminderStorageKey(userId, dateKey, reminderId), new Date().toISOString());
  } catch {
    // Ignore storage failures for notifications.
  }
};

const themedNotificationConfig = (kind: NotificationKind) => {
  switch (kind) {
    case 'wake':
      return {
        icon: '/icons/notification-oath.svg',
        badge: '/icons/icon.svg',
        tag: 'oath-wake',
        vibrate: [120, 70, 120] as number[],
      };
    case 'study':
      return {
        icon: '/icons/notification-study.svg',
        badge: '/icons/icon.svg',
        tag: 'oath-study',
        vibrate: [90, 60, 90, 60, 90] as number[],
      };
    case 'workout':
      return {
        icon: '/icons/notification-workout.svg',
        badge: '/icons/icon.svg',
        image: '/icons/notification-workout.svg',
        tag: 'oath-workout',
        vibrate: [140, 60, 140, 60, 180] as number[],
      };
    case 'water':
      return {
        icon: '/icons/notification-water.svg',
        badge: '/icons/icon.svg',
        image: '/icons/notification-water.svg',
        tag: 'oath-water',
        vibrate: [70, 40, 70, 40, 140] as number[],
      };
    case 'tasks':
      return {
        icon: '/icons/notification-oath.svg',
        badge: '/icons/icon.svg',
        tag: 'oath-tasks',
        vibrate: [120, 60, 160] as number[],
        requireInteraction: true,
      };
    case 'success':
      return {
        icon: '/icons/notification-oath.svg',
        badge: '/icons/icon.svg',
        tag: 'oath-success',
        vibrate: [50, 25, 50] as number[],
      };
    default:
      return {
        icon: '/icons/notification-oath.svg',
        badge: '/icons/icon.svg',
        tag: 'oath-generic',
        vibrate: [100] as number[],
      };
  }
};

const buildWorkoutRemaining = (profile: UserProfile, log: DailyLog) => {
  const checklist = Array.isArray(profile.dailyTargets?.workoutPlan?.dailyChecklist)
    ? profile.dailyTargets.workoutPlan.dailyChecklist
    : [];
  const completed = new Set(log.completedWorkoutTasks || []);
  return checklist.filter((task) => task?.id && !completed.has(task.id)).length;
};

const buildTaskReminderBody = (
  profile: UserProfile,
  log: DailyLog,
  tasks: TaskItem[],
  dateKey: string,
): ScheduledPayload | null => {
  const pendingTasks = tasks.filter((task) => !task.completed && task.dueDate && task.dueDate <= dateKey);
  const waterRemaining = Math.max(0, profile.dailyTargets.waterLiters - log.waterIntakeMl / 1000);
  const studyRemainingMinutes = Math.max(0, profile.dailyTargets.studyHours * 60 - log.studyMinutes);
  const workoutRemaining = buildWorkoutRemaining(profile, log);
  const goalBits = [
    waterRemaining > 0.05 ? `${waterRemaining.toFixed(1)}L water left` : '',
    studyRemainingMinutes > 0 ? `${studyRemainingMinutes} min study left` : '',
    workoutRemaining > 0 ? `${workoutRemaining} workout task${workoutRemaining === 1 ? '' : 's'} left` : '',
  ].filter(Boolean);

  if (!pendingTasks.length && !goalBits.length) {
    return null;
  }

  const taskSummary = pendingTasks.length
    ? `${pendingTasks.length} pending task${pendingTasks.length === 1 ? '' : 's'}`
    : '';
  const summary = [taskSummary, ...goalBits].filter(Boolean).join(' • ');

  return {
    title: '🌙 OATH evening reset',
    body: summary || 'You still have unfinished goals today.',
    kind: 'tasks',
  };
};

const buildScheduledReminder = ({
  item,
  profile,
  log,
  tasks,
  dateKey,
}: {
  item: NotificationItem;
  profile: UserProfile;
  log: DailyLog;
  tasks: TaskItem[];
  dateKey: string;
}): ScheduledPayload | null => {
  switch (item.id) {
    case 'wake':
      return log.wakeUpTime
        ? null
        : {
            title: '☀️ OATH wake-up check',
            body: 'Log your wake-up time and lock in today’s streak momentum.',
            kind: 'wake',
          };
    case 'study': {
      const remainingMinutes = Math.max(0, profile.dailyTargets.studyHours * 60 - log.studyMinutes);
      return remainingMinutes > 0
        ? {
            title: 'Study mode is waiting',
            body: `${remainingMinutes} minutes are left in today’s focus block. Re-open OATH and lock in.`,
            kind: 'study',
          }
        : null;
    }
    case 'workout': {
      const workoutRemaining = buildWorkoutRemaining(profile, log);
      return workoutRemaining > 0
        ? {
            title: 'Workout energy is still pending',
            body: `${workoutRemaining} workout task${workoutRemaining === 1 ? '' : 's'} left. Finish the session and close your ring.`,
            kind: 'workout',
          }
        : null;
    }
    case 'water': {
      const remainingLiters = Math.max(0, profile.dailyTargets.waterLiters - log.waterIntakeMl / 1000);
      return remainingLiters > 0.05
        ? {
            title: 'Hydration flow is active',
            body: `Take another ${remainingLiters.toFixed(1)}L sip wave to complete today’s water goal.`,
            kind: 'water',
          }
        : null;
    }
    case 'tasks':
      return buildTaskReminderBody(profile, log, tasks, dateKey);
    default:
      return null;
  }
};

const showBrowserNotification = async (
  title: string,
  body: string,
  kind: NotificationKind = 'generic',
) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const themed = themedNotificationConfig(kind);
  const notificationOptions = {
    body,
    icon: themed.icon,
    badge: themed.badge,
    tag: themed.tag,
    vibrate: themed.vibrate,
  } as NotificationOptions;

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const serviceWorkerOptions = {
        ...notificationOptions,
        ...(themed.image ? { image: themed.image } : {}),
        ...(themed.requireInteraction ? { requireInteraction: themed.requireInteraction } : {}),
        renotify: true,
        data: {
          kind,
          url: '/',
        },
      } as NotificationOptions;
      await registration.showNotification(title, {
        ...serviceWorkerOptions,
      });
      return;
    } catch {
      // Fall back to the page notification API below.
    }
  }

  new Notification(title, notificationOptions);
};

export const requestNotificationPermission = async (): Promise<PermissionResult> => {
  if (!('Notification' in window)) {
    return {
      permission: 'unsupported',
      message: 'This phone/browser does not support web notifications.',
    };
  }

  if (Notification.permission === 'granted') {
    await showBrowserNotification(
      '✨ OATH notifications are ready',
      'Your reminders now use the OATH theme on this device.',
      'success',
    );
    return {
      permission: 'granted',
      message: 'Notifications are already enabled on this device.',
    };
  }

  const permission = await Notification.requestPermission();

  if (permission === 'granted') {
    await showBrowserNotification(
      '✨ OATH notifications are on',
      'You’ll now receive themed study, hydration, and evening reminders here.',
      'success',
    );
    return {
      permission,
      message: 'Notifications enabled successfully.',
    };
  }

  if (permission === 'denied') {
    return {
      permission,
      message: 'Notifications are blocked. Allow them in your phone browser or PWA settings.',
    };
  }

  return {
    permission,
    message: 'Notification permission was dismissed.',
  };
};

export const sendLocalNotification = (
  title: string,
  body: string,
  kind: NotificationKind = 'generic',
) => {
  void showBrowserNotification(title, body, kind);
};

export const processScheduledNotifications = async ({
  userId,
  profile,
  log,
  tasks,
  notifications,
  now = new Date(),
}: {
  userId: string;
  profile: UserProfile | null;
  log: DailyLog;
  tasks: TaskItem[];
  notifications: NotificationItem[];
  now?: Date;
}) => {
  if (!userId || !profile || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dateKey = toDateKey(now);

  for (const defaultItem of defaultNotifications) {
    const currentItem = notifications.find((item) => item.id === defaultItem.id) ?? defaultItem;

    if (!currentItem.enabled) continue;
    if (nowMinutes < toMinutes(normalizeTime(currentItem.time, defaultItem.time))) continue;
    if (readSentReminder(userId, dateKey, currentItem.id)) continue;

    const payload = buildScheduledReminder({
      item: currentItem,
      profile,
      log,
      tasks,
      dateKey,
    });

    if (!payload) continue;

    await showBrowserNotification(payload.title, payload.body, payload.kind);
    markReminderSent(userId, dateKey, currentItem.id);
  }
};
