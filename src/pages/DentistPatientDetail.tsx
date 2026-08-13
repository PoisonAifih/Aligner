import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle, ChevronDown, Clock } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import type { Profile, TimerLog } from '../services/supabaseService';
import { useAuth } from '../context/useAuth';
import { useToday } from '../hooks/useToday';
import {
  addDays,
  endOfDay,
  formatDayLabel,
  formatDuration,
  formatShortDate,
  formatTimeOfDay,
  isSameDay,
  lastNDays,
  parseDBDate,
  startOfDay,
} from '../lib/time';
import {
  COMPLIANCE_HEX,
  COMPLIANCE_LABELS,
  DAILY_TARGET_HOURS,
  SKIPPED_DAY_HOURS,
  complianceClasses,
  complianceFor,
  dailyWear,
  logBounds,
  summariseWear,
} from '../lib/wearTime';
import type { DailyWear } from '../lib/wearTime';

const RANGE_OPTIONS = [7, 30, 90];

export default function DentistPatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const today = useToday();

  const [rangeDays, setRangeDays] = useState(RANGE_OPTIONS[0]);
  const [patient, setPatient] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<TimerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const load = useCallback(async () => {
    if (!user || !patientId) return;
    setLoading(true);
    setError(null);

    try {
      if (!isAdmin) {
        const assignments = await supabaseService.getAssignmentsForDentist(user.id);
        if (!assignments.some((assignment) => assignment.patient_id === patientId)) {
          setError('This patient is not assigned to you.');
          setPatient(null);
          setLogs([]);
          return;
        }
      }

      const [profiles, patientLogs] = await Promise.all([
        supabaseService.getProfilesByIds([patientId]),
        supabaseService.getLogsInRange(patientId, startOfDay(addDays(today, -(rangeDays - 1))), endOfDay(today)),
      ]);

      setPatient(profiles[0] ?? null);
      setLogs(patientLogs);
      setNow(new Date());
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load this patient.');
    } finally {
      setLoading(false);
    }
  }, [user, patientId, isAdmin, rangeDays, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const daily = useMemo(
    () => dailyWear(logs, lastNDays(rangeDays, today), now),
    [logs, rangeDays, today, now],
  );

  const summary = useMemo(() => summariseWear(daily, now), [daily, now]);
  const compliance = complianceFor(summary);

  const chartData = useMemo(
    () =>
      daily.map((day) => ({
        label: formatShortDate(day.date),
        hours: Number(day.hours.toFixed(1)),
      })),
    [daily],
  );

  const logsByDay = useMemo(() => {
    const grouped = new Map<string, TimerLog[]>();
    daily.forEach((day) => {
      const key = day.date.toDateString();
      grouped.set(
        key,
        logs.filter((log) => {
          const { start, end } = logBounds(log, now);
          return start <= endOfDay(day.date) && end >= startOfDay(day.date);
        }),
      );
    });
    return grouped;
  }, [daily, logs, now]);

  const journeyInfo = useMemo(() => {
    if (!patient?.is_journey_active || !patient.current_aligner_date) return null;
    const start = parseDBDate(patient.current_aligner_date);
    const nextChange = addDays(start, 7);
    return { start, nextChange, isOverdue: now.getTime() >= nextChange.getTime() };
  }, [patient, now]);

  if (loading) {
    return <p className="py-20 text-center text-white/50">Loading patient records…</p>;
  }

  if (error || !patient) {
    return (
      <div className="space-y-6">
        <BackButton onClick={() => navigate('/aligner/dentist')} />
        <div className="rounded-[2.5rem] border border-brand-red/20 bg-brand-red/5 p-12 text-center text-white/60">
          {error ?? 'This patient could not be found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <BackButton onClick={() => navigate('/aligner/dentist')} />

      <div className="flex flex-col gap-6 rounded-[2.5rem] border border-white/5 bg-card p-8 shadow-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 font-serif-display text-2xl text-white">
            {(patient.username?.[0] || patient.email?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <h1 className="font-serif-display text-3xl text-white">
              {patient.username || patient.email?.split('@')[0]}
            </h1>
            <p className="text-sm text-white/40">{patient.email}</p>
            {journeyInfo ? (
              <p className={`mt-1 text-xs ${journeyInfo.isOverdue ? 'text-brand-yellow' : 'text-white/40'}`}>
                Current aligner since {journeyInfo.start.toLocaleDateString()} ·{' '}
                {journeyInfo.isOverdue
                  ? 'change overdue'
                  : `next change ${journeyInfo.nextChange.toLocaleDateString()}`}
              </p>
            ) : (
              <p className="mt-1 text-xs text-white/30">No active aligner journey.</p>
            )}
          </div>
        </div>

        <div
          className={`flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest ${complianceClasses(compliance)}`}
        >
          {compliance === 'green' && <CheckCircle size={16} />}
          {compliance === 'yellow' && <Clock size={16} />}
          {compliance === 'red' && <AlertCircle size={16} />}
          {COMPLIANCE_LABELS[compliance]}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/5 bg-brand-base p-1.5 lg:w-fit">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => setRangeDays(option)}
            className={`rounded-xl px-5 py-2 text-sm font-medium transition-all ${
              rangeDays === option ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'
            }`}
          >
            Last {option} days
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Daily average" value={`${summary.averageHours.toFixed(1)}h`} />
        <StatCard
          label="Best day"
          value={summary.best ? `${summary.best.hours.toFixed(1)}h` : '—'}
          hint={summary.best ? formatShortDate(summary.best.date) : undefined}
          accent="text-brand-green"
        />
        <StatCard
          label="Lowest day"
          value={summary.worst ? `${summary.worst.hours.toFixed(1)}h` : '—'}
          hint={summary.worst ? formatShortDate(summary.worst.date) : undefined}
          accent="text-brand-yellow"
        />
        <StatCard
          label="Days without wear"
          value={`${summary.skippedDays}`}
          hint={`of ${summary.ratedDays} completed days`}
          accent={summary.skippedDays > 0 ? 'text-brand-red' : 'text-brand-green'}
        />
      </div>

      <div className="rounded-[2.5rem] border border-white/5 bg-card p-8 shadow-xl">
        <h3 className="mb-6 flex items-center gap-3 font-serif-display text-xl text-white">
          <CalendarDays size={22} className="text-brand-green" />
          Wear time per day
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 24]}
                ticks={[0, 6, 12, 18, 24]}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{
                  backgroundColor: '#313647',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                formatter={(value: unknown) => [`${Number(value).toFixed(1)} h`, 'Worn']}
              />
              <ReferenceLine
                y={DAILY_TARGET_HOURS}
                stroke="#94A378"
                strokeDasharray="4 4"
                label={{ value: `${DAILY_TARGET_HOURS}h target`, fill: '#94A378', fontSize: 10, position: 'insideTopRight' }}
              />
              <Bar dataKey="hours" radius={[4, 4, 4, 4]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`${entry.label}-${index}`}
                    fill={
                      entry.hours >= DAILY_TARGET_HOURS
                        ? COMPLIANCE_HEX.green
                        : entry.hours < SKIPPED_DAY_HOURS
                          ? COMPLIANCE_HEX.red
                          : COMPLIANCE_HEX.yellow
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-white/5 bg-card p-8 shadow-xl">
        <h3 className="mb-6 font-serif-display text-xl text-white">Session history</h3>
        <div className="space-y-2">
          {[...daily].reverse().map((day) => (
            <DayRow
              key={day.date.toDateString()}
              day={day}
              today={today}
              sessions={logsByDay.get(day.date.toDateString()) ?? []}
              now={now}
              expanded={expandedDay === day.date.toDateString()}
              onToggle={() =>
                setExpandedDay((current) =>
                  current === day.date.toDateString() ? null : day.date.toDateString(),
                )
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayRow({
  day,
  today,
  sessions,
  now,
  expanded,
  onToggle,
}: {
  day: DailyWear;
  today: Date;
  sessions: TimerLog[];
  now: Date;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isToday = isSameDay(day.date, today);
  const barWidth = Math.min(100, (day.hours / 24) * 100);
  const barColor =
    day.hours >= DAILY_TARGET_HOURS
      ? 'bg-brand-green'
      : day.hours < SKIPPED_DAY_HOURS
        ? 'bg-brand-red'
        : 'bg-brand-yellow';

  return (
    <div className="overflow-hidden rounded-3xl border border-white/5 bg-brand-base/40">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-brand-base/70"
      >
        <ChevronDown
          size={18}
          className={`shrink-0 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">{formatDayLabel(day.date)}</span>
            {isToday && (
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/60">
                In progress
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-serif-display text-lg text-white">{day.hours.toFixed(1)}h</p>
          <p className="text-xs text-white/30">
            {sessions.length} session{sessions.length === 1 ? '' : 's'}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-white/5 px-5 py-4">
          {sessions.length === 0 ? (
            <p className="py-3 text-sm italic text-white/30">No sessions recorded on this day.</p>
          ) : (
            sessions.map((session) => {
              const { start, end } = logBounds(session, now);
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm"
                >
                  <span className="text-white/80">
                    {formatTimeOfDay(start)} – {session.end_time ? formatTimeOfDay(end) : 'now'}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs capitalize text-white/30">{session.reason || 'Session'}</span>
                    <span className="font-medium text-white/60">
                      {formatDuration(end.getTime() - start.getTime())}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm font-medium text-white/50 transition-colors hover:text-white"
    >
      <ArrowLeft size={16} /> Back to patients
    </button>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = 'text-white',
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/5 bg-card p-6 shadow-lg">
      <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
      <p className={`mt-2 font-serif-display text-3xl ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-white/30">{hint}</p>}
    </div>
  );
}
