import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountingSuiteView } from '../components/AccountingSuiteView';
import { ContractsAndVaultView } from '../components/ContractsAndVaultView';
import { Neobank3DCardWidget } from '../components/Neobank3DCardWidget';
import {
  INITIAL_INVOICES,
  INITIAL_CHECKS,
  INITIAL_JOURNAL,
  INITIAL_PARTNERS,
  INITIAL_ITEMS,
  INITIAL_VAULT_DOCS,
  INITIAL_EXPENSES,
} from '../lib/karbanData';

const savePdfMock = vi.fn();
const addImageMock = vi.fn();
const addPageMock = vi.fn();

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(function () {
    return {
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      },
      getImageProperties: () => ({ width: 794, height: 1123 }),
      addImage: addImageMock,
      addPage: addPageMock,
      save: savePdfMock,
    };
  }),
}));

describe('New Features: 3D Card Share, Jalali Range Filter & Contracts Direct PDF Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('دکمه اشتراک‌گذاری کارت سه‌بعدی تصویر کارت را آماده کرده و پیام موفقیت نمایش می‌دهد', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: shareSpy,
      configurable: true,
    });
    Object.defineProperty(navigator, 'canShare', {
      value: () => true,
      configurable: true,
    });

    render(<Neobank3DCardWidget finish="gold" />);

    const shareBtn = screen.getByTestId('share-3d-card-btn');
    expect(shareBtn).toBeTruthy();
    expect(shareBtn.textContent).toContain('اشتراک‌گذاری تصویر کارت');

    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(shareSpy).toHaveBeenCalledTimes(1);
    });

    const shareArg = shareSpy.mock.calls[0][0];
    expect(shareArg.files).toHaveLength(1);
    expect(shareArg.files[0].type).toBe('image/png');
    expect(screen.getByTestId('share-3d-card-toast')).toBeTruthy();
  });

  it('کنترلر فیلتر بازه زمانی شمسی (از تاریخ - تا تاریخ) لیست فاکتورها و هزینه‌ها را فیلتر می‌کند', () => {
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
        expenses={INITIAL_EXPENSES}
        signatureDataUrl={null}
        onNavigateToScanner={() => {}}
        onNavigateToSignPad={() => {}}
      />
    );

    // در حالت اولیه هر ۳ فاکتور نمایش داده می‌شوند
    expect(screen.getByTestId('accounting-date-range-filter')).toBeTruthy();
    expect(screen.getByText(/نمایش ۳ از ۳ فاکتور/)).toBeTruthy();

    // باز کردن انتخاب‌گر «از تاریخ» و انتخاب ۱۰ آبان ۱۴۰۵ -> هر ۳ فاکتور (۰۴، ۰۷، ۰۸ آبان) باید پنهان شوند
    const fromButton = screen.getByText('انتخاب شروع بازه').closest('button')!;
    fireEvent.click(fromButton);
    fireEvent.click(screen.getByText('امروز (۱۰ آبان ۱۴۰۵)'));

    expect(screen.getByText(/نمایش ۰ از ۳ فاکتور/)).toBeTruthy();
    expect(screen.getByText('در بازه زمانی انتخاب‌شده فاکتوری ثبت نشده است')).toBeTruthy();

    // تغییر به تب هزینه‌های روزانه -> هزینه ۱۴۰۵/۰۸/۱۰ در بازه باقی می‌ماند (۱ از ۳)
    fireEvent.click(screen.getByText('هزینه‌های روزانه'));
    expect(screen.getByText(/نمایش ۱ از ۳ هزینه/)).toBeTruthy();
    expect(screen.getByText('خرید ملزومات مصرفی و پذیرایی جلسات')).toBeTruthy();
    expect(screen.queryByText('اجاره ماهیانه و شارژ دفتر شرکت')).toBeNull();

    // پاک کردن فیلتر بازه زمانی
    fireEvent.click(screen.getByTestId('clear-date-range-btn'));
    expect(screen.getByText(/نمایش ۳ از ۳ هزینه/)).toBeTruthy();
    expect(screen.getByText('اجاره ماهیانه و شارژ دفتر شرکت')).toBeTruthy();
  });

  it('در ContractsAndVaultView خروجی مستقیم PDF برای قراردادها، سند امضاشده، نامه‌ها و گاوصندوق کار می‌کند', async () => {
    render(
      <ContractsAndVaultView
        plan="yearly"
        onOpenUpgrade={() => {}}
        signatureDataUrl="data:image/png;base64,fakeSigData"
        onSaveSignature={() => {}}
        vaultDocs={INITIAL_VAULT_DOCS}
        onAddVaultDoc={() => {}}
      />
    );

    // ۱) دانلود مستقیم PDF قرارداد ساخته‌شده
    fireEvent.click(screen.getByTestId('export-contract-pdf-btn'));
    await waitFor(() => {
      expect(savePdfMock).toHaveBeenCalledTimes(1);
    });
    expect(savePdfMock.mock.calls[0][0]).toMatch(/^karban-contract-.*\.pdf$/);

    // ۲) دانلود مستقیم PDF سند امضاشده در تب بوم امضا
    fireEvent.click(screen.getByText('بوم امضای لمسی'));
    fireEvent.click(screen.getByTestId('export-signed-doc-pdf-btn'));
    await waitFor(() => {
      expect(savePdfMock).toHaveBeenCalledTimes(2);
    });
    expect(savePdfMock.mock.calls[1][0]).toMatch(/^karban-signed-document-.*\.pdf$/);

    // ۳) دانلود مستقیم PDF نامه اداری
    fireEvent.click(screen.getByText('نامه‌های اداری'));
    fireEvent.click(screen.getByTestId('export-letter-pdf-btn'));
    await waitFor(() => {
      expect(savePdfMock).toHaveBeenCalledTimes(3);
    });
    expect(savePdfMock.mock.calls[2][0]).toMatch(/^karban-official-letter-.*\.pdf$/);

    // ۴) دانلود مستقیم PDF سند داخل گاوصندوق
    fireEvent.click(screen.getByText('گاوصندوق اسناد'));
    fireEvent.click(screen.getByTestId('export-vault-pdf-vlt-1'));
    await waitFor(() => {
      expect(savePdfMock).toHaveBeenCalledTimes(4);
    });
    expect(savePdfMock.mock.calls[3][0]).toBe('karban-vault-vlt-1.pdf');
  });
});
