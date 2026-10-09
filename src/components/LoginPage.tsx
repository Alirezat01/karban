import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, LogOut, Phone, ShieldCheck, Timer } from 'lucide-react';
import { useAuth, signInWithGoogle, signOutUser, sanitizeNext } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { isIranianMobile } from '@/lib/validation';
import { normalizeMobile } from '@/lib/normalize';

function nextFromQuery(): string | null {
  try {
    return sanitizeNext(new URLSearchParams(window.location.search).get('next'));
  } catch {
    return null;
  }
}

type Tab = 'google' | 'mobile';
type MobileStep = 'phone' | 'code';
type MobileStatus = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified' | 'error';

export default function LoginPage() {
  const { loading, userId, email, profile, displayName, saveProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('google');
  const next = nextFromQuery();

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

  /* ─── OTP موبایل ─── */
  const [mobileInput, setMobileInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [mobileStatus, setMobileStatus] = useState<MobileStatus>('idle');
  const [mobileErr, setMobileErr] = useState('');
  const [mobileStep, setMobileStep] = useState<MobileStep>('phone');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const sendOtp = async () => {
    const m = normalizeMobile(mobileInput);
    if (!isIranianMobile(m)) {
      setMobileErr('شماره موبایل را با ۰۹ و ۱۱ رقم وارد کنید.');
      return;
    }
    setMobileErr('');
    setMobileStatus('sending');
    try {
      const res = await fetch('/api/otp?action=send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: m }),
      });
      const j = await res.json();
      if (!j.ok) {
        setMobileErr(j.error || 'ارسال کد ناموفق بود');
        setMobileStatus('error');
        return;
      }
      setMobileStatus('sent');
      setMobileStep('code');
      setResendIn(60);
    } catch {
      setMobileErr('خطای شبکه؛ دوباره تلاش کنید');
      setMobileStatus('error');
    }
  };

  const verifyOtp = async () => {
    const m = normalizeMobile(mobileInput);
    setMobileErr('');
    setMobileStatus('verifying');
    /* BROWSER_LOG_TAG: every console line uses the prefix `OTP-BROWSER` so the
       user can grep the browser console with one search. */
    const logB = (msg: string) => console.log(`[OTP-BROWSER] ${msg}`);
    const errB = (msg: string) => console.error(`[OTP-BROWSER] ${msg}`);
    const t0 = Date.now();
    const elapsed = () => `${Date.now() - t0}ms`;
    try {
      logB(`VERIFY START phone=****${m.slice(-4)}`);
      const res = await fetch('/api/otp?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: m, code: codeInput.replace(/\D/g, '') }),
      });
      logB(`VERIFY HTTP response status=${res.status} elapsed=${elapsed()}`);
      const j = await res.json();
      logB(`VERIFY server body ok=${j.ok} has_access_token=${!!j.access_token} has_refresh_token=${!!j.refresh_token} code_verified=${!!j.code_verified} user_id=${j.user_id || 'null'} error=${j.error || 'none'} elapsed=${elapsed()}`);

      if (!j.ok) {
        errB(`VERIFY REJECT reason=server_not_ok error=${j.error || 'unknown'} elapsed=${elapsed()}`);
        setMobileErr(j.error || 'کد اشتباه است');
        setMobileStatus('error');
        return;
      }
      if (!j.access_token || !j.refresh_token) {
        errB(`VERIFY REJECT reason=missing_token_in_response elapsed=${elapsed()}`);
        setMobileErr('پاسخ سرور ناقص است (توکن یافت نشد)');
        setMobileStatus('error');
        return;
      }
      logB(`VERIFY setSession: calling supabase.auth.setSession elapsed=${elapsed()}`);
      const { error: setSessionError, data: setSessionData } = await supabase.auth.setSession({
        access_token: j.access_token,
        refresh_token: j.refresh_token,
      });
      if (setSessionError) {
        errB(`VERIFY setSession FAILED name=${setSessionError.name} message=${setSessionError.message} status=${setSessionError.status} elapsed=${elapsed()}`);
        setMobileErr('نشست در مرورگر ساخته نشد: ' + setSessionError.message);
        setMobileStatus('error');
        return;
      }
      logB(`VERIFY setSession OK session_present=${!!setSessionData.session} user_present=${!!setSessionData.user} elapsed=${elapsed()}`);

      logB(`VERIFY getSession: calling supabase.auth.getSession elapsed=${elapsed()}`);
      const { data: checkSession, error: getSessionError } = await supabase.auth.getSession();
      if (getSessionError) {
        errB(`VERIFY getSession FAILED message=${getSessionError.message} elapsed=${elapsed()}`);
        setMobileErr('دریافت نشست از مرورگر ناموفق بود: ' + getSessionError.message);
        setMobileStatus('error');
        return;
      }
      if (checkSession.session?.access_token) {
        logB(`VERIFY DONE result=success access_token_len=${checkSession.session.access_token.length} elapsed=${elapsed()}`);
        setMobileStatus('verified');
        window.location.replace(next || '/داشبورد');
        return;
      }
      errB(`VERIFY DONE result=fail reason=getSession_no_token session_present=${!!checkSession.session} elapsed=${elapsed()}`);
      setMobileErr('کد تأیید شد اما نشست در مرورگر ذخیره نشد. لطفاً دوباره تلاش کنید.');
      setMobileStatus('error');
    } catch (e: any) {
      errB(`VERIFY DONE result=exception name=${e?.name} message=${e?.message} elapsed=${elapsed()}`);
      setMobileErr('خطای شبکه؛ دوباره تلاش کنید');
      setMobileStatus('error');
    }
  };

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow"><ShieldCheck size={14} /> حساب کاربری کاربان</span>
        <h1>ورود به کاربان</h1>
        <p className="lead">
          با حساب گوگل یا شماره موبایل وارد شو تا قراردادهای ساخته‌شده، درخواست‌ها و مشاوره‌هایت همیشه در داشبوردت بماند.
        </p>

        {loading ? (
          <div className="contact-card calc-card auth-card"><p>در حال بررسی نشست…</p></div>
        ) : !userId ? (
          <>
            {/* تب‌ها */}
            <div className="auth-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'google'} className={tab === 'google' ? 'is-active' : ''} onClick={() => setTab('google')}>
                ورود با گوگل
              </button>
              <button role="tab" aria-selected={tab === 'mobile'} className={tab === 'mobile' ? 'is-active' : ''} onClick={() => setTab('mobile')}>
                <Phone size={14} /> ورود با موبایل
              </button>
            </div>

            {tab === 'google' ? (
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
              <div className="contact-card calc-card auth-card">
                {mobileStep === 'phone' && (
                  <>
                    <label>شماره موبایل <span className="req-star" title="الزامی">*</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={mobileInput}
                        onChange={(e) => setMobileInput(e.target.value)}
                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                        dir="ltr"
                        style={{ textAlign: 'left' }}
                      />
                    </label>
                    <button className="button" onClick={sendOtp} disabled={mobileStatus === 'sending'}>
                      {mobileStatus === 'sending' ? 'در حال ارسال…' : 'ارسال کد یک‌بارمصرف'} <ArrowLeft size={15} />
                    </button>
                  </>
                )}
                {mobileStep === 'code' && (
                  <>
                    <div className="otp-phone-display">
                      <small>کد برای شماره</small>
                      <strong dir="ltr">{mobileInput}</strong>
                      <button className="text-link" onClick={() => { setMobileStep('phone'); setMobileStatus('idle'); setMobileErr(''); }}>
                        تغییر شماره
                      </button>
                    </div>
                    <label>کد ۶ رقمی <span className="req-star" title="الزامی">*</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="۱۲۳۴۵۶"
                        dir="ltr"
                        maxLength={6}
                        style={{ textAlign: 'center', letterSpacing: '.4em', fontSize: '1.3rem', fontVariantNumeric: 'tabular-nums' }}
                      />
                    </label>
                    <button className="button" onClick={verifyOtp} disabled={mobileStatus === 'verifying' || codeInput.length !== 6}>
                      {mobileStatus === 'verifying' ? 'در حال تأیید…' : 'تأیید و ورود'} <ArrowLeft size={15} />
                    </button>
                    <div className="otp-footer">
                      {resendIn > 0 ? (
                        <small className="muted-note"><Timer size={12} /> ارسال مجدد تا {resendIn.toLocaleString('fa-IR')} ثانیه</small>
                      ) : (
                        <button className="text-link" onClick={sendOtp}>ارسال مجدد کد</button>
                      )}
                    </div>
                  </>
                )}
                {mobileErr && <small className="admin-error">{mobileErr}</small>}
                <p className="muted-note">
                  کد ۵ دقیقه اعتبار دارد. شماره موبایل شما نزد کاربان محفوظ است و فقط برای ورود استفاده می‌شود.
                </p>
              </div>
            )}
          </>
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
