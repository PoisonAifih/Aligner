import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { AlertCircle, ArrowRight, CheckCircle, Clock, RefreshCw, Search, Users } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import type { Profile, TimerLog } from '../services/supabaseService';
import { useAuth } from '../context/useAuth';
import { useToday } from '../hooks/useToday';
import { addDays, endOfDay, formatShortDate, lastNDays, startOfDay } from '../lib/time';
import {
  COMPLIANCE_HEX,
  COMPLIANCE_LABELS,
  MIN_ACCEPTABLE_HOURS,
  SKIPPED_DAY_HOURS,
  complianceClasses,
  complianceFor,
  dailyWear,
  lastActivityAt,
  summariseWear,
} from '../lib/wearTime';
import type { Compliance } from '../lib/wearTime';

const WINDOW_DAYS = 7;

type ComplianceFilter = Compliance | 'all';

interface PatientRow {
  profile: Profile;
  compliance: Compliance;
  averageHours: number;
  skippedDays: number;
  lastActive: Date | null;
  chartData: Array<{ label: string; hours: number }>;
}

const FILTERS: Array<{ value: ComplianceFilter; label: string }> = [
  { value: 'all', label: 'All patients' },
  { value: 'red', label: 'At risk' },
  { value: 'yellow', label: 'Watch' },
  { value: 'green', label: 'On track' },
];

export default function DentistDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = useToday();

  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ComplianceFilter>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const assignments = await supabaseService.getAssignmentsForDentist(user.id);
      const patientIds = assignments.map((assignment) => assignment.patient_id);

      if (patientIds.length === 0) {
        setRows([]);
        return;
      }

      const windowStart = startOfDay(addDays(today, -(WINDOW_DAYS - 1)));
      const [profiles, logs] = await Promise.all([
        supabaseService.getProfilesByIds(patientIds),
        supabaseService.getLogsInRangeForUsers(patientIds, windowStart, endOfDay(today)),
      ]);

      const now = new Date();
      const days = lastNDays(WINDOW_DAYS, today);
      const logsByPatient = new Map<string, TimerLog[]>();
      logs.forEach((log) => {
        const list = logsByPatient.get(log.user_id) ?? [];
        list.push(log);
        logsByPatient.set(log.user_id, list);
      });

      const computed = profiles.map<PatientRow>((profile) => {
        const patientLogs = logsByPatient.get(profile.id) ?? [];
        const daily = dailyWear(patientLogs, days, now);
        const summary = summariseWear(daily, now);

        return {
          profile,
          compliance: complianceFor(summary),
          averageHours: summary.averageHours,
          skippedDays: summary.skippedDays,
          lastActive: lastActivityAt(patientLogs),
          chartData: daily.map((day) => ({
            label: formatShortDate(day.date),
            hours: Number(day.hours.toFixed(1)),
          })),
        };
      });

      const severity: Record<Compliance, number> = { red: 0, yellow: 1, green: 2 };
      computed.sort((a, b) => {
        if (severity[a.compliance] !== severity[b.compliance]) {
          return severity[a.compliance] - severity[b.compliance];
        }
        return a.averageHours - b.averageHours;
      });

      setRows(computed);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load your patients.');
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const atRisk = rows.filter((row) => row.compliance === 'red').length;
    const watch = rows.filter((row) => row.compliance === 'yellow').length;
    const average =
      rows.length > 0 ? rows.reduce((total, row) => total + row.averageHours, 0) / rows.length : 0;
    return { total: rows.length, atRisk, watch, average };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.compliance !== filter) return false;
      if (!term) return true;
      return (
        (row.profile.username ?? '').toLowerCase().includes(term) ||
        (row.profile.email ?? '').toLowerCase().includes(term)
      );
    });
  }, [rows, filter, search]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-brand-surface">
            <Users size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-serif-display text-white">My Patients</h1>
            <p className="text-sm text-white/50">
              Wear time over the last {WINDOW_DAYS} days. Today is excluded from the average while it is
              still in progress.
            </p>
          </div>
        </div>

        <button
          onClick={() => void load()}
          className="flex items-center gap-2 self-start rounded-2xl border border-white/5 bg-brand-base px-5 py-3 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Patients" value={`${stats.total}`} />
        <StatCard label="At risk" value={`${stats.atRisk}`} accent="text-brand-red" />
        <StatCard label="Needs watching" value={`${stats.watch}`} accent="text-brand-yellow" />
        <StatCard
          label="Average wear"
          value={`${stats.average.toFixed(1)}h`}
          accent={stats.average >= MIN_ACCEPTABLE_HOURS ? 'text-brand-green' : 'text-brand-yellow'}
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-brand-red/30 bg-brand-red/10 p-4 text-sm font-medium text-brand-red">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patients"
            className="w-full rounded-2xl border border-white/5 bg-brand-base py-3.5 pl-12 pr-4 text-white outline-none transition-colors placeholder:text-white/20 focus:border-brand-green"
          />
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/5 bg-brand-base p-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                filter === option.value ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-20 text-center text-white/50">Loading patients…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-[2.5rem] border border-white/5 bg-card p-12 text-center text-white/50">
          No patients assigned yet. Ask an admin to link patients to your profile.
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-[2.5rem] border border-white/5 bg-card p-12 text-center text-white/50">
          No patients match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map((row) => (
            <PatientCard
              key={row.profile.id}
              row={row}
              onOpen={() => navigate(`/aligner/dentist/patients/${row.profile.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PatientCard({ row, onOpen }: { row: PatientRow; onOpen: () => void }) {
  const { profile, compliance, averageHours, skippedDays, lastActive, chartData } = row;

  return (
    <div className="flex flex-col rounded-[2.5rem] border border-white/5 bg-card p-8 shadow-xl transition-all hover:border-white/10">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-serif-display text-xl text-white">
            {profile.username || profile.email?.split('@')[0]}
          </h3>
          <p className="truncate text-xs text-white/40">{profile.email}</p>
        </div>
        <div
          className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${complianceClasses(compliance)}`}
        >
          {compliance === 'green' && <CheckCircle size={14} />}
          {compliance === 'yellow' && <Clock size={14} />}
          {compliance === 'red' && <AlertCircle size={14} />}
          {COMPLIANCE_LABELS[compliance]}
        </div>
      </div>

      <div className="mb-6 flex-1">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-xs uppercase tracking-widest text-white/50">Daily average</span>
          <span className="font-serif-display text-2xl text-white">
            {averageHours.toFixed(1)} <span className="text-sm text-white/40">hrs</span>
          </span>
        </div>

        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
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
              <Bar dataKey="hours" radius={[3, 3, 3, 3]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`${entry.label}-${index}`}
                    fill={entry.hours < SKIPPED_DAY_HOURS ? COMPLIANCE_HEX.red : COMPLIANCE_HEX[compliance]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-3 text-xs text-white/30">
          {skippedDays > 0 ? `${skippedDays} day${skippedDays === 1 ? '' : 's'} without wear · ` : ''}
          {lastActive ? `Last activity ${lastActive.toLocaleString()}` : 'No activity recorded'}
        </p>
      </div>

      <button
        onClick={onOpen}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-base py-3 text-sm font-medium text-white/60 transition-colors hover:bg-brand-base/80 hover:text-white"
      >
        View full records <ArrowRight size={16} />
      </button>
    </div>
  );
}

function StatCard({ label, value, accent = 'text-white' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-card p-6 shadow-lg">
      <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
      <p className={`mt-2 font-serif-display text-3xl ${accent}`}>{value}</p>
    </div>
  );
}
