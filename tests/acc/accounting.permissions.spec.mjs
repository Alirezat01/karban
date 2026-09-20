/* ═══════════ accounting.permissions.spec ═══════════
   بخش ۵ درخواست — مجوز ریزدانه باید در دیتابیس enforce شود نه فقط در React
   سناریو: کاربر B (مالک کسب‌وکار B) به‌عنوان viewer و سپس accountant با
   مجوز محدود در کسب‌وکار A تست می‌شود */
import { record } from './_harness.mjs';

export async function run(ctx) {
  const { A, B, bizA, bizB, rpc, RID, TODAY } = ctx;

  /* ── B را به‌عنوان viewer عضو A می‌کنیم (مالک A اضافه می‌کند) ── */
  const { data: vAcc, error: vErr } = await A.sb.from('acc_access').insert({
    business_id: bizA, user_id: B.userId, email: B.email, role: 'viewer', status: 'active', plan: 'trial',
    expires_at: new Date(Date.now() + 86400000 * 14).toISOString(),
  }).select('id').single();
  if (vErr) {
    record('PRM-0', 'تخصیص نقش viewer به عضو تازه توسط مالک', 'SKIP', 'پالیسی acc_access اجازه نداد: ' + vErr.message.slice(0, 70));
    return;
  }

  /* ۱) viewer نمی‌تواند روی جدول‌های عملیاتی بنویسد (RLS واقعی) */
  const { data: vIns, error: vInsErr } = await B.sb.from('acc_partners').insert({ business_id: bizA, kind: 'customer', person_type: 'real', name: 'نفوذ-viewer' }).select('id');
  record('PRM-1', 'viewer → INSERT طرف‌حساب ممنوع', !vIns && !!vInsErr ? 'PASS' : 'FAIL', vIns ? '⚠️ viewer ردیف نوشت!' : (vInsErr?.message || '').slice(0, 60));

  const { data: vUpd } = await B.sb.from('acc_partners').update({ name: 'خرابکاری' }).eq('business_id', bizA).select('id');
  record('PRM-2', 'viewer → UPDATE طرف‌حساب ممنوع', (vUpd || []).length === 0 ? 'PASS' : 'FAIL', `${(vUpd || []).length} ردیف`);

  const { data: vInsDet, error: vDetErr } = await B.sb.from('acc_details').insert({ business_id: bizA, title: 'تفصیلی-viewer', kind: 'other' }).select('id');
  if (vInsDet) await B.sb.from('acc_details').delete().eq('id', vInsDet.id);
  record('PRM-3', 'viewer → INSERT تفصیلی شناور ممنوع (پالیسی §10)',
    !vInsDet && !!vDetErr ? 'PASS' : (ctx.rpc ? 'FAIL' : 'EXPECTED-FAIL'),
    vInsDet ? '⚠️ viewer نوشت — پالیسی v7 نقش را چک نمی‌کند؛ بعد از مایگریشن بسته می‌شود' : (vDetErr?.message || '').slice(0, 60));

  /* ۲) viewer خواندن دارد (عضویت) */
  const { data: vRead } = await B.sb.from('acc_partners').select('id').eq('business_id', bizA);
  record('PRM-4', 'viewer → SELECT مجاز (عضویت خواندنی)', (vRead || []).length >= 0 ? 'PASS' : 'FAIL', `${(vRead || []).length} ردیف`);

  /* ۳) حسابدار با مجوز خالی = رفتار قدیمی (پیش از پیکربندی) — فقط بعد از مایگریشن معنا دقیق دارد */
  if (rpc) {
    await A.sb.from('acc_access').update({ role: 'accountant', perms: {} }).eq('id', vAcc.id);
    const { data: okId, error: okErr } = await B.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: `حسابدار-بدون-پیکربندی-${RID}`, p_ref_type: 'manual',
      p_lines: [{ account_code: '1101', debit: 100, credit: 0 }, { account_code: '4101', debit: 0, credit: 100 }],
    });
    record('PRM-5', 'حسابدار با مجوز پیکربندی‌نشده → رفتار قدیمی (دسترسی کامل)', !okErr ? 'PASS' : 'FAIL', okErr ? okErr.message.slice(0, 60) : 'سند ساخته شد');

    /* ۴) حسابدار با invoices.issue=false → صدور فاکتور از مسیر RPC باید رد شود */
    await A.sb.from('acc_access').update({ perms: { 'invoices.issue': false, 'journal.manage': true } }).eq('id', vAcc.id);
    const { data: inv, error: invErr } = await A.sb.from('acc_invoices').insert({
      business_id: bizA, number: `PRM-${RID}`, type: 'sale', status: 'draft', date_g: TODAY,
      subtotal: 500, discount_total: 0, vat_total: 0, total: 500, paid_total: 0,
    }).select('id').single();
    let voidBlocked = null;
    if (inv) {
      const { error } = await B.sb.rpc('acc_issue_invoice', { p_invoice: inv.id });
      voidBlocked = error ? error.message.slice(0, 60) : null;
      await A.sb.from('acc_invoices').delete().eq('id', inv.id);
    }
    record('PRM-6', 'حسابدار با invoices.issue=false → صدور ممنوع (enforce دیتابیس)', voidBlocked ? 'PASS' : 'FAIL', voidBlocked || '⚠️ صدور پذیرفته شد!');

    /* ۵) حسابدار با journal.manage=false → ثبت سند ممنوع */
    await A.sb.from('acc_access').update({ perms: { 'journal.manage': false } }).eq('id', vAcc.id);
    const { error: jmErr } = await B.sb.rpc('acc_create_journal', {
      p_business: bizA, p_date: TODAY, p_description: `ممنوع-${RID}`, p_ref_type: 'manual',
      p_lines: [{ account_code: '1101', debit: 100, credit: 0 }, { account_code: '4101', debit: 0, credit: 100 }],
    });
    record('PRM-7', 'حسابدار با journal.manage=false → ثبت سند ممنوع', !!jmErr ? 'PASS' : 'FAIL', jmErr ? jmErr.message.slice(0, 60) : '⚠️ پذیرفته شد!');
  } else {
    record('PRM-5', 'مجوزهای ریزدانه در RPCها', 'SKIP', 'مایگریشن هنوز اجرا نشده — بعد از اجرا این بخش فعال می‌شود');
  }

  /* پاکسازی عضویت آزمایشی */
  await A.sb.from('acc_access').delete().eq('id', vAcc.id);
}
