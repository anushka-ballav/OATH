export const classNames = (...items: Array<string | false | null | undefined>) =>
  items.filter(Boolean).join(' ');

export const percent = (value: number, target: number) => {
  if (!target) return 0;
  return Math.min(100, Math.round((value / target) * 100));
};

export const randomId = () => Math.random().toString(36).slice(2, 10);
