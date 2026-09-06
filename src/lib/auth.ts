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

/* نام واقعی کاربر از متادیتای گوگل (full_name / name / given_name+family_name) */
type AuthUserMeta = { full_name?: string; name?: string; given_name?: string; family_name?: string };

export function metaDisplayName(meta?: AuthUserMeta | null): string | null {
  if (!meta) return null;
  const direct = meta.full_name || meta.name;
  if (direct && direct.trim()) return direct.trim();
  const composed = [meta.given_name, meta.family_name].filter(Boolean).join(' ').trim();
  return composed || null;
}

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metaName, setMetaName] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user || null;
      setUserId(user?.id ?? null);
      setEmail(user?.email ?? null);
      const derived = metaDisplayName(user?.user_metadata as AuthUserMeta | undefined);
      setMetaName(derived);

      if (user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('id,role,full_name,phone,user_role,company_name')
          .eq('id', user.id)
          .maybeSingle();

        let row = (p as Profile) || null;

        if (!row) {
          /* ردیف پروفایل وجود ندارد (کاربر قدیمی قبل از trigger) → یک‌بار بساز */
          const { data: created, error } = await supabase
            .from('profiles')
            .insert({ id: user.id, role: 'user', full_name: derived ?? null })
            .select('id,role,full_name,phone,user_role,company_name')
            .maybeSingle();
          if (!error && created) row = created as Profile;
          else if (error) console.warn('profile create skipped:', error.message);
        } else if (derived && !row.full_name) {
          /* full_name خالی است → یک‌بار از نام گوگل پر کن */
          const { data: updated, error } = await supabase
            .from('profiles')
            .update({ full_name: derived })
            .eq('id', user.id)
            .select('id,role,full_name,phone,user_role,company_name')
            .maybeSingle();
          if (!error && updated) row = updated as Profile;
          else if (error) console.warn('profile name sync skipped:', error.message);
          else row = { ...row, full_name: derived };
        }

        setProfile(row);
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

  /* زنجیره نمایش نام: پروفایل دیتابیس → نام گوگل → «کاربر کاربان» */
  const displayName = profile?.full_name?.trim() || metaName || 'کاربر کاربان';

  return { loading, userId, email, profile, displayName, saveProfile, reload: load };
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
