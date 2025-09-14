// Locale-aware number/currency formatting helpers for FinGrow
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  opts?: { compact?: boolean; forceDecimals?: boolean }
): string {
  const compact = !!opts?.compact;
  const hasCents = opts?.forceDecimals ? true : Math.abs(amount % 1) > 1e-6;
  const maximumFractionDigits = hasCents ? 2 : 0;
  try {
    const nf = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits,
      notation: compact ? 'compact' : 'standard',
      compactDisplay: 'short',
    });
    return nf.format(amount);
  } catch {
    // Fallback
    const rounded = hasCents ? amount.toFixed(2) : Math.round(amount).toString();
    return `${currency} ${rounded}`;
  }
}

export function formatPercent(value: number): string {
  // show sign and 2 decimals by default; 1 decimal if |value| < 1
  const abs = Math.abs(value);
  const digits = abs < 1 ? 1 : 2;
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

export function symbolFor(currency: string): string {
  const code = (currency || 'USD').toUpperCase();
  const map: Record<string, string> = {
    USD: '$',
    SGD: 'S$',
    AUD: 'A$',
    CAD: 'C$',
    HKD: 'HK$',
    NZD: 'NZ$',
  };
  return map[code] || code;
}
