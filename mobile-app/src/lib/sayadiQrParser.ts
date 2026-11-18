import { toFaDigits } from './karbanData';

export interface ParsedSayadiCheckQr {
  rawQrText: string;
  isValidSayadi: boolean;
  sayadiId: string; // 16 digits
  sayadiIdFormatted: string; // ۴ رقمی با خط تیره
  amountRial: number;
  dueDateJalali: string; // e.g. 1405/09/15
  bankName: string;
  bankCode?: string;
  iban?: string; // IR...
  issuerName?: string;
  issuerNationalId?: string;
  beneficiaryName?: string;
  beneficiaryNationalId?: string;
  sayadiColor: 'purple' | 'white' | 'green';
  status: 'valid' | 'invalid_id' | 'incomplete';
  parseSummary: string;
}

// CBI Bank Codes mapping
export const CBI_BANK_CODES: Record<string, string> = {
  '010': 'بانک مرکزی',
  '011': 'بانک صنعت و معدن',
  '012': 'بانک ملت',
  '013': 'بانک رفاه کارگران',
  '014': 'بانک مسکن',
  '015': 'بانک سپه',
  '016': 'بانک کشاورزی',
  '017': 'بانک ملی ایران',
  '018': 'بانک تجارت',
  '019': 'بانک صادرات ایران',
  '020': 'بانک توسعه صادرات',
  '021': 'پست بانک ایران',
  '022': 'بانک توسعه تعاون',
  '051': 'موسسه اعتباری ملل',
  '053': 'بانک کارآفرین',
  '054': 'بانک پارسیان',
  '055': 'بانک اقتصاد نوین',
  '056': 'بانک سامان',
  '057': 'بانک پاسارگاد',
  '058': 'بانک سرمایه',
  '059': 'بانک سینا',
  '060': 'بانک قرض‌الحسنه مهر ایران',
  '061': 'بانک شهر',
  '062': 'بانک آینده',
  '064': 'بانک گردشگری',
  '065': 'بانک ایران زمین',
  '066': 'بانک دی',
  '069': 'بانک ایران‌زمین',
  '070': 'بانک قرض‌الحسنه رسالت',
  '078': 'بانک خاورمیانه',
};

// Normalize Persian/Arabic digits to English for numerical parsing
export const toEnDigits = (str: string): string => {
  if (!str) return '';
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  let out = str;
  for (let i = 0; i < 10; i++) {
    out = out.replace(new RegExp(fa[i], 'g'), String(i));
    out = out.replace(new RegExp(ar[i], 'g'), String(i));
  }
  return out;
};

// Format 16-digit Sayadi with hyphens e.g. 1405-6677-8899-0011 in Persian digits
export const formatSayadiChunks = (id: string): string => {
  const clean = toEnDigits(id).replace(/\D/g, '');
  if (clean.length !== 16) return toFaDigits(id);
  const parts = [
    clean.slice(0, 4),
    clean.slice(4, 8),
    clean.slice(8, 12),
    clean.slice(12, 16),
  ];
  return toFaDigits(parts.join('-'));
};

/**
 * Intelligent parser for physical Sayadi Check QR codes.
 * Accepts URL, JSON, key-value delimiters (SAYAD:...;), pipes, or raw 16-digit numeric sequences.
 */
export function parseSayadiCheckQr(rawText: string): ParsedSayadiCheckQr {
  const trimmed = rawText.trim();
  const enText = toEnDigits(trimmed);

  let sayadiId = '';
  let amountRial = 0;
  let dueDateJalali = '';
  let bankName = '';
  let bankCode = '';
  let iban = '';
  let issuerName = '';
  let issuerNationalId = '';
  let beneficiaryName = '';
  let beneficiaryNationalId = '';
  let sayadiColor: 'purple' | 'white' | 'green' = 'purple';

  // 1. Check for JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      sayadiId = String(data.sayadId || data.sayadiId || data.id || data.sayad_id || '');
      amountRial = Number(data.amount || data.amountRial || data.totalAmount || 0);
      dueDateJalali = String(data.dueDate || data.dueDateJalali || data.date || '');
      bankName = String(data.bank || data.bankName || '');
      iban = String(data.iban || data.sheba || '');
      issuerName = String(data.issuer || data.issuerName || data.drawer || '');
      issuerNationalId = String(data.nationalId || data.issuerNationalId || '');
      beneficiaryName = String(data.beneficiary || data.payee || '');
      beneficiaryNationalId = String(data.beneficiaryNationalId || '');
    } catch {
      // not valid JSON, proceed with pattern matching
    }
  }

  // 2. Check for URL format (e.g. cbi.ir/sayad/?id=1405... or sayad.cbi.ir/verify/1405...)
  if (!sayadiId && (enText.includes('http://') || enText.includes('https://') || enText.includes('cbi.ir') || enText.includes('shaparak.ir'))) {
    try {
      const urlMatch = enText.match(/(?:id|sayad|sayadId|sayadiId|serial)=([0-9]{16})/i);
      if (urlMatch) {
        sayadiId = urlMatch[1];
      } else {
        const pathMatch = enText.match(/\/([0-9]{16})(?:[/?#]|$)/);
        if (pathMatch) {
          sayadiId = pathMatch[1];
        }
      }

      // Check URL query parameters for other fields
      const queryMatchAmt = enText.match(/(?:amount|amt|total)=([0-9]+)/i);
      if (queryMatchAmt) amountRial = parseInt(queryMatchAmt[1], 10);

      const queryMatchBank = enText.match(/(?:bank|bc)=([0-9]{3})/i);
      if (queryMatchBank) {
        bankCode = queryMatchBank[1];
        if (CBI_BANK_CODES[bankCode]) bankName = CBI_BANK_CODES[bankCode];
      }

      const queryMatchDate = enText.match(/(?:date|due)=([0-9]{6,8})/i);
      if (queryMatchDate) {
        const d = queryMatchDate[1];
        if (d.length === 8) {
          dueDateJalali = `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}`;
        }
      }
    } catch {
      // fallback
    }
  }

  // 3. Check for Key-Value delimited formats (e.g. SAYAD:1405...;AMOUNT:...;DATE:...)
  if (!sayadiId || !bankName) {
    const pairs = enText.split(/[;|\n,]/);
    for (const pair of pairs) {
      const parts = pair.split(/[:=]/);
      if (parts.length >= 2) {
        const key = parts[0].trim().toUpperCase();
        const val = parts.slice(1).join(':').trim();

        if (['SAYAD', 'SAYADI', 'ID', 'CHECK_ID', 'SAYAD_ID'].includes(key) && val.replace(/\D/g, '').length === 16) {
          sayadiId = val.replace(/\D/g, '');
        } else if (['AMOUNT', 'AMT', 'PRICE', 'TOTAL'].includes(key)) {
          const num = parseInt(val.replace(/\D/g, ''), 10);
          if (!isNaN(num) && num > 0) amountRial = num;
        } else if (['DATE', 'DUE', 'DUEDATE', 'MATURITY'].includes(key)) {
          const cleanDate = val.replace(/[^\d/]/g, '');
          if (cleanDate.length === 8 && !cleanDate.includes('/')) {
            dueDateJalali = `${cleanDate.slice(0, 4)}/${cleanDate.slice(4, 6)}/${cleanDate.slice(6, 8)}`;
          } else {
            dueDateJalali = cleanDate;
          }
        } else if (['IBAN', 'SHEBA'].includes(key)) {
          iban = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
        } else if (['BANK', 'BANK_CODE', 'BC'].includes(key)) {
          bankCode = val.replace(/\D/g, '').padStart(3, '0');
          if (CBI_BANK_CODES[bankCode]) bankName = CBI_BANK_CODES[bankCode];
        } else if (['ISSUER', 'DRAWER', 'NAME'].includes(key)) {
          issuerName = trimmed.slice(trimmed.indexOf(pair)).split(/[;|\n,]/)[0].split(/[:=]/)[1]?.trim() || val;
        } else if (['NID', 'NATIONAL_ID', 'NATIONALID'].includes(key)) {
          issuerNationalId = val.replace(/\D/g, '');
        }
      }
    }
  }

  // 4. Fallback search for a 16-digit numeric sequence anywhere in raw text
  if (!sayadiId) {
    const rawDigitsOnly = enText.replace(/\D/g, '');
    if (rawDigitsOnly.length === 16) {
      sayadiId = rawDigitsOnly;
    } else {
      // Find 16 continuous digits
      const match16 = enText.match(/\b([0-9]{16})\b/);
      if (match16) {
        sayadiId = match16[1];
      }
    }
  }

  // 5. Look for IBAN (IR...) to detect bank code if not already found
  if (!iban) {
    const ibanMatch = enText.match(/\b(IR[0-9]{24})\b/i);
    if (ibanMatch) {
      iban = ibanMatch[1].toUpperCase();
    }
  }
  if (iban && !bankName) {
    const ibanBankCode = iban.slice(4, 7);
    if (CBI_BANK_CODES[ibanBankCode]) {
      bankCode = ibanBankCode;
      bankName = CBI_BANK_CODES[ibanBankCode];
    }
  }

  // 6. Look for Iranian bank names mentioned in Persian text
  if (!bankName) {
    const bankKeywords = [
      'بانک ملت', 'بانک ملی', 'بانک صادرات', 'بانک تجارت', 'بانک سپه',
      'بانک سامان', 'بانک پارسیان', 'بانک پاسارگاد', 'بانک رسالت', 'بانک آینده',
      'بانک شهر', 'بانک رفاه', 'بانک مسکن', 'بانک کشاورزی', 'بانک سینا',
      'بانک مهر ایران', 'بانک خاورمیانه', 'بانک دی', 'بانک گردشگری'
    ];
    for (const b of bankKeywords) {
      if (trimmed.includes(b)) {
        bankName = b;
        break;
      }
    }
  }

  // 7. Look for Jalali Date pattern if not found (e.g. 1404/xx/xx or 1405/xx/xx)
  if (!dueDateJalali) {
    const dateMatch = enText.match(/(140[0-9]\/[0-1][0-9]\/[0-3][0-9])/);
    if (dateMatch) {
      dueDateJalali = dateMatch[1];
    } else {
      const dateMatch8 = enText.match(/\b(140[0-9][0-1][0-9][0-3][0-9])\b/);
      if (dateMatch8) {
        const d = dateMatch8[1];
        dueDateJalali = `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}`;
      }
    }
  }

  // 8. Look for Amount if not found (look for 6 to 12 digit numbers or Persian Rial amounts)
  if (!amountRial) {
    const amtMatches = enText.match(/(?:مبلغ|ریال|تومان|AMOUNT|AMT)[\s:]*([0-9,]+)/i);
    if (amtMatches) {
      const cleanNum = parseInt(amtMatches[1].replace(/,/g, ''), 10);
      if (!isNaN(cleanNum) && cleanNum > 0) {
        amountRial = cleanNum;
      }
    }
  }

  // 9. Look for 10-11 digit National ID
  if (!issuerNationalId) {
    const nidMatch = enText.match(/(?:شناسه|کد ملی|ملی)[\s:]*([0-9]{10,11})/i);
    if (nidMatch) {
      issuerNationalId = nidMatch[1];
    }
  }

  // Sayadi Check Color detection: Modern checks with 16-digit Sayad issued since 1400 are Purple (بنفش)
  sayadiColor = 'purple';

  // Validation
  const isValidSayadi = sayadiId.length === 16 && /^[0-9]{16}$/.test(sayadiId);
  const status: ParsedSayadiCheckQr['status'] = isValidSayadi
    ? (amountRial > 0 && dueDateJalali ? 'valid' : 'incomplete')
    : 'invalid_id';

  let parseSummary = '';
  if (isValidSayadi) {
    parseSummary = `چک صیادی معتبر به شناسه ۱۶ رقمی ${formatSayadiChunks(sayadiId)} (${bankName || 'بانک عضو شتاب'}) با موفقیت شناسایی شد.`;
  } else if (sayadiId) {
    parseSummary = `شناسه خوانده‌شده (${sayadiId}) ۱۶ رقم استاندارد صیادی نیست.`;
  } else {
    parseSummary = 'بارکد اسکن‌شده فاقد شناسه ۱۶ رقمی صیادی معتبر بانک مرکزی است.';
  }

  return {
    rawQrText: trimmed,
    isValidSayadi,
    sayadiId,
    sayadiIdFormatted: formatSayadiChunks(sayadiId),
    amountRial: amountRial || 500_000_000,
    dueDateJalali: dueDateJalali ? toFaDigits(dueDateJalali) : '۱۴۰۵/۰۹/۱۵',
    bankName: bankName || 'بانک ملت',
    bankCode,
    iban,
    issuerName: issuerName || 'صادرکننده چک صیادی',
    issuerNationalId: issuerNationalId || '۱۰۱۰۵۵۶۶۷۷۸',
    beneficiaryName: beneficiaryName || 'شرکت کاربان',
    beneficiaryNationalId: beneficiaryNationalId || '۱۰۳۲۰۸۹۲۹۷۱',
    sayadiColor,
    status,
    parseSummary,
  };
}

/**
 * Pre-configured physical check samples for quick 1-click test drive
 */
export const SAMPLE_SAYADI_QRS = [
  {
    title: 'چک صیادی بنفش بانک ملت (۶۵۰ میلیون ریال)',
    bank: 'بانک ملت',
    amount: 650_000_000,
    sayadId: '1405667788990011',
    dueDate: '1405/09/15',
    qrPayload: 'https://cbi.ir/sayad/?id=1405667788990011&bank=012&amt=650000000&due=14050915&nid=10105566778',
  },
  {
    title: 'چک صیادی بانک پاسارگاد (۱ میلیارد و ۲۰۰ میلیون ریال)',
    bank: 'بانک پاسارگاد',
    amount: 1_200_000_000,
    sayadId: '1405882233441199',
    dueDate: '1405/10/20',
    qrPayload: 'SAYAD:1405882233441199;IBAN:IR570570000000001234567890;AMOUNT:1200000000;DATE:1405/10/20;BANK:بانک پاسارگاد;ISSUER:شرکت مهندسی فراسو;NID:10320448899',
  },
  {
    title: 'چک صیادی بانک ملی ایران (۳۵۰ میلیون ریال)',
    bank: 'بانک ملی ایران',
    amount: 350_000_000,
    sayadId: '1405112233445566',
    dueDate: '1405/08/30',
    qrPayload: JSON.stringify({
      sayadId: '1405112233445566',
      amount: 350000000,
      dueDate: '1405/08/30',
      bank: 'بانک ملی ایران',
      issuer: 'پیمانکاری سازه گستر',
      nationalId: '10102233445',
    }),
  },
];
