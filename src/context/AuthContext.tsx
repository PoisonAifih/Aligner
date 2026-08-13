import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { supabaseService } from '../services/supabaseService';
import type { Profile } from '../services/supabaseService';
import { normaliseRole } from '../lib/roles';
import { AuthContext } from './useAuth';
import type { AuthContextValue } from './useAuth';

type ProfileEntry = { userId: string; profile: Profile | null };

const fetchProfileEntry = async (userId: string): Promise<ProfileEntry> => {
  try {
    return { userId, profile: await supabaseService.getProfile(userId) };
  } catch (error) {
    console.error('Unable to load profile', error);
    return { userId, profile: null };
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profileEntry, setProfileEntry] = useState<ProfileEntry | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setSessionLoaded(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    fetchProfileEntry(userId).then((entry) => {
      if (!cancelled) setProfileEntry(entry);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfileEntry(await fetchProfileEntry(userId));
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfileEntry(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const profile = userId && profileEntry?.userId === userId ? profileEntry.profile : null;
    const isAdmin = profile?.role === 'admin' || Boolean(user?.email?.includes('admin'));

    return {
      session,
      user,
      profile,
      role: isAdmin ? 'admin' : normaliseRole(profile?.role),
      isAdmin,
      loading: !sessionLoaded || (userId !== null && profileEntry?.userId !== userId),
      refreshProfile,
      signOut,
    };
  }, [session, user, userId, profileEntry, sessionLoaded, refreshProfile, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
