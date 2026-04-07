import { DailyLog, NotificationItem, TaskItem, UserProfile } from '../types';

export const defaultNotifications: NotificationItem[] = [
  { id: 'wake', label: 'Wake up reminder', time: '06:00', enabled: true },
  { id: 'study', label: 'Study reminder', time: '18:00', enabled: true },
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

const buildWorkoutRemaining = (profile: UserProfile, log: DailyLog) => {
  const checklist = Array.isArray(profile.dailyTargets?.workoutPlan?.dailyChecklist)
    ? profile.dailyTargets.workoutPlan.dailyChecklist
    : [];
  const completed = new Set(log.completedWorkoutTasks || []);
  return checklist.filter((task) => task?.id && !completed.has(task.id)).length;
};

const buildTaskReminderBody = (profile: UserProfile, log: DailyLog, tasks: TaskItem[], dateKey: string) => {
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
    title: '8 PM OATH reminder',
    body: summary || 'You still have unfinished tasks or goals today.',
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
}) => {
  switch (item.id) {
    case 'wake':
      return log.wakeUpTime
        ? null
        : {
            title: 'Wake-up reminder',
            body: 'Log your wake-up time to keep today’s streak on track.',
          };
    case 'study': {
      const remainingMinutes = Math.max(0, profile.dailyTargets.studyHours * 60 - log.studyMinutes);
      return remainingMinutes > 0
        ? {
            title: 'Study reminder',
            body: `You still have ${remainingMinutes} minutes left for today’s study goal.`,
          }
        : null;
    }
    case 'water': {
      const remainingLiters = Math.max(0, profile.dailyTargets.waterLiters - log.waterIntakeMl / 1000);
      return remainingLiters > 0.05
        ? {
            title: 'Hydration reminder',
            body: `Drink another ${remainingLiters.toFixed(1)}L to hit your water goal today.`,
          }
        : null;
    }
    case 'tasks':
      return buildTaskReminderBody(profile, log, tasks, dateKey);
    default:
      return null;
  }
};

const showBrowserNotification = async (title: string, body: string) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/icons/icon.svg',
        badge: '/icons/icon.svg',
        tag: title,
      });
      return;
    } catch {
      // Fall back to the page notification API below.
    }
  }

  new Notification(title, {
    body,
    icon: '/icons/icon.svg',
  });
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.requestPermission();
};

export const sendLocalNotification = (title: string, body: string) => {
  void showBrowserNotification(title, body);
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
    const currentItem =
      notifications.find((item) => item.id === defaultItem.id) ??
      defaultItem;

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

    await showBrowserNotification(payload.title, payload.body);
    markReminderSent(userId, dateKey, currentItem.id);
  }
};
