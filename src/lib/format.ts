const numberFormatter = new Intl.NumberFormat('fa-IR');

export const formatFaNumber = (value: number | string) => {
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(parsed)) return '۰';
  return numberFormatter.format(Math.round(parsed));
};

export const formatRial = (value: number | string) => `${formatFaNumber(value)} ریال`;

export const formatPercentage = (value: number) => `${formatFaNumber(value * 100)}٪`;

export const formatFaDate = (value: string | Date) =>
  new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    typeof value === 'string' ? new Date(value) : value,
  );

export const toNumericValue = (value: string) => Number(String(value).replace(/[^\d.-]/g, '')) || 0;

export const formatEditableAmount = (value: string) => {
  const numeric = String(value).replace(/[^\d]/g, '');
  if (!numeric) return '';
  return formatFaNumber(Number(numeric));
};

export const normalizeDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

