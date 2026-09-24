/* ═══════════ accounting.shared-catalog.spec ═══════════
   M240000 — کاتالوگ مشترک شناسهٔ کالا و خدمات:
   • خواندن کاتالوگ برای همهٔ کاربران واردشده آزاد است
   • نوشتن فقط ادمین سایت — کاربر معمولی (کاربران سوییت) باید رد شود
   (تا M240000 اجرا نشده، نوشتن برای همه آزاد است — سناریو SKIP می‌شود) */
import { record } from './_harness.mjs';

export async function run(ctx) {
  const { A, bizA, RID } = ctx;
  const TAG = `CAT-${RID}`;

  /* ۱) خواندن کاتالوگ برای کاربر معمولی آزاد است */
  const { data: rows, error: rErr } = await A.sb.from('acc_stuff_catalog').select('id').limit(5);
  record('CAT-1', 'خواندن کاتالوگ مشترک برای کاربر معمولی', !rErr ? 'PASS' : 'FAIL',
    rErr ? rErr.message.slice(0, 70) : `${rows?.length ?? 0} ردیف (خواندن آزاد)`);

  /* ۲) سنجش قابلیت: اگر نوشتن آزاد بود یعنی M240000 هنوز اجرا نشده */
  const probeId = `9999999999999-${TAG}`;
  const { error: wErr } = await A.sb.from('acc_stuff_catalog').upsert({
    id: probeId, description: `آزمون کاتالوگ ${TAG}`, vat: 0, taxable: true,
  });
  if (!wErr) {
    record('CAT-CAP', 'قفل نوشتن کاتالوگ (M240000)', 'SKIP',
      'نوشتن هنوز آزاد است — بعد از اجرای M240000 دوباره اجرا کنید');
    /* پاک‌سازی چیزی که نوشتیم */
    await A.sb.from('acc_stuff_catalog').delete().eq('id', probeId);
    return;
  }
  record('CAT-2', 'نوشتن کاربر معمولی در کاتالوگ رد می‌شود', 'PASS',
    'رد شد: ' + wErr.message.slice(0, 60));

  /* ۳) خودِ کاربر معمولی نمی‌تواند رد شدن را دور بزند (delete/apply هم بسته است) */
  const { error: dErr } = await A.sb.from('acc_stuff_catalog').delete().eq('id', probeId);
  record('CAT-3', 'حذف توسط کاربر معمولی هم رد می‌شود', dErr ? 'PASS' : 'FAIL',
    dErr ? 'رد شد (گشودن حذف به غیر ادمین ممنوع)' : 'حذف پذیرفته شد!');
}
