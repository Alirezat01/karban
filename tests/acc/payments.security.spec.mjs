/* ═══════════ payments.security.spec ═══════════
   M250000 — زیرساخت پرداخت امن کاربان (شماره کارت تجاری):
   • جدول pay_accounts برای anon و کاربران واردشده غیرقابل‌خواندن است (deny-all)
   • جدول pay_account_access_log هم همین‌طور
   • RPC عمومی pay_get_account فقط با کد پیگیریِ شکل‌درست کار می‌کند
   • کد ناموجود / شکل‌بد با خطای فارسی رد می‌شود
   • RPCهای ادمین (upsert/admin_get) برای anon قابل فراخوانی نیستند
   بدون ساختن هیچ سفارش آزمایشی — صفر آلودگی داده روی سفارش‌های واقعی. */
import { record, client, authed } from './_harness.mjs';

export async function run(ctx) {
  const { A } = ctx;
  const anon = client();

  /* ۰۰) سنجش قابلیت — اگر M250000 هنوز اجرا نشده، کل spec رد می‌شود */
  const { error: capErr } = await anon.rpc('pay_get_account', { p_order_code: '' });
  const hasRpc = !capErr || !/could not find|does not exist|schema cache|not found/i.test(capErr.message || '');
  if (!hasRpc) {
    record('PAY-CAP', 'RPC pay_get_account (M250000)', 'SKIP', 'M250000 هنوز اجرا نشده — پس از اجرای SQL دوباره اجرا کنید');
    return;
  }
  record('PAY-CAP', 'RPC pay_get_account (M250000) نصب است', 'PASS', null);

  /* ۰۱) خواندن مستقیم جدول کارت با anon — باید مطلقاً بسته باشد */
  const { data: d1, error: e1 } = await anon.from('pay_accounts').select('card_number').limit(3);
  record('PAY-1', 'anon نمی‌تواند جدول pay_accounts را بخواند', e1 && !d1 ? 'PASS' : 'FAIL',
    e1 ? `deny: ${e1.code || e1.message.slice(0, 50)}` : 'نشتی! anon جدول کارت را می‌بیند');

  /* ۰۲) خواندن مستقیم جدول لاگ با anon */
  const { data: d2, error: e2 } = await anon.from('pay_account_access_log').select('outcome').limit(3);
  record('PAY-2', 'anon نمی‌تواند pay_account_access_log را بخواند', e2 && !d2 ? 'PASS' : 'FAIL',
    e2 ? `deny: ${e2.code || e2.message.slice(0, 50)}` : 'نشتی! anon لاگ دسترسی را می‌بیند');

  /* ۰۳) کاربر واردشده هم اجازهٔ خواندن مستقیم ندارد */
  const { data: d3, error: e3 } = await A.sb.from('pay_accounts').select('card_number').limit(3);
  record('PAY-3', 'کاربر واردشده (غیر ادمین) هم جدول کارت را نمی‌بیند', e3 && !d3 ? 'PASS' : 'FAIL',
    e3 ? `deny: ${e3.code || e3.message.slice(0, 50)}` : 'نشتی! کاربر عادی جدول کارت را می‌بیند');

  /* ۰۴) کد با شکل غلط → خطای فارسی (بدون نشت اطلاعات) */
  const { error: e4 } = await anon.rpc('pay_get_account', { p_order_code: "<script>alert(1)</script>'" });
  record('PAY-4', 'کد پیگیری با شکل غلط رد می‌شود', e4 && /کد پیگیری/.test(e4.message || '') ? 'PASS' : 'FAIL',
    e4 ? `«${(e4.message || '').slice(0, 60)}»` : 'خطای انتظاری صادر نشد');

  /* ۰۵) کد شکل‌درست اما ناموجود → «سفارشی پیدا نشد» */
  const { error: e5 } = await anon.rpc('pay_get_account', { p_order_code: 'deadbeef' });
  record('PAY-5', 'کد ناموجود رد می‌شود (بدون افشای وجود سفارش)', e5 && /سفارشی|کد پیگیری/.test(e5.message || '') ? 'PASS' : 'FAIL',
    e5 ? `«${(e5.message || '').slice(0, 60)}»` : 'خطای انتظاری صادر نشد');

  /* ۰۶) RPC ادمین برای anon بسته است */
  const { error: e6 } = await anon.rpc('pay_account_upsert', { p_holder_name: 'x', p_bank_name: 'x', p_card_number: '6037997512345670', p_sheba: 'IR820540102680020817909002', p_label: 'x' });
  const { error: e6b } = await anon.rpc('pay_account_admin_get');
  record('PAY-6', 'RPCهای ادمین برای anon قابل فراخوانی نیستند', e6 && e6b ? 'PASS' : 'FAIL',
    e6 ? `deny: ${(e6.message || '').slice(0, 50)}` : 'نشتی! anon می‌تواند کارت ثبت کند');

  /* ۰۷) RPC ادمین برای کاربر غیرادمین هم بسته است */
  const { error: e7 } = await A.sb.rpc('pay_account_admin_get');
  record('PAY-7', 'کاربر غیرادمین نمی‌تواند فهرست کارت را بگیرد', e7 ? 'PASS' : 'FAIL',
    e7 ? `deny: ${(e7.message || '').slice(0, 50)}` : 'نشتی! کاربر عادی فهرست کارت را دید');
}
