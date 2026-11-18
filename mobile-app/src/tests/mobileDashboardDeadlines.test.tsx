import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import App from '../App';

vi.mock('../components/Neobank3DCardWidget', () => ({
  Neobank3DCardWidget: () => <div data-testid="mock-3d-card">3D Card</div>,
}));

describe('Mobile-Only Dashboard & Urgent Deadline Animations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('کارت‌های هشدار سررسیدهای مهم را با کلاس انیمیشن ملایم رندر می‌کند', () => {
    render(<App />);

    const vatUrgentCard = screen.getByTestId('urgent-deadline-vat-spring');
    expect(vatUrgentCard).toBeTruthy();
    expect(vatUrgentCard.className).toContain('urgent-deadline-card');
    expect(vatUrgentCard.textContent).toContain('ارسال اظهارنامه ارزش افزوده');

    const insuranceUrgentCard = screen.getByTestId('urgent-deadline-insurance-salary');
    expect(insuranceUrgentCard).toBeTruthy();
    expect(insuranceUrgentCard.className).toContain('urgent-deadline-card');
  });

  it('تمامی ماژول‌های سنگین داشبورد روی دکمه‌های موبایلی قرار دارند و با کلیک در شیت باز می‌شوند', () => {
    render(<App />);

    // در نمای اولیه صفحه نباید فرم کامل توصیه‌های مالیاتی یا نمودار کامل صفحه را دراز کند
    expect(screen.queryByTestId('daily-tax-saving-tips')).toBeNull();

    // با لمس دکمه توصیه‌های صرفه‌جویی مالیاتی، شیت موبایل باز می‌شود
    const taxTipsBtn = screen.getByTestId('mobile-module-btn-tax_tips');
    expect(taxTipsBtn.className).toContain('urgent-deadline-card');
    fireEvent.click(taxTipsBtn);

    expect(screen.getByTestId('daily-tax-saving-tips')).toBeTruthy();

    // بستن شیت و باز کردن تقویم تکالیف
    fireEvent.click(screen.getByLabelText('بستن پنجره'));
    fireEvent.click(screen.getByTestId('mobile-module-btn-calendar'));
    expect(screen.getByText('تقویم تکالیف مالیاتی و بیمه ۱۴۰۵')).toBeTruthy();
  });
});
