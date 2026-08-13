import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, RefreshCw, Search, ShieldCheck, ShieldOff, UserPlus, Users } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import type { Assignment, Profile } from '../services/supabaseService';
import { useAuth } from '../context/useAuth';
import { ROLE_BADGE_CLASSES, ROLE_LABELS, normaliseRole } from '../lib/roles';
import type { AppRole } from '../lib/roles';
import { parseDBDate } from '../lib/time';

type RoleFilter = AppRole | 'all';

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'user', label: 'Patients' },
  { value: 'dentist', label: 'Dentists' },
  { value: 'admin', label: 'Admins' },
];

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRows, assignmentRows] = await Promise.all([
        supabaseService.listProfiles(),
        supabaseService.listAssignments(),
      ]);
      setProfiles(profileRows);
      setAssignments(assignmentRows);
    } catch (error) {
      console.error(error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not load the user list.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const linkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    assignments.forEach((assignment) => {
      counts.set(assignment.patient_id, (counts.get(assignment.patient_id) ?? 0) + 1);
      counts.set(assignment.dentist_id, (counts.get(assignment.dentist_id) ?? 0) + 1);
    });
    return counts;
  }, [assignments]);

  const stats = useMemo(() => {
    const byRole = { user: 0, dentist: 0, admin: 0 };
    let deactivated = 0;
    profiles.forEach((profile) => {
      byRole[normaliseRole(profile.role)] += 1;
      if (profile.is_active === false) deactivated += 1;
    });
    return { total: profiles.length, ...byRole, deactivated };
  }, [profiles]);

  const visibleProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (roleFilter !== 'all' && normaliseRole(profile.role) !== roleFilter) return false;
      if (!term) return true;
      return (
        (profile.username ?? '').toLowerCase().includes(term) ||
        (profile.email ?? '').toLowerCase().includes(term)
      );
    });
  }, [profiles, roleFilter, search]);

  const applyUpdate = async (profileId: string, updates: Partial<Profile>, successText: string) => {
    setPendingId(profileId);
    setMessage(null);
    try {
      const updated = await supabaseService.updateProfile(profileId, updates);
      setProfiles((current) => current.map((item) => (item.id === profileId ? { ...item, ...updated } : item)));
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'The change could not be saved.',
      });
    } finally {
      setPendingId(null);
    }
  };

  const handleRoleChange = async (profile: Profile, nextRole: AppRole) => {
    if (profile.id === user?.id) {
      setMessage({ type: 'error', text: 'You cannot change your own role.' });
      return;
    }
    await applyUpdate(
      profile.id,
      { role: nextRole },
      `${profile.username || profile.email} is now a ${ROLE_LABELS[nextRole].toLowerCase()}.`,
    );
  };

  const handleActivationToggle = async (profile: Profile) => {
    if (profile.id === user?.id) {
      setMessage({ type: 'error', text: 'You cannot deactivate your own account.' });
      return;
    }
    const nextActive = profile.is_active === false;
    await applyUpdate(
      profile.id,
      { is_active: nextActive },
      `${profile.username || profile.email} has been ${nextActive ? 'reactivated' : 'deactivated'}.`,
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-brand-surface">
            <Users size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-serif-display text-white">Manage Users</h1>
            <p className="text-sm text-white/50">Review every account, adjust roles and control access.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-2xl border border-white/5 bg-brand-base px-5 py-3 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /> Refresh
          </button>
          <button
            onClick={() => navigate('/aligner/admin/assign')}
            className="flex items-center gap-2 rounded-2xl border border-white/5 bg-brand-base px-5 py-3 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            <Link2 size={16} /> Assignments
          </button>
          <button
            onClick={() => navigate('/aligner/admin/create-user')}
            className="flex items-center gap-2 rounded-2xl bg-brand-green px-5 py-3 text-sm font-medium text-white shadow-lg shadow-brand-green/20 transition-colors hover:bg-brand-green/90"
          >
            <UserPlus size={16} /> Register user
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total accounts" value={stats.total} />
        <StatCard label="Patients" value={stats.user} accent="text-brand-green" />
        <StatCard label="Dentists" value={stats.dentist} accent="text-brand-yellow" />
        <StatCard label="Deactivated" value={stats.deactivated} accent="text-brand-red" />
      </div>

      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm font-medium ${
            message.type === 'success'
              ? 'border-brand-green/30 bg-brand-green/10 text-brand-green'
              : 'border-brand-red/30 bg-brand-red/10 text-brand-red'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-[2.5rem] border border-white/5 bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-2xl border border-white/5 bg-brand-base py-3.5 pl-12 pr-4 text-white outline-none transition-colors placeholder:text-white/20 focus:border-brand-green"
            />
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/5 bg-brand-base p-1.5">
            {ROLE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setRoleFilter(filter.value)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  roleFilter === filter.value
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:bg-white/5 hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-white/40">Loading accounts…</p>
        ) : visibleProfiles.length === 0 ? (
          <p className="py-16 text-center text-white/40">No accounts match this filter.</p>
        ) : (
          <div className="space-y-3">
            {visibleProfiles.map((profile) => {
              const role = normaliseRole(profile.role);
              const isSelf = profile.id === user?.id;
              const isDeactivated = profile.is_active === false;
              const links = linkCounts.get(profile.id) ?? 0;

              return (
                <div
                  key={profile.id}
                  className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-brand-base/50 p-6 transition-colors hover:bg-brand-base xl:flex-row xl:items-center xl:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 font-serif-display text-lg text-white">
                      {(profile.username?.[0] || profile.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-white">
                          {profile.username || profile.email?.split('@')[0] || 'Unnamed'}
                        </span>
                        {isSelf && (
                          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/60">
                            You
                          </span>
                        )}
                        {isDeactivated && (
                          <span className="rounded-md bg-brand-red/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-brand-red">
                            Deactivated
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-white/40">{profile.email}</p>
                      <p className="mt-1 text-xs text-white/30">
                        {role === 'dentist'
                          ? `${links} patient${links === 1 ? '' : 's'} assigned`
                          : role === 'user'
                            ? links > 0
                              ? `Linked to ${links} dentist${links === 1 ? '' : 's'}`
                              : 'Not linked to a dentist yet'
                            : 'Full console access'}
                        {profile.is_journey_active && profile.current_aligner_date
                          ? ` · Aligner since ${parseDBDate(profile.current_aligner_date).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${ROLE_BADGE_CLASSES[role]}`}
                    >
                      {ROLE_LABELS[role]}
                    </span>

                    <select
                      value={role}
                      disabled={isSelf || pendingId === profile.id}
                      onChange={(event) => void handleRoleChange(profile, event.target.value as AppRole)}
                      className="rounded-xl border border-white/10 bg-brand-base px-3 py-2 text-sm text-white outline-none transition-colors focus:border-brand-green disabled:opacity-40"
                    >
                      <option value="user">Patient</option>
                      <option value="dentist">Dentist</option>
                      <option value="admin">Administrator</option>
                    </select>

                    <button
                      onClick={() => void handleActivationToggle(profile)}
                      disabled={isSelf || pendingId === profile.id}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                        isDeactivated
                          ? 'border-brand-green/30 bg-brand-green/10 text-brand-green hover:bg-brand-green/20'
                          : 'border-white/10 bg-white/5 text-white/60 hover:border-brand-red/30 hover:text-brand-red'
                      }`}
                    >
                      {isDeactivated ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                      {isDeactivated ? 'Reactivate' : 'Deactivate'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = 'text-white' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-card p-6 shadow-lg">
      <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
      <p className={`mt-2 font-serif-display text-3xl ${accent}`}>{value}</p>
    </div>
  );
}
