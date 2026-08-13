import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Calendar from 'react-calendar';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis } from 'recharts';
import {
  BarChart2,
  Calendar as CalendarIcon,
  History,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import type { ReconcileResult, TimerLog } from '../services/supabaseService';
import { useAuth } from '../context/useAuth';
import { useToday } from '../hooks/useToday';
import {
  MS_PER_HOUR,
  addDays,
  endOfDay,
  formatClock,
  formatDuration,
  formatTimeOfDay,
  fromDateTimeInput,
  isSameDay,
  parseDBDate,
  startOfDay,
  toDateInputValue,
  toTimeInputValue,
} from '../lib/time';
import { DAILY_TARGET_HOURS, dailyWear, wearTimeForDay } from '../lib/wearTime';

const PAUSE_REASONS = ['Eating', 'Drinking', 'Brushing', 'Other'];
const SYNC_INTERVAL_MS = 30_000;
const WEEKLY_DAYS = 7;

export default function Dashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const today = useToday();

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [followToday, setFollowToday] = useState(true);
  const [now, setNow] = useState<Date>(() => new Date());

  const [dayLogs, setDayLogs] = useState<TimerLog[]>([]);
  const [weeklyLogs, setWeeklyLogs] = useState<TimerLog[]>([]);
  const [activeLog, setActiveLog] = useState<TimerLog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState(PAUSE_REASONS[0]);

  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualDate, setManualDate] = useState(() => toDateInputValue(new Date()));
  const [manualStartTime, setManualStartTime] = useState('');
  const [manualEndTime, setManualEndTime] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);

  const [showStartJourneyModal, setShowStartJourneyModal] = useState(false);
  const [journeyModalDate, setJourneyModalDate] = useState(() => toDateInputValue(new Date()));
  const [journeyModalTime, setJourneyModalTime] = useState(() => toTimeInputValue(new Date()));

  const journeyStartDate = profile?.is_journey_active ? profile.current_aligner_date ?? null : null;
  const isRunning = activeLog !== null;
  const isViewingToday = isSameDay(selectedDate, today);

  const reconcileRef = useRef<Promise<ReconcileResult> | null>(null);

  const reconcile = useCallback(async (): Promise<ReconcileResult | null> => {
    if (!user) return null;
    if (!reconcileRef.current) {
      reconcileRef.current = supabaseService
        .reconcileRunningLogs(user.id)
        .finally(() => {
          reconcileRef.current = null;
        });
    }
    return reconcileRef.current;
  }, [user]);

  const syncTimer = useCallback(async () => {
    if (!user) return;
    try {
      const result = await reconcile();
      const next = result?.active ?? null;
      setActiveLog((current) => (current?.id === next?.id ? current : next));
    } catch (syncError) {
      console.error('Unable to sync the timer state', syncError);
    }
  }, [user, reconcile]);

  const loadLogs = useCallback(async () => {
    if (!user) return;
    try {
      const [daily, weekly] = await Promise.all([
        supabaseService.getDailyLogs(user.id, selectedDate),
        supabaseService.getLogsInRange(user.id, startOfDay(addDays(today, -(WEEKLY_DAYS - 1))), endOfDay(today)),
      ]);
      setDayLogs(daily);
      setWeeklyLogs(weekly);
    } catch (loadError) {
      console.error('Unable to load sessions', loadError);
    }
  }, [user, selectedDate, today]);

  useEffect(() => {
    if (followToday) setSelectedDate(today);
  }, [followToday, today]);

  useEffect(() => {
    void syncTimer();
  }, [syncTimer, today]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, activeLog?.id]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!user) return;

    const resync = () => {
      if (document.visibilityState === 'hidden') return;
      void syncTimer();
    };

    const interval = setInterval(resync, SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
    };
  }, [user, syncTimer]);

  const handleSelectDay = (value: Date) => {
    const day = startOfDay(value);
    setSelectedDate(day);
    setFollowToday(isSameDay(day, today));
  };

  const handleStartTimer = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const log = await supabaseService.startTimer(user.id);
      setActiveLog(log);
      setFollowToday(true);
    } catch (startError) {
      console.error(startError);
      setError('Could not start the timer. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmPause = async () => {
    if (!user || !activeLog || busy) return;
    setBusy(true);
    setError(null);
    try {
      await supabaseService.pauseTimer(activeLog.id, pauseReason);
      setActiveLog(null);
      setShowPauseModal(false);
      await loadLogs();
    } catch (pauseError) {
      console.error(pauseError);
      setError('Could not pause the timer. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openManualEntry = () => {
    setManualDate(toDateInputValue(selectedDate));
    setManualStartTime('');
    setManualEndTime('');
    setManualReason('');
    setManualError(null);
    setShowManualEntryModal(true);
  };

  const handleManualEntry = async () => {
    if (!user || manualSaving) return;
    setManualSaving(true);
    setManualError(null);
    try {
      const start = fromDateTimeInput(manualDate, manualStartTime);
      const end = fromDateTimeInput(manualDate, manualEndTime);
      await supabaseService.addManualLog(user.id, start, end, manualReason.trim() || null);
      setShowManualEntryModal(false);
      await loadLogs();
    } catch (entryError) {
      setManualError(entryError instanceof Error ? entryError.message : 'Could not save this session.');
    } finally {
      setManualSaving(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    try {
      await supabaseService.deleteLog(logId);
      if (activeLog?.id === logId) setActiveLog(null);
      await loadLogs();
    } catch (deleteError) {
      console.error('Unable to delete the session', deleteError);
      setError('Could not delete that session.');
    }
  };

  const handleStartJourney = async () => {
    if (!user || !journeyModalDate || !journeyModalTime) return;
    try {
      await supabaseService.updateProfile(user.id, {
        current_aligner_date: fromDateTimeInput(journeyModalDate, journeyModalTime).toISOString(),
        is_journey_active: true,
      });
      await refreshProfile();
      setShowStartJourneyModal(false);
    } catch (journeyError) {
      console.error(journeyError);
      setError('Could not start your journey. Please try again.');
    }
  };

  const handleStopJourney = async () => {
    if (!user) return;
    if (!confirm('Finish your aligner journey? This stops all tracking.')) return;
    try {
      if (activeLog) {
        await supabaseService.pauseTimer(activeLog.id, 'Journey Finished');
        setActiveLog(null);
      }
      await supabaseService.updateProfile(user.id, { is_journey_active: false });
      await refreshProfile();
      await loadLogs();
    } catch (stopError) {
      console.error(stopError);
      setError('Could not finish your journey. Please try again.');
    }
  };

  const handleConfirmChange = async () => {
    if (!user) return;
    if (!confirm('Confirm that you have switched to the next aligner?')) return;
    try {
      await supabaseService.updateProfile(user.id, { current_aligner_date: new Date().toISOString() });
      await refreshProfile();
    } catch (changeError) {
      console.error(changeError);
      setError('Could not record the aligner change.');
    }
  };

  const dayTotalMs = useMemo(
    () => wearTimeForDay(dayLogs, selectedDate, now),
    [dayLogs, selectedDate, now],
  );

  const sessionSeconds = activeLog
    ? Math.max(0, Math.floor((now.getTime() - parseDBDate(activeLog.start_time).getTime()) / 1000))
    : 0;

  const minuteMark = Math.floor(now.getTime() / 60_000);

  const weeklyChartData = useMemo(() => {
    const days = Array.from({ length: WEEKLY_DAYS }, (_, index) =>
      startOfDay(addDays(today, index - (WEEKLY_DAYS - 1))),
    );
    return dailyWear(weeklyLogs, days, new Date(minuteMark * 60_000)).map((day) => ({
      name: day.date.toLocaleDateString(undefined, { weekday: 'short' }),
      hours: Number(day.hours.toFixed(1)),
      isToday: isSameDay(day.date, today),
    }));
  }, [weeklyLogs, today, minuteMark]);

  const targetProgress = Math.min(100, (dayTotalMs / MS_PER_HOUR / DAILY_TARGET_HOURS) * 100);

  const timelineItems = useMemo(() => {
    const items: Array<
      | { kind: 'session'; log: TimerLog }
      | { kind: 'break'; key: string; label: string; from: Date; to: Date | null; minutes: number }
    > = [];

    dayLogs.forEach((log, index) => {
      items.push({ kind: 'session', log });

      if (!log.end_time) return;
      const breakStart = parseDBDate(log.end_time);
      const next = dayLogs[index + 1];

      if (next) {
        const breakEnd = parseDBDate(next.start_time);
        const minutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / 60_000);
        if (minutes > 0) {
          items.push({
            kind: 'break',
            key: `break-${log.id}`,
            label: log.reason || 'Break',
            from: breakStart,
            to: breakEnd,
            minutes,
          });
        }
        return;
      }

      if (isViewingToday && !isRunning) {
        const minutes = Math.round((minuteMark * 60_000 - breakStart.getTime()) / 60_000);
        if (minutes > 1) {
          items.push({
            kind: 'break',
            key: `break-now-${log.id}`,
            label: log.reason || 'Current break',
            from: breakStart,
            to: null,
            minutes,
          });
        }
      }
    });

    return items;
  }, [dayLogs, isViewingToday, isRunning, minuteMark]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif-display font-bold text-white tracking-wide">
            Hello, {profile?.username || user?.email?.split('@')[0]}!
          </h1>
          <p className="text-brand-green mt-1 font-medium">Have a great day tracking your smile.</p>
        </div>
        <div className="bg-card px-6 py-3 rounded-2xl border border-white/5 shadow-lg flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
          <span className="text-sm font-medium text-white/80">
            {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 px-6 py-4 text-sm font-medium text-brand-red flex items-center justify-between gap-4">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-brand-red/70 hover:text-brand-red">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-card rounded-[2.5rem] p-10 flex flex-col items-center justify-center relative overflow-hidden shadow-xl border border-white/5">
          <div className="absolute top-0 right-0 p-6 opacity-5">
            <Play size={200} />
          </div>

          <h2 className="text-brand-green/80 text-sm uppercase tracking-[0.3em] mb-6 font-bold text-center">
            {isViewingToday ? 'Worn today' : `Total for ${selectedDate.toLocaleDateString()}`}
          </h2>

          <div className="text-[6rem] sm:text-[8rem] leading-none font-serif-display text-white mb-4 drop-shadow-2xl">
            {formatClock(dayTotalMs / 1000)}
          </div>

          <div className="w-full max-w-md mb-8 relative z-10">
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-green transition-all duration-500"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
            <p className="mt-2 text-center text-xs uppercase tracking-widest text-white/30">
              {targetProgress >= 100
                ? `Daily goal of ${DAILY_TARGET_HOURS}h reached`
                : `${formatDuration(DAILY_TARGET_HOURS * MS_PER_HOUR - dayTotalMs)} left to reach ${DAILY_TARGET_HOURS}h`}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 w-full relative z-10 min-h-20">
            {isViewingToday ? (
              isRunning ? (
                <>
                  <button
                    onClick={() => setShowPauseModal(true)}
                    disabled={busy}
                    className="flex items-center gap-3 px-10 py-5 bg-brand-yellow/10 hover:bg-brand-yellow/20 text-brand-yellow border border-brand-yellow/20 hover:border-brand-yellow/40 rounded-2xl transition-all w-64 justify-center active:scale-95 shadow-xl disabled:opacity-50"
                  >
                    <Pause size={24} className="fill-current" />
                    <span className="text-xl font-serif-display tracking-wide font-medium">Pause</span>
                  </button>
                  <p className="text-xs uppercase tracking-widest text-white/30">
                    Current session {formatClock(sessionSeconds)}
                  </p>
                </>
              ) : (
                <button
                  onClick={handleStartTimer}
                  disabled={busy}
                  className="flex items-center gap-3 px-10 py-5 bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-xl shadow-primary/20 transition-all w-64 justify-center active:scale-95 border border-white/10 disabled:opacity-50"
                >
                  <Play size={24} className="fill-current" />
                  <span className="text-xl font-serif-display tracking-wide font-medium">
                    {busy ? 'Starting…' : 'Resume'}
                  </span>
                </button>
              )
            ) : (
              <button
                onClick={() => handleSelectDay(today)}
                className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded-2xl transition-all"
              >
                <RotateCcw size={18} />
                <span className="font-medium tracking-wide">Back to today</span>
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-card border border-white/5 p-8 rounded-[2.5rem] shadow-xl">
            <h3 className="font-serif-display text-lg text-white/90 flex items-center justify-between mb-6">
              <span className="flex items-center gap-3">
                <CalendarIcon size={20} className="text-brand-green" /> Calendar
              </span>
              <span className="text-xs font-sans text-white/30 bg-white/5 px-2 py-1 rounded-lg">
                Select a date to view history
              </span>
            </h3>
            <div className="calendar-wrapper bg-brand-base rounded-3xl p-4 border border-white/5">
              <Calendar
                className="w-full"
                value={selectedDate}
                maxDate={today}
                onClickDay={handleSelectDay}
              />
            </div>
          </div>

          <div className="bg-card border border-white/5 p-8 rounded-[2.5rem] shadow-xl">
            <h3 className="font-serif-display text-lg text-white/90 flex items-center gap-2 mb-6">
              <BarChart2 size={20} className="text-brand-yellow" />
              Weekly Trends
            </h3>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'serif' }}
                    axisLine={false}
                    tickLine={false}
                    dy={5}
                  />
                  <Bar dataKey="hours" radius={[4, 4, 4, 4]}>
                    <LabelList
                      dataKey="hours"
                      position="top"
                      fill="rgba(255,255,255,0.5)"
                      fontSize={10}
                      formatter={(value: unknown) => (Number(value) > 0 ? Number(value).toFixed(1) : '')}
                    />
                    {weeklyChartData.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        fill={entry.isToday ? '#94A378' : 'rgba(255,255,255,0.1)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="lg:col-span-12">
          {!journeyStartDate ? (
            <button
              onClick={() => {
                setJourneyModalDate(toDateInputValue(new Date()));
                setJourneyModalTime(toTimeInputValue(new Date()));
                setShowStartJourneyModal(true);
              }}
              className="w-full bg-gradient-to-r from-brand-base to-brand-surface border border-brand-green/30 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-brand-green/60 transition-all shadow-xl group"
            >
              <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center text-brand-green group-hover:scale-110 transition-transform">
                <CalendarIcon size={32} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-serif-display text-white">Start Aligner Journey</h3>
                <p className="text-white/50 text-sm mt-1">Click here to set your first aligner date</p>
              </div>
            </button>
          ) : (
            <JourneyCard
              startDate={parseDBDate(journeyStartDate)}
              now={now}
              onConfirmChange={handleConfirmChange}
              onFinish={handleStopJourney}
            />
          )}
        </div>

        <div className="lg:col-span-12 bg-card border border-white/5 rounded-[2.5rem] p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-3 sm:gap-0">
            <h3 className="font-serif-display text-xl text-white/90 flex items-center gap-3">
              <History size={24} className="text-brand-green" />
              {isViewingToday ? "Today's Sessions" : `Sessions on ${selectedDate.toLocaleDateString()}`}
            </h3>
            <button
              onClick={openManualEntry}
              className="w-full sm:w-auto text-sm bg-brand-base hover:bg-brand-base/80 text-white px-6 py-3 rounded-2xl border border-white/5 transition-colors flex items-center justify-center gap-2 active:scale-95 font-medium tracking-wide shadow-lg"
            >
              <Plus size={16} /> Add log manually
            </button>
          </div>

          {timelineItems.length === 0 ? (
            <div className="py-12 text-center text-white/30 italic">
              {isViewingToday
                ? 'No sessions recorded yet today. Start your journey!'
                : `No activity recorded for ${selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.`}
            </div>
          ) : (
            <div className="space-y-3">
              {timelineItems.map((item) =>
                item.kind === 'session' ? (
                  <SessionRow
                    key={item.log.id}
                    log={item.log}
                    now={now}
                    onDelete={() => handleDeleteLog(item.log.id)}
                  />
                ) : (
                  <div
                    key={item.key}
                    className="flex justify-between items-center px-8 py-3 border-l-2 border-dashed border-white/10 ml-8"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white/50">{item.label}</span>
                      <span className="text-xs text-white/30 mt-0.5">
                        {formatTimeOfDay(item.from)} – {item.to ? formatTimeOfDay(item.to) : 'now'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-brand-yellow/80 bg-brand-yellow/10 px-2 py-1 rounded-md border border-brand-yellow/10">
                      {item.minutes}m break
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {showStartJourneyModal && (
        <Modal title="Start Journey" onClose={() => setShowStartJourneyModal(false)}>
          <p className="text-white/60 text-sm mb-6">
            Enter the date and time you first put on your aligners. We'll remind you to change them
            every week at this time.
          </p>
          <div className="space-y-4">
            <Field label="Date">
              <input
                type="date"
                value={journeyModalDate}
                max={toDateInputValue(today)}
                onChange={(event) => setJourneyModalDate(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={journeyModalTime}
                onChange={(event) => setJourneyModalTime(event.target.value)}
                className={inputClass}
              />
            </Field>
            <button
              onClick={handleStartJourney}
              className="w-full bg-brand-green hover:bg-brand-green/90 text-white font-serif-display text-lg py-4 rounded-2xl mt-4 transition-colors shadow-xl shadow-brand-green/20"
            >
              Start Tracking
            </button>
          </div>
        </Modal>
      )}

      {showManualEntryModal && (
        <Modal title="Add Manual Log" onClose={() => setShowManualEntryModal(false)}>
          <div className="space-y-5">
            <Field label="Date">
              <input
                type="date"
                value={manualDate}
                max={toDateInputValue(today)}
                onChange={(event) => setManualDate(event.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start time">
                <input
                  type="time"
                  value={manualStartTime}
                  onChange={(event) => setManualStartTime(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="End time">
                <input
                  type="time"
                  value={manualEndTime}
                  onChange={(event) => setManualEndTime(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Reason (optional)">
              <input
                type="text"
                placeholder="e.g. Forgot to track"
                value={manualReason}
                onChange={(event) => setManualReason(event.target.value)}
                className={inputClass}
              />
            </Field>

            {manualError && (
              <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-4 text-sm font-medium text-brand-red">
                {manualError}
              </div>
            )}

            <button
              onClick={handleManualEntry}
              disabled={manualSaving}
              className="w-full bg-brand-green hover:bg-brand-green/90 text-white font-serif-display text-lg py-4 rounded-2xl mt-2 transition-colors shadow-xl shadow-brand-green/20 disabled:opacity-50"
            >
              {manualSaving ? 'Saving…' : 'Save Session'}
            </button>
          </div>
        </Modal>
      )}

      {showPauseModal && (
        <Modal title="Pause Timer" onClose={() => setShowPauseModal(false)} maxWidth="max-w-sm">
          <div className="grid grid-cols-1 gap-3 mb-8">
            {PAUSE_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => setPauseReason(reason)}
                className={`p-4 rounded-xl border text-left transition-all font-medium flex items-center justify-between ${
                  pauseReason === reason
                    ? 'bg-brand-yellow/20 border-brand-yellow/50 text-brand-yellow shadow-inner'
                    : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white'
                }`}
              >
                {reason}
                {pauseReason === reason && <div className="w-2 h-2 rounded-full bg-brand-yellow" />}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowPauseModal(false)}
              className="flex-1 py-4 text-white/60 hover:text-white transition-colors hover:bg-white/5 rounded-2xl font-medium"
            >
              Cancel
            </button>
            <button
              onClick={confirmPause}
              disabled={busy}
              className="flex-1 py-4 bg-brand-yellow hover:bg-brand-yellow/90 text-brand-base font-serif-display text-lg rounded-2xl transition-colors shadow-lg shadow-brand-yellow/20 disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const inputClass =
  'w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-brand-green outline-none transition-colors placeholder-white/20';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-white/70 mb-2 ml-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div
        className={`bg-brand-base border border-white/10 w-full ${maxWidth} p-8 rounded-[2rem] shadow-2xl animate-in fade-in zoom-in duration-300`}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-serif-display text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SessionRow({ log, now, onDelete }: { log: TimerLog; now: Date; onDelete: () => void }) {
  const start = parseDBDate(log.start_time);
  const end = log.end_time ? parseDBDate(log.end_time) : null;
  const isRunning = log.status === 'RUNNING';
  const durationMs = (end ?? now).getTime() - start.getTime();

  return (
    <div className="flex justify-between items-center p-6 bg-brand-base/50 hover:bg-brand-base rounded-3xl border border-white/5 transition-all group">
      <div className="flex flex-col">
        <span className="text-2xl font-serif-display text-white/90">{formatTimeOfDay(start)}</span>
        <span className="text-xs text-white/40 mt-1 uppercase tracking-wider">
          {end ? (
            <>
              to {formatTimeOfDay(end)} · {formatDuration(durationMs)}
            </>
          ) : (
            <span className="text-brand-green font-bold animate-pulse">Running</span>
          )}
        </span>
      </div>

      <div className="text-right flex flex-col items-end gap-2">
        <div
          className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase border inline-flex items-center gap-1.5 ${
            isRunning
              ? 'bg-brand-green/20 text-brand-green border-brand-green/30'
              : 'bg-white/5 text-white/30 border-white/10'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-brand-green' : 'bg-white/30'}`} />
          {isRunning ? 'Active' : formatDuration(durationMs)}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-white/30 font-medium capitalize">{log.reason || 'Session'}</p>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-white/20 hover:text-brand-red hover:bg-brand-red/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete session"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function JourneyCard({
  startDate,
  now,
  onConfirmChange,
  onFinish,
}: {
  startDate: Date;
  now: Date;
  onConfirmChange: () => void;
  onFinish: () => void;
}) {
  const nextChange = addDays(startDate, 7);
  const isOverdue = now.getTime() >= nextChange.getTime();
  const daysLeft = Math.ceil((nextChange.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  return (
    <div className="bg-gradient-to-r from-brand-green/10 to-transparent border border-brand-green/20 p-8 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-brand-green rounded-2xl flex items-center justify-center text-brand-base shadow-lg shadow-brand-green/20">
          <CalendarIcon size={32} />
        </div>
        <div>
          <h3 className="text-xl font-serif-display text-white">Current Aligner</h3>
          <p className="text-brand-green text-sm font-medium uppercase tracking-wider mt-1">
            Started {startDate.toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Next change</p>
        <p className={`text-3xl font-serif-display ${isOverdue ? 'text-brand-yellow animate-pulse' : 'text-white'}`}>
          {isOverdue ? 'Change due!' : `${daysLeft} days`}
        </p>
        <p className="text-white/30 text-xs mt-1 mb-3">
          {nextChange.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} at{' '}
          {formatTimeOfDay(nextChange)}
        </p>
        {isOverdue && (
          <button
            onClick={onConfirmChange}
            className="mt-2 px-6 py-2 bg-brand-green text-brand-base font-bold rounded-xl shadow-lg hover:bg-white transition-colors"
          >
            I've changed it
          </button>
        )}
      </div>

      <button
        onClick={onFinish}
        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-brand-red border border-white/5 hover:border-brand-red/30 rounded-xl transition-all text-sm font-medium"
      >
        Finish Journey
      </button>
    </div>
  );
}
