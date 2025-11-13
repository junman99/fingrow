// Locale-aware number/currency formatting helpers for FinGrow
import { useProfileStore } from '../store/profile';
import { findCurrency } from './currencies';

function preferredCurrency() {
  try {
    const cur = useProfileStore.getState()?.profile?.currency;
    if (typeof cur === 'string' && cur.trim().length) return cur.toUpperCase();
  } catch {}
  return 'USD';
}

export function formatCurrency(
  amount: number,
  currency?: string,
  opts?: { compact?: boolean; forceDecimals?: boolean; dynamicPrecision?: boolean }
): string {
  const code = (currency || preferredCurrency() || 'USD').toUpperCase();
  const compact = !!opts?.compact;
  const useDynamicPrecision = !!opts?.dynamicPrecision;

  // Dynamic precision based on amount magnitude (for prices like crypto)
  let minimumFractionDigits = 2;
  let maximumFractionDigits = 2;

  if (useDynamicPrecision) {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1) {
      minimumFractionDigits = 2;
      maximumFractionDigits = 2;
    } else if (absAmount >= 0.01) {
      minimumFractionDigits = 4;
      maximumFractionDigits = 4;
    } else if (absAmount >= 0.0001) {
      minimumFractionDigits = 6;
      maximumFractionDigits = 6;
    } else {
      minimumFractionDigits = 8;
      maximumFractionDigits = 8;
    }
  } else if (compact) {
    minimumFractionDigits = 0;
    maximumFractionDigits = 2;
  }

  try {
    const nf = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits,
      maximumFractionDigits,
      notation: compact ? 'compact' : 'standard',
      compactDisplay: 'short',
    });
    return nf.format(amount);
  } catch {
    // Fallback
    const rounded = compact ? Math.round(amount).toString() : amount.toFixed(maximumFractionDigits);
    return `${code} ${rounded}`;
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
  const meta = findCurrency(code);
  if (meta?.symbol) return meta.symbol;
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


export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sum(arr: number[] = []): number {
  return (arr || []).reduce((a, b) => a + ((typeof b === 'number' ? b : Number(b)) || 0), 0);
}

/**
 * Format large numbers with B/M/T suffixes
 * Examples: 1,500,000,000 -> 1.50B, 50,000,000 -> 50.00M, 2,300,000,000,000 -> 2.30T
 */
export function formatLargeNumber(value: number, decimals: number = 2): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000_000) {
    // Trillions
    return `${sign}${(value / 1_000_000_000_000).toFixed(decimals)}T`;
  } else if (abs >= 1_000_000_000) {
    // Billions
    return `${sign}${(value / 1_000_000_000).toFixed(decimals)}B`;
  } else if (abs >= 1_000_000) {
    // Millions
    return `${sign}${(value / 1_000_000).toFixed(decimals)}M`;
  } else if (abs >= 1_000) {
    // Thousands
    return `${sign}${(value / 1_000).toFixed(decimals)}K`;
  } else {
    return `${sign}${value.toFixed(decimals)}`;
  }
}

/**
 * Format market cap with currency symbol and B/M/T suffix
 * Example: 1,500,000,000 USD -> $1.50B
 */
export function formatMarketCap(value: number, currency?: string): string {
  const code = (currency || preferredCurrency() || 'USD').toUpperCase();
  const symbol = symbolFor(code);
  return `${symbol}${formatLargeNumber(value, 2)}`;
}
