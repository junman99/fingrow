/**
 * Yahoo Finance Crypto Module
 *
 * Fetches cryptocurrency data (BTC, ETH, SOL, BNB, ADA, DOGE, etc.) from Yahoo Finance.
 * Uses the same chart endpoint as stocks, with crypto symbols like "BTC-USD", "ETH-USD".
 *
 * Advantages over CoinGecko:
 * - Unified data source (stocks + crypto + FX all from Yahoo)
 * - More historical data points (366 daily bars vs 92 OHLC bars)
 * - Consistent date format across all assets
 * - No additional API key needed
 */

export type CryptoPoint = { t: number; v: number };
export type CryptoBar = { t: number; o: number; h: number; l: number; c: number };

/**
 * Map of supported crypto symbols
 * Format: User symbol → Yahoo Finance symbol
 */
const CRYPTO_MAP: Record<string, string> = {
  'BTC': 'BTC-USD',
  'XBT': 'BTC-USD',  // Alternative Bitcoin ticker
  'ETH': 'ETH-USD',
  'SOL': 'SOL-USD',
  'BNB': 'BNB-USD',
  'ADA': 'ADA-USD',
  'DOGE': 'DOGE-USD',
  'XRP': 'XRP-USD',
  'MATIC': 'MATIC-USD',
  'DOT': 'DOT-USD',
  'AVAX': 'AVAX-USD',
  'LINK': 'LINK-USD',
  'UNI': 'UNI-USD',
  'ATOM': 'ATOM-USD',
  'LTC': 'LTC-USD',
};

/**
 * Normalize user-entered crypto symbols to Yahoo Finance format
 * Examples:
 *   "BTC" → "BTC-USD"
 *   "BTCUSD" → "BTC-USD"
 *   "BTC-USD" → "BTC-USD"
 *   "ETH" → "ETH-USD"
 *   "ETHUSD" → "ETH-USD"
 */
export function normalizeYahooCryptoSymbol(sym: string): string | null {
  const upper = (sym || '').toUpperCase().trim();

  // Already in Yahoo format (e.g., "BTC-USD")
  if (upper.includes('-USD')) {
    const base = upper.split('-')[0];
    if (CRYPTO_MAP[base]) return upper;
  }

  // Remove common suffixes (USD, USDT, etc.)
  const cleaned = upper
    .replace(/[-_]/g, '')
    .replace(/USDT?$/, '')
    .replace(/USD$/, '');

  // Check if it's a known crypto
  if (CRYPTO_MAP[cleaned]) {
    return CRYPTO_MAP[cleaned];
  }

  // Try direct match
  if (CRYPTO_MAP[upper]) {
    return CRYPTO_MAP[upper];
  }

  return null;
}

/**
 * Check if a symbol is a crypto symbol
 */
export function isCryptoSymbol(sym: string): boolean {
  return normalizeYahooCryptoSymbol(sym) !== null;
}

/**
 * Get base crypto symbol (e.g., "BTC-USD" → "BTC")
 */
export function baseCryptoSymbol(sym: string): string | null {
  const normalized = normalizeYahooCryptoSymbol(sym);
  if (!normalized) return null;
  return normalized.split('-')[0];
}

/**
 * Fetch JSON from Yahoo Finance with proper headers
 */
async function fetchJson(url: string): Promise<any> {
  const headers: any = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://finance.yahoo.com',
    'Origin': 'https://finance.yahoo.com',
  };

  const res = await fetch(url as any, {
    headers,
    credentials: 'omit',
  } as any);

  if (!res.ok) {
    throw new Error(`Yahoo HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Fetch crypto price and historical data from Yahoo Finance
 *
 * @param sym - User crypto symbol (e.g., "BTC", "ETH", "BTC-USD")
 * @param range - Time range ("1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max")
 * @returns Object with last price and daily price line
 */
export async function fetchYahooCrypto(
  sym: string,
  range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | 'max' = '1y'
): Promise<{ last: number; line: CryptoPoint[] }> {
  const yahooSymbol = normalizeYahooCryptoSymbol(sym);
  if (!yahooSymbol) {
    throw new Error(`Unknown crypto symbol: ${sym}`);
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=1d&includePrePost=false`;

  try {
    const json = await fetchJson(url);
    const result = json?.chart?.result?.[0];

    if (!result) {
      throw new Error('No data returned from Yahoo Finance');
    }

    // Extract price data
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];

    // Build price line
    const line: CryptoPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = Number(closes[i]);
      if (close && close > 0) {
        line.push({
          t: (timestamps[i] || 0) * 1000, // Convert to milliseconds
          v: close,
        });
      }
    }

    const last = line.length > 0 ? line[line.length - 1].v : 0;

    return { last, line };
  } catch (err) {
    console.error(`[Yahoo Crypto] Error fetching ${yahooSymbol}:`, err);
    throw err;
  }
}

/**
 * Fetch crypto OHLC bars from Yahoo Finance
 *
 * @param sym - User crypto symbol (e.g., "BTC", "ETH", "BTC-USD")
 * @param range - Time range ("1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max")
 * @returns Array of OHLC bars with timestamps in milliseconds
 */
export async function fetchYahooCryptoOhlc(
  sym: string,
  range: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | 'max' = '1y'
): Promise<CryptoBar[]> {
  const yahooSymbol = normalizeYahooCryptoSymbol(sym);
  if (!yahooSymbol) {
    throw new Error(`Unknown crypto symbol: ${sym}`);
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=1d&includePrePost=false`;

  try {
    const json = await fetchJson(url);
    const result = json?.chart?.result?.[0];

    if (!result) {
      throw new Error('No data returned from Yahoo Finance');
    }

    // Extract OHLC data
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const closes = quotes.close || [];

    // Build OHLC bars
    const bars: CryptoBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = Number(opens[i]);
      const h = Number(highs[i]);
      const l = Number(lows[i]);
      const c = Number(closes[i]);

      if (c && c > 0) {
        bars.push({
          t: (timestamps[i] || 0) * 1000, // Convert to milliseconds
          o: o || c,
          h: h || c,
          l: l || c,
          c: c,
        });
      }
    }

    return bars;
  } catch (err) {
    console.error(`[Yahoo Crypto] Error fetching OHLC for ${yahooSymbol}:`, err);
    throw err;
  }
}
