import { useState } from 'react';
import { CheckCircle2, Instagram, Linkedin, Mail, Phone, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isIranianMobile } from '@/lib/validation';
import { normalizeMobile } from '@/lib/normalize';

export default function SiteFooter() {
  const [mobile, setMobile] = useState('');
  const [state, setState] = useState<'idle' | 'ok' | 'dup' | 'err'>('idle');

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!isIranianMobile(mobile)) {
      setState('err');
      return;
    }
    const { error } = await supabase.from('newsletter').insert({ mobile: normalizeMobile(mobile) });
    if (error) {
      if (String(error.message).toLowerCase().includes('duplicate')) {
        setState('dup');
      } else {
        setState('err');
      }
      return;
    }
    setState('ok');
    setMobile('');
  }

  return (
    <footer className="site-footer">
      <div className="footer-pattern" />
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src="/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png" alt="کاربان" />
          <p>مرجع هوشمند مدیریت کسب‌وکار برای کارفرمایان، کارمندان و فریلنسرها؛ از قرارداد تا آرامش.</p>
          <div className="socials">
            <a href="/تماس-با-ما" aria-label="اینستاگرام">
              <Instagram size={18} />
            </a>
            <a href="/تماس-با-ما" aria-label="لینکدین">
              <Linkedin size={18} />
            </a>
            <a href="/تماس-با-ما" aria-label="تلگرام">
              <Send size={18} />
            </a>
          </div>
        </div>
        <div>
          <h3>دسترسی سریع</h3>
          <a href="/دانشنامه">دانشنامه</a>
          <a href="/قراردادها">قراردادها</a>
          <a href="/خدمات">خدمات</a>
          <a href="/ابزارهای-هوش-مصنوعی">ابزارهای هوش مصنوعی</a>
        </div>
        <div>
          <h3>کاربان</h3>
          <a href="/درباره-ما">درباره ما</a>
          <a href="/تماس-با-ما">تماس با ما</a>
          <a href="/قوانین">قوانین و شرایط</a>
        </div>
        <div>
          <h3>تماس</h3>
          <p className="contact-line">
            <Phone size={16} /> ۰۲-۸۸۳۲۶۷۹
          </p>
          <p className="contact-line">
            <Mail size={16} /> hello@karbanapp.ir
          </p>
          <p className="footer-address">تهران، خیابان کریمخان، خیابان سنایی، پلاک ۶۱، طبقه سوم</p>
        </div>
        <div className="footer-news">
          <h3>خبرنامه کاربان</h3>
          <p>تغییرات قوانین، مهلت‌های مالیاتی و ابزارهای جدید؛ ماهی یک پیام، بدون اسپم.</p>
          <form className="news-form" onSubmit={subscribe}>
            <input
              type="tel"
              inputMode="numeric"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                setState('idle');
              }}
              placeholder="شماره موبایل"
              aria-label="شماره موبایل برای خبرنامه"
            />
            <button className="button" type="submit">عضویت</button>
          </form>
          {state === 'ok' && <small className="news-ok"><CheckCircle2 size={14} /> عضویت شما در خبرنامه ثبت شد.</small>}
          {state === 'dup' && <small className="news-ok">این شماره قبلاً در خبرنامه عضو شده است.</small>}
          {state === 'err' && <small className="news-err">شماره موبایل معتبر وارد کنید؛ نمونه: ۰۹۱۲۳۴۵۶۷۸۹</small>}
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© ۱۴۰۵ کاربان. تمام حقوق محفوظ است.</span>
        <span>ساخته‌شده برای رشد کسب‌وکارهای ایرانی</span>
      </div>
    </footer>
  );
}
