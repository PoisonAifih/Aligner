import { supabase } from '../supabaseClient';
import type { AppRole } from '../lib/roles';
import {
  MS_PER_DAY,
  MS_PER_MINUTE,
  addDays,
  differenceInCalendarDays,
  endOfDay,
  formatTimeOfDay,
  isSameDay,
  isValidDate,
  parseDBDate,
  splitRangeByDay,
  startOfDay,
} from '../lib/time';

export type TimerStatus = 'RUNNING' | 'PAUSED' | 'STOPPED';

export interface TimerLog {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  status: TimerStatus;
  reason: string | null;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  role: AppRole | null;
  is_active?: boolean | null;
  current_aligner_date?: string | null;
  is_journey_active?: boolean | null;
}

export interface Assignment {
  id: string;
  dentist_id: string;
  patient_id: string;
  created_at: string;
}

export interface ReconcileResult {
  active: TimerLog | null;
  changed: boolean;
}

const MAX_AUTO_CONTINUE_DAYS = 7;
const UNIQUE_VIOLATION = '23505';

export const MIDNIGHT_SPLIT_REASON = 'Auto-closed at midnight';
export const OVERNIGHT_REASON = 'Auto-continued overnight';
export const DUPLICATE_REASON = 'Duplicate session closed';

const assertWritten = <T>(rows: T[] | null, action: string): T[] => {
  if (!rows || rows.length === 0) {
    throw new Error(
      `${action} was blocked by database permissions. Run supabase_schema_hardening.sql and make sure your account has the admin role.`,
    );
  }
  return rows;
};

export const supabaseService = {
  async getRunningLogs(userId: string): Promise<TimerLog[]> {
    const { data, error } = await supabase
      .from('timer_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'RUNNING')
      .order('start_time', { ascending: false });

    if (error) throw error;
    return (data ?? []) as TimerLog[];
  },

  async closeRunningLog(logId: string, endTime: Date, reason: string): Promise<TimerLog | null> {
    const { data, error } = await supabase
      .from('timer_logs')
      .update({ end_time: endTime.toISOString(), status: 'PAUSED', reason })
      .eq('id', logId)
      .eq('status', 'RUNNING')
      .select();

    if (error) throw error;
    return ((data ?? []) as TimerLog[])[0] ?? null;
  },

  async insertRunningLog(userId: string, startTime: Date): Promise<TimerLog> {
    const { data, error } = await supabase
      .from('timer_logs')
      .insert({ user_id: userId, start_time: startTime.toISOString(), status: 'RUNNING' })
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        const [existing] = await this.getRunningLogs(userId);
        if (existing) return existing;
      }
      throw error;
    }

    return data as TimerLog;
  },

  async reconcileRunningLogs(userId: string, now: Date = new Date()): Promise<ReconcileResult> {
    const running = await this.getRunningLogs(userId);
    if (running.length === 0) return { active: null, changed: false };

    const [newest, ...duplicates] = running;
    let changed = false;

    for (const duplicate of duplicates) {
      const start = parseDBDate(duplicate.start_time);
      const limit = Math.min(endOfDay(start).getTime(), parseDBDate(newest.start_time).getTime());
      const cutoff = new Date(Math.max(limit, start.getTime()));
      await this.closeRunningLog(duplicate.id, cutoff, DUPLICATE_REASON);
      changed = true;
    }

    const start = parseDBDate(newest.start_time);
    if (isSameDay(start, now)) return { active: newest, changed };

    const closed = await this.closeRunningLog(newest.id, endOfDay(start), MIDNIGHT_SPLIT_REASON);
    if (!closed) {
      const [current] = await this.getRunningLogs(userId);
      return { active: current ?? null, changed: true };
    }

    const daysElapsed = differenceInCalendarDays(now, start);
    if (daysElapsed > MAX_AUTO_CONTINUE_DAYS) {
      return { active: null, changed: true };
    }

    const backfill = [];
    for (let offset = 1; offset < daysElapsed; offset++) {
      const day = addDays(startOfDay(start), offset);
      backfill.push({
        user_id: userId,
        start_time: day.toISOString(),
        end_time: endOfDay(day).toISOString(),
        status: 'STOPPED' as const,
        reason: OVERNIGHT_REASON,
      });
    }

    if (backfill.length > 0) {
      const { error } = await supabase.from('timer_logs').insert(backfill);
      if (error) throw error;
    }

    const active = await this.insertRunningLog(userId, startOfDay(now));
    return { active, changed: true };
  },

  async startTimer(userId: string): Promise<TimerLog> {
    const { active } = await this.reconcileRunningLogs(userId);
    if (active) return active;
    return this.insertRunningLog(userId, new Date());
  },

  async pauseTimer(logId: string, reason: string): Promise<TimerLog | null> {
    return this.closeRunningLog(logId, new Date(), reason);
  },

  async getOverlappingLogs(
    userId: string,
    start: Date,
    end: Date,
    excludeLogId?: string,
  ): Promise<TimerLog[]> {
    let query = supabase
      .from('timer_logs')
      .select('*')
      .eq('user_id', userId)
      .lt('start_time', end.toISOString())
      .or(`end_time.is.null,end_time.gt.${start.toISOString()}`);

    if (excludeLogId) query = query.neq('id', excludeLogId);

    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) throw error;
    return (data ?? []) as TimerLog[];
  },

  async addManualLog(
    userId: string,
    startTime: Date,
    endTime: Date,
    reason: string | null,
  ): Promise<TimerLog[]> {
    if (!isValidDate(startTime) || !isValidDate(endTime)) {
      throw new Error('Please pick a valid date, start time and end time.');
    }
    if (endTime.getTime() <= startTime.getTime()) {
      throw new Error(
        'The end time has to be after the start time. For a session that ran past midnight, add one entry per day.',
      );
    }
    if (endTime.getTime() - startTime.getTime() > MS_PER_DAY) {
      throw new Error('A single session cannot be longer than 24 hours.');
    }
    if (startTime.getTime() > Date.now() + MS_PER_MINUTE) {
      throw new Error('You cannot log a session that starts in the future.');
    }

    const [clash] = await this.getOverlappingLogs(userId, startTime, endTime);
    if (clash) {
      const clashEnd = clash.end_time ? formatTimeOfDay(parseDBDate(clash.end_time)) : 'now';
      throw new Error(
        `This overlaps a session already recorded from ${formatTimeOfDay(parseDBDate(clash.start_time))} to ${clashEnd}.`,
      );
    }

    const rows = splitRangeByDay(startTime, endTime).map((segment) => ({
      user_id: userId,
      start_time: segment.start.toISOString(),
      end_time: segment.end.toISOString(),
      status: 'STOPPED' as const,
      reason,
    }));

    const { data, error } = await supabase.from('timer_logs').insert(rows).select();
    if (error) throw error;
    return (data ?? []) as TimerLog[];
  },

  async getLogsInRange(userId: string, from: Date, to: Date): Promise<TimerLog[]> {
    const { data, error } = await supabase
      .from('timer_logs')
      .select('*')
      .eq('user_id', userId)
      .lte('start_time', to.toISOString())
      .or(`end_time.is.null,end_time.gte.${from.toISOString()}`)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return (data ?? []) as TimerLog[];
  },

  async getLogsInRangeForUsers(userIds: string[], from: Date, to: Date): Promise<TimerLog[]> {
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
      .from('timer_logs')
      .select('*')
      .in('user_id', userIds)
      .lte('start_time', to.toISOString())
      .or(`end_time.is.null,end_time.gte.${from.toISOString()}`)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return (data ?? []) as TimerLog[];
  },

  async getDailyLogs(userId: string, date: Date): Promise<TimerLog[]> {
    return this.getLogsInRange(userId, startOfDay(date), endOfDay(date));
  },

  async deleteLog(logId: string): Promise<void> {
    const { error } = await supabase.from('timer_logs').delete().eq('id', logId);
    if (error) throw error;
  },

  async updateUserPassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return (data as Profile) ?? null;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select();

    if (error) throw error;
    return assertWritten(data as Profile[], 'Updating this profile')[0];
  },

  async listProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('username', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async getProfilesByIds(ids: string[]): Promise<Profile[]> {
    if (ids.length === 0) return [];

    const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async listAssignments(): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Assignment[];
  },

  async getAssignmentsForDentist(dentistId: string): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('dentist_id', dentistId);

    if (error) throw error;
    return (data ?? []) as Assignment[];
  },

  async createAssignment(patientId: string, dentistId: string): Promise<Assignment> {
    const { data, error } = await supabase
      .from('assignments')
      .insert({ patient_id: patientId, dentist_id: dentistId })
      .select();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new Error('This patient is already assigned to that dentist.');
      }
      throw error;
    }

    return assertWritten(data as Assignment[], 'Creating this assignment')[0];
  },

  async deleteAssignment(assignmentId: string): Promise<void> {
    const { data, error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId)
      .select();

    if (error) throw error;
    assertWritten(data as Assignment[], 'Removing this assignment');
  },
};

export { parseDBDate };
