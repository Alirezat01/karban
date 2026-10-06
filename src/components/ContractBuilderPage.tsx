import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Copy, FileText, Link2, MessageSquare, Printer, Save, Share2, Wand2 } from 'lucide-react';
import { CONTRACT_TYPES, INDUSTRIES, legalNotes } from '@/data/config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { notifyAdmin } from '@/lib/notify';
import FaNumberInput from '@/components/FaNumberInput';
import StepIndicator from '@/components/StepIndicator';
import ClauseComments from '@/components/ClauseComments';

const laborTypes = ['کار', 'کارآموزی'];
const STEPS = ['نوع و صنف', 'طرفین', 'مدت و مبلغ', 'پیش‌نمایش'];

export default function ContractBuilderPage() {
  const { userId } = useAuth();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<string>('کار');
  const [industry, setIndustry] = useState<string>('برنامه‌نویسان');
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [duration, setDuration] = useState('');
  const [amount, setAmount] = useState('');
  const [extra, setExtra] = useState('');
  const [copied, setCopied] = useState(false);
  const [rootId, setRootId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedContractId, setSavedContractId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);

  const isLabor = laborTypes.includes(type);

  /* بازگرداندن قرارداد ذخیره‌شده از داشبورد (?restore=) */
  useEffect(() => {
    try {
      const raw = localStorage.getItem('karban-builder-restore');
      if (raw) {
        const c = JSON.parse(raw) as Record<string, string>;
        if (c.type) setType(c.type);
        if (c.industry) setIndustry(c.industry);
        if (c.partyA) setPartyA(c.partyA);
        if (c.partyB) setPartyB(c.partyB);
        if (c.duration) setDuration(c.duration);
        if (c.amount) setAmount(c.amount);
        if (c.extra) setExtra(c.extra);
        if (c.__root) setRootId(c.__root);
        setStep(3); /* مستقیم بریم پیش‌نمایش */
        localStorage.removeItem('karban-builder-restore');
      }
    } catch { /* noop */ }
  }, []);

  const text = useMemo(() => {
    const a = partyA.trim() || '…………………………';
    const b = partyB.trim() || '…………………………';
    const dur = duration.trim() || '……… ماه شمسی از تاریخ امضا';
    const amountText = amount ? `${Number(amount).toLocaleString('fa-IR')} ریال` : 'مبلغ توافقی طرفین که در پیوست ذکر می‌شود';
    const clauses: [string, string][] = [
      ['ماده ۱ — طرفین قرارداد', `این قرارداد در تاریخ ……………… فیمابین ${a} که از این پس «طرف اول» نامیده می‌شود و ${b} که از این پس «طرف دوم» نامیده می‌شود، با شرایط زیر منعقد گردید.`],
      ['ماده ۲ — موضوع قرارداد', `موضوع قرارداد عبارت است از تنظیم و اجرای قرارداد ${type} ویژه حوزه ${industry}؛ شامل کلیه تعهدات، مشخصات و استانداردهای مندرج در این سند و پیوست‌های آن${extra.trim() ? ` و به‌ویژه: ${extra.trim()}` : ''}.`],
      ['ماده ۳ — مدت قرارداد', `مدت این قرارداد ${dur} است و تمدید آن تنها با توافق کتبی طرفین مجاز است.`],
      ['ماده ۴ — مبلغ و نحوه پرداخت', `کل مبلغ قرارداد ${amountText} است که طبق زمان‌بندی توافقی (پیوست مالی) پرداخت می‌شود؛ تأخیر در پرداخت، مشمول خسارت تأخیر تأدیه خواهد بود.`],
      ['ماده ۵ — تعهدات طرف اول', 'طرف اول متعهد است: اطلاعات و امکانات لازم را در اختیار طرف دوم قرار دهد؛ مبالغ را در موعد مقرر بپردازد؛ و از هر اقدامی که انجام تعهدات را مختل می‌کند خودداری نماید.'],
      ['ماده ۶ — تعهدات طرف دوم', 'طرف دوم متعهد است: موضوع قرارداد را با رعایت اصول فنی و حرفه‌ای و قوانین جاری کشور اجرا نماید؛ گزارش دوره‌ای ارائه دهد؛ و اسرار کاری را محفوظ بدارد.'],
      isLabor
        ? ['ماده ۷ — مبنای قانون کار', 'این قرارداد از حیث رابطه کاری تابع مواد ۷، ۲۴، ۶، ۴۱، ۵۱ و ۵۹ قانون کار جمهوری اسلامی ایران است؛ بیمه تأمین اجتماعی از روز نخست الزامی است و موارد پیش‌بینی‌نشده طبق قانون کار و آیین‌های مرتبط حل‌وفصل می‌شود.']
        : ['ماده ۷ — مبنای قانون مدنی', 'این قرارداد بر اساس ماده ۱۰ و مواد ۱۹۰، ۲۱۹، ۲۲ و ۲۳ قانون مدنی تنظیم شده و برای طرفین و قائم‌مقام آنان لازم‌الاتباع است؛ اصل صحت قرارداد و اصل لزوم حاکم است.'],
      ['ماده ۸ — حل اختلاف', 'کلیه اختلافات ناشی از این قرارداد ابتدا از طریق مذاکره مسالمت‌آمیز؛ در صورت عدم سازش، از طریق داور مرضی‌الطرفین و در نهایت مراجع قضایی صالح حل‌وفصل خواهد شد.'],
      ['ماده ۹ — محرمانگی و فورس ماژور', 'طرفین متعهد به حفظ محرمانگی اطلاعات هستند؛ در موارد قوه قاهره، تعهدات تا رفع مانع معلق و در صورت تداوم بیش از ۳۰ روز، هر طرف حق فسخ با اطلاع کتبی دارد.'],
      ['ماده ۱۰ — نسخ و لازم‌الاجرا بودن', 'این قرارداد در ۱۰ ماده و ۲ نسخه هم‌اعتبار تنظیم و پس از امضا برای طرفین الزام‌آور است.'],
    ];
    return [`قرارداد ${type} — ویژه ${industry}`, '', ...clauses.map(([h, bdy]) => `${h}\n${bdy}\n`)].join('\n');
  }, [type, industry, partyA, partyB, duration, amount, extra, isLabor]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const save = async () => {
    if (!userId) return;
    setSaveState('saving');
    try {
      const root = rootId || crypto.randomUUID();
      const { data: prev } = await supabase
        .from('saved_contracts')
        .select('version')
        .eq('root_id', root)
        .eq('user_id', userId)
        .order('version', { ascending: false })
        .limit(1);
      const version = ((prev?.[0]?.version as number) || 0) + 1;
      const { data, error } = await supabase.from('saved_contracts').insert({
        user_id: userId,
        root_id: root,
        title: `قرارداد ${type} — ${industry}`,
        type,
        industry,
        version,
        content: { type, industry, partyA, partyB, duration, amount, extra, __root: root },
      }).select('id').single();
      setSaveState(error ? 'error' : 'saved');
      if (!error) {
        setRootId(root);
        if (data?.id) setSavedContractId(data.id);
        void notifyAdmin(`📄 قرارداد جدید در سازنده: قرارداد ${type} — ${industry} (نسخه ${version})`);
      }
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
    }
  };

  /* اعتبارسنجی ساده هر مرحله — برای فعال‌شدن دکمه «بعدی» */
  const stepValid = (i: number) => {
    if (i === 0) return !!type && !!industry;
    if (i === 1) return partyA.trim().length >= 2 || partyB.trim().length >= 2;
    if (i === 2) return true; /* مدت و مبلغ اختیاری */
    return true;
  };

  const canNext = stepValid(step);
  const next = () => setStep((s) => Math.min(3, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">ابزار هوشمند · ساخت قرارداد</span>
        <h1>ساخت قرارداد هوشمند</h1>
        <p className="lead">نوع قرارداد و صنف را انتخاب کن، اطلاعات کلیدی را بنویس؛ متن اولیه با مبنای قانونی (قانون کار یا ماده ۱۰ قانون مدنی) همین‌جا ساخته می‌شود.</p>

        <StepIndicator steps={STEPS} current={step} onStepClick={(i) => i < step && setStep(i)} />

        <div className="contact-card calc-card">
          {/* مرحله ۱: نوع و صنف */}
          {step === 0 && (
            <div className="wizard-step">
              <label>نوع قرارداد
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>صنف / حوزه کاری
                <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  {INDUSTRIES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <p className="muted-note">نوع قرارداد، مبنای قانونی متن را تعیین می‌کند: قراردادهای «کار» و «کارآموزی» تابع قانون کار هستند و بقیه بر اساس ماده ۱۰ قانون مدنی تنظیم می‌شوند.</p>
            </div>
          )}

          {/* مرحله ۲: طرفین */}
          {step === 1 && (
            <div className="wizard-step">
              <label>نام طرف اول (کارفرما / سفارش‌دهنده) <span className="req-star" title="الزامی">*</span>
                <input value={partyA} onChange={(e) => setPartyA(e.target.value)} placeholder="مثلاً: شرکت …" />
              </label>
              <label>نام طرف دوم (کارگر / پیمانکار / مشاور) <span className="req-star" title="الزامی">*</span>
                <input value={partyB} onChange={(e) => setPartyB(e.target.value)} placeholder="مثلاً: آقای/خانم …" />
              </label>
              <label>توضیح اضافه (اختیاری)
                <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} placeholder="هر شرط خاصی داری بنویس… مثلاً: محل انجام کار، ساعات حضور، تحویل خروجی‌ها…" />
              </label>
            </div>
          )}

          {/* مرحله ۳: مدت و مبلغ */}
          {step === 2 && (
            <div className="wizard-step">
              <label>مدت (اختیاری)
                <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="مثلاً: ۱۲ ماه" />
              </label>
              <label>مبلغ کل (ریال — اختیاری)
                <FaNumberInput value={Number(String(amount).replace(/\D/g, '')) || 0} onChange={(n) => setAmount(n ? String(n) : '')} />
              </label>
              <p className="muted-note">اگر مدت یا مبلغ را خالی بگذاری، در متن قرارداد به‌صورت «توافقی طرفین» درج می‌شود که بعداً می‌توانید دستی پر کنید.</p>
            </div>
          )}

          {/* مرحله ۴: پیش‌نمایش */}
          {step === 3 && (
            <div className="wizard-step">
              <div className="legal-box contract-draft">
                <h2><FileText size={18} /> پیش‌نویس قرارداد {type} — {industry}</h2>
                <pre className="contract-pre">{text}</pre>
                <div className="health-cta">
                  <button className="button" onClick={copy}>{copied ? '✓ کپی شد' : 'کپی متن'} <Copy size={15} /></button>
                  <button className="button button-outline" onClick={() => window.print()}><Printer size={15} /> چاپ / PDF</button>
                  {userId ? (
                    <button className="button button-outline" onClick={save}>
                      <Save size={15} />
                      {saveState === 'saving' ? 'در حال ذخیره…' : saveState === 'saved' ? '✓ ذخیره شد (نسخه جدید)' : saveState === 'error' ? 'ذخیره نشد — دوباره' : rootId ? 'ذخیره نسخه جدید' : 'ذخیره در حساب من'}
                    </button>
                  ) : (
                    <a className="button button-outline" href="/ورود"><Save size={15} /> برای ذخیره، وارد شو</a>
                  )}
                </div>
                {savedContractId && userId && (
                  <div className="health-cta" style={{ marginTop: '.5rem', borderTop: '1px dashed var(--line)', paddingTop: '.6rem' }}>
                    <button className="button button-outline" onClick={async () => {
                      const { data } = await supabase
                        .from('contract_signatures')
                        .insert({ contract_id: savedContractId, owner_id: userId })
                        .select('share_token')
                        .single();
                      if (data?.share_token) {
                        const link = `${window.location.origin}/امضای-قرارداد/${data.share_token}`;
                        setShareLink(link);
                        await navigator.clipboard.writeText(link);
                        void notifyAdmin(`✍️ درخواست امضای قرارداد: ${type} — ${industry}`);
                      }
                    }}>
                      <Share2 size={15} /> ساخت لینک امضا
                    </button>
                    <button className="button button-outline" onClick={() => setShowComments((v) => !v)}>
                      <MessageSquare size={15} /> یادداشت‌های بندها
                    </button>
                    {shareLink && (
                      <input value={shareLink} readOnly style={{ flex: '1 1 100%', fontFamily: 'monospace', fontSize: '.78rem', background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 8, padding: '.4rem .6rem' }} dir="ltr" />
                    )}
                  </div>
                )}
                <p className="muted-note">این متن، پیش‌نویس استاندارد است؛ برای نسخه نهایی و اختصاصی، از صفحه خدمات «تنظیم قرارداد اختصاصی» سفارش بدهید.</p>
              </div>
              {showComments && savedContractId && (
                <ClauseComments
                  contractId={savedContractId}
                  clauses={['ماده ۱ — طرفین قرارداد', 'ماده ۲ — موضوع قرارداد', 'ماده ۳ — مدت قرارداد', 'ماده ۴ — مبلغ و نحوه پرداخت', 'ماده ۵ — تعهدات طرف اول', 'ماده ۶ — تعهدات طرف دوم', 'ماده ۷ — مبنای قانونی', 'ماده ۸ — حل اختلاف', 'ماده ۹ — محرمانگی و فورس ماژور', 'ماده ۱۰ — نسخ و لازم‌الاجرا بودن']}
                  onClose={() => setShowComments(false)}
                />
              )}
            </div>
          )}

          {/* ناوبری ویزارد */}
          <div className="wizard-nav">
            {step > 0 && (
              <button className="button button-outline" onClick={prev}>
                <ArrowRight size={16} /> مرحله قبل
              </button>
            )}
            {step < 3 ? (
              <button className="button" onClick={next} disabled={!canNext}>
                مرحله بعد <ArrowLeft size={16} />
              </button>
            ) : (
              <button className="button button-outline" onClick={() => setStep(0)}>
                <Wand2 size={15} /> ویرایش مجدد
              </button>
            )}
          </div>
        </div>

        <div className="legal-box">
          <h2>مبنای قانونی</h2>
          <ul>
            {(isLabor ? legalNotes['محاسبه-حقوق'] : legalNotes['تست-سلامت'] || []).slice(0, 2).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
            <li>ماده ۱۰ قانون مدنی: قراردادهای خصوصی مطابق عرف و توافق طرفین معتبر است، مشروط بر آنکه مخالف صریح قانون نباشد.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
