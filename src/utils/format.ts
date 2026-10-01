/**
 * Formatting Utility Module
 * Money & percentage formatting using Intl.NumberFormat('th-TH')
 */

const TH_CURRENCY_FORMATTER = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const TH_PERCENT_FORMATTER = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const TH_INTEGER_FORMATTER = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 0,
});

export function formatMoney(val: number | null | undefined): string {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return '-';
  return TH_CURRENCY_FORMATTER.format(val);
}

export function formatPercent(val: number | null | undefined): string {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return '-';
  return TH_PERCENT_FORMATTER.format(val);
}

export function formatInteger(val: number | null | undefined): string {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return '-';
  return TH_INTEGER_FORMATTER.format(val);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
  }
  return phone;
}
