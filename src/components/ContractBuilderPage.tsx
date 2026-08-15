import { useMemo, useState } from 'react';
import { Copy, FileText, Printer, Wand2 } from 'lucide-react';
import { CONTRACT_TYPES, INDUSTRIES, legalNotes } from '@/data/config';

const laborTypes = ['کار', 'کارآموزی'];

export default function ContractBuilderPage() {
  const [type, setType] = useState<string>('کار');
  const [industry, setIndustry] = useState<string>('برنامه‌نویسان');
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [duration, setDuration] = useState('');
  const [amount, setAmount] = useState('');
  const [extra, setExtra] = useState('');
  const [built, setBuilt] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLabor = laborTypes.includes(type);

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

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">ابزار هوشمند · ساخت قرارداد</span>
        <h1>ساخت قرارداد هوشمند</h1>
        <p className="lead">نوع قرارداد و صنف را انتخاب کن، اطلاعات کلیدی را بنویس؛ متن اولیه با مبنای قانونی (قانون کار یا ماده ۱۰ قانون مدنی) همین‌جا ساخته می‌شود.</p>

        <div className="contact-card calc-card">
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
          <label>نام طرف اول (کارفرما / سفارش‌دهنده)
            <input value={partyA} onChange={(e) => setPartyA(e.target.value)} placeholder="مثلاً: شرکت …" />
          </label>
          <label>نام طرف دوم (کارگر / پیمانکار / مشاور)
            <input value={partyB} onChange={(e) => setPartyB(e.target.value)} placeholder="مثلاً: آقای/خانم …" />
          </label>
          <label>مدت (اختیاری)
            <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="مثلاً: ۱۲ ماه" />
          </label>
          <label>مبلغ کل (ریال — اختیاری)
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>توضیح اضافه (اختیاری)
            <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="هر شرط خاصی داری بنویس…" />
          </label>
          <button className="button" onClick={() => { setBuilt(true); }}>
            <Wand2 size={16} /> ساخت متن قرارداد
          </button>
        </div>

        {built && (
          <div className="legal-box contract-draft">
            <h2><FileText size={18} /> پیش‌نویس قرارداد {type} — {industry}</h2>
            <pre className="contract-pre">{text}</pre>
            <div className="health-cta">
              <button className="button" onClick={copy}>{copied ? '✓ کپی شد' : 'کپی متن'} <Copy size={15} /></button>
              <button className="button button-outline" onClick={() => window.print()}><Printer size={15} /> چاپ / PDF</button>
            </div>
            <p className="muted-note">این متن، پیش‌نویس استاندارد است؛ برای نسخه نهایی و اختصاصی، از صفحه خدمات «تنظیم قرارداد اختصاصی» سفارش بدهید.</p>
          </div>
        )}

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
