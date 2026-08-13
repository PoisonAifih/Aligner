import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Stethoscope, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { supabaseService } from '../services/supabaseService';
import { useAuth } from '../context/useAuth';
import { ROLE_LABELS, homePathForRole, normaliseRole } from '../lib/roles';
import type { AppRole } from '../lib/roles';

const TABS: Array<{ value: AppRole; label: string; icon: typeof User; activeClass: string }> = [
  { value: 'user', label: 'Patient', icon: User, activeClass: 'bg-brand-green text-white shadow-lg shadow-brand-green/20' },
  { value: 'dentist', label: 'Dentist', icon: Stethoscope, activeClass: 'bg-brand-yellow text-brand-base shadow-lg shadow-brand-yellow/20' },
  { value: 'admin', label: 'Admin', icon: Shield, activeClass: 'bg-white/90 text-brand-base shadow-lg shadow-white/10' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [expectedRole, setExpectedRole] = useState<AppRole>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) navigate(homePathForRole(role), { replace: true });
  }, [authLoading, user, role, navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const signedInUser = data.user;
      if (!signedInUser) throw new Error('Sign in did not return an account.');

      const profile = await supabaseService.getProfile(signedInUser.id);
      const isAdmin = profile?.role === 'admin' || signedInUser.email?.includes('admin');
      const actualRole: AppRole = isAdmin ? 'admin' : normaliseRole(profile?.role);

      if (profile?.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('This account has been deactivated. Please contact your administrator.');
      }

      if (actualRole !== expectedRole) {
        await supabase.auth.signOut();
        throw new Error(
          `This account is registered as a ${ROLE_LABELS[actualRole].toLowerCase()}. Please switch to the ${ROLE_LABELS[actualRole]} tab and sign in again.`,
        );
      }

      navigate(homePathForRole(actualRole), { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const contactHint = expectedRole === 'user' ? 'Dentist' : 'Administrator';

  return (
    <div className="min-h-screen flex items-center justify-center bg-aesthetic p-4">
      <div className="bg-brand-surface/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[2rem] w-full max-w-screen-lg animate-in fade-in zoom-in duration-700 overflow-hidden flex flex-col md:flex-row">
        <div className="w-full md:w-5/12 p-8 md:p-12 flex flex-col justify-center items-start bg-brand-base/50 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-green/10 to-transparent pointer-events-none" />

          <div className="bg-brand-base w-80 h-20 flex items-center justify-center rounded-[2rem] shadow-[0_0_30px_rgba(148,163,120,0.1)] border border-brand-green/20 mb-8 relative z-10">
            <h1 className="font-serif-display text-3xl font-bold text-brand-green tracking-widest">InVilign</h1>
          </div>

          <h2 className="text-4xl md:text-5xl font-serif-display font-medium text-left mb-4 text-white tracking-tight leading-tight relative z-10">
            Welcome Back
          </h2>
          <p className="text-white/60 text-left font-light text-lg relative z-10">
            Sign in to track your aligner journey.
          </p>
        </div>

        <div className="w-full md:w-7/12 p-8 md:p-12">
          <div className="flex bg-brand-base p-1.5 rounded-2xl mb-8 border border-white/5">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setExpectedRole(tab.value);
                  setError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 ${
                  expectedRole === tab.value ? tab.activeClass : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={18} />
                <span className="font-medium tracking-wide">{tab.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2 ml-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full px-5 py-4 bg-brand-base border border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/50 outline-none text-white placeholder-white/20 transition-all hover:bg-brand-base/80"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2 ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-5 py-4 bg-brand-base border border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green/50 outline-none text-white placeholder-white/20 transition-all hover:bg-brand-base/80"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-4 bg-brand-red/20 border border-brand-red/30 rounded-2xl text-brand-red text-sm font-medium text-center backdrop-blur-md">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-brand-green hover:bg-brand-green/90 text-white font-serif-display text-lg tracking-wide rounded-2xl shadow-xl shadow-brand-green/20 transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-white/40 text-sm font-light">
            Don't have an account?{' '}
            <span className="text-brand-green border-b border-transparent">Contact your {contactHint}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
