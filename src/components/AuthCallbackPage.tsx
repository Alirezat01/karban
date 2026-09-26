import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, LogIn, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { consumeOAuthNext } from '@/lib/auth';
import KarbanLoader from '@/components/KarbanLoader';
import './acc/acc.css'; /* استایل acc-gate-card و acc-btn */

/* ───────────────── /auth/callback ─────────────────
   مقصد برگشت OAuth گوگل. مسیر ASCII پایدار است (به‌جای /ورود فارسی).
   فلوی PKCE: supabase-js با detectSessionInUrl کد ?code= را در init مشتری
   مبادله می‌کند؛ این صفحه صریحاً هم exchange را تلاش می‌کند (اگر هنوز نشست
   نیامده و کد در URL است) و بعد منتظر نشست می‌ماند و کاربر را به مقصد درست می‌برد:
   • اگر از پنل حسابداری آمده → next ذخیره‌شده (مثلاً /حسابداری/پنل)
   • در غیر این صورت → /داشبورد
   خطاهای گوگل (رد دسترسی و…) در hash (legacy implicit) یا query (PKCE)
   برمی‌گردند — هر دو خوانده می‌شوند؛ اتمام وقت انتظار هم پیام دوستانه دارد. */

type State = 'waiting' | 'error';

const WAIT_MS = 10_000;
const TICK_MS = 350;

function readHashError(): string | null {
  /* خطا هم در fragment (legacy implicit) و هم در query (PKCE) ممکن است بیاید */
  const sources = [
    window.location.hash.replace(/^#/, ''),
    window.location.search.replace(/^\?/, ''),
  ];
  for (const src of sources) {
    if (!src) continue;
    const params = new URLSearchParams(src);
    const error = params.get('error');
    if (!error) continue;
    const desc = params.get('error_description');
    return desc ? `${desc} (${error})` : error;
  }
  return null;
}

function friendlyError(raw: string): string {
  if (/access_denied/i.test(raw)) return 'ورود با گوگل را لغو کردی. دوباره تلاش کن.';
  if (/redirect_uri|unauthorized|invalid request/i.test(raw)) return 'آدرس برگشت ورود در تنظیمات تأیید نشده است. لطفاً با پشتیبانی در تماس باش.';
  return 'ورود با گوگل انجام نشد. لطفاً دوباره تلاش کن.';
}

export default function AuthCallbackPage() {
  const [state, setState] = useState<State>('waiting');
  const [errMsg, setErrMsg] = useState('');
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    /* خطای صریح گوگل در fragment؟ (مثل access_denied) */
    const hashError = readHashError();
    if (hashError) {
      setErrMsg(friendlyError(hashError));
      setState('error');
      return;
    }

    const finish = () => {
      if (cancelled) return;
      const next = consumeOAuthNext() || '/داشبورد';
      /* جایگزینی کامل تاریخچه تا #fragment و /auth/callback در URL نماند */
      window.location.replace(next);
    };

    const poll = async () => {
      const startedAt = Date.now();
      let exchanged = false;
      while (Date.now() - startedAt < WAIT_MS) {
        if (cancelled) return;
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            finish();
            return;
          }
        } catch { /* تلاش بعدی */ }
        /* fallback صریح PKCE: اگر init مشتری کد ?code= را هنوز مبادله نکرده
           و کد هنوز در URL است، یک‌بار صریحاً مبادله می‌کنیم. خطا بی‌اثر است
           (مثلاً کد قبلاً مصرف شده) — حلقهٔ انتظار ادامه می‌یابد. */
        const code = new URLSearchParams(window.location.search).get('code');
        if (code && !exchanged) {
          exchanged = true;
          try {
            await supabase.auth.exchangeCodeForSession(window.location.href);
          } catch { /* کد مصرف‌شده/نامعتبر — انتظار برای نشست یا تایم‌اوت */ }
          continue;
        }
        await new Promise((r) => { timer = setTimeout(r, TICK_MS); });
      }
      if (cancelled) return;
      setErrMsg('نشست گوگل دریافت نشد. ممکن است اتصال قطع شده باشد؛ دوباره تلاش کن.');
      setState('error');
    };
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: '1.5rem' }} dir="rtl">
      {state === 'waiting' ? (
        <div style={{ display: 'grid', justifyItems: 'center', gap: '.9rem', textAlign: 'center' }}>
          <KarbanLoader label="ورود موفق بود؛ در حال بردن تو به مقصد…" />
          <ShieldCheck size={18} style={{ color: 'var(--muted)' }} aria-hidden />
        </div>
      ) : (
        <div className="acc-gate-card" style={{ maxWidth: '26rem', textAlign: 'center' }}>
          <div className="gate-icon"><AlertTriangle size={26} /></div>
          <h2>ورود کامل نشد</h2>
          <p style={{ color: 'var(--muted)' }}>{errMsg}</p>
          <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', marginTop: '1.2rem', flexWrap: 'wrap' }}>
            <a className="acc-btn acc-btn-primary" href="/ورود"><LogIn size={15} /> تلاش دوباره</a>
            <a className="acc-btn acc-btn-outline" href="/">صفحه اصلی کاربان</a>
          </div>
        </div>
      )}
    </div>
  );
}
