import { termsOfService } from '@/data/config';

export default function TermsPage() {
  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">قوانین و شرایط</span>
        <h1>قوانین و شرایط استفاده از کاربان</h1>
        <p className="article-intro">
          استفاده از کاربان و ثبت سفارش، به‌معنی پذیرفتن این شرایط ساده و شفاف است. لطفاً پیش از خرید، این موارد را بخوانید.
        </p>
        <div className="contact-card">
          <ul className="terms-list">
            {termsOfService.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
        <p className="muted-note">
          سؤال یا ابهامی دارید؟ از صفحه «تماس با ما» با ما در ارتباط باشید؛ خوشحال می‌شویم کمک کنیم.
        </p>
      </div>
    </section>
  );
}
