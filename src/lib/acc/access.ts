/* گیت دسترسی پنل حسابداری — ثبت‌نام به‌تنهایی هیچ دسترسی‌ای نمی‌دهد
   نسخه ۲: پشتیبانی چندکسب‌وکاری + تشخیص پلن برای سقف‌ها */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchMyAccess, fetchMyBusinesses } from './api';
import type { AccAccess, AccBusiness } from './types';

export type AccState =
  | { phase: 'loading' }
  | { phase: 'anon' }
  | { phase: 'no-access' }
  | { phase: 'needs-business' }
  | {
      phase: 'ready';
      business: AccBusiness;
      role: string;
      accesses: AccAccess[];
      businesses: AccBusiness[];
      /** پلن مؤثر کاربر (founder/yearly/monthly/trial) */
      plan: string;
      /** سقف کسب‌وکار بر اساس پلن */
      businessLimit: number;
      /** سقف صورتحساب پلن آزمایشی (null = نامحدود) */
      invoiceLimit: number | null;
      /** وضعیت لایسنس کسب‌وکار فعلی */
      status: string;
    };

const STORAGE_KEY = 'acc:active-business';

/* سقف کسب‌وکار هر پلن — هماهنگ با تابع acc_business_limit دیتابیس */
export function planBusinessLimit(plan: string | null): number {
  switch (plan) {
    case 'founder': return 10;
    case 'yearly': return 5;
    case 'monthly': return 3;
    case 'trial': return 1;
    default: return 1;
  }
}

/* رتبه‌بندی پلن‌ها برای انتخاب بهترین لایسنس */
const PLAN_RANK: Record<string, number> = { founder: 1, yearly: 2, monthly: 3, trial: 4 };
function bestPlan(accesses: AccAccess[], now: number): { plan: string; status: string } | null {
  const valid = accesses
    .filter((a) => ['active', 'trial'].includes(a.status) && (!a.expires_at || new Date(a.expires_at).getTime() > now));
  if (!valid.length) return null;
  valid.sort((a, b) => {
    const r = (PLAN_RANK[a.plan || ''] || 9) - (PLAN_RANK[b.plan || ''] || 9);
    if (r !== 0) return r;
    return a.status === 'active' ? -1 : 1;
  });
  return { plan: valid[0].plan || (valid[0].status === 'active' ? 'active' : 'trial'), status: valid[0].status };
}

export function useAccAccess() {
  const [state, setState] = useState<AccState>({ phase: 'loading' });

  async function reload(opts?: { soft?: boolean }) {
    /* نرم: وضعیت فعلی را نگه می‌داریم تا داده تازه برسد — پنل پاک نمی‌شود و
       کاربر وسط کار (مثلاً افزودن ردیف فاکتور) چیزی از دست نمی‌دهد */
    if (!opts?.soft) setState({ phase: 'loading' });
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
        setState((s) => (opts?.soft && s.phase === 'ready' ? s : { phase: 'no-access' }));
        return;
      }
      const best = bestPlan(accesses, now);
      const businesses = await fetchMyBusinesses();
      const mine = businesses.filter((b) => valid.some((v) => v.business_id === b.id));
      if (!mine.length) {
        setState((s) => (opts?.soft && s.phase === 'ready' ? s : { phase: 'needs-business' }));
        return;
      }
      /* بازیابی کسب‌وکار انتخابی کاربر از localStorage */
      let selected = mine[0];
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const found = saved ? mine.find((b) => b.id === saved) : null;
        if (found) selected = found;
      } catch { /* localStorage در دسترس نیست */ }
      const acc = valid.find((v) => v.business_id === selected.id);
      setState({
        phase: 'ready',
        business: selected,
        role: acc?.role || 'viewer',
        accesses: valid,
        businesses: mine,
        plan: best?.plan || 'trial',
        businessLimit: planBusinessLimit(best?.plan || null),
        invoiceLimit: best?.plan === 'trial' ? 20 : null,
        status: acc?.status || 'active',
      });
    } catch {
      setState({ phase: 'no-access' });
    }
  }

  function selectBusiness(id: string) {
    setState((s) => {
      if (s.phase !== 'ready') return s;
      const b = s.businesses.find((x) => x.id === id);
      if (!b || b.id === s.business.id) return s;
      try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
      const acc = s.accesses.find((v) => v.business_id === id);
      return { ...s, business: b, role: acc?.role || s.role, status: acc?.status || s.status };
    });
  }

  useEffect(() => {
    reload();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      /* رفرش توکن در پس‌زمینه — که معمولاً دقیقاً وقتی کاربر به تب برمی‌گردد رخ می‌دهد —
         حق دسترسی را عوض نمی‌کند. اگر به‌خاطر آن reload سخت بزنیم، کل پنل به
         «در حال بررسی دسترسی» برمی‌گردد و کارِ نیمه‌تمام (مثل ردیف‌های فاکتور) پاک می‌شود.
         پس فقط رویدادهای واقعی ورود/خروج/ویرایش کاربر را نرم رفرش می‌کنیم. */
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        reload({ soft: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { state, reload, selectBusiness };
}
