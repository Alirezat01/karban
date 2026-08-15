import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, CircleHelp, MessageCircle } from 'lucide-react';
import { legalConfig } from '@/data/config';
import { supabase } from '@/lib/supabase';
import { formatRial, formatFaNumber } from '@/lib/format';

type CalculatorType = 'salary' | 'hire' | 'severance' | 'retirement' | 'overtime';
type Props = { type: CalculatorType; title: string; description: string };

type SalarySettings = {
  year?: string;
  baseSalaryDaily?: number;
  housingAllowanceMonthly?: number;
  foodAllowanceMonthly?: number;
  familyAllowanceMonthly?: number;
  childAllowanceMonthly?: number;
  overtimeMultiplier?: number;
  insuranceEmployeeRate?: number;
  insuranceEmployerRate?: number;
  insuranceRate?: number;
  annualTaxFree?: number;
  taxExemptionMonthly?: number;
};

const money = (value: number) => formatRial(Math.max(0, Math.round(value)));

export default function CalculatorPage({ type, title, description }: Props) {
  const [salary, setSalary] = useState(120000000);
  const [daysWorked, setDaysWorked] = useState(30);
  const [married, setMarried] = useState(true);
  const [children, setChildren] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(10);
  const [shortageDays, setShortageDays] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [seniorityYears, setSeniorityYears] = useState(3);
  const [hireFactor, setHireFactor] = useState(1);
  const [years, setYears] = useState(3);
  const [hours, setHours] = useState(10);
  const [age, setAge] = useState(35);
  const [insuredYears, setInsuredYears] = useState(8);
  const [calculated, setCalculated] = useState(false);
  const [cfg, setCfg] = useState(legalConfig);

  useEffect(() => {
    let active = true;
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'salary_1405')
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const s = data.value as SalarySettings;
        setCfg({
          year: s.year ?? legalConfig.year,
          baseSalaryDaily: s.baseSalaryDaily ?? legalConfig.baseSalaryDaily,
          housingAllowanceMonthly: s.housingAllowanceMonthly ?? legalConfig.housingAllowanceMonthly,
          foodAllowanceMonthly: s.foodAllowanceMonthly ?? legalConfig.foodAllowanceMonthly,
          familyAllowanceMonthly: s.familyAllowanceMonthly ?? legalConfig.familyAllowanceMonthly,
          childAllowanceMonthly: s.childAllowanceMonthly ?? legalConfig.childAllowanceMonthly,
          overtimeMultiplier: s.overtimeMultiplier ?? legalConfig.overtimeMultiplier,
          insuranceEmployeeRate: s.insuranceEmployeeRate ?? legalConfig.insuranceEmployeeRate,
          insuranceEmployerRate: s.insuranceEmployerRate ?? legalConfig.insuranceEmployerRate,
          insuranceRate: s.insuranceRate ?? legalConfig.insuranceRate,
          annualTaxFree: s.annualTaxFree ?? legalConfig.annualTaxFree,
          taxExemptionMonthly: s.taxExemptionMonthly ?? legalConfig.taxExemptionMonthly,
        });
      });
    return () => {
      active = false;
    };
  }, []);

  const calculation = useMemo(() => {
    const dailyBase = cfg.baseSalaryDaily || 0;
    const basePay = dailyBase * daysWorked;
    const housing = cfg.housingAllowanceMonthly || 0;
    const food = cfg.foodAllowanceMonthly || 0;
    const family = married ? cfg.familyAllowanceMonthly || 0 : 0;
    const childSupport = children * (cfg.childAllowanceMonthly || 0);
    const seniorityBonus = basePay * Math.min(0.2, seniorityYears * 0.01);
    const overtime = overtimeHours * ((salary / 220) * (cfg.overtimeMultiplier || 1.4));
    const shortage = shortageDays * dailyBase;
    const gross = basePay + housing + food + family + childSupport + seniorityBonus + overtime + bonus - shortage;
    const insurance = gross * (cfg.insuranceRate ?? cfg.insuranceEmployeeRate ?? 0.07);
    const annualAdjusted = gross * 12;
    const taxBase = Math.max(0, annualAdjusted - (cfg.annualTaxFree || 0));
    const tax = taxBase * 0.1 / 12;
    const net = gross - insurance - tax;
    return { basePay, housing, food, family, childSupport, seniorityBonus, overtime, shortage, bonus, gross, insurance, tax, net };
  }, [bonus, children, cfg, daysWorked, married, overtimeHours, seniorityYears, shortageDays, salary]);

  const salaryPart = type === 'salary' ? Math.max(10, Math.min(80, (salary / 300000000) * 100)) : 60;
  const insurancePart = type === 'salary' ? 7 : 20;
  const taxPart = Math.max(5, 100 - salaryPart - insurancePart);

  const range = (label: string, value: number, setValue: (value: number) => void, min: number, max: number, step: number) => (
    <label className="range-field">
      {label}
      <strong>{formatFaNumber(value)}</strong>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          setValue(Number(event.target.value));
          setCalculated(false);
        }}
      />
      <input
        type="number"
        value={value}
        onChange={(event) => {
          setValue(Number(event.target.value));
          setCalculated(false);
        }}
      />
    </label>
  );

  const faqData: Record<CalculatorType, { intro: string; faqs: [string, string][] }> = {
    salary: {
      intro: 'این محاسبه‌گر بر اساس پارامترهای سال ۱۴۰۵ و اطلاعات ورودی شما، یک برآورد سریع و قابل فهم ارائه می‌کند.',
      faqs: [
        ['بیمه چند درصد است؟', 'سهم بیمه کارگر ۷٪ در نظر گرفته شده و با تنظیمات سالانه از پنل مدیریت قابل تغییر است.'],
        ['مالیات چگونه حساب می‌شود؟', 'از معافیت سالانه و نرخ تقریبی پلکانی استفاده می‌شود تا نتیجه‌ای نزدیک به واقعیت بگیرید.'],
        ['اضافه‌کاری چگونه محاسبه می‌شود؟', 'نرخ اضافه‌کاری با ضریب ۱.۴ و بر اساس دستمزد ساعتی برآورد می‌شود.'],
      ],
    },
    severance: {
      intro: 'سنوات پایان خدمت برای هر سال سابقه معادل یک ماه آخرین مزد است و می‌تواند به‌صورت تقریبی محاسبه شود.',
      faqs: [
        ['با استعفا هم سنوات می‌گیرم؟', 'بله، در بسیاری از حالت‌ها سنوات به کارگر تعلق می‌گیرد و به علت پایان همکاری وابسته است.'],
        ['سنوات مشمول بیمه است؟', 'خیر، سنوات پایان خدمت معمولاً جزو کسورات بیمه قرار نمی‌گیرد.'],
        ['فرمول ساده چیست؟', 'هر سال سابقه را در یک ماه آخرین مزد ضرب کنید.'],
      ],
    },
    retirement: {
      intro: 'مسیرهای بازنشستگی و مستمری به سن، سابقه و شرایط شغلی وابسته‌اند و این ابزار یک برآورد اولیه می‌دهد.',
      faqs: [
        ['شرط سن چیست؟', 'بسته به سابقه و نوع شغل، شرایط متفاوت است و باید با آخرین مقررات تطبیق داده شود.'],
        ['مستمری چگونه محاسبه می‌شود؟', 'بر مبنای میانگین دستمزد و سابقه بیمه، برآورد اولیه انجام می‌شود.'],
        ['کارهای سخت و زیان‌آور چه می‌شوند؟', 'این موارد قواعد ویژه دارند و نتیجه‌ی نهایی باید با مقررات همان سال کنترل شود.'],
      ],
    },
    hire: {
      intro: 'هزینه استخدام فقط حقوق نیست؛ بیمه، مزایا و تعهدات کارفرما نیز در محاسبه‌ی واقعی نقش دارند.',
      faqs: [
        ['سهم بیمه کارفرما چند درصد است؟', 'سهم کارفرما در این مدل ۲۳٪ از مزد پایه در نظر گرفته می‌شود.'],
        ['هزینه واقعی استخدام چیست؟', 'حقوق پایه به‌علاوه‌ی سهم بیمه و مزایای مرتبط، عدد واقعی را می‌سازد.'],
        ['چطور به عدد دقیق‌تر برسم؟', 'پارامترهای سال و مزایا را از تنظیمات پنل به‌روز نگه دارید.'],
      ],
    },
    overtime: {
      intro: 'اضافه‌کاری با ضریب ۱.۴ محاسبه می‌شود و دستمزد ساعتی از تقسیم مزد ماهانه بر ۲۲۰ ساعت به دست می‌آید.',
      faqs: [
        ['نرخ اضافه‌کاری چیست؟', 'هر ساعت اضافه‌کاری معادل ۱۴۰٪ مزد عادی ساعتی است.'],
        ['مزد ساعتی چگونه حساب می‌شود؟', 'مزد ماهانه استاندارد بر ۲۲۰ ساعت تقسیم می‌شود.'],
        ['حداکثر اضافه‌کاری مجاز چقدر است؟', 'عدد نهایی باید با ضوابط سازمانی و مقررات سالانه تطبیق داده شود.'],
      ],
    },
  };

  const content = faqData[type];

  const renderSalaryOutput = () => (
    <div className={`salary-output ${calculated ? 'is-visible' : ''}`}>
      <div className="salary-output-head">
        <span>خروجی itemized</span>
        <strong>{money(calculation.net)}</strong>
      </div>
      <div className="salary-output-list">
        <div><span>حقوق پایه</span><b>{money(calculation.basePay)}</b></div>
        <div><span>بن و مزایا</span><b>{money(calculation.food + calculation.housing + calculation.family + calculation.childSupport)}</b></div>
        <div><span>اضافه‌کاری</span><b>{money(calculation.overtime)}</b></div>
        <div><span>پاداش</span><b>{money(calculation.bonus)}</b></div>
        <div><span>سنوات/سابقه</span><b>{money(calculation.seniorityBonus)}</b></div>
        <div><span>کسری</span><b>-{money(calculation.shortage)}</b></div>
        <div><span>بیمه</span><b>-{money(calculation.insurance)}</b></div>
        <div><span>مالیات</span><b>-{money(calculation.tax)}</b></div>
      </div>
      <div className="salary-output-foot">
        <span>حقوق خالص</span>
        <strong>{money(calculation.net)}</strong>
      </div>
    </div>
  );

  return (
    <section className="inner-page calculator-page">
      <div className="container calc-layout">
        <div className="calc-copy">
          <span className="eyebrow">ابزارهای کاربان · قانون کار {cfg.year}</span>
          <h1>{title}</h1>
          <p className="lead">{description}</p>
          <div className="education">
            <h2>قبل از محاسبه بدانید</h2>
            <p>{content.intro}</p>
          </div>
          <div className="faq">
            <h2>پرسش‌های متداول</h2>
            {content.faqs.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <CircleHelp size={16} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="calculator-card">
          <div className="calc-card-head">
            <Calculator />
            <span>محاسبه‌گر {cfg.year}</span>
          </div>

          {range('حقوق یا درآمد ماهانه (تومان)', salary, setSalary, 30000000, 300000000, 1000000)}

          {type === 'salary' && (
            <>
              {range('روز کارکرد', daysWorked, setDaysWorked, 1, 31, 1)}
              <label className="switch-field">
                <span>تأهل</span>
                <button type="button" className={married ? 'active' : ''} onClick={() => setMarried(true)}>
                  متأهل
                </button>
                <button type="button" className={!married ? 'active' : ''} onClick={() => setMarried(false)}>
                  مجرد
                </button>
              </label>
              {range('تعداد فرزند', children, setChildren, 0, 10, 1)}
              {range('اضافه‌کاری (ساعت)', overtimeHours, setOvertimeHours, 0, 120, 1)}
              {range('کسری (روز)', shortageDays, setShortageDays, 0, 31, 1)}
              {range('پاداش', bonus, setBonus, 0, 50000000, 500000)}
              {range('سابقه (سال)', seniorityYears, setSeniorityYears, 0, 30, 1)}
            </>
          )}

          {type === 'severance' && (
            <>
              {range('روزهای کارکرد', daysWorked, setDaysWorked, 1, 31, 1)}
              {range('سابقه (سال)', years, setYears, 1, 30, 1)}
            </>
          )}

          {type === 'overtime' && range('ساعات اضافه‌کاری', hours, setHours, 1, 100, 1)}

          {type === 'retirement' && (
            <>
              {range('سن فعلی', age, setAge, 18, 70, 1)}
              {range('سابقه بیمه (سال)', insuredYears, setInsuredYears, 1, 40, 1)}
            </>
          )}

          {type === 'hire' && range('ضریب استخدام', hireFactor, setHireFactor, 1, 3, 0.1)}

          {type === 'salary' && (
            <div className="calc-hints">
              <span>سهم بیمه کارگر: ۷٪</span>
              <span>ضریب اضافه‌کاری: {cfg.overtimeMultiplier?.toFixed(1) || '۱.۴'}</span>
              <span>عائله‌مندی و اولاد بر اساس تنظیمات</span>
            </div>
          )}

          <button
            className="button full-button calculate-button"
            type="button"
            onClick={() => {
              setCalculated(true);
            }}
          >
            محاسبه نتیجه <ArrowLeft size={17} />
          </button>

          {type === 'salary' ? (
            renderSalaryOutput()
          ) : (
            <div className={`result-box result-box-green ${calculated ? 'result-visible' : ''}`}>
              <span>برآورد شما</span>
              <strong>
                {money(
                  type === 'hire'
                    ? salary * hireFactor
                    : type === 'severance'
                      ? (salary / 30) * daysWorked * years
                      : type === 'overtime'
                        ? (salary / 220) * (cfg.overtimeMultiplier || 1.4) * hours
                        : Math.max(0, age + insuredYears >= 60 ? salary * 0.9 : salary * 0.6),
                )}
                <small> ریال</small>
              </strong>
              <div className="result-legend">
                <span>
                  <i className="legend-salary" />
                  حقوق
                </span>
                <span>
                  <i className="legend-insurance" />
                  بیمه
                </span>
                <span>
                  <i className="legend-tax" />
                  مالیات
                </span>
              </div>
            </div>
          )}

          <a className="button full-button" href="/خدمات">
            مشاوره مرتبط <MessageCircle size={17} />
          </a>
        </div>
      </div>
    </section>
  );
}

