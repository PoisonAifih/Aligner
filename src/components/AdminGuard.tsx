import { useCallback, useState, useSyncExternalStore } from 'react';
import { Outlet } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Lock, Shield, ShieldCheck } from 'lucide-react';
import { CookieStorage } from '../lib/storage';
import { useAuth } from '../context/useAuth';

const UNLOCK_COOKIE = 'admin_unlocked_until';
const UNLOCK_DURATION_MS = 8 * 60 * 60 * 1000;
const RECHECK_INTERVAL_MS = 30_000;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'INVILIGN';

const readUnlockExpiry = (): number => {
  const stored = CookieStorage.getItem(UNLOCK_COOKIE);
  const expiry = stored ? Number(stored) : 0;
  return Number.isFinite(expiry) ? expiry : 0;
};

const listeners = new Set<() => void>();

const notifyUnlockChanged = () => listeners.forEach((listener) => listener());

const subscribeToUnlock = (listener: () => void) => {
  listeners.add(listener);
  const interval = setInterval(listener, RECHECK_INTERVAL_MS);
  window.addEventListener('focus', listener);

  return () => {
    listeners.delete(listener);
    clearInterval(interval);
    window.removeEventListener('focus', listener);
  };
};

const getIsUnlocked = () => readUnlockExpiry() > Date.now();
const getUnlockExpiry = () => (getIsUnlocked() ? readUnlockExpiry() : 0);

export default function AdminGuard() {
  const { profile, user } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const isUnlocked = useSyncExternalStore(subscribeToUnlock, getIsUnlocked);
  const unlockedUntil = useSyncExternalStore(subscribeToUnlock, getUnlockExpiry);

  const lock = useCallback(() => {
    CookieStorage.removeItem(UNLOCK_COOKIE);
    setPassword('');
    notifyUnlockChanged();
  }, []);

  const handleUnlock = (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== ADMIN_PASSWORD) {
      setError(true);
      setPassword('');
      return;
    }

    CookieStorage.setItem(UNLOCK_COOKIE, `${Date.now() + UNLOCK_DURATION_MS}`);
    setError(false);
    setPassword('');
    notifyUnlockChanged();
  };

  if (isUnlocked) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-brand-yellow/20 bg-brand-yellow/5 px-6 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 text-sm">
            <ShieldCheck size={18} className="text-brand-yellow" />
            <span className="text-white/70">
              Admin console unlocked as{' '}
              <span className="text-white">{profile?.username || user?.email}</span> until{' '}
              {new Date(unlockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button
            onClick={lock}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Lock size={14} /> Lock console
          </button>
        </div>
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-card p-8 shadow-2xl animate-in zoom-in duration-300">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/5 bg-brand-base shadow-inner">
            <Shield className="text-brand-yellow" size={32} />
          </div>
        </div>

        <h2 className="mb-2 text-center text-2xl font-serif-display text-white">Admin Access</h2>
        <p className="mb-8 text-center text-sm text-white/50">
          This area is restricted. Enter the administrator password to unlock it for the next 8 hours.
        </p>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(false);
              }}
              placeholder="Enter password"
              className={`w-full rounded-2xl border bg-brand-base py-4 pl-12 pr-4 text-white outline-none transition-all placeholder:text-white/20 ${
                error ? 'border-brand-red/50 focus:border-brand-red' : 'border-white/10 focus:border-brand-yellow'
              }`}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-xs text-brand-red animate-in fade-in slide-in-from-top-1">
              <AlertTriangle size={14} />
              <span>Incorrect password. Please try again.</span>
            </div>
          )}

          <button
            type="submit"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-yellow py-4 font-serif-display text-lg text-brand-base shadow-xl shadow-brand-yellow/20 transition-all hover:bg-brand-yellow/90"
          >
            Unlock console <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
