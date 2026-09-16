/* گیت امکانات پیشرفته — وقتی کاربر پلن معمولی امکان پولی را باز می‌کند
   فهرست کامل تفاوت‌ها را نشان می‌دهد و به صفحه خرید هدایت می‌کند */

import React from 'react';
import { Crown, Lock, Sparkles } from 'lucide-react';
import { lockedFeatures, PRO_FEATURES, type FeatureKey } from '@/lib/acc/plan';

export default function ProGate({
  feature, plan, title, hint,
}: { feature?: FeatureKey; plan: string | null; title?: string; hint?: string }) {
  const locked = lockedFeatures(plan);
  const unlocked = isProNow(plan);
  if (unlocked) return null;
  const current = feature ? PRO_FEATURES.find((f) => f.key === feature) : null;
  return (
    <div className="acc-gate">
      <div className="acc-gate-card" style={{ maxWidth: 720 }}>
        <div className="gate-icon"><Lock size={26} /></div>
        <h2>{title || current?.title || 'این بخش مخصوص نسخه پیشرفته است'}</h2>
        <p>{hint || current?.desc || 'با ارتقا به اشتراک پولی، تمام امکانات نسخه پیشرفته فوراً فعال می‌شود.'}</p>

        <div style={{ textAlign: 'right', margin: '1.1rem 0 .3rem' }}>
          <b style={{ fontSize: '.86rem', color: 'var(--gold2)', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <Crown size={15} /> تفاوت نسخه معمولی و پیشرفته — {locked.length} امکان انحصاری پیشرفته:
          </b>
          <div className="pro-feature-list">
            {PRO_FEATURES.map((f) => (
              <div key={f.key} className="pro-feature-row">
                <Sparkles size={12} />
                <div>
                  <b>{f.title}</b>
                  <span>{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
          <a className="acc-btn acc-btn-primary" href="/حسابداری"><Crown size={15} /> مشاهده و ارتقای پلن</a>
          <a className="acc-btn acc-btn-outline" href="/حسابداری/پنل">بازگشت به پنل</a>
        </div>
        <small style={{ color: 'var(--muted)', marginTop: '.8rem', display: 'block' }}>
          نسخه معمولی: ابزارهای پایه فروش — نسخه پیشرفته: همه امکانات، بدون محدودیت
        </small>
      </div>
    </div>
  );
}

function isProNow(plan: string | null): boolean {
  return ['monthly', 'yearly', 'founder', 'active'].includes(plan || '');
}
