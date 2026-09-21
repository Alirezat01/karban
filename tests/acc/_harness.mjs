/* ═══════════════════════════════════════════════════════════════════
   کاربان — بستر تست زندهٔ حسابداری (Runtime Test Harness)
   اجرا با کلید anon + کاربران آزمایشی واقعی (دقیقاً مسیر اپ واقعی)
   ═══════════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

export const SUPABASE_URL = 'https://rocjeanizzhfvhnuhnms.supabase.co';
export const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvY2plYW5penpoZnZobnVobm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDQwMDcsImV4cCI6MjEwMjAyMDAwN30.Br3brGTpjWnI7ilghPka_DyYUQU7e9eYIPv88Ehqy6g';

export const RID = randomBytes(3).toString('hex');
const PW = 'Kb!' + randomBytes(8).toString('hex');

export function client() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' } });
}
export function authed(session) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
}

/* کاربران حسابرسی قدیمی (بدون نیاز به ایمیل تازه) — رمز از الگوی audit-core.js */
const AUDIT_STAMPS = ['mu86iqkm', 'mu85h42j', 'mu83n1ec', 'mu6uggvk', 'mu6svgi1', 'mu6quvyg', 'mu6ppvmg'];
let stampCursor = 0;

export async function makeUser(tag) {
  /* مسیر ۰: کاربران از پیش‌ساخته با متغیر محیطی — برای اجراهای مکرر بدون سهمیهٔ ایمیل
     ACC_TEST_USER_1 / ACC_TEST_PASS_1 و ACC_TEST_USER_2 / ACC_TEST_PASS_2 */
  const envUser = process.env[`ACC_TEST_USER_${tag === 'a' ? 1 : 2}`];
  const envPass = process.env[`ACC_TEST_PASS_${tag === 'a' ? 1 : 2}`];
  if (envUser && envPass) {
    const { data, error } = await client().auth.signInWithPassword({ email: envUser, password: envPass });
    if (!error && data?.session) return { email: envUser, password: envPass, session: data.session, sb: authed(data.session), userId: data.user.id };
    console.error(`  ╰─ ورود ${envUser} (env) ناموفق: ${error?.message?.slice(0, 60)}`);
  }
  while (stampCursor < AUDIT_STAMPS.length) {
    const stamp = AUDIT_STAMPS[stampCursor++];
    const email = `karban.audit.${stamp}@gmail.com`;
    const password = `Kb!Audit${stamp}Xq`;
    const { data, error } = await client().auth.signInWithPassword({ email, password });
    if (!error && data?.session) return { email, password, session: data.session, sb: authed(data.session), userId: data.user.id };
    console.error(`  ╰─ ورود ${email} ناموفق: ${error?.message?.slice(0, 60)}`);
  }
  const email = `acc-test-${tag}-${RID}@karbanqa.site`;
  let { data, error } = await client().auth.signUp({ email, password: PW });
  if (error || !data?.session) {
    const { data: s2, error: e2 } = await client().auth.signInWithPassword({ email, password: PW });
    if (e2 || !s2?.session) throw new Error(`ساخت کاربر ${tag} ناموفق: ${error?.message || e2?.message}`);
    return { email, password: PW, session: s2.session, sb: authed(s2.session), userId: s2.user.id };
  }
  return { email, password: PW, session: data.session, sb: authed(data.session), userId: data.user.id };
}

export async function makeBusiness(user, name) {
  const { data: bizId, error } = await user.sb.rpc('acc_start_trial', {
    p_form: { name, person_type: 'legal', default_vat_rate: '10' },
  });
  if (error) throw new Error('acc_start_trial ناموفق: ' + error.message);
  return bizId;
}

/* ── نتیجه‌ها ── */
export const RESULTS = [];
export function record(id, name, status, detail, evidence = null) {
  RESULTS.push({ id, name, status, detail, evidence });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'EXPECTED-FAIL' ? '🟧' : '⏭️';
  console.log(`${icon} [${id}] ${name} → ${status}${detail ? ' — ' + detail : ''}`);
}
export function saveResults(file) {
  mkdirSync(new URL('./out/', import.meta.url).pathname, { recursive: true });
  writeFileSync(new URL(`./out/${file}`, import.meta.url).pathname, JSON.stringify({ runId: RID, at: new Date().toISOString(), results: RESULTS }, null, 2));
}
export function summarize() {
  const c = (s) => RESULTS.filter(r => r.status === s).length;
  console.log(`\n═══ جمع‌بندی: ${c('PASS')} PASS / ${c('FAIL')} FAIL / ${c('EXPECTED-FAIL')} EXPECTED-FAIL / ${c('SKIP')} SKIP ═══`);
  return { pass: c('PASS'), fail: c('FAIL'), expFail: c('EXPECTED-FAIL'), skip: c('SKIP') };
}

/* ── پاکسازی داده (لایسنس acc_access و خود کسب‌وکار حفظ می‌شود تا اجرای بعدی reuse کند) ── */
const DATA_TABLES = ['acc_journal_lines', 'acc_journal', 'acc_invoice_items', 'acc_invoices', 'acc_transactions', 'acc_expenses', 'acc_checks',
  'acc_petty_ops', 'acc_petty', 'acc_prepayments', 'acc_bank_lines', 'acc_fiscal_years', 'acc_periods', 'acc_attachments',
  'acc_details', 'acc_partner_roles', 'acc_cost_centers', 'acc_partners', 'acc_items', 'acc_accounts', 'acc_projects', 'acc_expense_categories', 'acc_reconciliations', 'acc_entry_counters', 'acc_code_counters'];
export async function cleanup(sb, bizIds) {
  const failed = [];
  const blocked = [];
  for (const b of bizIds) {
    if (!b) continue;
    for (const t of DATA_TABLES) {
      const { error } = await sb.from(t).delete().eq('business_id', b);
      if (error && !/Could not find the table|does not exist/i.test(error.message)) {
        /* رد شدن به‌خاطر گارد حفظ تاریخچهٔ حسابداری (DEL-3/LGI) انتظار طراحی است */
        if (/قابل حذف نیست|بخشی از تاریخچه|قابل تغییر نیست|گردش حسابداری دارد|گردش مالی دارد|سند باطل‌شده/.test(error.message)) {
          blocked.push(t);
        } else {
          failed.push(`${t}: ${error.message.slice(0, 50)}`);
        }
      }
    }
  }
  return { failed, blocked };
}

/* درج سند دو مرحله‌ای — همان مسیر قدیمی اپ (برای سنجش رفتار پیش از مایگریشن) */
export async function insertJournalLegacy(sb, businessId, { entry_no, date_g, ref_type = 'manual', ref_action = 'post', ref_id = null, reversal_of = null, description = 'تست', lines = [] }) {
  let en = entry_no;
  if (!en) {
    const { data } = await sb.from('acc_journal').select('entry_no').eq('business_id', businessId).order('entry_no', { ascending: false }).limit(1).maybeSingle();
    en = (data?.entry_no || 0) + 1;
  }
  const { data: entry, error } = await sb.from('acc_journal')
    .insert({ business_id: businessId, entry_no: en, date_g, ref_type, ref_action, ref_id, reversal_of, description }).select('id').single();
  if (error) throw error;
  if (lines.length) {
    const rows = lines.map(l => ({ entry_id: entry.id, business_id: businessId, account_code: l.code, account_title: l.title || l.code, debit: l.debit || 0, credit: l.credit || 0 }));
    const { error: le } = await sb.from('acc_journal_lines').insert(rows);
    if (le) throw le;
  }
  return entry.id;
}

/* محاسبهٔ تراز یک سند */
export async function entrySums(sb, entryId) {
  const { data } = await sb.from('acc_journal_lines').select('debit, credit').eq('entry_id', entryId);
  const d = (data || []).reduce((s, l) => s + Number(l.debit || 0), 0);
  const c = (data || []).reduce((s, l) => s + Number(l.credit || 0), 0);
  return { d, c, lines: (data || []).length };
}
