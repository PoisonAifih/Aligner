
import { supabase } from '../supabaseClient';

export interface TimerLog {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  reason: string | null;
}

export const supabaseService = {

  async startTimer(userId: string) {
    const { data, error } = await supabase
      .from('timer_logs')
      .insert([
        { 
          user_id: userId, 
          start_time: new Date().toISOString(), 
          status: 'RUNNING' 
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async pauseTimer(logId: string, reason: string) {
    const { data, error } = await supabase
      .from('timer_logs')
      .update({ 
        end_time: new Date().toISOString(), 
        status: 'PAUSED',
        reason: reason
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addManualLog(userId: string, startTime: Date, endTime: Date, reason: string | null) {
      const { data, error } = await supabase
      .from('timer_logs')
      .insert([
        {
          user_id: userId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'STOPPED', 
          reason: reason
        }
      ])
      .select()
      .single();

      if (error) throw error;
      return data;
  },

  async getDailyLogs(userId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('timer_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data as TimerLog[];
  },

  async getWeeklyLogs(userId: string, startDate: Date) {
      const endWindow = new Date(startDate);
      endWindow.setDate(endWindow.getDate() + 7);

      const { data, error } = await supabase
      .from('timer_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endWindow.toISOString());

      if (error) throw error;
      return data as TimerLog[];
  },

  async updateUserPassword(newPassword: string) {
      const { data, error } = await supabase.auth.updateUser({
          password: newPassword
      });
      if (error) throw error;
      return data;
  },

  async getProfile(userId: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
  },

  async updateProfile(userId: string, updates: any) {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
  }
};
