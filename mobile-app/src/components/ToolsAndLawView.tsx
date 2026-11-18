import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  BookOpen,
  CheckSquare,
  HeartPulse,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import {
  LAW_ARTICLES,
  INITIAL_CHECKLISTS,
  LEGAL_CONFIG_1405,
  HEALTH_QUESTIONS_12,
  ChecklistDef,
  formatRial,
  formatToman,
  toFaDigits,
  formatFaNum,
} from '../lib/karbanData';
import { FaNumberInput } from './ui/PersianInputs';
import { PrintPreviewPdfModal, PrintDocumentPayload } from './PrintPreviewPdfModal';

export type ToolsSubTab = 'calculators' | 'tax_return' | 'health' | 'laws' | 'checklists';
export type CalcKind =
  | 'salary'
  | 'hire'
  | 'severance'
  | 'retirement'
  | 'overtime'
  | 'business_tax'
  | 'vat'
  | 'salary_tax'
  | 'eydi'
  | 'insurance'
  | 'leave'
  | 'termination'
  | 'company_reg';

interface ToolsAndLawViewProps {
  initialSubTab?: ToolsSubTab;
  signatureDataUrl?: string | null;
}

const CALC_OPTIONS: { id: CalcKind; label: string }[] = [
  { id: 'salary', label: 'حقوق و دستمزد' },
  { id: 'hire', label: 'هزینه استخدام' },
  { id: 'severance', label: 'سنوات پایان خدمت' },
  { id: 'retirement', label: 'بازنشستگی' },
  { id: 'overtime', label: 'اضافه‌کاری' },
  { id: 'business_tax', label: 'مالیات مشاغل' },
  { id: 'vat', label: 'ارزش افزوده ۱۰٪' },
  { id: 'salary_tax', label: 'مالیات حقوق' },
  { id: 'eydi', label: 'عیدی و پاداش' },
  { id: 'insurance', label: 'بیمه تأمین اجتماعی' },
  { id: 'leave', label: 'مانده مرخصی' },
  { id: 'termination', label: 'تسویه پایان همکاری' },
  { id: 'company_reg', label: 'ثبت شرکت و برند' },
];

export const ToolsAndLawView: React.FC<ToolsAndLawViewProps> = ({
  initialSubTab = 'calculators',
  signatureDataUrl = null,
}) => {
  const [subTab, setSubTab] = useState<ToolsSubTab>(initialSubTab);
  const [calcType, setCalcType] = useState<CalcKind>('salary');

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // Shared 1405 Salary / HR Inputs
  const [baseSalaryRial, setBaseSalaryRial] = useState<number>(LEGAL_CONFIG_1405.baseSalaryMonthly);
  const [housingAllowanceRial, setHousingAllowanceRial] = useState<number>(
    LEGAL_CONFIG_1405.housingAllowanceMonthly
  );
  const [groceryAllowanceRial, setGroceryAllowanceRial] = useState<number>(
    LEGAL_CONFIG_1405.foodAllowanceMonthly
  );
  const [married, setMarried] = useState(true);
  const [childrenCount, setChildrenCount] = useState(1);
  const [overtimeHours, setOvertimeHours] = useState(20);
  const [bonusRial, setBonusRial] = useState(0);
  const [deductionRial, setDeductionRial] = useState(0);

  // Additional Calculator Inputs (matching KarbanApp.ir 13 Calculators)
  const [workedYears, setWorkedYears] = useState(3);
  const [workedMonthsInYear, setWorkedMonthsInYear] = useState(12);
  const [workerAge, setWorkerAge] = useState(45);
  const [insuredYears, setInsuredYears] = useState(22);
  const [bizRevenueRial, setBizRevenueRial] = useState(5_000_000_000);
  const [bizExpensesRial, setBizExpensesRial] = useState(3_000_000_000);
  const [vatInputAmountRial, setVatInputAmountRial] = useState(1_000_000_000);
  const [vatMode, setVatMode] = useState<'add' | 'inside'>('add');
  const [insuredBaseRial, setInsuredBaseRial] = useState(150_000_000);
  const [earnedLeaveDays, setEarnedLeaveDays] = useState(26);
  const [usedLeaveDays, setUsedLeaveDays] = useState(14);
  const [companyType, setCompanyType] = useState<'private' | 'llp' | 'individual'>('private');
  const [hasBrand, setHasBrand] = useState(true);
  const [extraShares, setExtraShares] = useState(2);

  // Tax Return Wizard State (matching KarbanApp.ir TaxReturnPage.tsx)
  const [trMode, setTrMode] = useState<'diagnostic' | 'annual'>('diagnostic');
  const [trStep, setTrStep] = useState<0 | 1 | 2>(0);
  const [trTaxpayerName, setTrTaxpayerName] = useState('شرکت توسعه فناوری پارس سیستم');
  const [trSalesRev, setTrSalesRev] = useState(5_000_000_000);
  const [trServicesRev, setTrServicesRev] = useState(1_200_000_000);
  const [trOtherRev, setTrOtherRev] = useState(0);
  const [trPrevLoss, setTrPrevLoss] = useState(0);
  const [trCogs, setTrCogs] = useState(2_500_000_000);
  const [trSalaries, setTrSalaries] = useState(1_000_000_000);
  const [trOpex, setTrOpex] = useState(500_000_000);
  const [trDepreciation, setTrDepreciation] = useState(200_000_000);
  const [trDonations, setTrDonations] = useState(0);
  const [trPrintDoc, setTrPrintDoc] = useState<PrintDocumentPayload | null>(null);

  // Progressive 1405 Salary Calculation
  const salaryCalc = useMemo(() => {
    const hourlyRate = Math.round(baseSalaryRial / 192);
    const overtimePay = Math.round(overtimeHours * hourlyRate * LEGAL_CONFIG_1405.overtimeMultiplier);
    const maritalPay = married ? LEGAL_CONFIG_1405.familyAllowanceMonthly : 0;
    const childAllowance = childrenCount * LEGAL_CONFIG_1405.childAllowanceMonthly;
    const grossSalary =
      baseSalaryRial +
      housingAllowanceRial +
      groceryAllowanceRial +
      maritalPay +
      childAllowance +
      overtimePay +
      bonusRial;

    const insurableWages = Math.max(0, grossSalary - childAllowance);
    const workerInsurance7 = Math.round(insurableWages * LEGAL_CONFIG_1405.insuranceEmployeeRate);
    const employerInsurance23 = Math.round(insurableWages * LEGAL_CONFIG_1405.insuranceEmployerRate);

    // Progressive 1405 annual salary tax brackets
    const monthlyTaxable = Math.max(
      0,
      grossSalary - workerInsurance7 - LEGAL_CONFIG_1405.taxExemptionMonthly
    );
    const annualTaxable = monthlyTaxable * 12;
    let annualTax = 0;
    let rest = annualTaxable;
    let prevMax = 0;
    const rows: { label: string; amount: number }[] = [];
    for (const bracket of LEGAL_CONFIG_1405.salaryTaxBracketsAnnual) {
      if (rest <= 0) break;
      const cap =
        bracket.max === Number.POSITIVE_INFINITY
          ? Number.POSITIVE_INFINITY
          : Math.max(0, bracket.max - LEGAL_CONFIG_1405.annualSalaryTaxFree);
      const slice = Math.min(rest, cap - prevMax);
      if (slice > 0) {
        const t = Math.round(slice * bracket.rate);
        annualTax += t;
        rows.push({
          label: `پله ${toFaDigits(Math.round(bracket.rate * 100))}٪`,
          amount: Math.round(t / 12),
        });
      }
      rest -= Math.max(0, slice);
      prevMax = cap;
    }

    const incomeTax = Math.round(annualTax / 12);
    const netPayableToWorker = Math.max(0, grossSalary - workerInsurance7 - incomeTax - deductionRial);
    const totalEmployerCost = grossSalary + employerInsurance23;

    return {
      hourlyRate,
      overtimePay,
      maritalPay,
      childAllowance,
      grossSalary,
      workerInsurance7,
      employerInsurance23,
      monthlyTaxable,
      taxRows: rows,
      incomeTax,
      netPayableToWorker,
      totalEmployerCost,
    };
  }, [
    baseSalaryRial,
    housingAllowanceRial,
    groceryAllowanceRial,
    married,
    childrenCount,
    overtimeHours,
    bonusRial,
    deductionRial,
  ]);

  const hireResult = useMemo(() => {
    const insurable = baseSalaryRial + housingAllowanceRial + groceryAllowanceRial;
    const employerInsurance = Math.round(insurable * LEGAL_CONFIG_1405.insuranceEmployerRate);
    const monthlySeverance = Math.round(baseSalaryRial / 12);
    const monthlyEydi = Math.round((baseSalaryRial * 2) / 12);
    const totalMonthly = insurable + employerInsurance + monthlySeverance + monthlyEydi;
    return { employerInsurance, monthlySeverance, monthlyEydi, totalMonthly, yearly: totalMonthly * 12 };
  }, [baseSalaryRial, housingAllowanceRial, groceryAllowanceRial]);

  const severanceResult = useMemo(() => {
    const perYear = baseSalaryRial;
    const totalYearsPay = Math.round(baseSalaryRial * workedYears);
    const currentYearProRata = Math.round((baseSalaryRial * workedMonthsInYear) / 12);
    return { perYear, totalYearsPay, currentYearProRata };
  }, [baseSalaryRial, workedYears, workedMonthsInYear]);

  const retirementResult = useMemo(() => {
    const r = LEGAL_CONFIG_1405.retirement;
    const normal = workerAge >= r.minAge && insuredYears >= r.minYears;
    const early = workerAge >= r.altAge && insuredYears >= r.altYears;
    const full = insuredYears >= r.maxYears;
    const eligible = normal || early || full;
    const pension = Math.round(baseSalaryRial * Math.min(1, insuredYears / 30));
    return { normal, early, full, eligible, pension };
  }, [workerAge, insuredYears, baseSalaryRial]);

  const businessTaxResult = useMemo(() => {
    const profit = Math.max(0, bizRevenueRial - bizExpensesRial);
    const taxable = Math.max(0, profit - LEGAL_CONFIG_1405.businessTaxExemption);
    let rest = taxable;
    let prev = 0;
    const rows: { label: string; amount: number }[] = [];
    for (let i = 0; i < LEGAL_CONFIG_1405.businessTaxBrackets.length; i++) {
      if (rest <= 0) break;
      const b = LEGAL_CONFIG_1405.businessTaxBrackets[i];
      const slice = Math.min(rest, b.up - prev);
      if (slice > 0) {
        rows.push({
          label: `پله ${toFaDigits(i + 1)} (${toFaDigits(Math.round(b.rate * 100))}٪)`,
          amount: Math.round(slice * b.rate),
        });
      }
      rest -= slice;
      prev = b.up;
    }
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const effective = profit > 0 ? Math.round((total / profit) * 1000) / 10 : 0;
    return { profit, taxable, rows, total, effective };
  }, [bizRevenueRial, bizExpensesRial]);

  const vatResult = useMemo(() => {
    const rate = LEGAL_CONFIG_1405.vatRatePercent / 100;
    if (vatMode === 'add') {
      const vat = Math.round(vatInputAmountRial * rate);
      return { net: vatInputAmountRial, vat, gross: vatInputAmountRial + vat };
    }
    const net = Math.round(vatInputAmountRial / (1 + rate));
    return { net, vat: vatInputAmountRial - net, gross: vatInputAmountRial };
  }, [vatInputAmountRial, vatMode]);

  const eydiResult = useMemo(() => {
    const yearly = Math.round(baseSalaryRial * 2);
    const proRata = Math.round((yearly * Math.min(12, Math.max(1, workedMonthsInYear))) / 12);
    const monthlyReserve = Math.round(yearly / 12);
    return { yearly, proRata, monthlyReserve };
  }, [baseSalaryRial, workedMonthsInYear]);

  const insuranceResult = useMemo(() => {
    const worker7 = Math.round(insuredBaseRial * LEGAL_CONFIG_1405.insuranceEmployeeRate);
    const employer20 = Math.round(insuredBaseRial * LEGAL_CONFIG_1405.employerPensionRate);
    const unemployment3 = Math.round(insuredBaseRial * LEGAL_CONFIG_1405.employerUnemploymentRate);
    return {
      worker7,
      employer20,
      unemployment3,
      employerTotal23: employer20 + unemployment3,
      grandTotal30: worker7 + employer20 + unemployment3,
    };
  }, [insuredBaseRial]);

  const leaveResult = useMemo(() => {
    const perDay = Math.round(baseSalaryRial / 30);
    const remaining = Math.max(0, earnedLeaveDays - usedLeaveDays);
    return { perDay, remaining, value: remaining * perDay };
  }, [baseSalaryRial, earnedLeaveDays, usedLeaveDays]);

  const terminationResult = useMemo(() => {
    const severance = Math.round(baseSalaryRial * workedYears);
    const eydi = eydiResult.proRata;
    const leaveValue = leaveResult.value;
    return { severance, eydi, leaveValue, total: severance + eydi + leaveValue };
  }, [baseSalaryRial, workedYears, eydiResult.proRata, leaveResult.value]);

  const companyRegResult = useMemo(() => {
    const baseFees = { private: 1_700_000, llp: 1_500_000, individual: 500_000 };
    const regFee = baseFees[companyType];
    const notary = companyType === 'individual' ? 0 : 800_000;
    const gazette = companyType === 'individual' ? 0 : 350_000;
    const unionFee = companyType === 'individual' ? 200_000 : 600_000;
    const seal = companyType === 'individual' ? 0 : 450_000;
    const statCard = companyType === 'individual' ? 0 : 250_000;
    const extraShareFee = extraShares * 50_000;
    const brandReg = hasBrand ? 1_200_000 : 0;
    const attorneyFee = hasBrand ? 3_000_000 : 0;
    const total =
      regFee + notary + gazette + unionFee + seal + statCard + extraShareFee + brandReg + attorneyFee;
    return { regFee, notary, gazette, unionFee, seal, statCard, extraShareFee, brandReg, attorneyFee, total };
  }, [companyType, hasBrand, extraShares]);

  // Tax Return Result (TaxReturnPage.tsx logic)
  const taxReturnResult = useMemo(() => {
    const totalRevenue = trSalesRev + trServicesRev + trOtherRev;
    const totalDeductions = trCogs + trSalaries + trOpex + trDepreciation + trDonations;
    const taxableBeforeLoss = Math.max(0, totalRevenue - totalDeductions);
    const taxableIncome = Math.max(0, taxableBeforeLoss - trPrevLoss);

    let tax = 0;
    const bracketsUsed: { range: string; amount: number; rate: number; tax: number }[] = [];

    if (trMode === 'diagnostic') {
      const taxableAfterExemption = Math.max(0, taxableIncome - LEGAL_CONFIG_1405.individualTaxReturnExemption);
      let rest = taxableAfterExemption;
      let prev = 0;
      for (const b of LEGAL_CONFIG_1405.individualTaxReturnBrackets) {
        if (rest <= 0) break;
        const slice = Math.min(rest, b.up - prev);
        if (slice > 0) {
          const sliceTax = Math.round(slice * b.rate);
          bracketsUsed.push({
            range:
              prev === 0
                ? `تا ${formatToman(b.up)}`
                : `${formatToman(prev)} تا ${b.up === Infinity ? 'بالاتر' : formatToman(b.up)}`,
            amount: slice,
            rate: Math.round(b.rate * 100),
            tax: sliceTax,
          });
          tax += sliceTax;
        }
        rest -= slice;
        prev = b.up;
      }
    } else {
      tax = Math.round(taxableIncome * LEGAL_CONFIG_1405.corpTaxRate);
    }

    const effectiveRate = totalRevenue > 0 ? Math.round((tax / totalRevenue) * 1000) / 10 : 0;
    return { totalRevenue, totalDeductions, taxableBeforeLoss, taxableIncome, bracketsUsed, tax, effectiveRate };
  }, [trMode, trSalesRev, trServicesRev, trOtherRev, trPrevLoss, trCogs, trSalaries, trOpex, trDepreciation, trDonations]);

  // 12-Question Business Health Diagnostic
  const [healthAnswers, setHealthAnswers] = useState<Record<string, boolean>>({
    hq1: true,
    hq2: true,
    hq3: true,
    hq5: true,
    hq6: true,
    hq9: true,
    hq11: true,
    hq12: true,
  });

  const healthStats = useMemo(() => {
    const trues = HEALTH_QUESTIONS_12.filter((q) => !!healthAnswers[q.id]).length;
    const totalScore = Math.round((trues / HEALTH_QUESTIONS_12.length) * 100);
    const byArea = (['قراردادها', 'حقوق و بیمه', 'مالی و مالیات'] as const).map((area) => {
      const qs = HEALTH_QUESTIONS_12.filter((q) => q.area === area);
      const passed = qs.filter((q) => !!healthAnswers[q.id]).length;
      return { area, passed, total: qs.length, pct: Math.round((passed / qs.length) * 100) };
    });
    return { totalScore, byArea };
  }, [healthAnswers]);

  // Law Search & 5 Checklists
  const [lawSearch, setLawSearch] = useState('');
  const [checklists, setChecklists] = useState<ChecklistDef[]>(INITIAL_CHECKLISTS);

  const filteredLaws = useMemo(() => {
    if (!lawSearch.trim()) return LAW_ARTICLES;
    return LAW_ARTICLES.filter(
      (l) =>
        l.title.includes(lawSearch) ||
        l.text.includes(lawSearch) ||
        l.category.includes(lawSearch) ||
        l.articleNumber.includes(lawSearch)
    );
  }, [lawSearch]);

  const toggleChecklistStep = (listId: string, stepId: string) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === listId
          ? { ...c, steps: c.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) }
          : c
      )
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Top Nav */}
      <div className="crisp-card p-4 rounded-[26px] flex flex-col gap-3">
        <div>
          <h1 className="text-base font-black text-[#0F172A] dark:text-white">
            ۱۳ ماشین‌حساب ۱۴۰۵، اظهارنامه مالیاتی و بانک قوانین
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            منطبق با بخشنامه دستمزد و مالیات سال ۱۴۰۵ (نرخ‌های رسمی سایت کاربان)
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'calculators', label: '۱۳ ماشین‌حساب ۱۴۰۵', icon: Calculator },
            { id: 'tax_return', label: 'اظهارنامه مالیاتی', icon: FileSpreadsheet },
            { id: 'health', label: 'سنجش سلامت ۱۲گانه', icon: HeartPulse },
            { id: 'laws', label: 'کتابخانه قوانین', icon: BookOpen },
            { id: 'checklists', label: '۵ چک‌لیست اجرایی', icon: CheckSquare },
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id as ToolsSubTab)}
                className={`min-h-[40px] px-3.5 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1D4DF5] text-white shadow-md shadow-blue-600/25'
                    : 'bg-[#EFF1FA] dark:bg-[#1A223B] text-slate-600 dark:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: ALL 13 OFFICIAL 1405 CALCULATORS */}
      {subTab === 'calculators' && (
        <div className="space-y-3.5">
          {/* 13 Calculator Switcher Chips */}
          <div className="crisp-card p-3.5 rounded-[24px]">
            <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2">
              انتخاب ماشین‌حساب تخصصی (۱۳ ابزار فعال):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CALC_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCalcType(opt.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold transition-colors ${
                    calcType === opt.id
                      ? 'bg-[#1D4DF5] text-white shadow-sm'
                      : 'bg-[#EFF1FA] dark:bg-[#1A223B] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 1. Salary Calculator */}
          {(calcType === 'salary' || calcType === 'salary_tax') && (
            <div className="space-y-3.5">
              <div className="paper-card p-4 rounded-[28px] space-y-3">
                <h2 className="text-sm font-black text-[#0F172A] dark:text-white">
                  {calcType === 'salary' ? 'محاسبه جامع حقوق، بیمه و مالیات ۱۴۰۵' : 'محاسبه‌گر پلکانی مالیات حقوق ۱۴۰۵'}
                </h2>
                <FaNumberInput
                  label="حقوق و مزد مبنا ماهانه (پایه مصوب ۱۴۰۵: ۱۰۳٬۹۰۹٬۵۰۰ ریال)"
                  value={baseSalaryRial}
                  onChange={setBaseSalaryRial}
                  showTomanHint
                  quickChips={[
                    { label: 'حداقل مصوب ۱۴۰۵', value: LEGAL_CONFIG_1405.baseSalaryMonthly },
                    { label: '۲۰ میلیون ت', value: 200_000_000 },
                    { label: '۴۰ میلیون ت', value: 400_000_000 },
                  ]}
                />
                {calcType === 'salary' && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      <FaNumberInput label="حق مسکن (ریال)" value={housingAllowanceRial} onChange={setHousingAllowanceRial} />
                      <FaNumberInput label="بن خواربار (ریال)" value={groceryAllowanceRial} onChange={setGroceryAllowanceRial} />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <FaNumberInput label="تعداد فرزند" value={childrenCount} onChange={setChildrenCount} suffix="فرزند" max={10} />
                      <FaNumberInput label="اضافه‌کاری (ساعت)" value={overtimeHours} onChange={setOvertimeHours} suffix="ساعت" max={120} />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <FaNumberInput label="پاداش و مزایا (ریال)" value={bonusRial} onChange={setBonusRial} />
                      <FaNumberInput label="کسورات و مساعده (ریال)" value={deductionRial} onChange={setDeductionRial} />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-slate-200 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={married}
                        onChange={(e) => setMarried(e.target.checked)}
                        className="w-4 h-4 accent-violet-600"
                      />
                      <span>مشمول حق تأهل (۷٬۰۰۰٬۰۰۰ ریال ماهانه)</span>
                    </label>
                  </>
                )}
              </div>

              <div className="paper-card p-4 rounded-[28px] space-y-2.5 text-xs tabular-nums">
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span className="text-slate-500">جمع ناخالص حقوق و مزایا:</span>
                  <strong>{formatRial(salaryCalc.grossSalary)}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span className="text-rose-500">بیمه سهم کارگر (۷٪):</span>
                  <strong className="text-rose-500">{formatRial(salaryCalc.workerInsurance7)}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span className="text-slate-500">معافیت ماهانه مالیات حقوق ۱۴۰۵:</span>
                  <strong>{formatRial(LEGAL_CONFIG_1405.taxExemptionMonthly)}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span className="text-rose-500">مالیات پلکانی حقوق (۱۰٪ تا ۳۰٪):</span>
                  <strong className="text-rose-500">{formatRial(salaryCalc.incomeTax)}</strong>
                </div>
                {salaryCalc.taxRows.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-[11px] space-y-1">
                    {salaryCalc.taxRows.map((r) => (
                      <div key={r.label} className="flex justify-between">
                        <span>{r.label}:</span>
                        <span className="font-bold">{formatRial(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex justify-between items-center">
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-300">خالص پرداختی به کارمند:</span>
                  <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {formatToman(salaryCalc.netPayableToWorker)}
                  </strong>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FFFBEB] dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex justify-between items-center">
                  <span className="font-extrabold text-amber-700 dark:text-amber-300">هزینه کل کارفرما (با ۲۳٪ بیمه):</span>
                  <strong className="text-sm font-black text-amber-600 dark:text-[#608BFF]">
                    {formatToman(salaryCalc.totalEmployerCost)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* 2. Real Cost of Hiring */}
          {calcType === 'hire' && (
            <div className="paper-card p-4 rounded-[28px] space-y-3.5 text-xs tabular-nums">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white">برآورد هزینه واقعی استخدام ۱ نیروی جدید</h2>
              <FaNumberInput label="حقوق پایه توافقی ماهانه (ریال)" value={baseSalaryRial} onChange={setBaseSalaryRial} showTomanHint />
              <div className="space-y-2 pt-1">
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span>حق بیمه سهم کارفرما (۲۳٪ ماده ۲۸):</span>
                  <strong>{formatToman(hireResult.employerInsurance)}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span>ذخیره ماهانه سنوات (۱/۱۲ پایه):</span>
                  <strong>{formatToman(hireResult.monthlySeverance)}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span>ذخیره ماهانه عیدی (۲/۱۲ پایه):</span>
                  <strong>{formatToman(hireResult.monthlyEydi)}</strong>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#EFF1FA]0/10 flex justify-between items-center font-black">
                  <span>بهای تمام‌شده واقعی ماهانه:</span>
                  <span className="text-[#1D4DF5] dark:text-[#608BFF]">{formatToman(hireResult.totalMonthly)}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-500/10 flex justify-between items-center font-black">
                  <span>بودجه سالانه کل استخدام:</span>
                  <span className="text-amber-700 dark:text-amber-300">{formatToman(hireResult.yearly)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. Overtime Calculator */}
          {calcType === 'overtime' && (
            <div className="paper-card p-4 rounded-[28px] space-y-3.5 text-xs tabular-nums">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white">محاسبه اضافه‌کاری قانون کار (ماده ۵۹ · ضریب ۱٫۴)</h2>
              <FaNumberInput label="حقوق پایه ماهانه (ریال)" value={baseSalaryRial} onChange={setBaseSalaryRial} showTomanHint />
              <FaNumberInput label="مجموع ساعات اضافه‌کاری در ماه" value={overtimeHours} onChange={setOvertimeHours} suffix="ساعت" max={150} />
              <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                <span>نرخ هر ساعت عادی کارکرد (پایه ÷ ۱۹۲):</span>
                <strong>{formatRial(salaryCalc.hourlyRate)}</strong>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/10 flex justify-between items-center font-black">
                <span>مبلغ قابل پرداخت اضافه‌کاری:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatToman(salaryCalc.overtimePay)}</span>
              </div>
            </div>
          )}

          {/* 4. Severance / 5. Eydi / 6. Leave / 7. Termination */}
          {(calcType === 'severance' || calcType === 'eydi' || calcType === 'leave' || calcType === 'termination') && (
            <div className="paper-card p-4 rounded-[28px] space-y-3.5 text-xs tabular-nums">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white">
                {calcType === 'severance' && 'محاسبه سنوات پایان خدمت (ماده ۲۴)'}
                {calcType === 'eydi' && 'محاسبه عیدی و پاداش و پس‌انداز ماهانه'}
                {calcType === 'leave' && 'محاسبه مانده مرخصی و بازخرید نقدی (ماده ۶۴)'}
                {calcType === 'termination' && 'محاسبه یکجای تسویه‌حساب پایان همکاری'}
              </h2>
              <FaNumberInput label="حقوق مبنای ماهانه (ریال)" value={baseSalaryRial} onChange={setBaseSalaryRial} showTomanHint />
              {(calcType === 'severance' || calcType === 'termination') && (
                <FaNumberInput label="سابقه کار کل (سال)" value={workedYears} onChange={setWorkedYears} suffix="سال" min={1} max={35} />
              )}
              {(calcType === 'severance' || calcType === 'eydi') && (
                <FaNumberInput
                  label="ماه‌های کارکرد در سال جاری"
                  value={workedMonthsInYear}
                  onChange={(v) => setWorkedMonthsInYear(Math.max(1, v))}
                  suffix="ماه"
                  min={1}
                  max={12}
                />
              )}
              {(calcType === 'leave' || calcType === 'termination') && (
                <div className="grid grid-cols-2 gap-2.5">
                  <FaNumberInput label="مرخصی استحقاقی (روز)" value={earnedLeaveDays} onChange={setEarnedLeaveDays} suffix="روز" max={60} />
                  <FaNumberInput label="مرخصی استفاده‌شده" value={usedLeaveDays} onChange={setUsedLeaveDays} suffix="روز" max={60} />
                </div>
              )}

              <div className="space-y-2 pt-2">
                {calcType === 'severance' && (
                  <>
                    <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                      <span>سنوات به ازای کارکرد امسال ({formatFaNum(workedMonthsInYear)} ماه):</span>
                      <strong>{formatToman(severanceResult.currentYearProRata)}</strong>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#FFFBEB] dark:bg-amber-500/10 flex justify-between font-black">
                      <span>جمع سنوات {formatFaNum(workedYears)} سال سابقه:</span>
                      <span className="text-amber-600 dark:text-[#608BFF]">{formatToman(severanceResult.totalYearsPay)}</span>
                    </div>
                  </>
                )}
                {calcType === 'eydi' && (
                  <>
                    <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                      <span>ذخیره ماهانه پیشنهادی برای عیدی:</span>
                      <strong>{formatToman(eydiResult.monthlyReserve)}</strong>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/10 flex justify-between font-black">
                      <span>عیدی قابل پرداخت ({formatFaNum(workedMonthsInYear)} ماه):</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatToman(eydiResult.proRata)}</span>
                    </div>
                  </>
                )}
                {calcType === 'leave' && (
                  <>
                    <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                      <span>مانده مرخصی قابل بازخرید:</span>
                      <strong>{formatFaNum(leaveResult.remaining)} روز</strong>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/10 flex justify-between font-black">
                      <span>ارزش ریالی بازخرید مرخصی:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatToman(leaveResult.value)}</span>
                    </div>
                  </>
                )}
                {calcType === 'termination' && (
                  <>
                    <div className="flex justify-between py-1.5"><span>سنوات ({formatFaNum(workedYears)} سال):</span><strong>{formatToman(terminationResult.severance)}</strong></div>
                    <div className="flex justify-between py-1.5"><span>عیدی سال تسویه:</span><strong>{formatToman(terminationResult.eydi)}</strong></div>
                    <div className="flex justify-between py-1.5"><span>بازخرید {formatFaNum(leaveResult.remaining)} روز مرخصی:</span><strong>{formatToman(terminationResult.leaveValue)}</strong></div>
                    <div className="p-3.5 rounded-2xl bg-[#FFFBEB] dark:bg-amber-500/10 flex justify-between font-black">
                      <span>جمع کل تسویه‌حساب:</span>
                      <span className="text-amber-600 dark:text-[#608BFF]">{formatToman(terminationResult.total)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 8. Retirement Eligibility */}
          {calcType === 'retirement' && (
            <div className="paper-card p-4 rounded-[28px] space-y-3 text-xs tabular-nums">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white">بررسی شرایط بازنشستگی تأمین اجتماعی (ماده ۷۶)</h2>
              <div className="grid grid-cols-2 gap-2.5">
                <FaNumberInput label="سن فعلی (سال)" value={workerAge} onChange={setWorkerAge} suffix="سال" max={90} />
                <FaNumberInput label="سابقه پرداخت بیمه" value={insuredYears} onChange={setInsuredYears} suffix="سال" max={45} />
              </div>
              <FaNumberInput label="میانگین حقوق مبنا (ریال)" value={baseSalaryRial} onChange={setBaseSalaryRial} showTomanHint />
              <div
                className={`p-3.5 rounded-2xl border font-black flex justify-between items-center ${
                  retirementResult.eligible
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                }`}
              >
                <span>{retirementResult.eligible ? 'حائز شرایط بازنشستگی هستید' : 'هنوز به حداقل شرایط نرسیده‌اید'}</span>
                <span>مستمری برآوردی: {formatToman(retirementResult.pension)}</span>
              </div>
            </div>
          )}

          {/* 9. Business Tax Article 131 */}
          {calcType === 'business_tax' && (
            <div className="paper-card p-4 rounded-[28px] space-y-3 text-xs tabular-nums">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white">محاسبه‌گر مالیات مشاغل (ماده ۱۳۱ ق.م.م)</h2>
              <FaNumberInput label="جمع درآمد سالانه (ریال)" value={bizRevenueRial} onChange={setBizRevenueRial} showTomanHint />
              <FaNumberInput label="جمع هزینه‌های قابل قبول (ریال)" value={bizExpensesRial} onChange={setBizExpensesRial} showTomanHint />
              <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                <span>سود خالص حسابداری:</span>
                <strong>{formatToman(businessTaxResult.profit)}</strong>
              </div>
              <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                <span>سود مشمول پس از معافیت ({formatToman(LEGAL_CONFIG_1405.businessTaxExemption)}):</span>
                <strong>{formatToman(businessTaxResult.taxable)}</strong>
              </div>
              {businessTaxResult.rows.map((r) => (
                <div key={r.label} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span>{r.label}:</span>
                  <span>{formatToman(r.amount)}</span>
                </div>
              ))}
              <div className="p-3.5 rounded-2xl bg-[#FFF1F2] dark:bg-rose-500/10 flex justify-between font-black">
                <span>مالیات قابل پرداخت (نرخ مؤثر {toFaDigits(businessTaxResult.effective)}٪):</span>
                <span className="text-rose-600 dark:text-rose-400">{formatToman(businessTaxResult.total)}</span>
              </div>
            </div>
          )}

          {/* 10. VAT 10% */}
          {calcType === 'vat' && (
            <div className="paper-card p-4 rounded-[28px] space-y-3 text-xs tabular-nums">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white">محاسبه‌گر ارزش افزوده ۱۰٪ (سال ۱۴۰۵)</h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVatMode('add')}
                  className={`min-h-[40px] rounded-xl font-black border ${
                    vatMode === 'add' ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'border-slate-200 dark:border-violet-800'
                  }`}
                >
                  افزودن ۱۰٪ به مبلغ خالص
                </button>
                <button
                  type="button"
                  onClick={() => setVatMode('inside')}
                  className={`min-h-[40px] rounded-xl font-black border ${
                    vatMode === 'inside' ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'border-slate-200 dark:border-violet-800'
                  }`}
                >
                  استخراج ۱۰٪ از مبلغ کل
                </button>
              </div>
              <FaNumberInput label="مبلغ پایه (ریال)" value={vatInputAmountRial} onChange={setVatInputAmountRial} showTomanHint />
              <div className="space-y-1.5">
                <div className="flex justify-between py-1.5"><span>مبلغ خالص کالا/خدمات:</span><strong>{formatToman(vatResult.net)}</strong></div>
                <div className="flex justify-between py-1.5 text-amber-600 dark:text-[#608BFF]"><span>مالیات ارزش افزوده (۱۰٪):</span><strong>{formatToman(vatResult.vat)}</strong></div>
                <div className="p-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-500/10 flex justify-between font-black">
                  <span>جمع کل فاکتور با ارزش افزوده:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatToman(vatResult.gross)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 11. Social Security 30% Split */}
          {calcType === 'insurance' && (
            <div className="paper-card p-4 rounded-[28px] space-y-3 text-xs tabular-nums">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white">تفکیک ۳۰٪ حق بیمه تأمین اجتماعی (ماده ۲۸)</h2>
              <FaNumberInput label="دستمزد مشمول بیمه ماهانه (ریال)" value={insuredBaseRial} onChange={setInsuredBaseRial} showTomanHint />
              <div className="flex justify-between py-1.5 border-b border-violet-100 dark:border-violet-800/40"><span>سهم کارگر (۷٪):</span><strong>{formatToman(insuranceResult.worker7)}</strong></div>
              <div className="flex justify-between py-1.5 border-b border-violet-100 dark:border-violet-800/40"><span>سهم بازنشستگی کارفرما (۲۰٪):</span><strong>{formatToman(insuranceResult.employer20)}</strong></div>
              <div className="flex justify-between py-1.5 border-b border-violet-100 dark:border-violet-800/40"><span>بیمه بیکاری کارفرما (۳٪):</span><strong>{formatToman(insuranceResult.unemployment3)}</strong></div>
              <div className="p-3.5 rounded-2xl bg-[#EFF1FA]0/10 flex justify-between font-black">
                <span>جمع کل واریزی فهرست بیمه (۳۰٪):</span>
                <span className="text-[#1D4DF5] dark:text-[#608BFF]">{formatToman(insuranceResult.grandTotal30)}</span>
              </div>
            </div>
          )}

          {/* 12. Company & Brand Registration Costs */}
          {calcType === 'company_reg' && (
            <div className="paper-card p-4 rounded-[28px] space-y-3 text-xs tabular-nums">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>برآورد هزینه ثبت شرکت و برند ۱۴۰۵</span>
              </h2>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'private', label: 'سهامی خاص' },
                  { id: 'llp', label: 'مسئولیت محدود' },
                  { id: 'individual', label: 'شخصی / فردی' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCompanyType(c.id as typeof companyType)}
                    className={`min-h-[38px] rounded-xl font-black border text-[11px] ${
                      companyType === c.id ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'border-slate-200 dark:border-violet-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <FaNumberInput label="تعداد سهام / شرکای اضافه" value={extraShares} onChange={setExtraShares} suffix="سهم" max={50} />
              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input type="checkbox" checked={hasBrand} onChange={(e) => setHasBrand(e.target.checked)} className="w-4 h-4 accent-violet-600" />
                <span>شامل ثبت علامت تجاری و برند (۱ طبقه)</span>
              </label>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between"><span>حق‌الثبت پایه:</span><strong>{formatRial(companyRegResult.regFee)}</strong></div>
                <div className="flex justify-between"><span>روزنامه رسمی، دفترخانه و مهر:</span><strong>{formatRial(companyRegResult.notary + companyRegResult.gazette + companyRegResult.seal + companyRegResult.statCard)}</strong></div>
                {hasBrand && (
                  <div className="flex justify-between"><span>ثبت برند و وکیل مالکیت صنعتی:</span><strong>{formatRial(companyRegResult.brandReg + companyRegResult.attorneyFee)}</strong></div>
                )}
                <div className="p-3.5 rounded-2xl bg-[#FFFBEB] dark:bg-amber-500/10 flex justify-between font-black">
                  <span>برآورد کل هزینه ثبت:</span>
                  <span className="text-amber-700 dark:text-amber-300">{formatToman(companyRegResult.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TAX RETURN WIZARD (اظهارنامه مالیاتی ۱۴۰۵ — همگام با سایت کاربان) */}
      {subTab === 'tax_return' && (
        <div className="space-y-4">
          <div className="paper-card p-4 rounded-[28px] space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-[#1D4DF5] dark:text-[#608BFF]" />
                <span>دستیار اظهارنامه مالیاتی ۱۴۰۵</span>
              </h2>
              <button
                type="button"
                onClick={() =>
                  setTrPrintDoc({
                    kind: 'letter',
                    title: `خلاصه محاسبات ${trMode === 'diagnostic' ? 'اظهارنامه تشخیصی اشخاص حقیقی (ماده ۱۳۱)' : 'اظهارنامه عملکرد اشخاص حقوقی (ماده ۱۴۸)'}`,
                    targetOrg: 'سازمان امور مالیاتی کشور — کارپوشه مودیان',
                    dateJalali: '۱۴۰۵/۰۴/۳۱',
                    employerName: trTaxpayerName,
                    employeeName: 'واحد امور مالیاتی کاربان',
                    body: `گزارش محاسبات اظهارنامه مالیات بر درآمد سال ۱۴۰۵\nنوع پرونده: ${trMode === 'diagnostic' ? 'اشخاص حقیقی (نرخ پلکانی ۵ تا ۳۰٪)' : 'اشخاص حقوقی (نرخ مصوب ۲۵٪)'}\nجمع کل درآمد ابرازی: ${formatRial(taxReturnResult.totalRevenue)}\nجمع کل هزینه‌ها و کسورات قانونی: ${formatRial(taxReturnResult.totalDeductions)}\nسود خالص مشمول مالیات: ${formatRial(taxReturnResult.taxableIncome)}\nمالیات برآوردی قابل پرداخت: ${formatRial(taxReturnResult.tax)} (نرخ مؤثر ${toFaDigits(taxReturnResult.effectiveRate)}٪)`,
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-[#1D4DF5] text-white text-[11px] font-black flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ و PDF</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTrMode('diagnostic')}
                className={`min-h-[40px] rounded-2xl text-xs font-black border ${
                  trMode === 'diagnostic'
                    ? 'border-violet-600 bg-[#EFF1FA]0/15 text-[#1D4DF5] dark:border-amber-400 dark:text-amber-300'
                    : 'border-slate-200 dark:border-violet-800 text-slate-500'
                }`}
              >
                اشخاص حقیقی (ماده ۱۳۱)
              </button>
              <button
                type="button"
                onClick={() => setTrMode('annual')}
                className={`min-h-[40px] rounded-2xl text-xs font-black border ${
                  trMode === 'annual'
                    ? 'border-violet-600 bg-[#EFF1FA]0/15 text-[#1D4DF5] dark:border-amber-400 dark:text-amber-300'
                    : 'border-slate-200 dark:border-violet-800 text-slate-500'
                }`}
              >
                اشخاص حقوقی (۲۵٪)
              </button>
            </div>

            {/* 3-Step Indicator */}
            <div className="grid grid-cols-3 gap-1.5">
              {['۱. درآمدها', '۲. کسورات', '۳. نتیجه و مالیات'].map((lbl, idx) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setTrStep(idx as 0 | 1 | 2)}
                  className={`py-2 rounded-xl text-[11px] font-black ${
                    trStep === idx
                      ? 'bg-[#1D4DF5] text-white'
                      : 'bg-[#EFF1FA] dark:bg-[#18213D] text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {trStep === 0 && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold mb-1">نام مودی / شرکت</label>
                  <input
                    type="text"
                    value={trTaxpayerName}
                    onChange={(e) => setTrTaxpayerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4F6FD] dark:bg-[#18213D] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold"
                  />
                </div>
                <FaNumberInput label="درآمد فروش کالا (ریال)" value={trSalesRev} onChange={setTrSalesRev} showTomanHint />
                <FaNumberInput label="درآمد ارائه خدمات و قراردادها (ریال)" value={trServicesRev} onChange={setTrServicesRev} showTomanHint />
                <FaNumberInput label="سایر درآمدهای مشمول (ریال)" value={trOtherRev} onChange={setTrOtherRev} />
                <FaNumberInput label="زیان انباشته سنوات گذشته (قابل کسر)" value={trPrevLoss} onChange={setTrPrevLoss} />
                <button
                  type="button"
                  onClick={() => setTrStep(1)}
                  className="w-full min-h-[42px] rounded-2xl bg-[#1D4DF5] text-white text-xs font-black"
                >
                  مرحله بعد: ثبت هزینه‌ها و کسورات قانونی
                </button>
              </div>
            )}

            {trStep === 1 && (
              <div className="space-y-3 pt-1">
                <FaNumberInput label="بهای تمام‌شده کالا یا خدمات (ریال)" value={trCogs} onChange={setTrCogs} showTomanHint />
                <FaNumberInput label="هزینه حقوق و دستمزد و بیمه (ریال)" value={trSalaries} onChange={setTrSalaries} showTomanHint />
                <FaNumberInput label="هزینه‌های اداری، اجاره و عملیاتی (ریال)" value={trOpex} onChange={setTrOpex} />
                <FaNumberInput label="استهلاک دارایی‌های ثابت (ریال)" value={trDepreciation} onChange={setTrDepreciation} />
                <FaNumberInput label="معافیت‌ها و کمک‌های قانونی (ریال)" value={trDonations} onChange={setTrDonations} />
                <button
                  type="button"
                  onClick={() => setTrStep(2)}
                  className="w-full min-h-[42px] rounded-2xl bg-amber-500 text-[#0F172A] text-xs font-black"
                >
                  محاسبه نهایی مالیات اظهارنامه
                </button>
              </div>
            )}

            {trStep === 2 && (
              <div className="space-y-2.5 text-xs tabular-nums pt-1">
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span>جمع کل درآمدهای ابرازی:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">{formatToman(taxReturnResult.totalRevenue)}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span>جمع هزینه‌ها و کسورات ماده ۱۴۷:</span>
                  <strong className="text-rose-500">{formatToman(taxReturnResult.totalDeductions)}</strong>
                </div>
                <div className="flex justify-between py-2 border-b border-violet-100 dark:border-violet-800/40">
                  <span>سود خالص مشمول مالیات:</span>
                  <strong>{formatToman(taxReturnResult.taxableIncome)}</strong>
                </div>
                {taxReturnResult.bracketsUsed.map((b) => (
                  <div key={b.range} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                    <span>{b.range} ({toFaDigits(b.rate)}٪):</span>
                    <span>{formatToman(b.tax)}</span>
                  </div>
                ))}
                <div className="p-4 rounded-2xl bg-[#FFFBEB] dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 flex justify-between items-center font-black">
                  <span>مالیات برآوردی قابل پرداخت ({toFaDigits(taxReturnResult.effectiveRate)}٪):</span>
                  <span className="text-base text-amber-700 dark:text-amber-300">{formatToman(taxReturnResult.tax)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: 12-QUESTION BUSINESS HEALTH DIAGNOSTIC */}
      {subTab === 'health' && (
        <div className="paper-card p-5 rounded-[28px] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-[#0F172A] dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>تست جامع ۱۲گانه سلامت کسب‌وکار</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ارزیابی هم‌زمان قراردادها، حقوق و بیمه، و انضباط مالیاتی ۱۴۰۵
              </p>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-[#EFF1FA] dark:bg-amber-500/15 border border-slate-200 dark:border-amber-500/30 text-xs font-black text-[#1D4DF5] dark:text-[#608BFF] tabular-nums">
              امتیاز سلامت: {formatFaNum(healthStats.totalScore)} از ۱۰۰
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {healthStats.byArea.map((a) => (
              <div key={a.area} className="p-2.5 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 text-center">
                <div className="font-bold text-slate-500 dark:text-slate-400">{a.area}</div>
                <div className="font-black text-[#0F172A] dark:text-[#608BFF] mt-0.5 tabular-nums">
                  {formatFaNum(a.pct)}٪ ({formatFaNum(a.passed)}/{formatFaNum(a.total)})
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {HEALTH_QUESTIONS_12.map((q) => {
              const checked = !!healthAnswers[q.id];
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setHealthAnswers((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                  className={`p-3.5 rounded-2xl border text-right flex items-start gap-3 transition-colors ${
                    checked
                      ? 'border-emerald-500/60 bg-[#ECFDF5] dark:bg-emerald-500/10'
                      : 'border-slate-200/75 dark:border-slate-700/50 bg-[#F4F6FD] dark:bg-[#18213D]'
                  }`}
                >
                  <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${checked ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-[10px] font-extrabold text-[#1D4DF5] dark:text-[#608BFF] mb-0.5">{q.area}</div>
                    <span className="text-xs font-bold text-[#0F172A] dark:text-slate-200 leading-relaxed">{q.q}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: LAW LIBRARY */}
      {subTab === 'laws' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-violet-500 absolute right-4 top-3.5" />
            <input
              type="text"
              value={lawSearch}
              onChange={(e) => setLawSearch(e.target.value)}
              placeholder="جستجو در مواد قانون کار، مالیات‌های مستقیم، سامانه مودیان، بیمه ماده ۳۸ و چک صیادی..."
              className="w-full pr-10 pl-4 py-3.5 rounded-2xl bg-white dark:bg-[#12182B] border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-[#0F172A] dark:text-white"
            />
          </div>

          <div className="space-y-3.5">
            {filteredLaws.map((law) => (
              <div key={law.id} className="paper-card p-5 rounded-[28px] space-y-2">
                <div className="text-xs font-extrabold text-[#1D4DF5] dark:text-[#608BFF]">
                  {law.category} · {law.articleNumber}
                </div>
                <h3 className="text-sm font-black text-[#0F172A] dark:text-white">{law.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-7">{law.text}</p>
                <div className="p-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-[#18213D] border border-emerald-200/70 dark:border-slate-700/50 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                  {law.practicalTip}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ALL 5 EXECUTIVE CHECKLISTS */}
      {subTab === 'checklists' && (
        <div className="grid grid-cols-1 gap-4">
          {checklists.map((list) => {
            const doneCount = list.steps.filter((s) => s.done).length;
            return (
              <div key={list.id} className="paper-card p-5 rounded-[28px] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-[#1D4DF5] dark:text-[#608BFF] font-extrabold">{list.category}</span>
                    <h3 className="text-sm font-black text-[#0F172A] dark:text-white mt-0.5">{list.title}</h3>
                  </div>
                  <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                    {formatFaNum(doneCount)} از {formatFaNum(list.steps.length)}
                  </span>
                </div>
                <div className="space-y-2">
                  {list.steps.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleChecklistStep(list.id, st.id)}
                      className="w-full p-3 rounded-2xl bg-[#EFF1FA] dark:bg-[#18213D] border border-slate-200/75 dark:border-slate-700/50 flex items-center gap-3 text-right text-xs"
                    >
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${st.done ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span className={st.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-[#0F172A] dark:text-slate-200 font-bold'}>
                        {toFaDigits(st.text)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PrintPreviewPdfModal
        documentData={trPrintDoc}
        signatureDataUrl={signatureDataUrl}
        onClose={() => setTrPrintDoc(null)}
      />
    </div>
  );
};
