/* واردات صورت‌حساب بانک از اکسل — پارس دقیق + اعتبارسنجی زنجیره موجودی + طبقه‌بندی خطوط */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, FileSpreadsheet, FileUp, Landmark, Loader2, Paperclip,
  RotateCcw, TriangleAlert, XCircle,
} from 'lucide-react';
import type { AccBusiness } from '@/lib/acc/types';
import {
  parseBankStatement, importStatement, classifyBankLine, revertBankLine, summarizeLines,
  type ParseResult, type ClassifyAction,
} from '@/lib/acc/api8';
import { listAccounts, listPartners, listExpenseCategories } from '@/lib/acc/api';
import { listBankLines, type AccBankLine } from '@/lib/acc/api7';
import { formatJalali } from '@/lib/acc/jalali';
import { formatMoney } from '@/lib/acc/money';
import { Field, Modal, confirmAction, toast, Badge, EmptyState } from './ui';
import AttachButton from './AttachButton';

type Step = 'upload' | 'preview' | 'manage';
type Filter = 'all' | 'unmatched' | 'needs_doc' | 'manual' | 'ignored';

interface AccountLite { id: string; name: string; kind: string }

const STATE_LABEL: Record<string, string> = {
  unmatched: 'جدید', needs_doc: 'نیاز به سند', manual: 'ثبت شده', ignored: 'صرف‌نظر',
  auto: 'تطبیق خودکار', onbook: 'در کتاب',
};

export default function BankImportPage({ business }: { business: AccBusiness }) {
  const [step, setStep] = useState<Step>('upload');
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [accountId, setAccountId] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [batchId, setBatchId] = useState('');

  /* مدیریت */
  const [lines, setLines] = useState<AccBankLine[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [expenseFor, setExpenseFor] = useState<AccBankLine | null>(null);
  const [txFor, setTxFor] = useState<AccBankLine | null>(null);
  const [exCategory, setExCategory] = useState('');
  const [exTitle, setExTitle] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; title: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listAccounts(business.id).then((a) => {
      const list = (a || []) as unknown as AccountLite[];
      setAccounts(list);
      const bank = list.find((x) => x.kind === 'bank');
      if (bank) setAccountId(bank.id);
    }).catch(() => setAccounts([]));
  }, [business.id]);

  async function openManage(accId: string) {
    const ls = await listBankLines(business.id, accId);
    setLines((ls || []).slice().sort((a, b) => (b.date_g + (b.description || '')).localeCompare(a.date_g + (a.description || ''))));
  }

  async function onFile(f: File) {
    if (!accountId) { toast('اول حساب بانکی را انتخاب کنید', 'error'); return; }
    setParsing(true);
    try {
      const result = await parseBankStatement(f);
      setParsed(result);
      setStep('preview');
      toast(`فایل خوانده شد: ${result.rows.length} تراکنش`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'خواندن فایل ناموفق بود', 'error');
    } finally {
      setParsing(false);
    }
  }

  async function doImport() {
    if (!parsed) return;
    setImporting(true);
    try {
      const out = await importStatement(business.id, accountId, parsed);
      setBatchId(out.batchId);
      toast(out.inserted > 0
        ? `${out.inserted} تراکنش وارد شد${out.duplicates ? ` — ${out.duplicates} تکراری نادیده گرفته شد` : ''}`
        : 'همه ردیف‌ها از قبل وارد بودند (تکراری)');
      setParsed(null);
      setStep('manage');
      await openManage(accountId);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'واردات ناموفق بود', 'error');
    } finally {
      setImporting(false);
    }
  }

  async function act(line: AccBankLine, action: ClassifyAction, opts?: { category?: string; title?: string; partnerId?: string | null }) {
    setBusyLine(line.id);
    try {
      await classifyBankLine(business, line, action, opts || {});
      if (action === 'receipt') toast('سند دریافت ثبت شد');
      else if (action === 'payment') toast('سند پرداخت ثبت شد');
      else if (action === 'expense') toast('سند هزینه ثبت شد');
      else if (action === 'needs_doc') toast('به فهرست «نیاز به سند» رفت — پیوست را آپلود کنید');
      await openManage(accountId);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'عملیات ناموفق بود', 'error');
    } finally {
      setBusyLine(null);
    }
  }

  async function revert(line: AccBankLine) {
    if (!(await confirmAction('این خط به حالت «جدید» برگردد؟ سند/هزینه‌ای که از آن ساخته شده حذف می‌شود.'))) return;
    setBusyLine(line.id);
    try {
      await revertBankLine(business.id, line);
      toast('بازگشت و پاک‌سازی انجام شد');
      await openManage(accountId);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'بازگشت ناموفق بود', 'error');
    } finally {
      setBusyLine(null);
    }
  }

  function openExpenseModal(line: AccBankLine) {
    setExpenseFor(line);
    setExCategory(categories[0]?.title || 'اداری و عمومی');
    setExTitle((line.description || '').replace(/^\[[\d:]+\]\s*/, '').slice(0, 100));
    setPartnerId('');
    listExpenseCategories(business.id).then((c) => setCategories((c || []) as unknown as { id: string; title: string }[])).catch(() => {});
  }

  function openTxModal(line: AccBankLine) {
    setTxFor(line);
    setPartnerId('');
    listPartners(business.id).then((p) => setPartners((p || []) as unknown as { id: string; name: string }[])).catch(() => {});
  }

  const summary = useMemo(() => summarizeLines(lines), [lines]);
  const filtered = useMemo(() => {
    if (filter === 'all') return lines;
    return lines.filter((l) => l.match_status === filter);
  }, [lines, filter]);

  /* ═════════ مرحله ۱ — انتخاب حساب و فایل ═════════ */
  if (step === 'upload') {
    return (
      <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
        <header>
          <h1 className="text-lg font-bold flex items-center gap-2"><Landmark size={20} /> واردات صورت‌حساب بانک از اکسل</h1>
          <p className="text-xs opacity-70 mt-1 leading-6">
            فایل اکسل خروجی حساب بانک (تجارت‌بانک و بانک‌های مشابه) را بدهید؛ سیستم کامل می‌خواند، صحت را با
            زنجیره موجودی و خلاصه دوره کنترل می‌کند، تراکنش‌های تکراری را نمی‌گذارد و بعد طبقه‌بندی هر خط را
            (دریافت/پرداخت/هزینه/نیاز به سند) به شما می‌سپارد.
          </p>
        </header>

        <Field label="حساب بانکی / صندوق مقصد">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="acc-input">
            <option value="">— انتخاب کنید —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.kind === 'bank' ? 'بانک' : 'صندوق'})</option>)}
          </select>
        </Field>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={!accountId || parsing}
          className="w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 hover:border-violet-400 disabled:opacity-40 transition"
        >
          {parsing ? <Loader2 size={30} className="animate-spin text-violet-500" /> : <FileUp size={30} className="text-violet-500" />}
          <span className="text-sm font-semibold">{parsing ? 'در حال خواندن و اعتبارسنجی فایل…' : 'انتخاب فایل اکسل (.xlsx / .xls / .csv)'}</span>
          <span className="text-[11px] opacity-60">قالب تجارت‌بانک به‌صورت خودکار شناسایی می‌شود — هدر و خلاصه دوره لازم نیست دستی مشخص شود</span>
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />

        {lines.length > 0 || batchId ? null : (
          <div className="text-center">
            <button className="text-xs text-violet-600 underline" onClick={() => { setStep('manage'); openManage(accountId); }}>
              رفتن به کارتابل طبقه‌بندی خطوط قبلی ←
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ═════════ مرحله ۲ — پیش‌نمایش و اعتبارسنجی ═════════ */
  if (step === 'preview' && parsed) {
    const chainBad = parsed.rows.filter((r) => r.chainIssue).length;
    return (
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
        <header className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2"><FileSpreadsheet size={20} /> پیش‌نمایش و اعتبارسنجی</h1>
            <p className="text-xs opacity-70 mt-1">
              قالب: {parsed.meta.bank === 'tejarat' ? 'تجارت‌بانک (خلاصه دوره شناسایی شد)' : 'عمومی'}
              {parsed.meta.accountNo ? ` — حساب ${parsed.meta.accountNo}` : ''}
              {parsed.meta.customer ? ` — ${parsed.meta.customer}` : ''}
              {` — هدر در ردیف ${parsed.headerRow} اکسل`}
            </p>
          </div>
          <button className="acc-btn-ghost text-xs" onClick={() => { setParsed(null); setStep('upload'); }}>بازگشت</button>
        </header>

        {/* کارت‌های خلاصه */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { t: 'تعداد تراکنش', v: String(parsed.rows.length) },
            { t: 'جمع واریز', v: formatMoney(parsed.rows.reduce((s, r) => s + r.deposit, 0)) },
            { t: 'جمع برداشت', v: formatMoney(parsed.rows.reduce((s, r) => s + r.withdrawal, 0)) },
            { t: 'مانده انتهایی', v: parsed.meta.closing != null ? formatMoney(parsed.meta.closing) : '—' },
          ].map((c) => (
            <div key={c.t} className="acc-card p-3">
              <div className="text-[11px] opacity-60">{c.t}</div>
              <div className="text-sm font-bold mt-1">{c.v}</div>
            </div>
          ))}
        </div>

        {/* چک‌لیست صحت */}
        <div className="acc-card p-4 space-y-2">
          <div className="text-sm font-bold mb-1">کنترل صحت (بدون خطا)</div>
          {parsed.checks.map((c) => (
            <div key={c.label} className="flex items-start gap-2 text-xs">
              {c.ok ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" /> : (c.warnOnly ? <TriangleAlert size={15} className="text-amber-500 shrink-0 mt-0.5" /> : <XCircle size={15} className="text-red-600 shrink-0 mt-0.5" />)}
              <div>
                <span className="font-semibold">{c.label}</span>
                <span className="opacity-70"> — {c.detail}</span>
              </div>
            </div>
          ))}
        </div>

        {/* جدول پیش‌نمایش */}
        <div className="acc-card p-0 overflow-auto max-h-[420px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white dark:bg-zinc-900 shadow-sm">
              <tr className="text-right opacity-70">
                <th className="p-2 font-medium">#</th>
                <th className="p-2 font-medium">تاریخ</th>
                <th className="p-2 font-medium">شرح</th>
                <th className="p-2 font-medium">سند</th>
                <th className="p-2 font-medium">واریز</th>
                <th className="p-2 font-medium">برداشت</th>
                <th className="p-2 font-medium">مانده</th>
              </tr>
            </thead>
            <tbody>
              {parsed.rows.slice(0, 200).map((r) => (
                <tr key={r.rowIdx} className={`border-t ${r.chainIssue ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
                  <td className="p-2 opacity-50">{r.rowIdx}</td>
                  <td className="p-2 whitespace-nowrap">{formatJalali(r.date_g)} <span className="opacity-50">{r.time}</span></td>
                  <td className="p-2">{r.desc.replace(/^\[[\d:]+\]\s*/, '')}{r.chainIssue ? <div className="text-[10px] text-red-600 mt-0.5">⚠ {r.chainIssue}</div> : null}</td>
                  <td className="p-2 opacity-70">{r.docNo || '—'}</td>
                  <td className="p-2 text-emerald-700 whitespace-nowrap">{r.deposit ? formatMoney(r.deposit) : ''}</td>
                  <td className="p-2 text-red-700 whitespace-nowrap">{r.withdrawal ? formatMoney(r.withdrawal) : ''}</td>
                  <td className="p-2 whitespace-nowrap opacity-80">{r.balance != null ? formatMoney(r.balance) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs opacity-70">
            {chainBad > 0
              ? <span className="text-amber-600">⚠ {chainBad} ردیف مغایرت زنجیره دارد — می‌توانید وارد کنید ولی بعداً بررسی کنید</span>
              : 'همه ردیف‌ها سالم‌اند'}
          </div>
          <button className="acc-btn-primary" onClick={doImport} disabled={importing}>
            {importing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {importing ? 'در حال واردات…' : `واردات ${parsed.rows.length} تراکنش به سیستم`}
          </button>
        </div>
      </div>
    );
  }

  /* ═════════ مرحله ۳ — کارتابل طبقه‌بندی ═════════ */
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><Landmark size={20} /> کارتابل طبقه‌بندی تراکنش‌های بانک</h1>
          <p className="text-xs opacity-70 mt-1">هر خط را مشخص کنید: دریافت، پرداخت، هزینه یا نیازمند پیوست — خطوط ثبت‌شده قابل بازگشت‌اند.</p>
        </div>
        <button className="acc-btn-primary text-xs" onClick={() => { setParsed(null); setStep('upload'); }}>
          <FileUp size={14} /> واردات فایل جدید
        </button>
      </header>

      {/* نوار خلاصه */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {summary.map((s) => (
          <button key={s.state} onClick={() => setFilter(filter === s.state ? 'all' : s.state as Filter)}
            className={`acc-card p-3 text-right transition ${filter === s.state ? 'ring-2 ring-violet-400' : ''}`}>
            <div className="text-[11px] opacity-60">{STATE_LABEL[s.state] || s.state}</div>
            <div className="text-sm font-bold">{s.count} خط</div>
            <div className="text-[10px] opacity-60">{formatMoney(s.total)}</div>
          </button>
        ))}
      </div>

      {/* فیلتر */}
      <div className="flex gap-1 flex-wrap">
        {(['all', 'unmatched', 'needs_doc', 'manual', 'ignored'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs border ${filter === f ? 'bg-violet-600 text-white border-violet-600' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
            {f === 'all' ? 'همه' : STATE_LABEL[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Landmark size={28} />} title="خطی در این وضعیت نیست" hint="فایل اکسل بانک را وارد کنید یا فیلتر را عوض کنید" />
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => {
            const st = l.match_status;
            return (
              <div key={l.id} className={`acc-card p-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${busyLine === l.id ? 'opacity-50' : ''} ${st === 'needs_doc' ? 'ring-1 ring-amber-300' : ''}`}>
                {/* اطلاعات خط */}
                <div className="min-w-[180px]">
                  <div className="text-xs font-semibold">{formatJalali(l.date_g)}</div>
                  <div className="text-[11px] opacity-60">{(l.description || '').replace(/^\[([\d:]+)\]\s*/, '⏱ $1 ')}</div>
                  {l.ref_no ? <div className="text-[10px] opacity-50">سند بانک: {l.ref_no}</div> : null}
                </div>
                <div className={`text-sm font-bold whitespace-nowrap ${l.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {l.amount >= 0 ? '+' : '−'}{formatMoney(Math.abs(l.amount))}
                </div>

                <div className="flex-1" />

                {/* وضعیت */}
                <Badge tone={st === 'manual' ? 'ok' : st === 'needs_doc' ? 'warn' : st === 'ignored' ? 'draft' : 'draft'}>
                  {STATE_LABEL[st] || st}{st === 'manual' && l.match_entity_type ? ` (${l.match_entity_type === 'expense' ? 'هزینه' : l.match_entity_type === 'transaction' ? 'خزانه' : l.match_entity_type})` : ''}
                </Badge>

                {/* پیوست */}
                <AttachButton business={business} entityType="bank_line" entityId={l.id} />

                {/* عملیات */}
                <div className="flex gap-1 flex-wrap">
                  {(st === 'unmatched' || st === 'needs_doc' || st === 'auto' || st === 'onbook') && (
                    <>
                      <button className="acc-btn-ghost text-[11px] text-emerald-700" disabled={busyLine === l.id} onClick={() => openTxModal(l)}>دریافت…</button>
                      <button className="acc-btn-ghost text-[11px] text-red-700" disabled={busyLine === l.id} onClick={() => openTxModal(l)}>پرداخت…</button>
                      <button className="acc-btn-ghost text-[11px] text-violet-700" disabled={busyLine === l.id} onClick={() => openExpenseModal(l)}>هزینه…</button>
                      {st !== 'needs_doc' && (
                        <button className="acc-btn-ghost text-[11px] text-amber-700" disabled={busyLine === l.id} onClick={() => act(l, 'needs_doc')}>نیاز به سند</button>
                      )}
                      <button className="acc-btn-ghost text-[11px] opacity-70" disabled={busyLine === l.id} onClick={() => act(l, 'ignore')}>صرف‌نظر</button>
                    </>
                  )}
                  {(st === 'manual' || st === 'ignored') && (
                    <button className="acc-btn-ghost text-[11px]" disabled={busyLine === l.id} onClick={() => revert(l)}>
                      <RotateCcw size={12} className="inline" /> بازگشت
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* مودال هزینه */}
      <Modal open={!!expenseFor} onClose={() => setExpenseFor(null)} title="ثبت به‌عنوان هزینه">
        {expenseFor && (
          <div className="space-y-3">
            <div className="text-xs opacity-70">{formatJalali(expenseFor.date_g)} — {formatMoney(Math.abs(expenseFor.amount))} ریال</div>
            <Field label="دسته هزینه">
              <select value={exCategory} onChange={(e) => setExCategory(e.target.value)} className="acc-input">
                {(categories.length ? categories : [{ id: '', title: 'اداری و عمومی' }]).map((c) => (
                  <option key={c.id || c.title} value={c.title}>{c.title}</option>
                ))}
              </select>
            </Field>
            <Field label="عنوان هزینه">
              <input className="acc-input" value={exTitle} onChange={(e) => setExTitle(e.target.value)} />
            </Field>
            <Field label="طرف‌حساب (اختیاری)">
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="acc-input">
                <option value="">— بدون طرف‌حساب —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <p className="text-[11px] opacity-60">وضعیت مالیاتی ابتدا «نیازمند تکمیل سند» ثبت می‌شود؛ بعد از پیوست فاکتور از همان بخش هزینه‌ها قابل اصلاح است.</p>
            <div className="flex gap-2 justify-end">
              <button className="acc-btn-ghost" onClick={() => setExpenseFor(null)}>انصراف</button>
              <button className="acc-btn-primary" onClick={() => { const l = expenseFor; setExpenseFor(null); if (l) act(l, 'expense', { category: exCategory, title: exTitle, partnerId: partnerId || null }); }}>
                ثبت هزینه
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* مودال دریافت/پرداخت با طرف‌حساب */}
      <Modal open={!!txFor} onClose={() => setTxFor(null)} title={txFor && txFor.amount >= 0 ? 'ثبت به‌عنوان دریافت' : 'ثبت به‌عنوان پرداخت'}>
        {txFor && (
          <div className="space-y-3">
            <div className="text-xs opacity-70">{formatJalali(txFor.date_g)} — {formatMoney(Math.abs(txFor.amount))} ریال ({txFor.amount >= 0 ? 'واریز به حساب' : 'برداشت از حساب'})</div>
            <Field label="طرف‌حساب (اختیاری — برای اتصال به مشتری/تامین‌کننده)">
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="acc-input">
                <option value="">— بدون طرف‌حساب —</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <div className="flex gap-2 justify-end">
              <button className="acc-btn-ghost" onClick={() => setTxFor(null)}>انصراف</button>
              <button className="acc-btn-primary" onClick={() => { const l = txFor; setTxFor(null); if (l) act(l, l.amount >= 0 ? 'receipt' : 'payment', { partnerId: partnerId || null }); }}>
                ثبت سند خزانه
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
