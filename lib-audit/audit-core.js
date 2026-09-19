/* ═════════════════════════════════════════════════════════════════════
   موتور حسابرسی کامل سیستم حسابداری کاربان — حسابدار حرفه‌ای و حسابرس رسمی
   مشترک بین:
     • api/acc-audit.js        (Vercel Serverless — با env های ورسل)
     • scripts/audit-full.mjs  (CLI / GitHub Actions — اجرای مستقیم)
   خروجی: report کامل + نسخه عمومی پاک‌سازی‌شده (ریپو عمومی است!)
   ═════════════════════════════════════════════════════════════════════ */

/* ── ابزارهای پایه ── */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const jalaliYear = () => {
  const d = new Date();
  const m = d.getMonth() + 1;
  return d.getFullYear() - 621 - (m < 3 || (m === 3 && d.getDate() < 21) ? 1 : 0);
};

export function resolveConfig(env = {}) {
  const URL_ =
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://rocjeanizzhfvhnuhnms.supabase.co';
  const SRK =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY ||
    env.SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE ||
    '';
  return { URL: String(URL_).replace(/\/+$/, ''), SRK };
}

/* ═══════════════ اجرای اصلی حسابرسی ═══════════════ */
export async function runAudit({ URL, SRK, cleanup = true, log = console.log } = {}) {
  if (!SRK) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — کلید service_role در env تنظیم نشده است');

  const t0 = Date.now();
  const results = [];
  const findings = [];

  function step(id, title, ok, detail = '', severity = '') {
    results.push({ id, title, ok, detail: String(detail).slice(0, 500), severity: severity || '' });
    log(`${ok ? '✅' : '❌'} [${id}] ${title}${ok ? '' : ' → ' + String(detail).slice(0, 260)}`);
    if (!ok && severity) findings.push({ id, title, severity, detail: String(detail).slice(0, 500) });
  }

  function srHeaders(token) {
    return { apikey: SRK, Authorization: `Bearer ${token || SRK}`, 'Content-Type': 'application/json' };
  }
  async function sr(path, method = 'GET', body = null) {
    const r = await fetch(`${URL}/${path}`, { method, headers: srHeaders(), body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html error page */ }
    return { status: r.status, json, text };
  }
  /* پاسخ ساپابیس ممکن است به‌جای آرایه، آبجکت خطا باشد — همیشه امن آرایه بگیر */
  const arr = (x) => (Array.isArray(x) ? x : []);
  /* پاسخ POST در PostgREST آرایه است — id را امن بگیر (رفع باگ B15/B40/B44: id=undefined) */
  const idOf = (j) => (Array.isArray(j) ? (j[0]?.id ?? null) : (j?.id ?? null));
  /* اگر POST ردیف را برنگرداند (RLS روی INSERT RETURNING)، شناسه را با سرویس‌رو برمی‌گردانیم — ریشه B15/B40/B44 */
  async function idBack(json, table, query) {
    const d = idOf(json);
    if (d) return d;
    const r = await sr(`rest/v1/${table}?select=id&${query}&order=created_at.desc&limit=1`);
    return arr(r.json)[0]?.id ?? null;
  }
  let USER_TOKEN = null;
  async function user(path, method = 'GET', body = null) {
    const r = await fetch(`${URL}/${path}`, { method, headers: srHeaders(USER_TOKEN), body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* noop */ }
    return { status: r.status, json, text };
  }

  let BIZ = null, INV1 = null, USER_ID = null, EMAIL = '';
  let BANK_ID = null;
  let diag = [];
  let liveSchema = {}, missingSchema = {}, accTables = [];

  try {
    /* ═══ مرحله A — خودنگاری کامل اسکیمای زنده ═══ */
    log('\n══ مرحله A: خودنگاری اسکیمای زنده (OpenAPI) ══');
    const openapi = await sr('rest/v1/');
    const defs = openapi.json?.definitions || {};
    accTables = Object.keys(defs).filter((t) => t.startsWith('acc_') || ['telegram_queue', 'site_secrets', 'app_settings', 'profiles'].includes(t));
    for (const t of accTables) liveSchema[t] = Object.keys(defs[t]?.properties || {});
    log(`جداول یافت‌شده: ${accTables.join(', ')}`);

    const REQUIRED = {
      acc_businesses: ['owner_id', 'name', 'brand', 'person_type', 'shenase_melli', 'national_id', 'economic_code', 'registration_number', 'province', 'county', 'city', 'address', 'postal_code', 'phone', 'default_vat_rate', 'fax'],
      acc_access: ['business_id', 'user_id', 'email', 'role', 'status', 'plan', 'expires_at'],
      acc_partners: ['name', 'kind', 'person_type', 'national_id', 'economic_code', 'shenase_melli', 'registration_number', 'province', 'county', 'city', 'postal_code', 'address', 'phone', 'fax'],
      acc_items: ['name', 'unit', 'sale_price', 'purchase_price', 'vat_rate', 'vat_exempt', 'track_stock', 'stock', 'stuff_id'],
      acc_accounts: ['name', 'kind', 'initial_balance'],
      acc_invoices: ['number', 'type', 'status', 'partner_id', 'date_g', 'due_date_g', 'description', 'payment_terms', 'is_cash_sale', 'buyer_type', 'pay_id', 'account_id', 'subtotal', 'discount_total', 'vat_total', 'total', 'paid_total', 'project_id'],
      acc_invoice_items: ['invoice_id', 'business_id', 'item_id', 'stuff_id', 'title', 'unit', 'quantity', 'unit_price', 'discount', 'vat_rate', 'vat_amount', 'row_total', 'position'],
      acc_expenses: ['category', 'title', 'amount', 'vat_amount', 'date_g', 'account_id', 'partner_id', 'is_paid', 'description', 'vendor_name', 'receipt_no', 'receipt_url', 'tax_status', 'tax_note', 'project_id'],
      acc_transactions: ['kind', 'amount', 'date_g', 'method', 'account_id', 'invoice_id', 'partner_id', 'description'],
      acc_checks: ['kind', 'partner_id', 'account_id', 'invoice_id', 'amount', 'serial_no', 'bank_name', 'branch', 'issue_date_g', 'due_date_g', 'status', 'description'],
      acc_employees: ['name', 'national_id', 'personnel_code', 'position', 'hire_date_g', 'base_salary', 'housing_allowance', 'food_allowance', 'child_allowance', 'child_count', 'insurance_number', 'bank_account'],
      acc_payrolls: ['employee_id', 'jyear', 'jmonth', 'work_days', 'overtime_hours', 'base_salary', 'food_allowance', 'housing_allowance', 'family_allowance', 'overtime_pay', 'gross', 'insurance_employee', 'tax', 'other_deductions', 'net', 'paid', 'account_id', 'pay_date_g'],
      acc_assets: ['name', 'category', 'purchase_date_g', 'purchase_amount', 'useful_life_years', 'salvage_value', 'account_id', 'status', 'sell_amount', 'sell_date_g', 'notes'],
      acc_recurring: ['title', 'category', 'amount', 'vat_amount', 'frequency', 'next_date_g', 'account_id', 'partner_id', 'auto_create', 'active', 'last_created_date_g', 'description'],
      acc_contracts: ['title', 'partner_id', 'project_id', 'amount', 'vat_rate', 'status', 'start_date_g', 'end_date_g', 'description'],
      acc_projects: ['name', 'code', 'partner_id', 'status', 'budget', 'start_date_g', 'end_date_g', 'description'],
      acc_journal: ['business_id', 'date_g', 'description', 'ref_type', 'ref_id'],
      acc_journal_lines: ['entry_id', 'account_code', 'account_title', 'debit', 'credit'],
      acc_details: ['business_id', 'title', 'kind'],
      acc_attachments: ['business_id', 'entity_type', 'entity_id', 'file_url'],
      acc_petty: ['business_id', 'name', 'status'],
      acc_petty_ops: ['business_id', 'petty_id', 'kind', 'amount', 'date_g'],
      acc_prepayments: ['business_id', 'kind', 'partner_id', 'amount', 'date_g', 'status'],
      acc_bank_lines: ['business_id', 'account_id', 'date_g', 'amount', 'match_status'],
      acc_fiscal_years: ['business_id', 'jyear', 'status'],
      acc_expense_categories: ['business_id', 'title', 'code', 'position'],
      acc_periods: ['business_id', 'jyear', 'jmonth', 'locked', 'locked_at'],
      acc_activity: ['business_id', 'user_id', 'user_email', 'action', 'entity', 'entity_id', 'detail'],
      telegram_queue: ['text', 'kind'],
      site_secrets: ['key', 'value'],
    };
    missingSchema = {};
    for (const [t, cols] of Object.entries(REQUIRED)) {
      if (!liveSchema[t]) { missingSchema[t] = ['«کل جدول موجود نیست»']; continue; }
      const miss = cols.filter((c) => !liveSchema[t].includes(c));
      if (miss.length) missingSchema[t] = miss;
    }
    step('A1', 'تطبیق کامل اسکیمای زنده با کد', Object.keys(missingSchema).length === 0,
      Object.keys(missingSchema).length ? JSON.stringify(missingSchema) : 'همه جداول و ستون‌ها موجودند', 'critical');

    /* ═══ مرحله B — تست سرتاسری با کاربر واقعی ═══ */
    log('\n══ مرحله B: تست سرتاسری با کاربر تازه ══');
    const STAMP = Date.now().toString(36);
    EMAIL = `karban.audit.${STAMP}@gmail.com`;
    const PASS = 'Kb!Audit' + STAMP + 'Xq';

    const cu = await sr('auth/v1/admin/users', 'POST', { email: EMAIL, password: PASS, email_confirm: true });
    step('B1', 'ساخت کاربر تاییدشده (admin)', cu.status === 200 || cu.status === 201, (cu.status === 200 || cu.status === 201) ? EMAIL : `${cu.status} ${cu.text.slice(0, 200)}`);
    USER_ID = idOf(cu.json);

    const lg = await sr('auth/v1/token?grant_type=password', 'POST', { email: EMAIL, password: PASS });
    USER_TOKEN = lg.json?.access_token;
    step('B2', 'ورود با رمز → session', !!USER_TOKEN, USER_TOKEN ? 'ok' : lg.text.slice(0, 200));

    const prof = await user('rest/v1/profiles?select=*');
    step('B3', 'خواندن پروفایل', prof.status === 200, prof.status === 200 ? `rows=${prof.json?.length}` : prof.text.slice(0, 200));

    /* B4: شروع نسخه آزمایشی */
    const trial = await user('rest/v1/rpc/acc_start_trial', 'POST', {
      p_form: {
        name: 'فروشگاه نمونه کاربان (حسابرسی)', brand: 'نمونه کاربان', person_type: 'legal',
        shenase_melli: '14003567890', national_id: '10860045331', economic_code: '411345678901',
        registration_number: '556677', province: 'تهران', county: 'تهران', city: 'تهران',
        address: 'تهران، خیابان آزادی، پلاک ۱۰۰', postal_code: '1453613344', phone: '02166561122',
        default_vat_rate: '10', contact_name: 'حسابرس کاربان', contact_phone: '09121234567',
      },
    });
    BIZ = typeof trial.json === 'string' ? trial.json : trial.json?.[0] || null;
    step('B4', 'acc_start_trial → ساخت کسب‌وکار آزمایشی', trial.status === 200 && !!BIZ, trial.status === 200 ? `biz=${BIZ}` : trial.text.slice(0, 250));

    const acc2 = BIZ ? await user(`rest/v1/acc_access?business_id=eq.${BIZ}&select=*`) : { json: [] };
    const accRow = acc2.json?.[0];
    step('B5', 'لایسنس آزمایشی ثبت شد (status=trial، ۱۴ روز)', accRow?.status === 'trial', JSON.stringify(accRow || String(acc2.text || '').slice(0, 150)).slice(0, 250));

    /* B6: طرف‌حساب ساده */
    const p1 = await user('rest/v1/acc_partners', 'POST', {
      business_id: BIZ, name: 'شرکت بازرگانی آریا', kind: 'customer', person_type: 'legal',
      national_id: '10860045332', economic_code: '411345678902', postal_code: '1453613345',
      address: 'تهران، خیابان ولیعصر', phone: '02188990011',
    });
    const PARTNER = await idBack(p1.json, 'acc_partners', `business_id=eq.${BIZ}&name=eq.${encodeURIComponent('شرکت بازرگانی آریا')}`);
    step('B6', 'ثبت طرف‌حساب حقوقی (بدون shenase_melli)', p1.status === 201, p1.status === 201 ? `id=${PARTNER}` : `${p1.status} ${p1.text.slice(0, 220)}`);

    /* B7: طرف‌حساب با shenase_melli */
    const p2 = await user('rest/v1/acc_partners', 'POST', {
      business_id: BIZ, name: 'حقیقی با شناسه ملی', kind: 'customer', person_type: 'real',
      national_id: '0079123456', shenase_melli: '14003567891',
    });
    const shenaseMissing = p2.status !== 201 && /shenase_melli/i.test(p2.text);
    step('B7', 'ثبت طرف‌حساب حقیقی با shenase_melli', p2.status === 201,
      shenaseMissing ? 'باگ تایید شد: ستون shenase_melli در جدول acc_partners وجود ندارد — «ثبت سریع طرف‌حساب» و فرم کامل طرف‌حساب‌ها با شناسه ملی شکست می‌خورد' : `${p2.status} ${p2.text.slice(0, 220)}`,
      shenaseMissing ? 'high' : '');

    /* B8: ستون‌های نسخه ۲ طرف‌حساب */
    const p3 = await user('rest/v1/acc_partners', 'POST', {
      business_id: BIZ, name: 'با ستون‌های نسخه۲', kind: 'supplier', person_type: 'legal',
      registration_number: '556688', province: 'البرز', county: 'کرج', city: 'کرج', fax: '02644556677',
    });
    step('B8', 'ستون‌های نسخه۲ طرف‌حساب (استان/شهرستان/فکس/شماره ثبت)', p3.status === 201,
      p3.status === 201 ? 'ok' : `${p3.status} ${p3.text.slice(0, 220)} — مایگریشن 20260917 اجرا نشده؟`, p3.status === 201 ? '' : 'high');

    /* B9-B10: کالا و خدمت */
    const it1 = await user('rest/v1/acc_items', 'POST', {
      business_id: BIZ, name: 'لپ‌تاپ لنوو ThinkPad', unit: 'دستگاه', sale_price: 850000000,
      purchase_price: 700000000, vat_rate: 10, track_stock: true, stock: 5,
    });
    const ITEM1 = await idBack(it1.json, 'acc_items', `business_id=eq.${BIZ}&name=eq.${encodeURIComponent('لپ‌تاپ لنوو ThinkPad')}`);
    step('B9', 'ثبت کالا با ردیابی موجودی', it1.status === 201, it1.status === 201 ? `id=${ITEM1}` : `${it1.status} ${it1.text.slice(0, 200)}`);

    const it2 = await user('rest/v1/acc_items', 'POST', {
      business_id: BIZ, name: 'خدمات مشاوره مالی', unit: 'ساعت', sale_price: 120000000,
      purchase_price: 0, vat_rate: 10, vat_exempt: false, track_stock: false,
    });
    const ITEM2 = await idBack(it2.json, 'acc_items', `business_id=eq.${BIZ}&name=eq.${encodeURIComponent('خدمات مشاوره مالی')}`);
    step('B10', 'ثبت خدمت (بدون موجودی)', it2.status === 201, it2.status === 201 ? `id=${ITEM2}` : `${it2.status} ${it2.text.slice(0, 200)}`);

    /* B11-B12: حساب‌ها */
    const a1 = await user('rest/v1/acc_accounts', 'POST', { business_id: BIZ, name: 'بانک ملت – جاری ۱۲۳۴', kind: 'bank', initial_balance: 2500000000 });
    const BANK = await idBack(a1.json, 'acc_accounts', `business_id=eq.${BIZ}&kind=eq.bank`);
    BANK_ID = BANK;
    /* تشخیص: آیا توکن کاربر اصلاً اجازه SELECT روی این جدول را دارد؟ (ریشه خالی‌بودن پاسخ POST) */
    const probeRead = await user(`rest/v1/acc_accounts?select=id,kind&business_id=eq.${BIZ}&limit=3`);
    const probeCount = Array.isArray(probeRead.json) ? probeRead.json.length : -1;
    const probeNote = probeCount === 0 ? ' | ⚠️ SELECT با توکن کاربر = ۰ ردیف → پالیسی SELECT این جدول برای کاربر عادی وجود ندارد (اپ هم لیست خالی می‌بیند)' : (probeCount > 0 ? ` | SELECT کاربر: ${probeCount} ردیف` : ' | SELECT کاربر: خطا');
    step('B11', 'ثبت حساب بانکی', a1.status === 201, a1.status === 201 ? `id=${BANK}${probeNote}${BANK ? '' : ' | پاسخ POST: ' + JSON.stringify(a1.json)?.slice(0, 100)}` : `${a1.status} ${a1.text.slice(0, 200)}`);
    const a2 = await user('rest/v1/acc_accounts', 'POST', { business_id: BIZ, name: 'صندوق فروشگاه', kind: 'cash', initial_balance: 50000000 });
    step('B12', 'ثبت صندوق نقدی', a2.status === 201, a2.status === 201 ? 'ok' : `${a2.status} ${a2.text.slice(0, 200)}`);

    /* B13-B14: فاکتور فروش رسمی */
    const jy = jalaliYear();
    const sub = 2 * 850000000 + 4 * 120000000;
    const disc = 80000000;
    const vat = Math.round(((2 * 850000000 - disc) * 10) / 100) + Math.round((4 * 120000000 * 10) / 100);
    const total = sub - disc + vat;
    const inv1 = await user('rest/v1/acc_invoices', 'POST', {
      business_id: BIZ, number: `${jy}-001`, type: 'sale', status: 'draft', partner_id: PARTNER,
      date_g: todayISO(), due_date_g: todayISO(), description: 'فاکتور رسمی تستی حسابرسی — فروش لپ‌تاپ و مشاوره',
      payment_terms: '۵۰٪ نقد، مابقی ۳۰ روز', is_cash_sale: false, buyer_type: 'business',
      pay_id: '123456789012345678901234567890', account_id: BANK,
      subtotal: sub, discount_total: disc, vat_total: vat, total,
    });
    INV1 = await idBack(inv1.json, 'acc_invoices', `business_id=eq.${BIZ}&number=eq.${jy}-001`);
    step('B13', 'ثبت فاکتور فروش رسمی (پیش‌نویس)', inv1.status === 201, inv1.status === 201 ? `id=${INV1} total=${total.toLocaleString('en')}` : `${inv1.status} ${inv1.text.slice(0, 250)}`);

    if (INV1) {
      const rows = [
        { invoice_id: INV1, business_id: BIZ, item_id: ITEM1, stuff_id: null, title: 'لپ‌تاپ لنوو ThinkPad', unit: 'دستگاه', quantity: 2, unit_price: 850000000, discount: disc, vat_rate: 10, vat_amount: Math.round(((2 * 850000000 - disc) * 10) / 100), row_total: 2 * 850000000 - disc + Math.round(((2 * 850000000 - disc) * 10) / 100), position: 0 },
        { invoice_id: INV1, business_id: BIZ, item_id: ITEM2, stuff_id: null, title: 'خدمات مشاوره مالی', unit: 'ساعت', quantity: 4, unit_price: 120000000, discount: 0, vat_rate: 10, vat_amount: 48000000, row_total: 528000000, position: 1 },
      ];
      const li = await user('rest/v1/acc_invoice_items', 'POST', rows);
      step('B14', 'ثبت ردیف‌های فاکتور', li.status === 201, li.status === 201 ? '۲ ردیف' : `${li.status} ${li.text.slice(0, 250)}`);
    }

    /* B15: صدور نهایی */
    const iss = await user(`rest/v1/acc_invoices?id=eq.${INV1}`, 'PATCH', { status: 'issued' });
    const issConstraint = iss.status !== 204 && /(check constraint|violates)/i.test(iss.text);
    step('B15', 'صدور نهایی فاکتور (status=issued)', iss.status === 204,
      iss.status === 204 ? 'ok' : `${iss.status} ${iss.text.slice(0, 250)}${issConstraint ? ' ← قید CHECK روی ستون status مقدار «issued» را رد می‌کند — علت ریشه‌ای «ذخیره ناموفق» هنگام صدور؛ sql-4 را اجرا کن' : ''}`,
      iss.status === 204 ? '' : 'critical');

    /* B16: سند حسابداری خودکار پس از صدور؟ */
    const jr = await user(`rest/v1/acc_journal?business_id=eq.${BIZ}&select=*,acc_journal_lines(*)`);
    const autoJournal = arr(jr.json).filter((e) => e.ref_type !== 'manual');
    step('B16', 'سند حسابداری خودکار هنگام صدور', autoJournal.length > 0,
      autoJournal.length ? `${autoJournal.length} سند` : 'هیچ سندی پس از صدور ثبت نشد — دفتر کل بدون اسناد خودکار می‌ماند (صدور فاکتور ثبت دوبل ندارد)', 'high');

    /* B17: کسر موجودی کالا */
    if (ITEM1) {
      const stk0 = await user(`rest/v1/acc_items?id=eq.${ITEM1}&select=stock`);
      const cur = Number(stk0.json?.[0]?.stock ?? 0);
      const stkSet = await user(`rest/v1/acc_items?id=eq.${ITEM1}`, 'PATCH', { stock: cur - 2 });
      const stk = await user(`rest/v1/acc_items?id=eq.${ITEM1}&select=stock`);
      step('B17', 'به‌روزرسانی موجودی کالا پس از فروش (۵→۳)', stkSet.status === 204 && stk.json?.[0]?.stock === cur - 2,
        `stock=${stk.json?.[0]?.stock} (بود ${cur})`);
    }

    /* B18: قفل سند صادره */
    const editIssued = await user(`rest/v1/acc_invoices?id=eq.${INV1}`, 'PATCH', { description: 'تلاش برای ویرایش سند صادره' });
    const editable = editIssued.status === 204;
    step('B18', 'قفل ویرایش سند صادره (اصل حسابداری)', !editable,
      editable ? 'سند صادره از مسیر REST قابل ویرایش است — هیچ تریگر/پالیسی قفلی وجود ندارد' : `مسدود شد (${editIssued.status})`, editable ? 'medium' : '');

    /* B19: پیش‌فاکتور */
    const inv2 = await user('rest/v1/acc_invoices', 'POST', {
      business_id: BIZ, number: `${jy}-002`, type: 'proforma', status: 'issued', partner_id: PARTNER,
      date_g: todayISO(), is_cash_sale: true, buyer_type: 'business',
      subtotal: 850000000, discount_total: 0, vat_total: 85000000, total: 935000000,
    });
    step('B19', 'پیش‌فاکتور (استعلام قیمت)', inv2.status === 201, inv2.status === 201 ? `id=${idOf(inv2.json)}` : `${inv2.status} ${inv2.text.slice(0, 220)}`);

    /* B20: فاکتور خرید */
    const inv3 = await user('rest/v1/acc_invoices', 'POST', {
      business_id: BIZ, number: `${jy}-003`, type: 'purchase', status: 'issued', partner_id: PARTNER,
      date_g: todayISO(), is_cash_sale: false, buyer_type: 'business',
      subtotal: 1400000000, discount_total: 0, vat_total: 140000000, total: 1540000000,
    });
    step('B20', 'فاکتور خرید', inv3.status === 201, inv3.status === 201 ? `id=${idOf(inv3.json)}` : `${inv3.status} ${inv3.text.slice(0, 220)}`);

    /* B21-B22: دریافت وجه */
    if (INV1) {
      const tx = await user('rest/v1/acc_transactions', 'POST', {
        business_id: BIZ, kind: 'receipt', amount: total, date_g: todayISO(), method: 'transfer',
        account_id: BANK, invoice_id: INV1, partner_id: PARTNER, description: 'واریز کامل فاکتور 001',
      });
      step('B21', 'ثبت دریافت وجه مرتبط با فاکتور', tx.status === 201, tx.status === 201 ? `id=${idOf(tx.json)}` : `${tx.status} ${tx.text.slice(0, 220)}`);
      const rc1 = await user(`rest/v1/acc_invoices?id=eq.${INV1}`, 'PATCH', { paid_total: total, status: 'paid' });
      const invAfter = await user(`rest/v1/acc_invoices?id=eq.${INV1}&select=status,paid_total`);
      step('B22', 'به‌روزرسانی وضعیت تسویه (paid_total/status=paid)', rc1.status === 204 && invAfter.json?.[0]?.status === 'paid',
        JSON.stringify(invAfter.json?.[0] || invAfter.text.slice(0, 150)).slice(0, 200));
    }

    /* B23: هزینه */
    const ex = await user('rest/v1/acc_expenses', 'POST', {
      business_id: BIZ, category: 'اجاره', title: 'اجاره دفتر مهرماه', amount: 60000000, vat_amount: 6000000,
      date_g: todayISO(), account_id: BANK, is_paid: true, vendor_name: 'مالک ساختمان',
      receipt_no: 'R-1001', tax_status: 'incomplete', description: 'چک شماره ۵۵۲',
    });
    step('B23', 'ثبت هزینه (با وضعیت مالیاتی)', ex.status === 201, ex.status === 201 ? `id=${idOf(ex.json)}` : `${ex.status} ${ex.text.slice(0, 220)}`);

    /* B24: چک */
    const ck = await user('rest/v1/acc_checks', 'POST', {
      business_id: BIZ, kind: 'received', partner_id: PARTNER, account_id: BANK, invoice_id: null,
      amount: 500000000, serial_no: '552144', bank_name: 'بانک صادرات', branch: 'شعبه مرکزی',
      issue_date_g: todayISO(), due_date_g: todayISO(), status: 'in_hand', description: 'چک بابت فاکتور',
    });
    step('B24', 'ثبت چک دریافتی', ck.status === 201, ck.status === 201 ? `id=${idOf(ck.json)}` : `${ck.status} ${ck.text.slice(0, 220)}`);

    /* B25-B26: کارمند و حقوق */
    const emp = await user('rest/v1/acc_employees', 'POST', {
      business_id: BIZ, name: 'محمد رضایی', national_id: '0065432198', personnel_code: '101',
      position: 'حسابدار', hire_date_g: todayISO(), base_salary: 150000000, housing_allowance: 9000000,
      food_allowance: 14000000, child_allowance: 0, child_count: 0, insurance_number: '55443322', bank_account: '6037991112223334',
    });
    const EMP = await idBack(emp.json, 'acc_employees', `business_id=eq.${BIZ}&personnel_code=eq.101`);
    step('B25', 'ثبت کارمند', emp.status === 201, emp.status === 201 ? `id=${EMP}` : `${emp.status} ${emp.text.slice(0, 220)}`);
    if (EMP) {
      const pay = await user('rest/v1/acc_payrolls', 'POST', {
        business_id: BIZ, employee_id: EMP, jyear: jalaliYear(), jmonth: 6, work_days: 30, overtime_hours: 10,
        base_salary: 150000000, food_allowance: 14000000, housing_allowance: 9000000, family_allowance: 0,
        overtime_pay: 15000000, gross: 188000000, insurance_employee: 23460000, tax: 5000000,
        other_deductions: 0, net: 159540000, paid: false, account_id: null, pay_date_g: null,
      });
      step('B26', 'ثبت فیش حقوقی (حقوق و دستمزد + بیمه)', pay.status === 201, pay.status === 201 ? `id=${idOf(pay.json)}` : `${pay.status} ${pay.text.slice(0, 220)}`);
    }

    /* B27: دارایی ثابت */
    const as1 = await user('rest/v1/acc_assets', 'POST', {
      business_id: BIZ, name: 'خودرو پیکان', category: 'وسیله نقلیه', purchase_date_g: todayISO(),
      purchase_amount: 950000000, useful_life_years: 5, salvage_value: 50000000, account_id: BANK, status: 'active',
    });
    step('B27', 'ثبت دارایی ثابت', as1.status === 201, as1.status === 201 ? `id=${idOf(as1.json)}` : `${as1.status} ${as1.text.slice(0, 220)}`);

    /* B28: هزینه تکرارشونده */
    const rc = await user('rest/v1/acc_recurring', 'POST', {
      business_id: BIZ, title: 'اجاره ماهانه', category: 'اجاره', amount: 60000000, vat_amount: 6000000,
      frequency: 'monthly', next_date_g: todayISO(), account_id: BANK, auto_create: false, active: true,
    });
    step('B28', 'هزینه تکرارشونده', rc.status === 201, rc.status === 201 ? `id=${idOf(rc.json)}` : `${rc.status} ${rc.text.slice(0, 220)}`);

    /* B29: قرارداد */
    const ct = await user('rest/v1/acc_contracts', 'POST', {
      business_id: BIZ, title: 'قرارداد پشتیبانی شبکه سالانه', partner_id: PARTNER, project_id: null,
      amount: 480000000, vat_rate: 10, status: 'active', start_date_g: todayISO(), end_date_g: todayISO(),
    });
    step('B29', 'قرارداد خدماتی', ct.status === 201, ct.status === 201 ? `id=${idOf(ct.json)}` : `${ct.status} ${ct.text.slice(0, 220)}`);

    /* B30: پروژه */
    const pj = await user('rest/v1/acc_projects', 'POST', {
      business_id: BIZ, name: 'پروژه راه‌اندازی فروشگاه آنلاین', code: 'PRJ-01', partner_id: PARTNER,
      status: 'active', budget: 2000000000, start_date_g: todayISO(), end_date_g: null,
    });
    step('B30', 'پروژه / مرکز هزینه', pj.status === 201, pj.status === 201 ? `id=${idOf(pj.json)}` : `${pj.status} ${pj.text.slice(0, 220)}`);

    /* B31: سند دستی دوبل */
    const mj = await user('rest/v1/acc_journal', 'POST', {
      business_id: BIZ, entry_no: 9001, date_g: todayISO(), description: 'سند افتتاحی — سرمایه نقدی',
      ref_type: 'manual', ref_action: 'post',
    });
    const MJID = await idBack(mj.json, 'acc_journal', `business_id=eq.${BIZ}&entry_no=eq.9001`);
    step('B31a', 'ثبت سربرگ سند دستی', mj.status === 201, mj.status === 201 ? `id=${MJID}` : `${mj.status} ${mj.text.slice(0, 250)}`);
    if (MJID) {
      const mjl = await user('rest/v1/acc_journal_lines', 'POST', [
        { entry_id: MJID, business_id: BIZ, account_code: '1101', account_title: 'صندوق', debit: 3000000000, credit: 0 },
        { entry_id: MJID, business_id: BIZ, account_code: '3101', account_title: 'سرمایه', debit: 0, credit: 3000000000 },
      ]);
      step('B31b', 'ثبت سطرهای بدهکار/بستانکار سند دوبل', mjl.status === 201, mjl.status === 201 ? '۲ سطر' : `${mjl.status} ${mjl.text.slice(0, 250)}`);
    }

    /* B32: دسته هزینه سفارشی */
    const ec = await user('rest/v1/acc_expense_categories', 'POST', { business_id: BIZ, title: 'تبلیغات دیجیتال', code: 'EXP-CUSTOM', position: 99 });
    step('B32', 'دسته‌بندی هزینه سفارشی (title/code/position)', ec.status === 201, ec.status === 201 ? 'ok' : `${ec.status} ${ec.text.slice(0, 220)}`, ec.status === 201 ? '' : 'high');

    /* B33: قفل دوره مالی */
    const pl = await user('rest/v1/acc_periods', 'POST', { business_id: BIZ, jyear: jalaliYear(), jmonth: 6, locked: true, locked_at: new Date().toISOString() });
    step('B33', 'قفل دوره مالی (جلوگیری از تغییر اسناد قطعی)', pl.status === 201, pl.status === 201 ? 'ok' : `${pl.status} ${pl.text.slice(0, 220)}`);

    /* B34: لاگ فعالیت */
    const act = await user('rest/v1/acc_activity', 'POST', {
      business_id: BIZ, user_id: USER_ID, user_email: EMAIL, action: 'تست حسابرسی',
      entity: 'audit', entity_id: null, detail: 'تست خودکار حسابرسی کاربان',
    });
    step('B34', 'لاگ فعالیت کاربران', act.status === 201, act.status === 201 ? 'ok' : `${act.status} ${act.text.slice(0, 220)}`);

    /* B35: تراز آزمایشی */
    const tb = await user(`rest/v1/acc_journal_lines?select=account_code,account_title,debit,credit,acc_journal!inner(date_g)&acc_journal.business_id=eq.${BIZ}`);
    step('B35', 'کوئری تراز آزمایشی (join داخلی)', tb.status === 200, tb.status === 200 ? `rows=${tb.json?.length}` : `${tb.status} ${tb.text.slice(0, 220)}`);

    /* B36: گزارش سود و زیان */
    const pl2 = await user(`rest/v1/acc_invoices?select=total,vat_total&type=eq.sale&business_id=eq.${BIZ}&status=neq.cancelled`);
    step('B36', 'داده‌های گزارش فروش/درآمد', pl2.status === 200, pl2.status === 200 ? `rows=${pl2.json?.length}` : `${pl2.status} ${pl2.text.slice(0, 200)}`);

    /* B37: صف تلگرام */
    const tq = await user('rest/v1/telegram_queue', 'POST', { text: '🧾 فاکتور رسمی صادر شد — تست حسابرسی کاربان', kind: 'invoice' });
    step('B37', 'ثبت رویداد در صف تلگرام', tq.status === 201, tq.status === 201 ? 'ok' : `${tq.status} ${tq.text.slice(0, 220)}`);

    /* B38: مخفیگاه تلگرام ادمین */
    const ss = await sr('rest/v1/site_secrets?key=eq.telegram_admin&select=key,updated_at');
    step('B38', 'تنظیم تلگرام ادمین در site_secrets (پنل)', ss.status === 200 && ss.json?.length > 0,
      ss.json?.length ? `key=${ss.json[0].key} updated=${ss.json[0].updated_at}` : 'رکورد telegram_admin در site_secrets نیست (پنل ادمین هنوز تنظیم نکرده)', 'info');

    /* B39: سقف ۲۰ فاکتور آزمایشی */
    log('\n══ B39: تست سقف فاکتور آزمایشی (۲۰) ══');
    const cnt0 = await user(`rest/v1/acc_invoices?business_id=eq.${BIZ}&select=id`);
    const existing = arr(cnt0.json).length;
    let quotaBlockedAt = null;
    for (let i = existing + 1; i <= 21; i++) {
      const r = await user('rest/v1/acc_invoices', 'POST', {
        business_id: BIZ, number: `${jy}-Q${String(i).padStart(3, '0')}`, type: 'sale', status: 'draft',
        partner_id: null, date_g: todayISO(), is_cash_sale: true, buyer_type: 'final',
        subtotal: 1000000, discount_total: 0, vat_total: 100000, total: 1100000,
      });
      if (r.status !== 201) {
        quotaBlockedAt = i;
        step('B39', 'سقف ۲۰ فاکتور آزمایشی', i === 21, `درخواست شماره ${i} رد شد: ${r.text.slice(0, 120)}`);
        break;
      }
      if (i === 21) step('B39', 'سقف ۲۰ فاکتور آزمایشی', false, 'فاکتور ۲۱ هم پذیرفته شد — پالیسی سقف کار نمی‌کند!', 'medium');
    }
    if (quotaBlockedAt === null && existing + 1 <= 20) step('B39', 'سقف ۲۰ فاکتور آزمایشی', false, `تا ۲۱ رفت ولی خطا برگشت؟ existing=${existing}`, 'medium');
    if (quotaBlockedAt === 21) log('   ✅ سقف دقیقاً روی ۲۰ اعمال می‌شود');

    /* B40: مغایرت‌گیری بانکی */
    const rec = await user('rest/v1/acc_reconciliations', 'POST', {
      business_id: BIZ, account_id: BANK, statement_date_g: todayISO(), statement_balance: 2600000000,
      book_balance: 2500000000, difference: 100000000, reconciled: false, notes: 'یک واریز شناسایی نشده',
    });
    const recMissing = rec.status !== 201 && /(does not exist|relation|404)/i.test(rec.text);
    step('B40', 'مغایرت‌گیری بانکی', rec.status === 201,
      rec.status === 201 ? 'ok' : `${rec.status} ${rec.text.slice(0, 220)}${recMissing ? ' ← جدول acc_reconciliations در دیتابیس نیست — sql-4 را اجرا کن' : ''}`,
      rec.status === 201 ? '' : 'high');

    /* ═══ مرحله C — تشخیص داده‌های موجود ═══ */
    log('\n══ مرحله C: تشخیص داده‌های موجود ══');
    const lic = await sr('rest/v1/acc_access?select=id,business_id,user_id,email,role,status,plan,expires_at,created_at&order=created_at.desc&limit=50');
    const licenses = arr(lic.json);
    step('C1', 'خواندن لایسنس‌ها (acc_access)', lic.status === 200, `${licenses.length} ردیف`);

    const bizs = await sr('rest/v1/acc_businesses?select=id,name,owner_id,created_at&order=created_at.desc&limit=50');
    const businesses = arr(bizs.json);
    step('C2', 'خواندن کسب‌وکارها', bizs.status === 200, `${businesses.length} کسب‌وکار`);

    for (const b of businesses) {
      const c = await sr(`rest/v1/acc_invoices?business_id=eq.${b.id}&select=id,status,type`);
      const rows = arr(c.json);
      const licsForBiz = licenses.filter((l) => l.business_id === b.id);
      const trialOnly = licsForBiz.some((l) => l.status === 'trial' && (!l.expires_at || l.expires_at > new Date().toISOString()))
        && !licsForBiz.some((l) => l.status === 'active');
      diag.push({
        business: b.name, id: b.id,
        invoices: rows.length,
        issued: rows.filter((r) => r.status === 'issued').length,
        drafts: rows.filter((r) => r.status === 'draft').length,
        trial_only: trialOnly,
        quota_20_blocked: trialOnly && rows.length >= 20,
        license: licsForBiz.map((l) => `${l.role}/${l.status}/${l.plan}${l.expires_at ? '/تا ' + l.expires_at.slice(0, 10) : ''}`).join(' , ') || '«بدون لایسنس متصل!»',
      });
    }
    for (const d of diag) {
      log(`   • ${d.business}: ${d.invoices} فاکتور (${d.issued} صادره، ${d.drafts} پیش‌نویس) | لایسنس: ${d.license}${d.quota_20_blocked ? ' | ⚠️ سقف ۲۰ آزمایشی پر شده!' : ''}`);
    }
    step('C3', 'گزارش وضعیت کسب‌وکارها', true, JSON.stringify(diag).slice(0, 490));

    const orphanBiz = diag.filter((d) => d.license.includes('بدون لایسنس'));
    step('C4', 'کسب‌وکار بدون لایسنس متصل (عامل ریشه‌ای ذخیره ناموفق)', orphanBiz.length === 0,
      orphanBiz.length ? orphanBiz.map((o) => o.business).join('، ') + ' — لایسنس ندارند؛ RLS همه درج/ویرایش را رد می‌کند' : 'هیچ',
      orphanBiz.length ? 'critical' : '');

    const expired = licenses.filter((l) => l.expires_at && l.expires_at < new Date().toISOString() && l.status !== 'active');
    step('C5', 'لایسنس‌های منقضی/آزمایشی گذشته', true, expired.length ? expired.map((l) => `${l.email}:${l.plan}:${l.expires_at?.slice(0, 10)}`).join('، ') : 'هیچ');

    let unpostedCount = 0, checkedBiz = 0;
    for (const b of businesses.slice(0, 10)) {
      const j = await sr(`rest/v1/acc_journal?business_id=eq.${b.id}&select=id,ref_type,ref_id`);
      const js = arr(j.json);
      const inv = await sr(`rest/v1/acc_invoices?business_id=eq.${b.id}&status=eq.issued&select=id,number&order=date_g.desc&limit=5`);
      const postedRefs = new Set(js.map((e) => e.ref_id));
      const unposted = arr(inv.json).filter((i) => !postedRefs.has(i.id));
      unpostedCount += unposted.length;
      checkedBiz++;
    }
    step('C6', 'بررسی ثبت دوبل فاکتورهای صادره (۵ تای آخر هر کسب‌وکار)', true,
      unpostedCount === 0 ? 'همه صادره‌ها سند دارند' : `${unpostedCount} فاکتور صادره در ${checkedBiz} کسب‌وکار بدون سند حسابداری است`, 'info');

    const tqAll = await sr('rest/v1/telegram_queue?select=id&limit=100');
    step('C7', 'صف تلگرام (پیام‌های در انتظار ارسال)', true, `${arr(tqAll.json).length} پیام در صف`, 'info');

    /* ═══ B41-B43: قابلیت‌های حرفه‌ای نسخه ۷ ═══ */
    if (BIZ && USER_TOKEN) {
      const u2 = (path, method, body) => user(path, method, body);
      /* B41 تنخواه‌گردان */
      const pt = await u2('rest/v1/acc_petty', 'POST', { business_id: BIZ, name: 'تنخواه تستی حسابرسی', status: 'open' });
      const PTY = await idBack(pt.json, 'acc_petty', `business_id=eq.${BIZ}&name=eq.${encodeURIComponent('تنخواه تستی حسابرسی')}`);
      step('B41', 'تنخواه‌گردان — ایجاد و شارژ', pt.status === 201, pt.status === 201 ? 'ok' : `${pt.status} ${pt.text.slice(0, 200)}`);
      if (PTY) {
        const po = await u2('rest/v1/acc_petty_ops', 'POST', { business_id: BIZ, petty_id: PTY, kind: 'charge', amount: 5000000, date_g: todayISO() });
        step('B41b', 'ثبت عمل شارژ تنخواه', po.status === 201, po.status === 201 ? 'ok' : `${po.status} ${po.text.slice(0, 180)}`);
      }
      /* B42 پیش‌دریافت */
      const pp = await u2('rest/v1/acc_prepayments', 'POST', { business_id: BIZ, kind: 'advance_received', amount: 10000000, date_g: todayISO(), status: 'open' });
      step('B42', 'پیش‌دریافت/پیش‌پرداخت', pp.status === 201, pp.status === 201 ? 'ok' : `${pp.status} ${pp.text.slice(0, 200)}`);
      /* B43 تفصیلی شناور + ضمیمه + خط بانک */
      const dt = await u2('rest/v1/acc_details', 'POST', { business_id: BIZ, title: 'تفصیلی تستی حسابرسی', kind: 'other' });
      step('B43', 'تفصیلی شناور', dt.status === 201, dt.status === 201 ? 'ok' : `${dt.status} ${dt.text.slice(0, 180)}`);
      const bl = await u2('rest/v1/acc_bank_lines', 'POST', { business_id: BIZ, account_id: BANK_ID, date_g: todayISO(), description: 'واریز تستی', amount: 1500000, match_status: 'unmatched' });
      step('B44', 'خطوط صورت‌حساب بانک (مغایرت واقعی)', bl.status === 201, bl.status === 201 ? 'ok' : `${bl.status} ${bl.text.slice(0, 200)}`);
      const fy = await u2('rest/v1/acc_fiscal_years', 'POST', { business_id: BIZ, jyear: jalaliYear(), status: 'open' });
      step('B45', 'دوره مالی سالانه', fy.status === 201, fy.status === 201 ? 'ok' : `${fy.status} ${fy.text.slice(0, 180)}`);

      /* B46: ویرایش اطلاعات حساب بانکی — ریشه‌یابی باگ «ذخیره نشدن اطلاعات بانک» */
      if (BANK_ID) {
        const editName = `بانک آری ویرایش‌شده ${STAMP}`;
        const pAcc = await u2(`rest/v1/acc_accounts?id=eq.${BANK_ID}`, 'PATCH', { name: editName, account_number: '6104337812345678' });
        const chk = await u2(`rest/v1/acc_accounts?id=eq.${BANK_ID}&select=name,account_number`);
        const persisted = arr(chk.json)[0]?.name === editName && arr(chk.json)[0]?.account_number === '6104337812345678';
        step('B46', 'ویرایش اطلاعات حساب بانکی ذخیره می‌شود', pAcc.status === 204 && persisted,
          pAcc.status === 204 && persisted ? 'ok — UPDATE پالیسی و ذخیره برقرار' : `PATCH=${pAcc.status} persisted=${persisted} ${pAcc.text.slice(0, 160)}`,
          pAcc.status === 204 && persisted ? '' : 'high');
      }

      /* B47: پیش‌فاکتور صادره همچنان قابل ویرایش است (کنترل قفل B18) */
      const pf = await u2(`rest/v1/acc_invoices?business_id=eq.${BIZ}&type=eq.proforma&select=id&order=created_at.desc&limit=1`);
      const PFID = arr(pf.json)[0]?.id ?? null;
      if (PFID) {
        const pPf = await u2(`rest/v1/acc_invoices?id=eq.${PFID}`, 'PATCH', { description: 'ویرایش آزاد پیش‌فاکتور' });
        step('B47', 'پیش‌فاکتور صادره قابل ویرایش می‌ماند', pPf.status === 204,
          pPf.status === 204 ? 'ok — قفل B18 فقط اسناد رسمی را می‌بندد' : `PATCH=${pPf.status} ${pPf.text.slice(0, 160)}`,
          pPf.status === 204 ? '' : 'medium');
      }
    }
  } catch (e) {
    step('X1', 'خطای غیرمنتظره در اجرای حسابرسی', false, String(e?.stack || e).slice(0, 480), 'critical');
  }

  /* ═══ مرحله E — پاک‌سازی داده‌های تستی ═══ */
  let cleanupOk = 0, cleanupFail = 0;
  if (cleanup && BIZ) {
    log('\n══ مرحله E: پاک‌سازی داده‌های تستی ══');
    const tables = [
      'acc_bank_lines', 'acc_prepayments', 'acc_petty_ops', 'acc_petty', 'acc_attachments', 'acc_details', 'acc_fiscal_years',
      'acc_reconciliations', 'acc_checks', 'acc_transactions', 'acc_invoice_items', 'acc_invoices',
      'acc_journal_lines', 'acc_journal', 'acc_payrolls', 'acc_employees', 'acc_assets',
      'acc_recurring', 'acc_contracts', 'acc_projects', 'acc_expense_categories', 'acc_expenses',
      'acc_periods', 'acc_activity', 'acc_items', 'acc_accounts', 'acc_partners',
      'acc_access',
    ];
    for (const t of tables) {
      try {
        const d = await sr(`rest/v1/${t}?business_id=eq.${BIZ}`, 'DELETE');
        if (d.status === 204 || d.status === 200) cleanupOk++; else cleanupFail++;
      } catch { cleanupFail++; }
    }
    try { await sr(`rest/v1/telegram_queue?text=ilike.${encodeURIComponent('*حسابرسی*')}`, 'DELETE'); cleanupOk++; } catch { cleanupFail++; }
    try {
      const d = await sr(`rest/v1/acc_businesses?id=eq.${BIZ}`, 'DELETE');
      if (d.status === 204 || d.status === 200) cleanupOk++; else cleanupFail++;
    } catch { cleanupFail++; }
    if (USER_ID) {
      try { const d = await sr(`rest/v1/profiles?id=eq.${USER_ID}`, 'DELETE'); if (d.status === 204 || d.status === 200) cleanupOk++; else cleanupFail++; } catch { cleanupFail++; }
      try {
        const d = await fetch(`${URL}/auth/v1/admin/users/${USER_ID}`, { method: 'DELETE', headers: srHeaders() });
        if (d.status === 204 || d.status === 200) cleanupOk++; else cleanupFail++;
      } catch { cleanupFail++; }
    }
    log(`   پاک‌سازی: ${cleanupOk} موفق / ${cleanupFail} ناموفق`);
  }

  /* ═══ مرحله D — نتیجه‌گیری ═══ */
  const passCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  log(`\n══════ نتیجه: ${passCount} موفق / ${failCount} ناموفق ══════`);
  for (const f of findings) log(`   [${f.severity}] ${f.id} ${f.title}`);

  const report = {
    generated_at: new Date().toISOString(),
    duration_ms: Date.now() - t0,
    live_schema: liveSchema,
    schema_tables: accTables,
    missing_schema: missingSchema,
    results, findings, business_diagnosis: diag,
    summary: { pass: passCount, fail: failCount },
    cleanup: { attempted: !!(cleanup && BIZ), ok: cleanupOk, fail: cleanupFail },
    test_context: { email: EMAIL, business: BIZ, invoice: INV1 },
  };
  return report;
}

/* ═══ نسخه عمومی — برای ریپوی عمومی و پاسخ HTTP بدون احراز هویت ═══
   هیچ ایمیل/نام کسب‌وکار واقعی/جزئیات لایسنس در آن نیست */
export function publicReport(report) {
  return {
    generated_at: report.generated_at,
    duration_ms: report.duration_ms,
    summary: report.summary,
    schema_tables: report.schema_tables || [],
    missing_schema: report.missing_schema || {},
    results: (report.results || []).map((r) => ({ id: r.id, title: r.title, ok: r.ok, severity: r.severity || '', detail: String(r.id || '').startsWith('C') ? '' : (r.detail || '') })),
    findings: (report.findings || []).map((f) => ({ id: f.id, title: f.title, severity: f.severity })),
    business_stats: {
      count: (report.business_diagnosis || []).length,
      orphan_license: (report.business_diagnosis || []).filter((d) => d.license?.includes('بدون لایسنس')).length,
      trial_quota_full: (report.business_diagnosis || []).filter((d) => d.quota_20_blocked).length,
    },
    cleanup: report.cleanup,
    test_context: { email: report.test_context?.email },
  };
}

/* ═══ ساخت گزارش مارک‌داون ═══ */
export function buildMd(pub) {
  const lines = [];
  lines.push('# 🧾 گزارش حسابرسی خودکار سیستم حسابداری کاربان');
  lines.push('');
  lines.push(`- تاریخ تولید: \`${pub.generated_at}\``);
  lines.push(`- مدت اجرا: ${((pub.duration_ms || 0) / 1000).toFixed(1)} ثانیه`);
  lines.push(`- نتیجه: **${pub.summary.pass} موفق / ${pub.summary.fail} ناموفق**`);
  lines.push('');
  if (pub.findings?.length) {
    lines.push('## 🔴 یافته‌ها (نیاز به اقدام)');
    lines.push('');
    lines.push('| شدت | شناسه | عنوان |');
    lines.push('|-----|-------|-------|');
    for (const f of pub.findings) lines.push(`| ${f.severity === 'critical' ? '🔴 بحرانی' : f.severity === 'high' ? '🟠 بالا' : f.severity === 'medium' ? '🟡 متوسط' : '🔵 اطلاعات'} | ${f.id} | ${f.title} |`);
    lines.push('');
  } else {
    lines.push('## ✅ هیچ یافته بحرانی — همه چیز سبز است');
    lines.push('');
  }
  if (pub.missing_schema && Object.keys(pub.missing_schema).length) {
    lines.push('## 🗄️ ستون‌های ناموجود در اسکیمای زنده');
    lines.push('');
    for (const [t, cols] of Object.entries(pub.missing_schema)) lines.push(`- **${t}**: ${Array.isArray(cols) ? cols.join('، ') : cols}`);
    lines.push('');
  }
  if (pub.business_stats) {
    lines.push('## 📊 وضعیت کسب‌وکارها');
    lines.push('');
    lines.push(`- تعداد کسب‌وکارهای اخیر: ${pub.business_stats.count}`);
    lines.push(`- بدون لایسنس متصل: ${pub.business_stats.orphan_license}`);
    lines.push(`- سقف ۲۰ آزمایشی پر شده: ${pub.business_stats.trial_quota_full}`);
    lines.push('');
  }
  lines.push('## جزئیات تست‌ها');
  lines.push('');
  lines.push('| نتیجه | شناسه | تست |');
  lines.push('|-------|-------|-----|');
  for (const r of pub.results || []) lines.push(`| ${r.ok ? '✅' : '❌'} | ${r.id} | ${r.title} |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('> این گزارش توسط `acc-audit` (GitHub Actions + Vercel) به‌صورت خودکار تولید شده است. جزئیات کامل (اسکیمای زنده، تشخیص کسب‌وکارها، جزئیات یافته‌ها) در `site_secrets.acc_audit_report` دیتابیس نگهداری می‌شود.');
  return lines.join('\n');
}
