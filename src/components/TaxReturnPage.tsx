/* ────────────────────────────────────────────────────────────
   TaxReturnPage — Phase 5.2/5.3
   ابزار کمک‌حساب اظهارنامه مالیات بر درآمد:
     • تشخیصی (اشخاص حقیقی)
     • عملکرد سالانه (اشخاص حقوقی)
   محاسبه سود مشمول، کسورات، معافیت، مالیات پلکانی
   و خروجی XML مطابق فرمت اداره مالیات (به‌زودی)
   ──────────────────────────────────────────────────────────── */
import { useMemo, useState } from 'react';
import { Calculator, FileText, Info, Printer } from 'lucide-react';
import { formatRial, formatFaNumber } from '@/lib/format';
import FaNumberInput from '@/components/FaNumberInput';
import StepIndicator from '@/components/StepIndicator';

type Mode = 'diagnostic' | 'annual';
type Step = 'income' | 'deductions' | 'result';

const STEPS_DIAG = ['درآمد', 'کسورات', 'نتیجه'];
const STEPS_ANNUAL = ['درآمد سالانه', 'هزینه‌ها و کسورات', 'محاسبه مالیات'];

/* پله‌های مالیات اشخاص حقیقی ۱۴۰۵ (ماده ۱۳۱) */
const BRACKETS_INDIVIDUAL = [
  { up: 600_000_000, rate: 0.05 },       /* تا ۶۰۰ میلیون */
  { up: 1_800_000_000, rate: 0.10 },     /* ۶۰۰M تا ۱۸۰۰M */
  { up: 3_600_000_000, rate: 0.15 },     /* ۱۸۰۰M تا ۳۶۰۰M */
  { up: 7_200_000_000, rate: 0.20 },     /* ۳۶۰۰M تا ۷۲۰۰M */
  { up: 12_000_000_000, rate: 0.25 },    /* ۷۲۰۰M تا ۱۲B */
  { up: Infinity, rate: 0.30 },          /* بالای ۱۲B */
];
const EXEMPTION_INDIVIDUAL = 600_000_000; /* معافیت سالانه ۱۴۰۵ */

/* نرخ مالیات شرکت (ماده ۱۴۸ قانون مالیات‌های مستقیم) */
const TAX_RATE_CORP = 0.25;

export default function TaxReturnPage() {
  const [mode, setMode] = useState<Mode>('diagnostic');
  const [step, setStep] = useState<number>(0);

  /* فیلدهای درآمد */
  const [salesRevenue, setSalesRevenue] = useState(5_000_000_000);
  const [servicesRevenue, setServicesRevenue] = useState(0);
  const [otherRevenue, setOtherRevenue] = useState(0);
  const [previousLoss, setPreviousLoss] = useState(0);

  /* فیلدهای کسورات */
  const [costOfGoods, setCostOfGoods] = useState(2_500_000_000);
  const [salaries, setSalaries] = useState(1_000_000_000);
  const [operatingExpenses, setOperatingExpenses] = useState(500_000_000);
  const [depreciation, setDepreciation] = useState(200_000_000);
  const [interestPaid, setInterestPaid] = useState(0);
  const [donations, setDonations] = useState(0);
  const [taxesPaid, setTaxesPaid] = useState(0);

  const steps = mode === 'diagnostic' ? STEPS_DIAG : STEPS_ANNUAL;

  const result = useMemo(() => {
    const totalRevenue = salesRevenue + servicesRevenue + otherRevenue;
    const totalDeductions = costOfGoods + salaries + operatingExpenses + depreciation + interestPaid + donations + taxesPaid;
    const taxableBeforeLoss = Math.max(0, totalRevenue - totalDeductions);
    const taxableIncome = Math.max(0, taxableBeforeLoss - previousLoss);

    let tax = 0;
    let bracketsUsed: { range: string; amount: number; rate: number; tax: number }[] = [];

    if (mode === 'diagnostic') {
      /* اشخاص حقیقی — پلکانی با معافیت */
      const taxableAfterExemption = Math.max(0, taxableIncome - EXEMPTION_INDIVIDUAL);
      let rest = taxableAfterExemption;
      let prev = 0;
      for (const b of BRACKETS_INDIVIDUAL) {
        if (rest <= 0) break;
        const slice = Math.min(rest, b.up - prev);
        if (slice > 0) {
          const sliceTax = Math.round(slice * b.rate);
          bracketsUsed.push({
            range: prev === 0 ? `تا ${formatRial(b.up)}` : `${formatRial(prev)} تا ${b.up === Infinity ? 'بی‌نهایت' : formatRial(b.up)}`,
            amount: slice,
            rate: b.rate * 100,
            tax: sliceTax,
          });
          tax += sliceTax;
          rest -= slice;
        }
        prev = b.up;
      }
    } else {
      /* اشخاص حقوقی — نرخ ثابت ۲۵٪ */
      tax = Math.round(taxableIncome * TAX_RATE_CORP);
      bracketsUsed = [{
        range: 'کل درآمد مشمول',
        amount: taxableIncome,
        rate: TAX_RATE_CORP * 100,
        tax,
      }];
    }

    const finalTax = Math.max(0, tax - taxesPaid);
    const effectiveRate = taxableIncome > 0 ? Math.round((tax / taxableIncome) * 1000) / 10 : 0;

    return {
      totalRevenue, totalDeductions, taxableBeforeLoss, taxableIncome,
      bracketsUsed, tax, finalTax, effectiveRate,
    };
  }, [mode, salesRevenue, servicesRevenue, otherRevenue, previousLoss, costOfGoods, salaries, operatingExpenses, depreciation, interestPaid, donations, taxesPaid]);

  const canExportXML = result.tax > 0;

  const exportXML = () => {
    const year = 1404;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TaxReturn>
  <Year>${year}</Year>
  <Mode>${mode === 'diagnostic' ? 'Individual' : 'Corporate'}</Mode>
  <Income>
    <SalesRevenue>${salesRevenue}</SalesRevenue>
    <ServicesRevenue>${servicesRevenue}</ServicesRevenue>
    <OtherRevenue>${otherRevenue}</OtherRevenue>
    <TotalRevenue>${result.totalRevenue}</TotalRevenue>
  </Income>
  <Deductions>
    <CostOfGoods>${costOfGoods}</CostOfGoods>
    <Salaries>${salaries}</Salaries>
    <OperatingExpenses>${operatingExpenses}</OperatingExpenses>
    <Depreciation>${depreciation}</Depreciation>
    <InterestPaid>${interestPaid}</InterestPaid>
    <Donations>${donations}</Donations>
    <TaxesPaid>${taxesPaid}</TaxesPaid>
    <TotalDeductions>${result.totalDeductions}</TotalDeductions>
  </Deductions>
  <Calculation>
    <PreviousLoss>${previousLoss}</PreviousLoss>
    <TaxableIncome>${result.taxableIncome}</TaxableIncome>
    <TotalTax>${result.tax}</TotalTax>
    <EffectiveRate>${result.effectiveRate}</EffectiveRate>
    <FinalTaxPayable>${result.finalTax}</FinalTaxPayable>
  </Calculation>
</TaxReturn>`;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karban-tax-${mode}-${year}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="inner-page">
      <div className="container narrow-content">
        <span className="eyebrow"><Calculator size={14} /> ابزار مالیاتی · اظهارنامه درآمد</span>
        <h1>کمک‌حساب اظهارنامه مالیات بر درآمد</h1>
        <p className="lead">
          درآمد، هزینه‌ها و کسورات سالانه خود را وارد کنید تا مالیات مشمول، پله‌های مالیاتی و مالیات نهایی به‌صورت خودکار محاسبه شود. این ابزار برای اشخاص حقیقی (تشخیصی) و اشخاص حقوقی (عملکرد سالانه) قابل استفاده است.
        </p>

        <div className="contact-card calc-card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>نوع اظهارنامه</h3>
          <div className="auth-tabs">
            <button className={mode === 'diagnostic' ? 'is-active' : ''} onClick={() => { setMode('diagnostic'); setStep(0); }}>
              شخص حقیقی (تشخیصی)
            </button>
            <button className={mode === 'annual' ? 'is-active' : ''} onClick={() => { setMode('annual'); setStep(0); }}>
              شخص حقوقی (عملکرد سالانه)
            </button>
          </div>
        </div>

        <StepIndicator steps={steps} current={step} onStepClick={(i) => i < step && setStep(i)} />

        {/* مرحله ۱: درآمد */}
        {step === 0 && (
          <div className="contact-card calc-card wizard-step">
            <label>درآمد فروش کالا و خدمات (ریال)
              <FaNumberInput value={salesRevenue} onChange={setSalesRevenue} />
            </label>
            <label>درآمد خدمات حرفه‌ای (ریال)
              <FaNumberInput value={servicesRevenue} onChange={setServicesRevenue} />
            </label>
            <label>سایر درآمدها (سود بانکی، اجاره و...)
              <FaNumberInput value={otherRevenue} onChange={setOtherRevenue} />
            </label>
            <label>زیان سال‌های قبل (قابل انتقال)
              <FaNumberInput value={previousLoss} onChange={setPreviousLoss} />
            </label>
            <p className="muted-note">جمع درآمد ناخالص: {formatRial(salesRevenue + servicesRevenue + otherRevenue)}</p>
          </div>
        )}

        {/* مرحله ۲: کسورات */}
        {step === 1 && (
          <div className="contact-card calc-card wizard-step">
            <label>بهای تمام‌شده کالای فروش‌رفته (ریال)
              <FaNumberInput value={costOfGoods} onChange={setCostOfGoods} />
            </label>
            <label>حقوق و دستمزد پرداختی
              <FaNumberInput value={salaries} onChange={setSalaries} />
            </label>
            <label>هزینه‌های جاری (اجاره، آب، برق، تلفن و...)
              <FaNumberInput value={operatingExpenses} onChange={setOperatingExpenses} />
            </label>
            <label>استهلاک دارایی‌های ثابت
              <FaNumberInput value={depreciation} onChange={setDepreciation} />
            </label>
            <label>سود و بهره پرداختی (با تأیید بانک)
              <FaNumberInput value={interestPaid} onChange={setInterestPaid} />
            </label>
            <label>بخشایش و کمک‌های مالی (تا ۲۵٪ سود مشمول)
              <FaNumberInput value={donations} onChange={setDonations} />
            </label>
            <label>مالیات‌های پرداختی (از منبع)
              <FaNumberInput value={taxesPaid} onChange={setTaxesPaid} />
            </label>
            <p className="muted-note">جمع کسورات: {formatRial(costOfGoods + salaries + operatingExpenses + depreciation + interestPaid + donations + taxesPaid)}</p>
          </div>
        )}

        {/* مرحله ۳: نتیجه */}
        {step === 2 && (
          <div className="wizard-step">
            <div className="contact-card calc-card">
              <h2><FileText size={18} /> خلاصه محاسبه</h2>
              <table className="calc-table">
                <thead>
                  <tr><th>شرح</th><th>مبلغ (ریال)</th></tr>
                </thead>
                <tbody>
                  <tr><td>جمع درآمد ناخالص</td><td>{formatRial(result.totalRevenue)}</td></tr>
                  <tr className="is-minus"><td>جمع کسورات و هزینه‌ها</td><td>{formatRial(result.totalDeductions)}</td></tr>
                  <tr><td>سود قبل از کسر زیان انتقالی</td><td>{formatRial(result.taxableBeforeLoss)}</td></tr>
                  {previousLoss > 0 && <tr className="is-minus"><td>زیان سال‌های قبل</td><td>{formatRial(previousLoss)}</td></tr>}
                  <tr className="is-total"><td>درآمد مشمول مالیات</td><td>{formatRial(result.taxableIncome)}</td></tr>
                </tbody>
              </table>
            </div>

            {mode === 'diagnostic' && result.bracketsUsed.length > 0 && (
              <div className="contact-card calc-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>محاسبه پلکانی (ماده ۱۳۱)</h3>
                {result.bracketsUsed.map((b, i) => (
                  <div key={i} className="calc-bracket-row">
                    <span className="bracket-range">{b.range}</span>
                    <span className="bracket-amount">{formatRial(b.amount)}</span>
                    <span className="bracket-rate">{formatFaNumber(b.rate)}٪</span>
                    <span className="bracket-tax">{formatRial(b.tax)}</span>
                  </div>
                ))}
                {result.taxableIncome <= EXEMPTION_INDIVIDUAL && (
                  <p className="muted-note">درآمد مشمول شما زیر سقف معافیت سالانه ({formatRial(EXEMPTION_INDIVIDUAL)}) است؛ مالیات صفر.</p>
                )}
              </div>
            )}

            <div className="contact-card calc-card" style={{ marginTop: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>مالیات نهایی</h3>
              <div className="calc-summary">
                <div className="calc-summary-row">
                  <span>مالیات محاسبه‌شده</span>
                  <strong>{formatRial(result.tax)}</strong>
                </div>
                {taxesPaid > 0 && (
                  <div className="calc-summary-row is-minus">
                    <span>مالیات پرداختی (کسر می‌شود)</span>
                    <strong>{formatRial(taxesPaid)}</strong>
                  </div>
                )}
                <div className="calc-summary-row is-total">
                  <span>مالیات قابل پرداخت</span>
                  <strong>{formatRial(result.finalTax)}</strong>
                </div>
                <div className="calc-summary-row">
                  <span>نرخ مؤثر مالیاتی</span>
                  <strong>{formatFaNumber(result.effectiveRate)}٪</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button className="button" onClick={exportXML} disabled={!canExportXML}>
                  <FileText size={15} /> خروجی XML اظهارنامه
                </button>
                <button className="button button-outline" onClick={() => window.print()}>
                  <Printer size={15} /> چاپ
                </button>
              </div>
            </div>

            <div className="legal-box" style={{ marginTop: '1rem' }}>
              <h2><Info size={18} /> نکات مهم</h2>
              <ul>
                <li>این محاسبه برای پیش‌بینی است؛ ملاک نهایی، فرم رسمی اداره مالیات است.</li>
                <li>معافیت سالانه اشخاص حقیقی در ۱۴۰۵ برابر {formatRial(EXEMPTION_INDIVIDUAL)} است.</li>
                <li>اشخاص حقوقی با نرخ ثابت {formatFaNumber(TAX_RATE_CORP * 100)}٪ مالیات می‌پردازند (ماده ۱۴۸).</li>
                <li>زیان سال‌های قبل تا ۳ سال قابل انتقال است (ماده ۱۵۶).</li>
                <li>بخشایش تا سقف ۲۵٪ سود مشمول قابل کسر است (ماده ۱۴۷).</li>
                <li>برای اظهارنامه رسمی، با کارشناس مالیاتی کاربان مشاوره کنید.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ناوبری ویزارد */}
        <div className="wizard-nav" style={{ marginTop: '1.4rem' }}>
          {step > 0 && (
            <button className="button button-outline" onClick={() => setStep((s) => s - 1)}>
              مرحله قبل
            </button>
          )}
          {step < 2 ? (
            <button className="button" onClick={() => setStep((s) => s + 1)}>
              مرحله بعد
            </button>
          ) : (
            <button className="button button-outline" onClick={() => setStep(0)}>
              ویرایش مجدد
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
