/* گیت دسترسی پنل حسابداری — ثبت‌نام به‌تنهایی هیچ دسترسی‌ای نمی‌دهد */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchMyAccess, fetchMyBusinesses } from './api';
import type { AccAccess, AccBusiness } from './types';

export type AccState =
  | { phase: 'loading' }
  | { phase: 'anon' }
  | { phase: 'no-access' }
  | { phase: 'needs-business' }
  | { phase: 'ready'; business: AccBusiness; role: string; accesses: AccAccess[] };

export function useAccAccess() {
  const [state, setState] = useState<AccState>({ phase: 'loading' });

  async function reload() {
    setState({ phase: 'loading' });
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setState({ phase: 'anon' });
        return;
      }
      const accesses = await fetchMyAccess();
      const now = Date.now();
      const valid = accesses.filter(
        (a) => ['active', 'trial'].includes(a.status) && (!a.expires_at || new Date(a.expires_at).getTime() > now),
      );
      if (!valid.length) {
        setState({ phase: 'no-access' });
        return;
      }
      const businesses = await fetchMyBusinesses();
      const mine = businesses.find((b) => valid.some((v) => v.business_id === b.id));
      if (!mine) {
        setState({ phase: 'needs-business' });
        return;
      }
      const acc = valid.find((v) => v.business_id === mine.id);
      setState({ phase: 'ready', business: mine, role: acc?.role || 'viewer', accesses: valid });
    } catch {
      setState({ phase: 'no-access' });
    }
  }

  useEffect(() => {
    reload();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      reload();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, reload };
}
