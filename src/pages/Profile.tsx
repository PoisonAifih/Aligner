import { useEffect, useState } from 'react';
import { Lock, Mail, Save, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { supabaseService } from '../services/supabaseService';
import { useAuth } from '../context/useAuth';
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from '../lib/roles';

const MIN_PASSWORD_LENGTH = 8;

export default function Profile() {
  const { user, profile, role, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setUsername(profile?.username ?? '');
  }, [profile?.username]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) throw new Error('Username cannot be empty.');

      if (password) {
        if (password.length < MIN_PASSWORD_LENGTH) {
          throw new Error(`Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        if (password !== confirmPassword) throw new Error('The two passwords do not match.');
      }

      if (trimmedUsername !== (profile?.username ?? '')) {
        await supabaseService.updateProfile(user.id, { username: trimmedUsername });
        await refreshProfile();
      }

      if (password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Profile updated successfully.' });
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not update your profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-brand-surface rounded-2xl flex items-center justify-center border border-white/5">
          <User size={32} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-serif-display text-white">Edit Profile</h1>
          <p className="text-white/50 text-sm">Update your personal information and security settings.</p>
        </div>
        <span
          className={`ml-auto px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${ROLE_BADGE_CLASSES[role]}`}
        >
          {ROLE_LABELS[role]}
        </span>
      </div>

      <div className="bg-card border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-xl max-w-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label className="block text-sm font-medium text-white/50 mb-2 ml-1">Email address</label>
            <div className="relative">
              <input
                type="email"
                disabled
                value={user?.email ?? ''}
                className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/5 rounded-2xl text-white/50 cursor-not-allowed"
              />
              <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            </div>
            <p className="text-xs text-white/30 mt-2 ml-1">Email cannot be changed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/90 mb-2 ml-1">Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-yellow/50 focus:border-brand-yellow/50 outline-none text-white placeholder-white/20 transition-all hover:bg-white/10"
                placeholder="Your username"
              />
              <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
            </div>
          </div>

          <div className="border-t border-white/10 my-8" />
          <h3 className="text-lg font-serif-display text-white mb-4">Change password</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2 ml-1">New password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-yellow/50 focus:border-brand-yellow/50 outline-none text-white placeholder-white/20 transition-all hover:bg-white/10"
                  placeholder="Leave blank to keep current"
                />
                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2 ml-1">Confirm password</label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full pl-12 pr-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-yellow/50 focus:border-brand-yellow/50 outline-none text-white placeholder-white/20 transition-all hover:bg-white/10"
                  placeholder="Confirm new password"
                />
                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`p-4 rounded-2xl text-sm font-medium text-center border ${
                message.type === 'success'
                  ? 'bg-brand-green/20 border-brand-green/30 text-brand-green'
                  : 'bg-brand-red/20 border-brand-red/30 text-brand-red'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full md:w-auto md:min-w-[200px] flex items-center justify-center gap-2 py-4 px-8 bg-brand-yellow hover:bg-brand-yellow/90 text-brand-base font-serif-display text-lg tracking-wide rounded-2xl shadow-xl shadow-brand-yellow/20 transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="animate-pulse">Saving…</span>
              ) : (
                <>
                  <Save size={20} />
                  <span>Save changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
