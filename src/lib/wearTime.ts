import type { TimerLog } from '../services/supabaseService';
import { MS_PER_HOUR, endOfDay, overlapWithDay, parseDBDate } from './time';

export const DAILY_TARGET_HOURS = 22;
export const MIN_ACCEPTABLE_HOURS = 20;
export const AT_RISK_HOURS = 16;
export const SKIPPED_DAY_HOURS = 1;

export type Compliance = 'green' | 'yellow' | 'red';

export interface DailyWear {
  date: Date;
  ms: number;
  hours: number;
}

export interface WearSummary {
  averageHours: number;
  totalHours: number;
  skippedDays: number;
  ratedDays: number;
  best: DailyWear | null;
  worst: DailyWear | null;
}

export const logBounds = (log: TimerLog, now: Date) => {
  const start = parseDBDate(log.start_time);
  const rawEnd = log.end_time ? parseDBDate(log.end_time) : now;
  return { start, end: rawEnd.getTime() > start.getTime() ? rawEnd : start };
};

export const logDurationMs = (log: TimerLog, now: Date): number => {
  const { start, end } = logBounds(log, now);
  return end.getTime() - start.getTime();
};

export const wearTimeForDay = (logs: TimerLog[], day: Date, now: Date): number =>
  logs.reduce((total, log) => {
    const { start, end } = logBounds(log, now);
    return total + overlapWithDay(start, end, day);
  }, 0);

export const dailyWear = (logs: TimerLog[], days: Date[], now: Date): DailyWear[] =>
  days.map((date) => {
    const ms = wearTimeForDay(logs, date, now);
    return { date, ms, hours: ms / MS_PER_HOUR };
  });

export const summariseWear = (daily: DailyWear[], now: Date): WearSummary => {
  const completed = daily.filter((day) => endOfDay(day.date).getTime() < now.getTime());
  const rated = completed.length > 0 ? completed : [];

  if (rated.length === 0) {
    return { averageHours: 0, totalHours: 0, skippedDays: 0, ratedDays: 0, best: null, worst: null };
  }

  const totalHours = rated.reduce((total, day) => total + day.hours, 0);
  const sorted = [...rated].sort((a, b) => a.hours - b.hours);

  return {
    averageHours: totalHours / rated.length,
    totalHours,
    skippedDays: rated.filter((day) => day.hours < SKIPPED_DAY_HOURS).length,
    ratedDays: rated.length,
    best: sorted[sorted.length - 1],
    worst: sorted[0],
  };
};

export const complianceFor = (summary: WearSummary): Compliance => {
  if (summary.ratedDays === 0) return 'yellow';
  if (summary.skippedDays > 0 || summary.averageHours < AT_RISK_HOURS) return 'red';
  if (summary.averageHours < MIN_ACCEPTABLE_HOURS) return 'yellow';
  return 'green';
};

export const COMPLIANCE_LABELS: Record<Compliance, string> = {
  green: 'On track',
  yellow: 'Watch',
  red: 'At risk',
};

export const COMPLIANCE_HEX: Record<Compliance, string> = {
  green: '#94A378',
  yellow: '#E5BA41',
  red: '#A72703',
};

export const complianceClasses = (compliance: Compliance): string => {
  switch (compliance) {
    case 'green':
      return 'text-brand-green border-brand-green/30 bg-brand-green/10';
    case 'yellow':
      return 'text-brand-yellow border-brand-yellow/30 bg-brand-yellow/10';
    case 'red':
      return 'text-brand-red border-brand-red/30 bg-brand-red/10';
  }
};

export const lastActivityAt = (logs: TimerLog[]): Date | null =>
  logs.reduce<Date | null>((latest, log) => {
    const candidate = log.end_time ? parseDBDate(log.end_time) : parseDBDate(log.start_time);
    if (!latest || candidate.getTime() > latest.getTime()) return candidate;
    return latest;
  }, null);
