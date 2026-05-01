export const CURRENCY_SYMBOLS: Record<string, string> = {
  KZT: '₸', USD: '$', EUR: '€', CNY: '¥',
};

const CURRENCY_LOCALES: Record<string, string> = {
  KZT: 'kk-KZ', USD: 'en-US', EUR: 'de-DE', CNY: 'zh-CN',
};

export function normalizeCurrency(currency: string | null | undefined): string {
  const normalized = currency?.trim().toUpperCase() ?? '';

  if (!normalized) {
    return 'KZT';
  }

  return normalized in CURRENCY_LOCALES ? normalized : 'KZT';
}

export function formatMoney(
  amount: number,
  currency = 'KZT',
  compact = false,
): string {
  const normalizedCurrency = normalizeCurrency(currency);
  const locale = CURRENCY_LOCALES[normalizedCurrency] ?? 'kk-KZ';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
    currencyDisplay: 'narrowSymbol',
    ...(compact ? { notation: 'compact' } : {}),
  }).format(amount);
}

export function formatNumber(
  amount: number,
  locale: string = 'ru-KZ',
  compact = false,
): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
}

export function currencySymbol(currency: string): string {
  const normalizedCurrency = normalizeCurrency(currency);
  return CURRENCY_SYMBOLS[normalizedCurrency] ?? normalizedCurrency;
}
