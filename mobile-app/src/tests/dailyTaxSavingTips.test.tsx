import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  getCurrentShamsiDateInfo,
  generateDailyTaxTips,
} from '../lib/taxTipsEngine';
import {
  INITIAL_INVOICES,
  INITIAL_CHECKS,
  INITIAL_JOURNAL,
  INITIAL_PARTNERS,
} from '../lib/karbanData';
import { DailyTaxSavingTips } from '../components/DailyTaxSavingTips';

describe('Daily Tax-Saving Tips Engine & Dashboard Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Shamsi Calendar Context Resolution', () => {
    it('correctly resolves a Gregorian date (2026-11-13) to Shamsi 1405/08/22 (Aban, Fall)', () => {
      const info = getCurrentShamsiDateInfo(new Date(2026, 10, 13, 12, 0, 0));
      expect(info.year).toBe(1405);
      expect(info.month).toBe(8);
      expect(info.day).toBe(22);
      expect(info.monthName).toBe('آبان');
      expect(info.seasonName).toBe('پاییز');
      expect(info.quarter).toBe(3);
      expect(info.daysInMonth).toBe(30);
      expect(info.daysUntilMonthEnd).toBe(8);
      expect(info.formattedJalali).toBe('۱۴۰۵/۰۸/۲۲');
    });

    it('parses a custom Persian Jalali date string and computes quarter/year countdowns', () => {
      const info = getCurrentShamsiDateInfo('۱۴۰۵/۱۲/۲۰');
      expect(info.year).toBe(1405);
      expect(info.month).toBe(12);
      expect(info.day).toBe(20);
      expect(info.monthName).toBe('اسفند');
      expect(info.seasonName).toBe('زمستان');
      expect(info.quarter).toBe(4);
      expect(info.daysUntilMonthEnd).toBe(9);
      expect(info.daysUntilYearEnd).toBe(9);
    });
  });

  describe('Personalized Tax Tip Generation Engine', () => {
    it('generates an urgent end-of-month payroll/insurance tip when <= 10 days remain in the Shamsi month', () => {
      const report = generateDailyTaxTips({
        dateInput: '۱۴۰۵/۰۸/۲۴',
        invoices: INITIAL_INVOICES,
        checks: INITIAL_CHECKS,
        journal: INITIAL_JOURNAL,
        partners: INITIAL_PARTNERS,
      });

      const payrollDeadlineTip = report.tips.find((t) => t.id.startsWith('tip-calendar-payroll'));
      expect(payrollDeadlineTip).toBeTruthy();
      expect(payrollDeadlineTip?.urgency).toBe('فوری');
      expect(payrollDeadlineTip?.title).toContain('آبان');
      expect(payrollDeadlineTip?.estimatedSavingRial).toBeGreaterThan(0);
    });

    it('generates an Esfand year-end tax closing tip during month 12 when early in the month', () => {
      const report = generateDailyTaxTips({
        dateInput: '۱۴۰۵/۱۲/۰۵',
        invoices: INITIAL_INVOICES,
        checks: INITIAL_CHECKS,
        journal: INITIAL_JOURNAL,
        partners: INITIAL_PARTNERS,
      });

      const esfandTip = report.tips.find((t) => t.id === 'tip-calendar-esfand-closing');
      expect(esfandTip).toBeTruthy();
      expect(esfandTip?.urgency).toBe('فوری');
      expect(esfandTip?.legalBasis).toContain('ماده ۱۴۸');
    });

    it('detects non-white Sayadi checks and low VAT credit coverage from live business data', () => {
      const report = generateDailyTaxTips({
        dateInput: '۱۴۰۵/۰۸/۱۱',
        invoices: INITIAL_INVOICES,
        checks: INITIAL_CHECKS,
        journal: INITIAL_JOURNAL,
        partners: INITIAL_PARTNERS,
      });

      const checkRiskTip = report.tips.find((t) => t.id === 'tip-checks-bad-debt-shield');
      expect(checkRiskTip).toBeTruthy();
      expect(checkRiskTip?.personalizationReason).toContain('سپهر مارت');
      expect(checkRiskTip?.estimatedSavingRial).toBe(Math.round(390_000_000 * 0.25));

      const vatTip = report.tips.find((t) => t.id === 'tip-vat-credit-capture');
      expect(vatTip).toBeTruthy();
      expect(vatTip?.personalizationReason).toContain('۲ فاکتور فروش');
    });

    it('handles empty business datasets gracefully with onboarding VAT advice', () => {
      const report = generateDailyTaxTips({
        dateInput: '۱۴۰۵/۰۱/۰۵',
        invoices: [],
        checks: [],
        journal: [],
        partners: [],
      });

      expect(report.tips.length).toBeGreaterThanOrEqual(3);
      expect(report.tips.some((t) => t.id === 'tip-vat-initial-setup')).toBe(true);
      expect(report.featuredTip).toBeTruthy();
    });
  });

  describe('DailyTaxSavingTips Component Rendering & Interactions', () => {
    it('renders personalized tips, filters by category, toggles applied status, and triggers navigation', () => {
      const onNavigateTab = vi.fn();

      render(
        <DailyTaxSavingTips
          invoices={INITIAL_INVOICES}
          checks={INITIAL_CHECKS}
          journal={INITIAL_JOURNAL}
          partners={INITIAL_PARTNERS}
          activeReportDateJalali="۱۴۰۵/۰۸/۲۵"
          onNavigateTab={onNavigateTab}
        />
      );

      expect(screen.getByTestId('daily-tax-saving-tips')).toBeTruthy();
      expect(screen.getByTestId('featured-tax-tip')).toBeTruthy();

      const totalBefore = screen.getByTestId('tax-saving-potential-total').textContent;
      expect(totalBefore).toContain('تومان');

      // Filter by Checks & Risk category tab
      const checkTab = screen.getByRole('tab', { name: 'چک صیادی و ریسک' });
      fireEvent.click(checkTab);
      expect(screen.getByTestId('tax-tip-row-tip-checks-bad-debt-shield')).toBeTruthy();

      // Switch back to all tips
      fireEvent.click(screen.getByRole('tab', { name: 'همه نکات روز' }));

      // Toggle applied state on the Sayadi check tip and confirm remaining potential decreases
      const markBtn = screen.getByRole('button', {
        name: /ثبت انجام سپر مالیاتی مطالبات مشکوک‌الوصول/i,
      });
      fireEvent.click(markBtn);

      const totalAfter = screen.getByTestId('tax-saving-potential-total').textContent;
      expect(totalAfter).not.toBe(totalBefore);

      // Navigate via featured tip CTA button
      const featuredSection = screen.getByTestId('featured-tax-tip');
      const actionButtons = featuredSection.querySelectorAll('button');
      const navigateButton = actionButtons[actionButtons.length - 1];
      fireEvent.click(navigateButton);
      expect(onNavigateTab).toHaveBeenCalledTimes(1);
    });
  });
});
