import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Check, Link2, Search, Trash2, Users } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import type { Assignment, Profile } from '../services/supabaseService';
import { normaliseRole } from '../lib/roles';
import { parseDBDate } from '../lib/time';

export default function AdminAssignment() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [selectedDentist, setSelectedDentist] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [dentistSearch, setDentistSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
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
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not load assignments.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const patients = useMemo(
    () => profiles.filter((profile) => normaliseRole(profile.role) === 'user'),
    [profiles],
  );
  const dentists = useMemo(
    () => profiles.filter((profile) => normaliseRole(profile.role) === 'dentist'),
    [profiles],
  );

  const dentistsForPatient = useMemo(() => {
    const map = new Map<string, string[]>();
    assignments.forEach((assignment) => {
      const list = map.get(assignment.patient_id) ?? [];
      list.push(assignment.dentist_id);
      map.set(assignment.patient_id, list);
    });
    return map;
  }, [assignments]);

  const displayName = useCallback(
    (id: string) => {
      const profile = profilesById.get(id);
      return profile?.username || profile?.email || 'Unknown account';
    },
    [profilesById],
  );

  const matches = (profile: Profile, term: string) => {
    const needle = term.trim().toLowerCase();
    if (!needle) return true;
    return (
      (profile.username ?? '').toLowerCase().includes(needle) ||
      (profile.email ?? '').toLowerCase().includes(needle)
    );
  };

  const handleAssign = async () => {
    if (!selectedPatient || !selectedDentist) return;
    setSaving(true);
    setMessage(null);
    try {
      const created = await supabaseService.createAssignment(selectedPatient, selectedDentist);
      setAssignments((current) => [created, ...current]);
      setMessage({
        type: 'success',
        text: `${displayName(selectedPatient)} is now monitored by ${displayName(selectedDentist)}.`,
      });
      setSelectedPatient(null);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not create the assignment.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (assignment: Assignment) => {
    if (
      !confirm(
        `Remove ${displayName(assignment.patient_id)} from ${displayName(assignment.dentist_id)}'s patient list?`,
      )
    ) {
      return;
    }

    setRemovingId(assignment.id);
    setMessage(null);
    try {
      await supabaseService.deleteAssignment(assignment.id);
      setAssignments((current) => current.filter((item) => item.id !== assignment.id));
      setMessage({ type: 'success', text: 'Assignment removed.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not remove the assignment.',
      });
    } finally {
      setRemovingId(null);
    }
  };

  const unassignedPatients = patients.filter((patient) => !dentistsForPatient.has(patient.id)).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-brand-surface">
          <Link2 size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-serif-display text-white">Patient Assignment</h1>
          <p className="text-sm text-white/50">Link patients to the dentist who monitors their progress.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Active links" value={assignments.length} />
        <SummaryCard label="Dentists" value={dentists.length} accent="text-brand-yellow" />
        <SummaryCard
          label="Patients without a dentist"
          value={unassignedPatients}
          accent={unassignedPatients > 0 ? 'text-brand-red' : 'text-brand-green'}
        />
      </div>

      {message && (
        <div
          className={`rounded-2xl border p-4 text-center text-sm font-medium ${
            message.type === 'success'
              ? 'border-brand-green/30 bg-brand-green/10 text-brand-green'
              : 'border-brand-red/30 bg-brand-red/10 text-brand-red'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
        <PickerColumn
          title="Select patient"
          searchValue={patientSearch}
          onSearch={setPatientSearch}
          emptyText={loading ? 'Loading patients…' : 'No patients found.'}
        >
          {patients
            .filter((patient) => matches(patient, patientSearch))
            .map((patient) => {
              const linked = dentistsForPatient.get(patient.id) ?? [];
              return (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                    selectedPatient === patient.id
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-white/5 bg-brand-base text-white/70 hover:bg-brand-base/80 hover:text-white'
                  }`}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{patient.username || patient.email}</span>
                    <span className="truncate text-xs opacity-50">{patient.email}</span>
                    <span className="mt-1 text-xs opacity-40">
                      {linked.length > 0
                        ? `Monitored by ${linked.map(displayName).join(', ')}`
                        : 'Not assigned yet'}
                    </span>
                  </div>
                  {selectedPatient === patient.id && <Check size={18} className="shrink-0" />}
                </button>
              );
            })}
        </PickerColumn>

        <PickerColumn
          title="Select dentist"
          searchValue={dentistSearch}
          onSearch={setDentistSearch}
          emptyText={loading ? 'Loading dentists…' : 'No dentists found.'}
        >
          {dentists
            .filter((dentist) => matches(dentist, dentistSearch))
            .map((dentist) => {
              const patientCount = assignments.filter((item) => item.dentist_id === dentist.id).length;
              return (
                <button
                  key={dentist.id}
                  onClick={() => setSelectedDentist(dentist.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                    selectedDentist === dentist.id
                      ? 'border-brand-yellow bg-brand-yellow/20 text-brand-yellow'
                      : 'border-white/5 bg-brand-base text-white/70 hover:bg-brand-base/80 hover:text-white'
                  }`}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{dentist.username || dentist.email}</span>
                    <span className="truncate text-xs opacity-50">{dentist.email}</span>
                    <span className="mt-1 text-xs opacity-40">
                      {patientCount} patient{patientCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  {selectedDentist === dentist.id && <Check size={18} className="shrink-0" />}
                </button>
              );
            })}
        </PickerColumn>
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => void handleAssign()}
          disabled={!selectedPatient || !selectedDentist || saving}
          className="flex items-center gap-3 rounded-2xl bg-brand-green px-10 py-4 font-serif-display text-lg text-white shadow-xl shadow-brand-green/20 transition-all hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Assigning…' : 'Assign patient'} <ArrowRight size={20} />
        </button>
      </div>

      <div className="rounded-[2.5rem] border border-white/5 bg-card p-8 shadow-xl">
        <h3 className="mb-6 flex items-center gap-3 font-serif-display text-xl text-white">
          <Users size={22} className="text-brand-green" />
          Current assignments
        </h3>

        {loading ? (
          <p className="py-12 text-center text-white/40">Loading assignments…</p>
        ) : assignments.length === 0 ? (
          <p className="py-12 text-center text-white/40">
            No patients are linked to a dentist yet. Pick a pair above to create the first link.
          </p>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-brand-base/50 p-5 transition-colors hover:bg-brand-base sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium text-white">{displayName(assignment.patient_id)}</span>
                  <ArrowRight size={14} className="text-white/30" />
                  <span className="font-medium text-brand-yellow">{displayName(assignment.dentist_id)}</span>
                  <span className="text-xs text-white/30">
                    linked {parseDBDate(assignment.created_at).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={() => void handleUnassign(assignment)}
                  disabled={removingId === assignment.id}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:border-brand-red/30 hover:text-brand-red disabled:opacity-40"
                >
                  <Trash2 size={14} />
                  {removingId === assignment.id ? 'Removing…' : 'Unassign'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PickerColumn({
  title,
  searchValue,
  onSearch,
  emptyText,
  children,
}: {
  title: string;
  searchValue: string;
  onSearch: (value: string) => void;
  emptyText: string;
  children: ReactNode[];
}) {
  return (
    <div className="rounded-[2.5rem] border border-white/5 bg-card p-8 shadow-xl">
      <h3 className="mb-4 font-serif-display text-xl text-white">{title}</h3>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={searchValue}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search…"
          className="w-full rounded-2xl border border-white/5 bg-brand-base py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/20 focus:border-brand-green"
        />
      </div>

      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
        {children.length > 0 ? children : <p className="py-8 text-center text-sm text-white/40">{emptyText}</p>}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent = 'text-white' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-card p-6 shadow-lg">
      <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
      <p className={`mt-2 font-serif-display text-3xl ${accent}`}>{value}</p>
    </div>
  );
}
