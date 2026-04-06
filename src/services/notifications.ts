import { NotificationItem } from '../types';

export const defaultNotifications: NotificationItem[] = [
  { id: 'wake', label: 'Wake up reminder', time: '06:00', enabled: true },
  { id: 'study', label: 'Study reminder', time: '18:00', enabled: true },
  { id: 'water', label: 'Drink water reminder', time: '10:00', enabled: true },
];

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.requestPermission();
};

export const sendLocalNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
};
