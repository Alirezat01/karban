import { describe, it, expect } from 'vitest';
import {
  parseSayadiCheckQr,
  formatSayadiChunks,
  toEnDigits,
  CBI_BANK_CODES,
  SAMPLE_SAYADI_QRS,
} from '../lib/sayadiQrParser';

describe('Sayadi Check QR Parser & Formatter', () => {
  it('converts Persian/Arabic digits to English digits reliably', () => {
    expect(toEnDigits('۱۴۰۵۶۶۷۷۸۸۹۹۰۰۱۱')).toBe('1405667788990011');
    expect(toEnDigits('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890');
    expect(toEnDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('formats 16-digit Sayadi ID into 4-digit hyphenated chunks with Persian digits', () => {
    const formatted = formatSayadiChunks('1405667788990011');
    expect(formatted).toBe('۱۴۰۵-۶۶۷۷-۸۸۹۹-۰۰۱۱');
  });

  it('correctly maps CBI bank codes to official Iranian bank names', () => {
    expect(CBI_BANK_CODES['012']).toBe('بانک ملت');
    expect(CBI_BANK_CODES['017']).toBe('بانک ملی ایران');
    expect(CBI_BANK_CODES['057']).toBe('بانک پاسارگاد');
    expect(CBI_BANK_CODES['070']).toBe('بانک قرض‌الحسنه رسالت');
  });

  it('parses standard CBI URL QR code payload', () => {
    const url = 'https://cbi.ir/sayad/?id=1405667788990011&bank=012&amt=650000000&due=14050915&nid=10105566778';
    const parsed = parseSayadiCheckQr(url);

    expect(parsed.isValidSayadi).toBe(true);
    expect(parsed.sayadiId).toBe('1405667788990011');
    expect(parsed.amountRial).toBe(650_000_000);
    expect(parsed.dueDateJalali).toContain('۱۴۰۵/۰۹/۱۵');
    expect(parsed.bankName).toBe('بانک ملت');
    expect(parsed.status).toBe('valid');
  });

  it('parses key-value delimited Sayadi QR code payload', () => {
    const delimited = 'SAYAD:1405882233441199;IBAN:IR570570000000001234567890;AMOUNT:1200000000;DATE:1405/10/20;BANK:بانک پاسارگاد;ISSUER:شرکت مهندسی فراسو;NID:10320448899';
    const parsed = parseSayadiCheckQr(delimited);

    expect(parsed.isValidSayadi).toBe(true);
    expect(parsed.sayadiId).toBe('1405882233441199');
    expect(parsed.amountRial).toBe(1_200_000_000);
    expect(parsed.bankName).toBe('بانک پاسارگاد');
    expect(parsed.dueDateJalali).toContain('۱۴۰۵/۱۰/۲۰');
    expect(parsed.issuerName).toBe('شرکت مهندسی فراسو');
  });

  it('parses structured JSON Sayadi QR payload', () => {
    const jsonStr = JSON.stringify({
      sayadId: '1405112233445566',
      amount: 350000000,
      dueDate: '1405/08/30',
      bank: 'بانک ملی ایران',
      issuer: 'پیمانکاری سازه گستر',
      nationalId: '10102233445',
    });
    const parsed = parseSayadiCheckQr(jsonStr);

    expect(parsed.isValidSayadi).toBe(true);
    expect(parsed.sayadiId).toBe('1405112233445566');
    expect(parsed.amountRial).toBe(350_000_000);
    expect(parsed.bankName).toBe('بانک ملی ایران');
    expect(parsed.issuerName).toBe('پیمانکاری سازه گستر');
  });

  it('extracts raw 16-digit Sayadi ID when simple number is scanned', () => {
    const parsed = parseSayadiCheckQr('1405998877665544');
    expect(parsed.isValidSayadi).toBe(true);
    expect(parsed.sayadiId).toBe('1405998877665544');
  });

  it('all pre-configured test presets are valid and parsable', () => {
    SAMPLE_SAYADI_QRS.forEach((sample) => {
      const res = parseSayadiCheckQr(sample.qrPayload);
      expect(res.isValidSayadi).toBe(true);
      expect(res.sayadiId).toBe(sample.sayadId);
      expect(res.bankName).toBe(sample.bank);
      expect(res.amountRial).toBe(sample.amount);
    });
  });
});
