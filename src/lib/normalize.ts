const digitMap: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export const normalizeMobile = (value: string): string => {
  let result = value.trim().replace(/[۰-۹٠-٩]/g, (d) => digitMap[d] || d).replace(/\s+/g, '');
  if (result.startsWith('+98')) result = '0' + result.slice(3).replace(/^0+/, '');
  else if (result.startsWith('98') && result.length >= 11) result = '0' + result.slice(2).replace(/^0+/, '');
  return result;
};
