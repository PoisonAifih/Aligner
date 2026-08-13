export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

export const parseDBDate = (value: string | null | undefined): Date => {
  if (!value) return new Date();
  let normalized = value.replace(' ', 'T');
  if (!normalized.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized += 'Z';
  }
  return new Date(normalized);
};

export const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const endOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

export const addDays = (date: Date, amount: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const differenceInCalendarDays = (later: Date, earlier: Date): number =>
  Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / MS_PER_DAY);

export const toDateInputValue = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const toTimeInputValue = (date: Date): string => {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const fromDateTimeInput = (dateValue: string, timeValue: string): Date =>
  new Date(`${dateValue}T${timeValue}`);

export const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

export const lastNDays = (count: number, endingOn: Date = new Date()): Date[] =>
  Array.from({ length: count }, (_, index) => startOfDay(addDays(endingOn, index - count + 1)));

export const overlapWithDay = (start: Date, end: Date, day: Date): number => {
  const from = Math.max(start.getTime(), startOfDay(day).getTime());
  const to = Math.min(end.getTime(), endOfDay(day).getTime() + 1);
  return Math.max(0, to - from);
};

export const splitRangeByDay = (start: Date, end: Date): Array<{ start: Date; end: Date }> => {
  const segments: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(start);

  while (cursor.getTime() < end.getTime()) {
    const boundary = endOfDay(cursor);
    const segmentEnd = boundary.getTime() < end.getTime() ? boundary : end;
    segments.push({ start: new Date(cursor), end: new Date(segmentEnd) });
    cursor = new Date(segmentEnd.getTime() + 1);
  }

  return segments;
};

export const formatClock = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((part) => `${part}`.padStart(2, '0')).join(':');
};

export const formatDuration = (ms: number): string => {
  const totalMinutes = Math.max(0, Math.round(ms / MS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

export const formatTimeOfDay = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

export const formatShortDate = (date: Date): string =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
