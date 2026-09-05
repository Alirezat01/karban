import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  user_role: 'employer' | 'employee' | null;
  company_name: string | null;
};

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user || null;
      setUserId(user?.id ?? null);
      setEmail(user?.email ?? null);
      if (user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('id,role,full_name,phone,user_role,company_name')
          .eq('id', user.id)
          .maybeSingle();
        setProfile((p as Profile) || null);
      } else {
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    if (!userId) return { error: 'لاگین نکردی' } as const;
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (!error) setProfile((prev) => (prev ? ({ ...prev, ...patch } as Profile) : prev));
    return { error: error ? error.message : null } as const;
  }, [userId]);

  return { loading, userId, email, profile, saveProfile, reload: load };
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/ورود` },
  });
}

export async function signOutUser() {
  await supabase.auth.signOut();
}
