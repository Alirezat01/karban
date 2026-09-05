import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Scale, ShieldCheck, Table2 } from 'lucide-react';
import { legalConfig, legalNotes } from '@/data/config';
import { supabase } from '@/lib/supabase';
import { formatRial, formatFaNumber } from '@/lib/format';
import calcSeo from '@/data/calc-seo.json';

type CalcSeoEntry = {
  about: string[];
  how: string[];
  example: string[];
  laws: string[];
  faqs: [string, string][];
  links: { href: string; label: string }[];
};
const calcSeoMap = calcSeo as unknown as Record<string, CalcSeoEntry>;

export type CalcType = 'salary' | 'hire' | 'severance' | 'retirement' | 'overtime' | 'business-tax' | 'vat' | 'salary-tax';

type Props = { type: CalcType; title: string; description: string };

type Params = {
  salary: { base: number; bon: number; housing: number; family: number; child_per: number; overtime_coef: number; insurance_employee: number; tax_exempt_monthly: number };
  hiring: { insurance_employer: number; severance_months: number; eydi_months: number; leave_days: number };
  tax_brackets: number[];
  business_exempt: number;
  bracket_caps: number[];
  vat_rate: number;
  retirement: { min_years: number; min_age: number; alt_years: number; alt_age: number; max_years: number };
};

const defaultParams: Params = {
  salary: {
    base: legalConfig.baseSalaryDaily * 30,
    bon: legalConfig.foodAllowanceMonthly,
    housing: legalConfig.housingAllowanceMonthly,
    family: legalConfig.familyAllowanceMonthly,
    child_per: legalConfig.childAllowanceMonthly,
    overtime_coef: legalConfig.overtimeMultiplier,
    insurance_employee: legalConfig.insuranceEmployeeRate,
    tax_exempt_monthly: legalConfig.taxExemptionMonthly,
  },
  hiring: { insurance_employer: legalConfig.insuranceEmployerRate, severance_months: 1, eydi_months: 2, leave_days: 26 },
  tax_brackets: [15, 20, 25, 30, 35],
  business_exempt: 400000000,
  bracket_caps: [2000000000, 4000000000, 10000000000, 50000000000],
  vat_rate: 10,
  retirement: { min_years: 20, min_age: 60, alt_years: 30, alt_age: 50, max_years: 42 },
};

const noteKey: Record<CalcType, string> = {
  salary: 'محاسبه-حقوق',
  hire: 'هزینه-استخدام',
  severance: 'سنوات',
  retirement: 'بازنشستگی',
  overtime: 'اضافه-کاری',
  'business-tax': 'مالیات-مشاغل',
  vat: 'ارزش-افزوده',
  'salary-tax': 'مالیات-حقوق',
};

function CalcTable({ valueHeader = 'مبلغ (ریال)', children }: { valueHeader?: string; children: ReactNode }) {
  return (
    <div className="calc-table-wrap">
      <table className="calc-table">
        <thead>
          <tr>
            <th>شرح</th>
            <th>{valueHeader}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function TRow({ label, value, strong, minus, ok, no }: { label: string; value: string; strong?: boolean; minus?: boolean; ok?: boolean; no?: boolean }) {
  const cls = [strong ? 'is-total' : '', minus ? 'is-minus' : '', ok ? 'is-ok' : '', no ? 'is-no' : ''].filter(Boolean).join(' ');
  return (
    <tr className={cls || undefined}>
      <td>{minus ? '− ' : ''}{label}</td>
      <td>{value}</td>
    </tr>
  );
}

function ParamsTitle() {
  return (
    <h3 className="calc-subtitle"><Table2 size={16} /> پارامترهای قانونی ۱۴۰۵ اعمال‌شده</h3>
  );
}

export default function CalculatorPage({ type, title, description }: Props) {
  const [params, setParams] = useState<Params>(defaultParams);

  const [base, setBase] = useState(defaultParams.salary.base);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [childrenCount, setChildrenCount] = useState(0);
  const [married, setMarried] = useState(false);
  const [bonus, setBonus] = useState(0);
  const [deduction, setDeduction] = useState(0);

  const [years, setYears] = useState(10);
  const [age, setAge] = useState(40);
  const [insuredYears, setInsuredYears] = useState(10);

  const [revenue, setRevenue] = useState(5000000000);
  const [expenses, setExpenses] = useState(3000000000);

  const [vatAmount, setVatAmount] = useState(100000000);
  const [vatMode, setVatMode] = useState<'add' | 'inside'>('add');

  useEffect(() => {
    let active = true;
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'calc_1405')
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const v = data.value as Record<string, unknown>;
        setParams((prev) => ({
          ...prev,
          salary: { ...prev.salary, ...((v.salary as object) || {}) },
          hiring: { ...prev.hiring, ...((v.hiring as object) || {}) },
          tax_brackets: (v.tax_brackets as number[]) || prev.tax_brackets,
          business_exempt: (v.business_exempt as number) || prev.business_exempt,
          bracket_caps: (v.bracket_caps as number[]) || prev.bracket_caps,
          vat_rate: (v.vat_rate as number) || prev.vat_rate,
          retirement: { ...prev.retirement, ...((v.retirement as object) || {}) },
        }));
      });
    return () => { active = false; };
  }, []);

  const hourly = useMemo(() => base / 220, [base]);

  const salaryResult = useMemo(() => {
    const overtimePay = Math.round(hourly * params.salary.overtime_coef * overtimeHours);
    const familyPay = married ? params.salary.family : 0;
    const childPay = childrenCount * params.salary.child_per;
    const gross = base + params.salary.bon + params.salary.housing + familyPay + childPay + overtimePay + bonus;
    const insurance = Math.round((base + params.salary.bon + params.salary.housing) * params.salary.insurance_employee);
    const taxable = Math.max(0, gross - insurance - params.salary.tax_exempt_monthly);
    let tax = 0;
    if (taxable > 0) {
      const steps = [
        { up: params.salary.tax_exempt_monthly * 0.25, rate: 0.1 },
        { up: params.salary.tax_exempt_monthly * 0.5, rate: 0.15 },
        { up: params.salary.tax_exempt_monthly * 1, rate: 0.2 },
        { up: Infinity, rate: 0.3 },
      ];
      let rest = taxable;
      let prevUp = 0;
      for (const s of steps) {
        const slice = Math.min(rest, s.up - prevUp);
        if (slice > 0) tax += slice * s.rate;
        rest -= slice;
        prevUp = s.up;
        if (rest <= 0) break;
      }
    }
    tax = Math.round(tax);
    const net = gross - insurance - tax - deduction;
    return { overtimePay, familyPay, childPay, gross, insurance, tax, net };
  }, [base, bonus, deduction, hourly, married, childrenCount, overtimeHours, params.salary]);

  const hireResult = useMemo(() => {
    const insurance = Math.round((base + params.salary.bon + params.salary.housing) * params.hiring.insurance_employer);
    const severance = Math.round((base * params.hiring.severance_months) / 12);
    const eydi = Math.round((base * params.hiring.eydi_months) / 12);
    const total = base + params.salary.bon + params.salary.housing + insurance + severance + eydi;
    return { insurance, severance, eydi, total, yearly: total * 12 };
  }, [base, params]);

  const severanceResult = useMemo(() => ({ total: Math.round(base * years), perYear: base }), [base, years]);

  const retirementResult = useMemo(() => {
    const r = params.retirement;
    const normal = age >= r.min_age && insuredYears >= r.min_years;
    const early = age >= r.alt_age && insuredYears >= r.alt_years;
    const full = insuredYears >= r.max_years;
    const status = full || normal || early;
    const pension = Math.round(base * Math.min(1, insuredYears / 30));
    return { normal, early, full, status, pension };
  }, [age, insuredYears, base, params.retirement]);

  const overtimeResult = useMemo(() => ({ pay: Math.round(hourly * params.salary.overtime_coef * overtimeHours), hourly }), [hourly, overtimeHours, params.salary.overtime_coef]);

  const businessTaxResult = useMemo(() => {
    const profit = Math.max(0, revenue - expenses);
    const taxable = Math.max(0, profit - params.business_exempt);
    const rates = params.tax_brackets;
    const caps = [...params.bracket_caps, Infinity];
    let rest = taxable;
    let prev = 0;
    const rows: { label: string; amount: number }[] = [];
    for (let i = 0; i < rates.length; i++) {
      const slice = Math.min(rest, caps[i] - prev);
      if (slice > 0) rows.push({ label: `پله ${i + 1} — ${rates[i]}٪`, amount: Math.round((slice * rates[i]) / 100) });
      rest -= slice;
      prev = caps[i];
      if (rest <= 0) break;
    }
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return { profit, taxable, rows, total, effective: profit > 0 ? Math.round((total / profit) * 1000) / 10 : 0 };
  }, [revenue, expenses, params.business_exempt, params.tax_brackets, params.bracket_caps]);

  const vatResult = useMemo(() => {
    const rate = params.vat_rate / 100;
    if (vatMode === 'add') {
      return { vat: Math.round(vatAmount * rate), gross: Math.round(vatAmount * (1 + rate)), net: vatAmount };
    }
    const net = Math.round(vatAmount / (1 + rate));
    return { vat: vatAmount - net, gross: vatAmount, net };
  }, [vatAmount, vatMode, params.vat_rate]);

  const salaryTaxResult = useMemo(() => {
    const insurance = Math.round((base + params.salary.bon + params.salary.housing) * params.salary.insurance_employee);
    const monthlyTaxable = Math.max(0, base - insurance - params.salary.tax_exempt_monthly);
    const annualTaxable = monthlyTaxable * 12;
    let rest = annualTaxable;
    let prev = 0;
    const rows: { label: string; amount: number }[] = [];
    for (const b of legalConfig.taxBrackets) {
      const slice = Math.min(rest, b.max - prev);
      if (slice > 0) rows.push({ label: `پله ${Math.round(b.rate * 100)}٪`, amount: Math.round(slice * b.rate) });
      rest -= slice;
      prev = b.max;
      if (rest <= 0) break;
    }
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return { insurance, monthlyTaxable, rows, total, monthly: Math.round(total / 12) };
  }, [base, params.salary]);

  const notes = legalNotes[noteKey[type]] || [];
  const seo = calcSeoMap[noteKey[type]];

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow">ابزارهای هوش مصنوعی · قانون کار ۱۴۰۵</span>
        <h1>{title}</h1>
        <p className="lead">{description}</p>

        <div className="contact-card calc-card">
          {type === 'salary' && (
            <>
              <label>حقوق پایه ماهانه (ریال)
                <input type="number" value={base} onChange={(e) => setBase(Number(e.target.value) || 0)} />
              </label>
              <label>ساعت اضافه‌کاری در ماه
                <input type="number" value={overtimeHours} onChange={(e) => setOvertimeHours(Number(e.target.value) || 0)} />
              </label>
              <label>تعداد فرزند
                <input type="number" value={childrenCount} onChange={(e) => setChildrenCount(Number(e.target.value) || 0)} />
              </label>
              <label className="terms-check">
                <input type="checkbox" checked={married} onChange={(e) => setMarried(e.target.checked)} />
                <span>متأهل هستم (حق عائله‌مندی)</span>
              </label>
              <label>پاداش و سایر مزایا (ریال)
                <input type="number" value={bonus} onChange={(e) => setBonus(Number(e.target.value) || 0)} />
              </label>
              <label>کسورات دیگر (ریال)
                <input type="number" value={deduction} onChange={(e) => setDeduction(Number(e.target.value) || 0)} />
              </label>
              <CalcTable>
                <TRow label="حقوق پایه" value={formatRial(base)} />
                <TRow label="بن کارگری" value={formatRial(params.salary.bon)} />
                <TRow label="کمک مسکن" value={formatRial(params.salary.housing)} />
                {married && <TRow label="عائله‌مندی" value={formatRial(salaryResult.familyPay)} />}
                {childrenCount > 0 && <TRow label={`اولاد (${formatFaNumber(childrenCount)} فرزند)`} value={formatRial(salaryResult.childPay)} />}
                {overtimeHours > 0 && <TRow label={`اضافه‌کاری (${formatFaNumber(overtimeHours)} ساعت)`} value={formatRial(salaryResult.overtimePay)} />}
                {bonus > 0 && <TRow label="پاداش و مزایا" value={formatRial(bonus)} />}
                <TRow label="جمع ناخالص" value={formatRial(salaryResult.gross)} strong />
                <TRow label="بیمه سهم کارگر (۷٪)" value={formatRial(salaryResult.insurance)} minus />
                <TRow label="مالیات حقوق" value={formatRial(salaryResult.tax)} minus />
                {deduction > 0 && <TRow label="کسورات دیگر" value={formatRial(deduction)} minus />}
                <TRow label="خالص دریافتی" value={formatRial(salaryResult.net)} strong />
              </CalcTable>

              <ParamsTitle />
              <CalcTable valueHeader="مبلغ ماهانه (ریال)">
                <TRow label="حقوق پایه روزانه × ۳۰" value={formatRial(params.salary.base)} />
                <TRow label="بن کارگری" value={formatRial(params.salary.bon)} />
                <TRow label="کمک‌هزینه مسکن" value={formatRial(params.salary.housing)} />
                <TRow label="حق اولاد (هر فرزند)" value={formatRial(params.salary.child_per)} />
                <TRow label="معافیت مالیاتی ماهانه" value={formatRial(params.salary.tax_exempt_monthly)} />
                <TRow label="ضریب اضافه‌کاری (ساعت عادی ۲۲۰ ساعت)" value={`× ${formatFaNumber(params.salary.overtime_coef)}`} />
              </CalcTable>
            </>
          )}

          {type === 'hire' && (
            <>
              <label>حقوق پایه ماهانه کارمند (ریال)
                <input type="number" value={base} onChange={(e) => setBase(Number(e.target.value) || 0)} />
              </label>
              <CalcTable>
                <TRow label="حقوق پایه" value={formatRial(base)} />
                <TRow label="بن کارگری" value={formatRial(params.salary.bon)} />
                <TRow label="کمک مسکن" value={formatRial(params.salary.housing)} />
                <TRow label={`بیمه سهم کارفرما (${Math.round(params.hiring.insurance_employer * 100)}٪)`} value={formatRial(hireResult.insurance)} minus />
                <TRow label="ذخیره سنوات (ماهانه)" value={formatRial(hireResult.severance)} />
                <TRow label="ذخیره عیدی (ماهانه)" value={formatRial(hireResult.eydi)} />
                <TRow label="بهای تمام‌شدن ماهانه" value={formatRial(hireResult.total)} strong />
                <TRow label="بهای تمام‌شدن سالانه" value={formatRial(hireResult.yearly)} strong />
              </CalcTable>
              <p className="muted-note">هزینه استخدام فقط حقوق نیست؛ بیمه، عیدی و سنوات را هم باید از روز اول کنار بگذارید.</p>
            </>
          )}

          {type === 'severance' && (
            <>
              <label>آخرین حقوق ماهانه (ریال)
                <input type="number" value={base} onChange={(e) => setBase(Number(e.target.value) || 0)} />
              </label>
              <label>سابقه کار (سال)
                <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value) || 0)} />
              </label>
              <CalcTable>
                <TRow label="سنوات هر سال کار" value={formatRial(severanceResult.perYear)} />
                <TRow label={`جمع سنوات (${formatFaNumber(years)} سال)`} value={formatRial(severanceResult.total)} strong />
              </CalcTable>
            </>
          )}

          {type === 'retirement' && (
            <>
              <label>سن فعلی
                <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value) || 0)} />
              </label>
              <label>سابقه پرداخت حق بیمه (سال)
                <input type="number" value={insuredYears} onChange={(e) => setInsuredYears(Number(e.target.value) || 0)} />
              </label>
              <label>میانگین حقوق دو سال آخر (ریال)
                <input type="number" value={base} onChange={(e) => setBase(Number(e.target.value) || 0)} />
              </label>
              <CalcTable valueHeader="نتیجه">
                <TRow label="شرایط عادی (۶۰ سال + ۲۰ سال سابقه)" value={retirementResult.normal ? '✓ برقرار' : '✗ برقرار نیست'} ok={retirementResult.normal} no={!retirementResult.normal} />
                <TRow label="شرایط جایگزین (۵۰ سال + ۳۰ سال سابقه)" value={retirementResult.early ? '✓ برقرار' : '✗ برقرار نیست'} ok={retirementResult.early} no={!retirementResult.early} />
                <TRow label="بدون شرط سن (۴۲ سال سابقه)" value={retirementResult.full ? '✓ برقرار' : '✗ برقرار نیست'} ok={retirementResult.full} no={!retirementResult.full} />
                <TRow label="برآورد مستمری ماهانه" value={formatRial(retirementResult.pension)} strong />
              </CalcTable>
              {!retirementResult.status && <p className="muted-note">هنوز شرایط بازنشستگی برقرار نیست؛ با افزایش سن یا سابقه دوباره بررسی کنید.</p>}
            </>
          )}

          {type === 'overtime' && (
            <>
              <label>حقوق پایه ماهانه (ریال)
                <input type="number" value={base} onChange={(e) => setBase(Number(e.target.value) || 0)} />
              </label>
              <label>ساعت اضافه‌کاری
                <input type="number" value={overtimeHours} onChange={(e) => setOvertimeHours(Number(e.target.value) || 0)} />
              </label>
              <CalcTable>
                <TRow label="نرخ هر ساعت عادی (تقسیم بر ۲۲۰ ساعت)" value={formatRial(Math.round(overtimeResult.hourly))} />
                <TRow label={`نرخ هر ساعت اضافه‌کاری (×${formatFaNumber(params.salary.overtime_coef)})`} value={formatRial(Math.round(overtimeResult.hourly * params.salary.overtime_coef))} />
                <TRow label={`جمع ${formatFaNumber(overtimeHours)} ساعت اضافه‌کاری`} value={formatRial(overtimeResult.pay)} strong />
              </CalcTable>
            </>
          )}

          {type === 'business-tax' && (
            <>
              <label>درآمد سالانه (ریال)
                <input type="number" value={revenue} onChange={(e) => setRevenue(Number(e.target.value) || 0)} />
              </label>
              <label>هزینه‌های سالانه قابل‌قبول (ریال)
                <input type="number" value={expenses} onChange={(e) => setExpenses(Number(e.target.value) || 0)} />
              </label>
              <CalcTable>
                <TRow label="سود سالانه" value={formatRial(businessTaxResult.profit)} />
                <TRow label="معافیت سالانه مشاغل" value={formatRial(params.business_exempt)} minus />
                <TRow label="سود مشمول مالیات" value={formatRial(businessTaxResult.taxable)} />
                {businessTaxResult.rows.map((r) => (
                  <TRow key={r.label} label={r.label} value={formatRial(r.amount)} />
                ))}
                <TRow label="جمع مالیات سالانه" value={formatRial(businessTaxResult.total)} strong />
                <TRow label="نرخ مؤثر مالیات" value={`${formatFaNumber(businessTaxResult.effective)}٪`} />
              </CalcTable>
            </>
          )}

          {type === 'vat' && (
            <>
              <label>مبلغ (ریال)
                <input type="number" value={vatAmount} onChange={(e) => setVatAmount(Number(e.target.value) || 0)} />
              </label>
              <label className="terms-check">
                <input type="checkbox" checked={vatMode === 'inside'} onChange={(e) => setVatMode(e.target.checked ? 'inside' : 'add')} />
                <span>مبلغ واردشده شامل ارزش افزوده است (استخراج از داخل فاکتور)</span>
              </label>
              <CalcTable>
                <TRow label="مبلغ بدون ارزش افزوده" value={formatRial(vatResult.net)} />
                <TRow label={`ارزش افزوده (${params.vat_rate}٪)`} value={formatRial(vatResult.vat)} />
                <TRow label="مبلغ با ارزش افزوده" value={formatRial(vatResult.gross)} strong />
              </CalcTable>
            </>
          )}

          {type === 'salary-tax' && (
            <>
              <label>حقوق ماهانه مشمول (ریال)
                <input type="number" value={base} onChange={(e) => setBase(Number(e.target.value) || 0)} />
              </label>
              <CalcTable>
                <TRow label="بیمه سهم کارگر (۷٪)" value={formatRial(salaryTaxResult.insurance)} minus />
                <TRow label="معافیت ماهانه مالیات" value={formatRial(params.salary.tax_exempt_monthly)} minus />
                <TRow label="مازاد مشمول ماهانه" value={formatRial(salaryTaxResult.monthlyTaxable)} />
                {salaryTaxResult.rows.map((r) => (
                  <TRow key={r.label} label={r.label} value={formatRial(r.amount)} />
                ))}
                <TRow label="جمع مالیات سالانه" value={formatRial(salaryTaxResult.total)} strong />
                <TRow label="مالیات ماهانه تقریبی" value={formatRial(salaryTaxResult.monthly)} strong />
              </CalcTable>
            </>
          )}
        </div>

        <div className="legal-box">
          <h2><Scale size={18} /> مبنای قانونی</h2>
          <ul>
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <p className="muted-note"><ShieldCheck size={14} /> پارامترها مطابق مقررات ۱۴۰۵ است و از تب «تنظیمات» پنل ادمین قابل به‌روزرسانی است.</p>
        </div>

        {seo && (
          <div className="article-body calc-seo">
            <h2>راهنمای کامل {title}</h2>
            {seo.about.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <h2>روش محاسبه</h2>
            <ul>
              {seo.how.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <h2>مثال عملی</h2>
            {seo.example.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div className="faq-section">
              <h2>پرسش‌های پرتکرار</h2>
              {seo.faqs.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
            {seo.links.length > 0 && (
              <div className="related-box">
                <div>
                  <strong>لینک‌های مرتبط</strong>
                  <div className="related-links">
                    {seo.links.map((l) => (
                      <a key={l.href} href={l.href}>
                        {l.label} <ArrowLeft size={14} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
