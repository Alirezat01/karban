import React, { useEffect, useMemo, useState } from 'react';
import { useSEO } from '@/lib/useSEO';

import { ArrowLeft, Calculator, CircleHelp, MessageCircle, Check } from 'lucide-react';
import { legalConfig } from '@/data/config';
import { supabase } from '@/lib/supabase';
import { formatFa, formatPriceFa } from '@/lib/format';

type CalculatorType = 'salary' | 'hire' | 'severance' | 'retirement' | 'overtime';
type Props = { type: CalculatorType; title: string; description: string };
const format = (value: number) => new Intl.NumberFormat('fa-IR').format(Math.max(0, Math.round(value)));

type SalarySettings = {
  year?: string; baseSalaryDaily?: number; housingAllowanceMonthly?: number; foodAllowanceMonthly?: number;
  insuranceEmployeeRate?: number; insuranceEmployerRate?: number; annualTaxFree?: number; familyAllowanceMonthly?: number; childAllowanceMonthly?: number; overtimeRate?: number;
};

export default function CalculatorPage({
  useSEO('محاسبه‌گر حقوق و مزایا ۱۴۰۵ | کاربان', 'ابزار دقیق محاسبه حقوق، دستمزد، اضافه‌کاری، سنوات و بیمه ۱۴۰۵ بر اساس آخرین تغییرات قانون کار ایران.'); type, title, description }: Props) {
  const [salary, setSalary] = useState(120000000);
  const [days, setDays] = useState(30);
  const [years, setYears] = useState(3);
  const [hours, setHours] = useState(10);
  const [age, setAge] = useState(35);
  const [insuredYears, setInsuredYears] = useState(8);
  const [calculated, setCalculated] = useState(false);

  const [isMarried, setIsMarried] = useState(false);
  const [childrenCount, setChildrenCount] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [absenceHours, setAbsenceHours] = useState(0);
  const [bonuses, setBonuses] = useState(0);

  const [cfg, setCfg] = useState(legalConfig);
  useEffect(() => {
    let active = true;
    supabase.from('settings').select('value').eq('key', 'salary_1405').maybeSingle().then(({ data }) => {
      if (!active || !data) return;
      const s = data.value as SalarySettings;
      setCfg({
        year: s.year ?? legalConfig.year,
        baseSalaryDaily: s.baseSalaryDaily ?? legalConfig.baseSalaryDaily,
        housingAllowanceMonthly: s.housingAllowanceMonthly ?? legalConfig.housingAllowanceMonthly,
        foodAllowanceMonthly: s.foodAllowanceMonthly ?? legalConfig.foodAllowanceMonthly,
        insuranceEmployeeRate: s.insuranceEmployeeRate ?? legalConfig.insuranceEmployeeRate,
        insuranceEmployerRate: s.insuranceEmployerRate ?? legalConfig.insuranceEmployerRate,
        annualTaxFree: s.annualTaxFree ?? legalConfig.annualTaxFree,
        taxBrackets: legalConfig.taxBrackets,
        familyAllowanceMonthly: s.familyAllowanceMonthly ?? 5000000,
        childAllowanceMonthly: s.childAllowanceMonthly ?? (legalConfig.baseSalaryDaily * 3),
        overtimeRate: s.overtimeRate ?? 1.4
      } as any);
    });
    return () => { active = false; };
  }, []);

  const results = useMemo(() => {
    const base = (cfg.baseSalaryDaily * days);
    const food = (cfg.foodAllowanceMonthly * days) / 30;
    const housing = (cfg.housingAllowanceMonthly * days) / 30;
    const family = isMarried ? (cfg as any).familyAllowanceMonthly : 0;
    const child = childrenCount * (cfg as any).childAllowanceMonthly;
    const overtime = (base / 220) * (cfg as any).overtimeRate * overtimeHours;
    const absence = (base / 220) * absenceHours;
    const severanceMonthly = (base / 12) * years;

    const subjectToInsurance = base + food + housing + overtime + bonuses;
    const insurance = subjectToInsurance * cfg.insuranceEmployeeRate;

    const gross = subjectToInsurance + family + child + severanceMonthly - absence;

    const taxable = Math.max(0, gross - (cfg.annualTaxFree / 12));
    let tax = taxable > 0 ? taxable * 0.1 : 0;

    const net = gross - insurance - tax;

    let res = 0;
    if (type === 'salary') res = net;
    else if (type === 'hire') res = salary * (1 + cfg.insuranceEmployerRate);
    else if (type === 'severance') res = salary / 30 * days * years;
    else if (type === 'overtime') res = salary / 220 * 1.4 * hours;
    else res = Math.max(0, age + insuredYears >= 60 ? salary * 0.9 : salary * 0.6);

    return {
        base, food, housing, family, child, overtime, absence, severanceMonthly, insurance, tax, gross, net, res
    };
  }, [type, salary, days, years, hours, age, insuredYears, cfg, isMarried, childrenCount, overtimeHours, absenceHours, bonuses]);

  const salaryPart = type === 'salary' ? Math.max(10, Math.min(80, (salary / 300000000) * 100)) : 60; const insurancePart = type === 'salary' ? 7 : 20; const taxPart = Math.max(5, 100 - salaryPart - insurancePart);
  const range = (label: string, value: number, setValue: (value: number) => void, min: number, max: number, step: number) => <label className="range-field">{label}<strong>{formatFa(value)}</strong><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => { setValue(Number(event.target.value)); setCalculated(false); }} /><input type="number" value={value} onChange={(event) => { setValue(Number(event.target.value)); setCalculated(false); }} /></label>;
  const faqData: Record<CalculatorType, { intro: string; faqs: [string, string][] }> = {
    salary: { intro: 'اضافه‌کاری هر ساعت ۴۰٪ بالاتر از مزد عادی است (ماده ۵۹ قانون کار). کسورات شامل بیمه ۷٪ سهم کارگر و مالیات بر اساس پلکان معافیت سالانه محاسبه می‌شود.', faqs: [['بیمه سهم کارگر چند درصد است؟', '۷ درصد از مزد پایه به‌عنوان سهم بیمه کارگر کسر می‌شود (ماده ۳۷ قانون تأمین اجتماعی).'], ['مالیات چگونه محاسبه می‌شود؟', 'بر اساس پلکان معافیت سالانه؛ سقف معافیت ۱۴۰۵ معادل ۲۸۸ میلیون تومان است و نرخ‌های ۱۰ تا ۳۰ درصد پلکانی اعمال می‌شود.'], ['اضافه‌کاری چه نرخی دارد؟', 'هر ساعت اضافه‌کاری معادل ۱۴۰٪ مزد عادی ساعتی است (ماده ۵۹ قانون کار).']] },
    severance: { intro: 'سنوات پایان خدمت به هر علت از جمله استعفا تعلق می‌گیرد (ماده ۲۴ قانون کار: «به هر علت»). سنوات مشمول کسر بیمه نیست و فرمول آن: هر سال سابقه معادل یک ماه آخرین مزد.', faqs: [['با استعفا هم سنوات می‌گیرم؟', 'بله، ماده ۲۴ قانون کار صراحتاً بیان می‌کند سنوات «به هر علت» تعلق می‌گیرد.'], ['سنوات مشمول کسر بیمه است؟', 'خیر، سنوات پایان خدمت مشمول کسر بیمه تأمین اجتماعی نیست.'], ['فرمول محاسبه سنوات چیست؟', 'هر سال سابقه کار معادل یک ماه آخرین مزد پایه است.']] },
    retirement: { intro: 'مسیرهای بازنشستگی شامل ۶۰ سال سن با ۲۰ سال سابقه، هر سن با ۳۰ سال سابقه، یا ۳۵ سال سابقه بدون شرط سن است (ماده ۷۶). مستمری از متوسط ۹۰ روز آخر × ۱/۳۰ به ازای هر سال سابقه محاسبه می‌شود (ماده ۷۷). کارهای سخت و زیان‌آور: ۲۰ سال متوالی یا ۲۵ سال متناوب بدون شرط سن.', faqs: [['شرط سن بازنشستگی چیست؟', '۶۰ سال سن با حداقل ۲۰ سال سابقه، یا بدون شرط سن با ۳۵ سال سابقه (ماده ۷۶).'], ['مستمری چگونه محاسبه می‌شود؟', 'متوسط ۹۰ روز آخر مزد × ۳۰/۱ به ازای هر سال سابقه بیمه (ماده ۷۷).'], ['کارهای سخت و زیان‌آور چه شرطی دارند؟', '۲۰ سال متوالی یا ۲۵ سال متناوب سابقه بدون شرط سن کافی است.']] },
    hire: { intro: 'بیمه بیکاری ۳٪ بر دوش کارفرماست. فرمول سرانگشتی هزینه واقعی استخدام: پایه حقوق × ۱٫۳۵ تا ۱٫۴ شامل سهم بیمه کارفرما ۲۳٪، بیمه بیکاری ۳٪ و مزایا.', faqs: [['بیمه بیکاری چند درصد است؟', '۳ درصد از مزد که تماماً بر عهده کارفرماست.'], ['هزینه واقعی استخدام چقدر است؟', 'تقریباً ۱٫۳۵ تا ۱٫۴ برابر مزد پایه، شامل سهم بیمه کارفرما و مزایای قانونی.'], ['سهم بیمه کارفرما چند درصد است؟', '۲۳ درصد از مزد پایه به‌عنوان سهم بیمه تأمین اجتماعی کارفرما.']] },
    overtime: { intro: 'اضافه‌کاری هر ساعت ۴۰٪ بالاتر از مزد عادی محاسبه می‌شود (ماده ۵۹ قانون کار). مزد ساعتی از تقسیم مزد ماهانه بر ۲۲۰ ساعت به‌دست می‌آید.', faqs: [['نرخ اضافه‌کاری چیست؟', 'هر ساعت اضافه‌کاری معادل ۱۴۰٪ مزد عادی ساعتی است (ماده ۵۹).'], ['مزد ساعتی چگونه محاسبه می‌شود؟', 'مزد ماهانه تقسیم بر ۲۲۰ ساعت کار استاندارد ماهانه.'], ['حداکثر اضافه‌کاری مجاز چقدر است؟', 'حداکثر ۴۴ ساعت اضافه‌کاری در ماه با رعایت شرط‌های قانون کار مجاز است.']] },
  };
  const content = faqData[type];
  return <section className="inner-page calculator-page"><div className="container calc-layout"><div className="calc-copy"><span className="eyebrow">ابزارهای کاربان · قانون کار {cfg.year}</span><h1>{title}</h1><p className="lead">{description}</p><div className="education"><h2>قبل از محاسبه بدانید</h2><p>{content.intro}</p></div><div className="faq"><h2>پرسش‌های متداول</h2>{content.faqs.map(([q, a]) => <details key={q}><summary>{q}<CircleHelp size={16} /></summary><p>{a}</p></details>)}</div></div><div className="calculator-card"><div className="calc-card-head"><Calculator /><span>محاسبه‌گر {cfg.year}</span></div>

  {type === 'salary' ? (
      <>
        {range('روزهای کارکرد', days, setDays, 1, 31, 1)}
        <label className="range-field" style={{flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
          <input type="checkbox" checked={isMarried} onChange={(e) => { setIsMarried(e.target.checked); setCalculated(false); }} />
          <span>تأهل</span>
        </label>
        {range('تعداد فرزند', childrenCount, setChildrenCount, 0, 10, 1)}
        {range('ساعات اضافه‌کاری', overtimeHours, setOvertimeHours, 0, 120, 1)}
        {range('ساعات کسری', absenceHours, setAbsenceHours, 0, 120, 1)}
        {range('پاداش و مزایا (ریال)', bonuses, setBonuses, 0, 500000000, 1000000)}
        {range('سابقه (سال)', years, setYears, 0, 30, 1)}
      </>
  ) : (
      <>
        {range('حقوق یا درآمد ماهانه (ریال)', salary, setSalary, 30000000, 300000000, 1000000)}
        {type === 'severance' && <>{range('روزهای کارکرد', days, setDays, 1, 31, 1)}{range('سابقه (سال)', years, setYears, 1, 30, 1)}</>}
        {type === 'overtime' && range('ساعات اضافه‌کاری', hours, setHours, 1, 100, 1)}
        {type === 'retirement' && <>{range('سن فعلی', age, setAge, 18, 70, 1)}{range('سابقه بیمه (سال)', insuredYears, setInsuredYears, 1, 40, 1)}</>}
      </>
  )}

  {type === 'salary' && <div className="calc-hints"><span>سهم بیمه کارمند: ۷٪</span><span>سهم بیمه کارفرما: ۲۳٪</span></div>}<button className="button full-button calculate-button" type="button" onClick={() => setCalculated(true)}>محاسبه نتیجه <ArrowLeft size={17} /></button><div className={`result-layout ${calculated ? 'result-visible' : ''}`}><div className="pie-chart" style={{ background: `conic-gradient(#0F5132 0 ${salaryPart}%, #C9A227 ${salaryPart}% ${salaryPart + insurancePart}%, #12344D ${salaryPart + insurancePart}% 100%)` }} />

  <div className="result-box">
      {type === 'salary' ? (
          <div className="feedback-success" style={{flexDirection: 'column', alignItems: 'flex-start', width: '100%', boxSizing: 'border-box'}}>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', width: '100%'}}>
                  <Check size={16} /> <strong>دریافتی خالص: {formatPriceFa(results.net)}</strong>
              </div>
              <ul style={{fontSize: '0.85rem', width: '100%', lineHeight: '1.8'}}>
                  <li>پایه: {formatPriceFa(results.base)}</li>
                  <li>بن: {formatPriceFa(results.food)}</li>
                  <li>مسکن: {formatPriceFa(results.housing)}</li>
                  <li>عائله‌مندی: {formatPriceFa(results.family)}</li>
                  <li>اولاد: {formatPriceFa(results.child)}</li>
                  <li>اضافه‌کاری: {formatPriceFa(results.overtime)}</li>
                  <li>سنوات ماهانه: {formatPriceFa(results.severanceMonthly)}</li>
                  <li>پاداش: {formatPriceFa(bonuses)}</li>
                  <li style={{color: '#d93025'}}>کسری: {formatPriceFa(results.absence)}</li>
                  <li style={{color: '#d93025'}}>بیمه: {formatPriceFa(results.insurance)}</li>
                  <li style={{color: '#d93025'}}>مالیات: {formatPriceFa(results.tax)}</li>
              </ul>
          </div>
      ) : (
          <>
            <span>برآورد شما</span><strong>{formatPriceFa(results.res)}</strong>
            <div className="result-legend"><span><i className="legend-salary" />حقوق</span><span><i className="legend-insurance" />بیمه</span><span><i className="legend-tax" />مالیات</span></div>
          </>
      )}
  </div></div><a className="button full-button" href="/خدمات">مشاوره مرتبط <MessageCircle size={17} /></a></div></div></section>;
}
