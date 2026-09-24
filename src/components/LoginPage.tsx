import { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth, signInWithGoogle, signOutUser, sanitizeNext } from '@/lib/auth';
import { isIranianMobile } from '@/lib/validation';
import { normalizeMobile } from '@/lib/normalize';

function nextFromQuery(): string | null {
  try {
    return sanitizeNext(new URLSearchParams(window.location.search).get('next'));
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const { loading, userId, email, profile, displayName, saveProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const next = nextFromQuery();

  /* اگر با next آمده (مثلاً از پنل حسابداری) و لاگین است → مستقیم ببر به مقصد */
  useEffect(() => {
    if (!loading && userId && next) window.location.replace(next);
  }, [loading, userId, next]);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    user_role: '' as '' | 'employer' | 'employee',
    company_name: '',
  });
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  /* پری‌فیل یک‌باره وقتی پروفایل از دیتابیس رسید (بدون خراب‌کردن تایپ کاربر) */
  useEffect(() => {
    if (profile && !touched) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        user_role: profile.user_role || '',
        company_name: profile.company_name || '',
      });
    }
  }, [profile, touched]);

  const patch = (next: Partial<typeof form>) => {
    setTouched(true);
    setForm((prev) => ({ ...prev, ...next }));
  };

  const google = async () => {
    setBusy(true);
    setErr('');
    const { error } = await signInWithGoogle(next ?? undefined);
    if (error) {
      setErr('ورود با گوگل انجام نشد: ' + error.message);
      setBusy(false);
    }
  };

  const save = async () => {
    if (!isIranianMobile(form.phone)) {
      setErr('شماره موبایل را با ۰۹ و ۱۱ رقم وارد کنید.');
      return;
    }
    setErr('');
    const { error } = await saveProfile({
      full_name: form.full_name.trim() || null,
      phone: normalizeMobile(form.phone),
      user_role: form.user_role || null,
      company_name: form.company_name.trim() || null,
    });
    if (error) setErr('ذخیره نشد: ' + error);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow"><ShieldCheck size={14} /> حساب کاربری کاربان</span>
        <h1>ورود به کاربان</h1>
        <p className="lead">
          با حساب گوگل وارد شو تا قراردادهای ساخته‌شده، درخواست‌ها و مشاوره‌هایت همیشه در داشبوردت بماند.
        </p>

        {loading ? (
          <div className="contact-card calc-card auth-card"><p>در حال بررسی نشست…</p></div>
        ) : !userId ? (
          <div className="contact-card calc-card auth-card">
            <button className="button google-btn" onClick={google} disabled={busy}>
              <GoogleIcon /> {busy ? 'در حال انتقال به گوگل…' : 'ورود با گوگل'}
            </button>
            {err && <small className="admin-error">{err}</small>}
            <p className="muted-note">
              ورود با گوگل سریع و امن است؛ هیچ رمزی نزد کاربان ذخیره نمی‌شود و مدیریت احراز هویت با گوگل است.
            </p>
          </div>
        ) : (
          <>
            <div className="contact-card calc-card auth-card">
              <div className="auth-user">
                <strong>{displayName}</strong>
                <small>{email}</small>
              </div>
              <button className="button button-outline" onClick={() => signOutUser()}>
                خروج از حساب <LogOut size={15} />
              </button>
            </div>

            <div className="contact-card calc-card auth-card">
              <h2>اطلاعات شخصی و کاری</h2>
              <label>نام و نام خانوادگی
                <input value={form.full_name} onChange={(e) => patch({ full_name: e.target.value })} placeholder="مثلاً: علی رضایی" />
              </label>
              <label>شماره موبایل <span className="req-star" title="الزامی">*</span>
                <input type="tel" inputMode="numeric" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="۰۹۱۲…" />
              </label>
              <label>نقش من
                <select value={form.user_role} onChange={(e) => patch({ user_role: e.target.value as '' | 'employer' | 'employee' })}>
                  <option value="">انتخاب کن…</option>
                  <option value="employer">کارفرما هستم</option>
                  <option value="employee">کارمند هستم</option>
                </select>
              </label>
              {form.user_role === 'employer' && (
                <label>نام کسب‌وکار / شرکت
                  <input value={form.company_name} onChange={(e) => patch({ company_name: e.target.value })} placeholder="مثلاً: شرکت …" />
                </label>
              )}
              <button className="button" onClick={save}>
                ذخیره اطلاعات {saved ? '✓' : ''} <ArrowLeft size={15} />
              </button>
              {saved && <small className="admin-success">اطلاعات ذخیره شد.</small>}
              {err && <small className="admin-error">{err}</small>}
              <a className="text-link" href="/داشبورد">برو به داشبورد کاربان <ArrowLeft size={14} /></a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.4C29.4 34.8 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.3 5.4C40.9 36 44 30.5 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
