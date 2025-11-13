/**
 * Dynamic price formatting with precision based on value
 * Solves the crypto precision problem where $0.17742 rounded to $0.18 causes significant errors
 */

export function formatPrice(price: number, currency: string = 'USD'): string {
  if (price === 0) return `${getCurrencySymbol(currency)}0.00`;

  const absPrice = Math.abs(price);
  let decimals: number;

  // Dynamic precision based on price magnitude
  if (absPrice >= 1000) {
    decimals = 2; // $52,345.67
  } else if (absPrice >= 1) {
    decimals = 2; // $42.17
  } else if (absPrice >= 0.01) {
    decimals = 4; // $0.1774 (for DOGE at $0.17742)
  } else if (absPrice >= 0.0001) {
    decimals = 6; // $0.000123
  } else {
    decimals = 8; // $0.00001234 (for SHIB and very small coins)
  }

  const formatted = price.toFixed(decimals);
  const symbol = getCurrencySymbol(currency);

  // Add comma separators for large numbers
  if (absPrice >= 1000) {
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${symbol}${parts.join('.')}`;
  }

  return `${symbol}${formatted}`;
}

/**
 * Format price change with appropriate precision
 */
export function formatPriceChange(change: number, currency: string = 'USD'): string {
  const absChange = Math.abs(change);
  let decimals: number;

  if (absChange >= 1) {
    decimals = 2; // +$1.23
  } else if (absChange >= 0.01) {
    decimals = 4; // +$0.0123
  } else {
    decimals = 6; // +$0.000123
  }

  const formatted = change.toFixed(decimals);
  const symbol = getCurrencySymbol(currency);
  const sign = change >= 0 ? '+' : '';

  return `${sign}${symbol}${formatted}`;
}

/**
 * Format percentage change
 */
export function formatPercentChange(changePct: number): string {
  const sign = changePct >= 0 ? '+' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

/**
 * Get currency symbol
 */
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    SGD: 'S$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    KRW: '₩',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$',
    HKD: 'HK$',
    NZD: 'NZ$',
    CHF: 'CHF ',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    MYR: 'RM',
    THB: '฿',
    IDR: 'Rp',
    PHP: '₱',
    VND: '₫',
  };

  return symbols[currency.toUpperCase()] || `${currency} `;
}

/**
 * Determine if a symbol is likely crypto (heuristic)
 */
export function isCryptoSymbol(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();

  // Common crypto suffixes
  if (upperSymbol.includes('-USD') || upperSymbol.includes('USD')) return true;
  if (upperSymbol.includes('-USDT') || upperSymbol.includes('USDT')) return true;
  if (upperSymbol.includes('-BTC') || upperSymbol.includes('BTC')) return true;

  // Common crypto symbols
  const cryptoSymbols = [
    'BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'USDC', 'ADA', 'DOGE', 'TRX',
    'AVAX', 'DOT', 'MATIC', 'SHIB', 'LTC', 'LINK', 'BCH', 'UNI', 'ATOM', 'XLM',
  ];

  return cryptoSymbols.some(crypto => upperSymbol === crypto || upperSymbol.startsWith(`${crypto}-`));
}
