import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PrintPreviewPdfModal } from '../components/PrintPreviewPdfModal';
import { INITIAL_INVOICES } from '../lib/karbanData';

const saveMock = vi.fn();
const addImageMock = vi.fn();
const addPageMock = vi.fn();

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
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
      save: saveMock,
    };
  }),
}));

describe('PrintPreviewPdfModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('صورتحساب رسمی سامانه مودیان را نمایش داده و فایل PDF دانلود می‌کند', async () => {
    const sampleInvoice = INITIAL_INVOICES[0];
    const onClose = vi.fn();

    render(
      <PrintPreviewPdfModal
        documentData={{ kind: 'invoice', invoice: sampleInvoice }}
        signatureDataUrl="data:image/png;base64,fakeSig"
        onClose={onClose}
      />
    );

    expect(
      screen.getByText('پیش‌نمایش چاپ و دانلود PDF صورتحساب رسمی سامانه مودیان')
    ).toBeTruthy();
    expect(screen.getByText(sampleInvoice.partnerName)).toBeTruthy();

    const downloadBtn = screen.getByRole('button', { name: /دانلود فایل PDF/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
    expect(saveMock.mock.calls[0][0]).toMatch(/karban-moadian-invoice-.*\.pdf$/);
    expect(
      screen.getByText('فایل PDF رسمی با کیفیت چاپ A۴ آماده و ذخیره شد.')
    ).toBeTruthy();
  });

  it('لایحه دفاعیه مالیاتی و قرارداد رسمی را در پیش‌نمایش رندر کرده و کنترل بزرگنمایی دارد', () => {
    render(
      <PrintPreviewPdfModal
        documentData={{
          kind: 'tax_brief',
          title: 'لایحه دفاعیه مالیات ارزش افزوده ۱۴۰۴',
          authority: 'هیئت حل اختلاف مالیاتی بدوی (ماده ۲۴۴ ق.م.م)',
          taxpayerName: 'شرکت فناوری کاربان',
          dateJalali: '۱۴۰۵/۰۸/۱۰',
          amountRial: 150_000_000,
          citations: ['ماده ۲۴۴ ق.م.م', 'ماده ۱۶۹ مکرر'],
          body: 'متن رسمی دفاعیه حقوقی و مالیاتی برای ارائه به هیئت محترم حل اختلاف.',
        }}
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText('لایحه دفاعیه مالیات ارزش افزوده ۱۴۰۴')
    ).toBeTruthy();
    expect(screen.getByText('شرکت فناوری کاربان')).toBeTruthy();

    const zoom125Btn = screen.getByRole('button', { name: '۱۲۵٪' });
    fireEvent.click(zoom125Btn);
    expect(zoom125Btn.className).toContain('bg-[#1D4DF5]');
  });

  it('قرارداد رسمی را با مشخصات طرفین و دکمه چاپ مستقیم نمایش می‌دهد', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <PrintPreviewPdfModal
        documentData={{
          kind: 'contract',
          title: 'قرارداد کار مدت‌موقت',
          categoryLabel: 'قرارداد رسمی کاربان',
          dateJalali: '۱۴۰۵/۰۸/۰۱',
          employerName: 'شرکت کاربان',
          workerName: 'امیرحسین رادمنش',
          amountRial: 280_000_000,
          body: 'ماده ۱ — موضوع قرارداد توسعه نرم‌افزار است.',
        }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('قرارداد کار مدت‌موقت')).toBeTruthy();
    expect(screen.getByText('امیرحسین رادمنش')).toBeTruthy();

    const printBtn = screen.getByRole('button', { name: /چاپ مستقیم/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});
