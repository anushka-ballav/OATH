export const TRACKING_DAY_RESET_HOUR = 5;

const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const applyTrackingDayBoundary = (input: Date) => {
  const date = new Date(input);

  if (date.getHours() < TRACKING_DAY_RESET_HOUR) {
    date.setDate(date.getDate() - 1);
  }

  return date;
};

export const todayKey = (input = new Date()) => toLocalDateKey(applyTrackingDayBoundary(input));

export const formatMinutes = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
};

export const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(hours ? 2 : 1, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
};

export const toClockLabel = (isoString?: string) => {
  if (!isoString) return '--';

  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const timeStringToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const getDelayInMinutes = (isoString: string | undefined, targetTime: string) => {
  if (!isoString) return null;

  const wakeUp = new Date(isoString);
  const wakeUpMinutes = wakeUp.getHours() * 60 + wakeUp.getMinutes();
  return Math.max(0, wakeUpMinutes - timeStringToMinutes(targetTime));
};

export const getLastSevenDays = (anchor = new Date()) => {
  return getLastNDays(7, anchor);
};

export const getLastNDays = (count: number, anchor = new Date()) => {
  const safeCount = Math.max(1, Math.min(90, Math.floor(count)));
  const base = applyTrackingDayBoundary(anchor);

  return Array.from({ length: safeCount }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() - (safeCount - 1 - index));
    return toLocalDateKey(date);
  });
};
