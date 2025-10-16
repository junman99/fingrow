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
  opts?: { compact?: boolean; forceDecimals?: boolean }
): string {
  const code = (currency || preferredCurrency() || 'USD').toUpperCase();
  const compact = !!opts?.compact;
  const hasCents = opts?.forceDecimals ? true : Math.abs(amount % 1) > 1e-6;
  const maximumFractionDigits = hasCents ? 2 : 0;
  try {
    const nf = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits,
      notation: compact ? 'compact' : 'standard',
      compactDisplay: 'short',
    });
    return nf.format(amount);
  } catch {
    // Fallback
    const rounded = hasCents ? amount.toFixed(2) : Math.round(amount).toString();
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
