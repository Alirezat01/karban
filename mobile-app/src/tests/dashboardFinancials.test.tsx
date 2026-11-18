import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  formatRial,
  formatToman,
  numberToPersianWords,
  formatFaNum,
  toFaDigits,
  INITIAL_INVOICES,
  INITIAL_CHECKS,
  OfficialInvoice,
  SayadiCheck,
  getTrialStatus,
  resetTrial10Days,
} from '../lib/karbanData';

// Dashboard Treasury Financial Card Component for isolated testing of financial metrics display
interface DashboardFinancialProps {
  netLiquidityRial: number;
  totalSalesRial: number;
  receivableChecksRial: number;
  payableChecksRial: number;
  trialDaysRemaining: number;
}

const DashboardFinancialSummaryCard: React.FC<DashboardFinancialProps> = ({
  netLiquidityRial,
  totalSalesRial,
  receivableChecksRial,
  payableChecksRial,
  trialDaysRemaining,
}) => {
  return (
    <div data-testid="dashboard-financial-summary" className="p-6 bg-slate-900 text-white rounded-3xl">
      <div data-testid="trial-days-indicator">
        مهلت تست ۱۰ روزه رایگان: {toFaDigits(trialDaysRemaining)} روز باقی‌مانده
      </div>

      <div className="net-liquidity-section">
        <span className="label">تراز خالص نقدینگی خزانه‌داری:</span>
        <div data-testid="net-liquidity-toman" className="text-3xl font-black">
          {formatToman(netLiquidityRial)}
        </div>
        <div data-testid="net-liquidity-rial" className="text-sm">
          معادل ریالی: {formatRial(netLiquidityRial)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div data-testid="metric-sales">
          <span>فروش رسمی دوره</span>
          <strong>{formatToman(totalSalesRial)}</strong>
          <small>{formatRial(totalSalesRial)}</small>
        </div>

        <div data-testid="metric-receivable-checks">
          <span>چک‌های صیادی دریافتنی</span>
          <strong>{formatToman(receivableChecksRial)}</strong>
          <small>{formatRial(receivableChecksRial)}</small>
        </div>

        <div data-testid="metric-payable-checks">
          <span>تعهدات چک پرداختنی</span>
          <strong>{formatToman(payableChecksRial)}</strong>
          <small>{formatRial(payableChecksRial)}</small>
        </div>
      </div>
    </div>
  );
};

describe('داشبورد کاربان: راستی‌آزمایی محاسبات و نمایش مقادیر مالی (Vitest)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('۱. توابع فرمت‌بندی اعداد، تومان و ریال', () => {
    it('باید مبالغ ریالی را با جداکننده سه‌رقمی و ارقام تماماً فارسی نمایش دهد', () => {
      const rialAmount = 1_265_000_000;
      const formatted = formatRial(rialAmount);

      expect(formatted).toContain('ریال');
      expect(formatted).toContain('۱٬۲۶۵٬۰۰۰٬۰۰۰');
      // اطمینان از عدم وجود ارقام انگلیسی
      expect(formatted).not.toMatch(/[0-9]/);
    });

    it('باید مبالغ را با تقسیم بر ۱۰ به تومان تبدیل کرده و با جداکننده سه‌رقمی فارسی نشان دهد', () => {
      const rialAmount = 1_265_000_000; // معادل ۱۲۶ میلیون و ۵۰۰ هزار تومان
      const formatted = formatToman(rialAmount);

      expect(formatted).toContain('تومان');
      expect(formatted).toContain('۱۲۶٬۵۰۰٬۰۰۰');
      expect(formatted).not.toMatch(/[0-9]/);
    });

    it('باید تابع formatFaNum اعداد را با کاراکتر ٬ استاندارد فارسی گروه‌بندی کند', () => {
      expect(formatFaNum(3400000000)).toBe('۳٬۴۰۰٬۰۰۰٬۰۰۰');
      expect(formatFaNum(490000)).toBe('۴۹۰٬۰۰۰');
      expect(formatFaNum(0)).toBe('۰');
      expect(formatFaNum(-500000)).toBe('−۵۰۰٬۰۰۰');
    });

    it('باید حروف‌نویسی مبالغ به حروف فارسی (تومان و ریال) را به درستی تولید کند', () => {
      const words = numberToPersianWords(1_000_000_000); // ۱۰۰ میلیون تومان
      expect(words).toContain('میلیون');
      expect(words).toContain('تومان');
    });
  });

  describe('۲. محاسبات شاخص‌های مالی داشبورد از داده‌های فاکتور و چک', () => {
    it('باید جمع فروش‌های رسمی، خریدها و چک‌های صیادی را بر اساس داده‌های اولیه محاسبه کند', () => {
      const invoices: OfficialInvoice[] = INITIAL_INVOICES;
      const checks: SayadiCheck[] = INITIAL_CHECKS;

      const totalSalesRial = invoices
        .filter((i) => i.type === 'sale')
        .reduce((acc, i) => acc + i.grandTotalRial, 0);

      const totalPurchasesRial = invoices
        .filter((i) => i.type === 'purchase')
        .reduce((acc, i) => acc + i.grandTotalRial, 0);

      const receivableChecksRial = checks
        .filter((c) => c.type === 'receivable' && c.status === 'in_flow')
        .reduce((acc, c) => acc + c.amountRial, 0);

      const payableChecksRial = checks
        .filter((c) => c.type === 'payable' && c.status === 'in_flow')
        .reduce((acc, c) => acc + c.amountRial, 0);

      // مجموع فروش‌های رسمی اولیه (شامل سه فاکتور فروش معتبر: ۱٬۲۶۵٬۰۰۰٬۰۰۰ + ۴۹۵٬۰۰۰٬۰۰۰ + ۸۸۰٬۰۰۰٬۰۰۰ = ۲٬۶۴۰٬۰۰۰٬۰۰۰ ریال)
      expect(totalSalesRial).toBe(2_640_000_000);
      expect(totalPurchasesRial).toBe(605_000_000);
      expect(receivableChecksRial).toBeGreaterThan(0);
      expect(payableChecksRial).toBeGreaterThan(0);

      // محاسبه تراز خالص نقدینگی خزانه‌داری
      const netLiquidityRial = 3_400_000_000 + totalSalesRial - totalPurchasesRial - 485_000_000;
      expect(netLiquidityRial).toBe(4_950_000_000);
    });

    it('باید وضعیت دوره آزمایشی ۱۰ روزه را به درستی آغاز و روزهای باقی‌مانده را محاسبه کند', () => {
      resetTrial10Days();
      const trial = getTrialStatus();

      expect(trial.isTrial).toBe(true);
      expect(trial.daysRemaining).toBe(10);
      expect(trial.isExpired).toBe(false);
      expect(trial.percentUsed).toBe(0);
    });
  });

  describe('۳. رندر کامپوننت خلاصه مالی داشبورد و صحه‌سنجی DOM', () => {
    it('باید تمامی مقادیر مالی داشبورد را در ساختار بصری نئوبانک با ارقام فارسی رندر کند', () => {
      const netLiquidityRial = 4_444_000_000; // ۴۴۴ میلیون و ۴۰۰ هزار تومان
      const totalSalesRial = 1_760_000_000;  // ۱۷۶ میلیون تومان
      const receivableChecksRial = 1_350_000_000; // ۱۳۵ میلیون تومان
      const payableChecksRial = 650_000_000; // ۶۵ میلیون تومان

      render(
        <DashboardFinancialSummaryCard
          netLiquidityRial={netLiquidityRial}
          totalSalesRial={totalSalesRial}
          receivableChecksRial={receivableChecksRial}
          payableChecksRial={payableChecksRial}
          trialDaysRemaining={10}
        />
      );

      // بررسی حضور بخش تراز نقدینگی
      const netTomanEl = screen.getByTestId('net-liquidity-toman');
      expect(netTomanEl.textContent).toContain('۴۴۴٬۴۰۰٬۰۰۰ تومان');

      const netRialEl = screen.getByTestId('net-liquidity-rial');
      expect(netRialEl.textContent).toContain('۴٬۴۴۴٬۰۰۰٬۰۰۰ ریال');

      // بررسی کارت فروش رسمی
      const salesEl = screen.getByTestId('metric-sales');
      expect(salesEl.textContent).toContain('۱۷۶٬۰۰۰٬۰۰۰ تومان');
      expect(salesEl.textContent).toContain('۱٬۷۶۰٬۰۰۰٬۰۰۰ ریال');

      // بررسی کارت چک‌های صیادی دریافتنی
      const recCheckEl = screen.getByTestId('metric-receivable-checks');
      expect(recCheckEl.textContent).toContain('۱۳۵٬۰۰۰٬۰۰۰ تومان');

      // بررسی کارت چک‌های پرداختنی
      const payCheckEl = screen.getByTestId('metric-payable-checks');
      expect(payCheckEl.textContent).toContain('۶۵٬۰۰۰٬۰۰۰ تومان');

      // بررسی نمایش روزشمار تست ۱۰ روزه
      const trialEl = screen.getByTestId('trial-days-indicator');
      expect(trialEl.textContent).toContain('۱۰ روز باقی‌مانده');
    });
  });
});
