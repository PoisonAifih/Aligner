import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Check, Lock, Mail, Shield, Stethoscope, User, UserPlus, X } from 'lucide-react';
import { ROLE_LABELS } from '../lib/roles';
import type { AppRole } from '../lib/roles';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const signUpClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const MIN_PASSWORD_LENGTH = 8;

const ROLE_OPTIONS: Array<{ value: AppRole; icon: typeof User; activeClass: string }> = [
  { value: 'user', icon: User, activeClass: 'bg-brand-green text-white shadow-lg shadow-brand-green/20' },
  { value: 'dentist', icon: Stethoscope, activeClass: 'bg-brand-yellow text-brand-base shadow-lg shadow-brand-yellow/20' },
  { value: 'admin', icon: Shield, activeClass: 'bg-white/90 text-brand-base shadow-lg shadow-white/10' },
];

export default function AdminUserCreate() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<AppRole>('user');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) throw new Error('Please enter a username.');
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      }

      const { data, error } = await signUpClient.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: trimmedUsername, role } },
      });

      if (error) throw error;
      if (!data.user) throw new Error('The account was not created. Please try again.');

      setMessage({
        type: 'success',
        text: `${trimmedUsername} was created as a ${ROLE_LABELS[role].toLowerCase()}.`,
      });
      setEmail('');
      setPassword('');
      setUsername('');
      setRole('user');
    } catch (createError) {
      setMessage({
        type: 'error',
        text: createError instanceof Error ? createError.message : 'Could not create this account.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="mb-2 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/5 bg-brand-surface">
          <UserPlus size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-serif-display text-white">Create New User</h1>
          <p className="text-sm text-white/50">Add a patient, dentist or administrator to the system.</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="rounded-[2.5rem] border border-white/5 bg-card p-8 shadow-xl sm:p-10">
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-2">
              <label className="ml-1 text-sm font-medium text-white/70">Role</label>
              <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/5 bg-brand-base p-1">
                {ROLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all ${
                      role === option.value ? option.activeClass : 'text-white/40 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <option.icon size={16} />
                    {ROLE_LABELS[option.value]}
                  </button>
                ))}
              </div>
              {role === 'admin' && (
                <p className="ml-1 text-xs text-brand-yellow/80">
                  Administrators can manage every account and assignment. Grant this sparingly.
                </p>
              )}
            </div>

            <FormField label="Username" icon={User}>
              <input
                type="text"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="ivy"
                className={inputClass}
              />
            </FormField>

            <FormField label="Email" icon={Mail}>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ivy@example.com"
                className={inputClass}
              />
            </FormField>

            <FormField label="Password" icon={Lock}>
              <input
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className={inputClass}
              />
            </FormField>

            {message && (
              <div
                className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium ${
                  message.type === 'success'
                    ? 'border-brand-green/30 bg-brand-green/20 text-brand-green'
                    : 'border-brand-red/30 bg-brand-red/20 text-brand-red'
                }`}
              >
                {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
                {message.text}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-green py-4 font-serif-display text-lg text-white shadow-xl shadow-brand-green/20 transition-all hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create user'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/aligner/admin/users')}
                className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 font-medium text-white/60 transition-colors hover:text-white"
              >
                Back to users
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          New patients still need to be linked to a dentist on the Assignments page.
        </p>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-2xl border border-white/5 bg-brand-base py-4 pl-12 pr-4 text-white outline-none transition-colors placeholder:text-white/20 focus:border-brand-green';

function FormField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof User;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="ml-1 text-sm font-medium text-white/70">{label}</label>
      <div className="relative">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
        {children}
      </div>
    </div>
  );
}
