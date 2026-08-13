import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../services/supabaseService';
import type { AppRole } from '../lib/roles';

export interface AuthContextValue {
  session: Session | null;
  user: Session['user'] | null;
  profile: Profile | null;
  role: AppRole;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
