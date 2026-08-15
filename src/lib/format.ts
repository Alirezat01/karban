export const formatFa = (num: number | string): string => {
  if (num === null || num === undefined) return '';
  const parsed = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num;
  if (isNaN(parsed)) return String(num); // Fallback if it's not a valid number
  return parsed.toLocaleString('fa-IR');
};

export const formatPriceFa = (price: number | string): string => {
  if (price === null || price === undefined || price === '') return '';
  const parsed = typeof price === 'string' ? parseFloat(price.replace(/,/g, '')) : price;
  if (isNaN(parsed)) return String(price); // Fallback if not a number
  return `${parsed.toLocaleString('fa-IR')} ریال`;
};
