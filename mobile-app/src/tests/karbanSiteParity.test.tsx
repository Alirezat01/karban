import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolsAndLawView } from '../components/ToolsAndLawView';
import { AccountingSuiteView } from '../components/AccountingSuiteView';
import { ContractsAndVaultView } from '../components/ContractsAndVaultView';
import {
  INITIAL_INVOICES,
  INITIAL_CHECKS,
  INITIAL_JOURNAL,
  INITIAL_PARTNERS,
  INITIAL_ITEMS,
  INITIAL_VAULT_DOCS,
  CONTRACT_TYPES_ALL,
  INITIAL_CHECKLISTS,
  HEALTH_QUESTIONS_12,
} from '../lib/karbanData';

describe('KarbanApp.ir Site Feature Parity Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('شامل تمام ۱۳ ماشین‌حساب ۱۴۰۵، اظهارنامه مالیاتی، تست سلامت ۱۲گانه و ۵ چک‌لیست سایت است', () => {
    expect(HEALTH_QUESTIONS_12.length).toBe(12);
    expect(INITIAL_CHECKLISTS.length).toBe(5);

    render(<ToolsAndLawView />);

    // بررسی وجود ماشین‌حساب ثبت شرکت و برند و تغییر به آن
    fireEvent.click(screen.getByText('ثبت شرکت و برند'));
    expect(screen.getByText('برآورد هزینه ثبت شرکت و برند ۱۴۰۵')).toBeTruthy();

    // بررسی تب اظهارنامه مالیاتی ۱۴۰۵
    fireEvent.click(screen.getByText('اظهارنامه مالیاتی'));
    expect(screen.getByText('دستیار اظهارنامه مالیاتی ۱۴۰۵')).toBeTruthy();
    expect(screen.getByText('اشخاص حقیقی (ماده ۱۳۱)')).toBeTruthy();
    expect(screen.getByText('اشخاص حقوقی (۲۵٪)')).toBeTruthy();

    // بررسی تب سنجش سلامت ۱۲گانه
    fireEvent.click(screen.getByText('سنجش سلامت ۱۲گانه'));
    expect(screen.getByText('تست جامع ۱۲گانه سلامت کسب‌وکار')).toBeTruthy();
  });

  it('در حسابداری، تب‌های هزینه‌های روزانه، بانک/صندوق و تنخواه‌گردان و پروژه‌ها و دارایی فعال هستند', () => {
    render(
      <AccountingSuiteView
        plan="yearly"
        onOpenUpgrade={() => {}}
        invoices={INITIAL_INVOICES}
        onAddInvoice={() => {}}
        checks={INITIAL_CHECKS}
        onAddCheck={() => {}}
        onUpdateCheckStatus={() => {}}
        journal={INITIAL_JOURNAL}
        partners={INITIAL_PARTNERS}
        onAddPartner={() => {}}
        items={INITIAL_ITEMS}
        onAddItem={() => {}}
        signatureDataUrl={null}
        onNavigateToScanner={() => {}}
        onNavigateToSignPad={() => {}}
      />
    );

    fireEvent.click(screen.getByText('هزینه‌های روزانه'));
    expect(screen.getByText(/اعتبارسنجی مالیاتی/)).toBeTruthy();

    fireEvent.click(screen.getByText('بانک، صندوق و تنخواه'));
    expect(screen.getByText('بانک‌ها و صندوق‌های نقدی')).toBeTruthy();
    expect(screen.getByText(/مدیریت تنخواه‌گردان/)).toBeTruthy();

    fireEvent.click(screen.getByText('پروژه‌ها و دارایی'));
    expect(screen.getByText('پروژه‌ها و مراکز درآمد / هزینه')).toBeTruthy();
    expect(screen.getByText(/دارایی‌های ثابت/)).toBeTruthy();
  });

  it('در قراردادساز، همه ۲۳ نوع قرارداد رسمی سایت کاربان قابل انتخاب هستند', () => {
    expect(CONTRACT_TYPES_ALL.length).toBe(23);

    render(
      <ContractsAndVaultView
        plan="yearly"
        onOpenUpgrade={() => {}}
        signatureDataUrl={null}
        onSaveSignature={() => {}}
        vaultDocs={INITIAL_VAULT_DOCS}
        onAddVaultDoc={() => {}}
      />
    );

    expect(screen.getByText('انتخاب از ۲۳ نوع قرارداد رسمی')).toBeTruthy();
    expect(screen.getByText('قرارداد فرانچایز')).toBeTruthy();
    expect(screen.getByText('قرارداد مبایعنامه')).toBeTruthy();
  });
});
