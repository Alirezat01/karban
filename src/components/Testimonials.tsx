/* ────────────────────────────────────────────────────────────
   Testimonials section — used on HomePage and RolePage.
   Shows up to 6 published testimonials in a grid,
   plus a customer logos strip below.
   ──────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { Quote, Star } from 'lucide-react';
import { fetchTestimonials, fetchCustomerLogos, type Testimonial } from '@/lib/social';
import { useRevealGroup } from '@/lib/reveal';

function Stars({ rating }: { rating: number }) {
  return (
    <div className="t-stars" aria-label={`امتیاز ${rating} از ۵`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < rating ? 'var(--gold)' : 'transparent'}
          color={i < rating ? 'var(--gold)' : 'var(--muted)'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [logos, setLogos] = useState<string[]>([]);
  const gridRef = useRevealGroup('.t-card');

  useEffect(() => {
    let alive = true;
    (async () => {
      const [t, l] = await Promise.all([fetchTestimonials(), fetchCustomerLogos()]);
      if (!alive) return;
      setItems(t);
      setLogos(l);
    })();
    return () => { alive = false; };
  }, []);

  if (items.length === 0 && logos.length === 0) return null;

  return (
    <section className="testimonials-section">
      <div className="container">
        <div className="lux-heading">
          <span className="line" />
          <h2>اعتماد کسب‌وکارهای ایرانی به کاربان</h2>
          <span className="line" />
        </div>

        {items.length > 0 && (
          <div className="t-grid" ref={gridRef}>
            {items.map((t) => (
              <article className="t-card" key={t.id}>
                <Quote size={22} className="t-quote-icon" aria-hidden="true" />
                <Stars rating={t.rating} />
                <p className="t-content">«{t.content}»</p>
                <div className="t-author">
                  {t.avatar_url ? (
                    <img src={t.avatar_url} alt={t.name} loading="lazy" width={44} height={44} />
                  ) : (
                    <span className="t-avatar-fallback" aria-hidden="true">{t.name.charAt(0)}</span>
                  )}
                  <div>
                    <strong>{t.name}</strong>
                    <small>{t.role}{t.company ? ` · ${t.company}` : ''}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {logos.length > 0 && (
          <div className="logos-strip" aria-label="مشتریان کاربان">
            {logos.map((src, i) => (
              <img key={i} src={src} alt="لوگوی مشتری کاربان" loading="lazy" className="logo-img" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
