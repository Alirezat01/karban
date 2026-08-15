import { Instagram, Linkedin, Mail, Phone, Send } from 'lucide-react';

export default function SiteFooter() {
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
        </div>
        <div>
          <h3>تماس</h3>
          <p className="contact-line">
            <Phone size={16} /> ۰۲-۸۸۳۴۲۶۷۹
          </p>
          <p className="contact-line">
            <Mail size={16} /> hello@karbanapp.ir
          </p>
          <p className="footer-address">تهران، خیابان کریمخان، خیابان سنایی، پلاک ۶۱، طبقه سوم</p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© ۱۴۰۵ کاربان. تمام حقوق محفوظ است.</span>
        <span>ساخته‌شده برای رشد کسب‌وکارهای ایرانی</span>
      </div>
    </footer>
  );
}

