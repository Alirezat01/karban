import { useEffect, useState } from 'react';
import { ArrowLeft, LogIn, LogOut, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth, signOutUser } from '@/lib/auth';
import { isIranianMobile } from '@/lib/validation';
import { normalizeMobile } from '@/lib/normalize';
import KarbanLoader from '@/components/KarbanLoader';

type ProfileForm = {
  full_name: string;
  phone: string;
  user_role: '' | 'employer' | 'employee';
  company_name: string;
};

export default function ProfilePage() {
  const { loading, userId, email, profile, displayName, saveProfile } = useAuth();
  const [form, setForm] = useState<ProfileForm>({ full_name: '', phone: '', user_role: '', company_name: '' });
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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

  const patch = (next: Partial<ProfileForm>) => {
    setTouched(true);
    setForm((prev) => ({ ...prev, ...next }));
  };

  const save = async () => {
    if (form.phone && !isIranianMobile(form.phone)) {
      setErr('شماره موبایل را با ۰۹ و ۱۱ رقم وارد کنید.');
      return;
    }
    setBusy(true);
    setErr('');
    const { error } = await saveProfile({
      full_name: form.full_name.trim() || null,
      phone: form.phone.trim() ? normalizeMobile(form.phone) : null,
      user_role: form.user_role || null,
      company_name: form.company_name.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr('ذخیره نشد: ' + error + ' — اگر این خطا تکرار شد، اسکریپت SQL پروفایل را در Supabase اجرا کن.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const doSignOut = async () => {
    await signOutUser();
    window.location.assign('/');
  };

  const initial = displayName.trim().charAt(0) || 'ک';

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow"><UserRound size={14} /> حساب کاربری کاربان</span>
        <h1>پروفایل من</h1>
        <p className="lead">
          نام، شماره تماس و نقش کاری‌ات را این‌جا نگه می‌داریم تا قراردادها و درخواست‌هایت شخصی‌تر و سریع‌تر ثبت شوند.
        </p>

        {loading ? (
          <div className="contact-card calc-card"><KarbanLoader label="در حال بازکردن پروفایل…" /></div>
        ) : !userId ? (
          <div className="contact-card calc-card">
            <p>برای دیدن و ویرایش پروفایل، اول با حساب گوگل وارد شو.</p>
            <a className="button" href="/ورود"><LogIn size={16} /> ورود به کاربان <ArrowLeft size={15} /></a>
          </div>
        ) : (
          <>
            <div className="profile-head contact-card calc-card">
              <span className="profile-avatar" aria-hidden="true">{initial}</span>
              <div className="profile-head-info">
                <strong>{displayName}</strong>
                {email && <small>{email}</small>}
              </div>
              <span className="profile-chip"><ShieldCheck size={13} /> حساب کاربان</span>
            </div>

            <div className="contact-card calc-card">
              <h2>اطلاعات شخصی و کاری</h2>
              <label>نام و نام خانوادگی
                <input value={form.full_name} onChange={(e) => patch({ full_name: e.target.value })} placeholder="مثلاً: علی رضایی" />
              </label>
              <label>شماره موبایل
                <input type="tel" inputMode="numeric" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="۰۹۱۲…" />
              </label>
              <label>نقش من
                <select value={form.user_role} onChange={(e) => patch({ user_role: e.target.value as ProfileForm['user_role'] })}>
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
              <button className="button" onClick={save} disabled={busy}>
                <Save size={15} /> {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
              </button>
              {saved && <small className="admin-success">پروفایل ذخیره شد؛ نام تو از همین حالا در هدر سایت نشان داده می‌شود.</small>}
              {err && <small className="admin-error">{err}</small>}
            </div>

            <div className="profile-actions">
              <a className="button button-outline" href="/داشبورد"><ArrowLeft size={15} /> برو به داشبورد</a>
              <button className="button button-outline profile-logout" onClick={doSignOut}>
                <LogOut size={15} /> خروج از حساب
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
