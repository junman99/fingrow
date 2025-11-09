/**
 * FX Rate Fetching using Yahoo Finance
 * - Unlimited API calls (free)
 * - 1-hour cache per currency pair
 * - Fetches individual pairs on-demand (e.g., SGDUSD=X)
 * - No pre-calculation needed
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const FX_CACHE_PREFIX = 'fingrow/fx/yahoo/';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

export type FxRateCache = {
  rate: number;
  timestamp: number;
  pair: string;
};

/**
 * Fetch JSON from Yahoo with proper headers (same as yahoo.ts)
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
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  return await res.json();
}

/**
 * Fetch current FX rate from Yahoo Finance
 * Example: SGDUSD=X returns SGD to USD rate
 * Uses same approach as existing yahoo.ts for consistency
 */
async function fetchYahooFxRate(fromCurrency: string, toCurrency: string): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // Same currency
  if (from === to) return 1;

  const symbol = `${from}${to}=X`;

  console.log(`💱 [Yahoo FX] Fetching ${symbol}...`);

  // Try query1 first (same as yahoo.ts pattern)
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&includePrePost=false`;
    const json = await fetchJson(url);
    const result = json?.chart?.result?.[0];

    if (result) {
      // Get the most recent close price (current rate)
      const meta = result.meta;
      const regularMarketPrice = meta?.regularMarketPrice;

      if (regularMarketPrice && regularMarketPrice > 0) {
        console.log(`💱 [Yahoo FX] ✅ ${symbol} = ${regularMarketPrice}`);
        return regularMarketPrice;
      }

      // Fallback: try to get last close from quotes
      const quotes = result.indicators?.quote?.[0];
      const closes = quotes?.close || [];
      const lastClose = closes.filter((c: any) => c && c > 0).pop();

      if (lastClose && lastClose > 0) {
        console.log(`💱 [Yahoo FX] ✅ ${symbol} = ${lastClose} (from closes)`);
        return lastClose;
      }
    }
  } catch (error) {
    console.warn(`💱 [Yahoo FX] query1 failed for ${symbol}, trying query2...`);
  }

  // Try query2 as fallback
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&includePrePost=false`;
    const json = await fetchJson(url);
    const result = json?.chart?.result?.[0];

    if (result) {
      const meta = result.meta;
      const regularMarketPrice = meta?.regularMarketPrice;

      if (regularMarketPrice && regularMarketPrice > 0) {
        console.log(`💱 [Yahoo FX] ✅ ${symbol} = ${regularMarketPrice} (from query2)`);
        return regularMarketPrice;
      }

      const quotes = result.indicators?.quote?.[0];
      const closes = quotes?.close || [];
      const lastClose = closes.filter((c: any) => c && c > 0).pop();

      if (lastClose && lastClose > 0) {
        console.log(`💱 [Yahoo FX] ✅ ${symbol} = ${lastClose} (from query2 closes)`);
        return lastClose;
      }
    }
  } catch (error) {
    console.error(`💱 [Yahoo FX] ❌ Both query1 and query2 failed for ${symbol}:`, error);
    throw error;
  }

  throw new Error(`No valid price found for ${symbol}`);
}

/**
 * Get cached FX rate if fresh (< 1 hour old)
 */
async function getCachedRate(fromCurrency: string, toCurrency: string): Promise<FxRateCache | null> {
  try {
    const key = `${FX_CACHE_PREFIX}${fromCurrency}_${toCurrency}`;
    const cached = await AsyncStorage.getItem(key);

    if (!cached) return null;

    const parsed: FxRateCache = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age < CACHE_DURATION_MS) {
      console.log(`💱 [Yahoo FX] 📦 Using cached ${fromCurrency}_${toCurrency} (${Math.round(age / 60000)}min old)`);
      return parsed;
    }

    console.log(`💱 [Yahoo FX] ⏰ Cache stale for ${fromCurrency}_${toCurrency} (${Math.round(age / 60000)}min old)`);
    return null;
  } catch (error) {
    console.error('💱 [Yahoo FX] Cache read error:', error);
    return null;
  }
}

/**
 * Save FX rate to cache
 */
async function setCachedRate(fromCurrency: string, toCurrency: string, rate: number): Promise<void> {
  try {
    const key = `${FX_CACHE_PREFIX}${fromCurrency}_${toCurrency}`;
    const cache: FxRateCache = {
      rate,
      timestamp: Date.now(),
      pair: `${fromCurrency}_${toCurrency}`,
    };
    await AsyncStorage.setItem(key, JSON.stringify(cache));
    console.log(`💱 [Yahoo FX] 💾 Cached ${fromCurrency}_${toCurrency} = ${rate}`);
  } catch (error) {
    console.error('💱 [Yahoo FX] Cache write error:', error);
  }
}

/**
 * Get exchange rate with caching
 * Returns the rate for: 1 FROM = X TO
 *
 * Example: getExchangeRate('SGD', 'USD') returns 0.768 (meaning 1 SGD = 0.768 USD)
 */
export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // Same currency = 1:1
  if (from === to) return 1;

  // Check cache first
  const cached = await getCachedRate(from, to);
  if (cached) {
    return cached.rate;
  }

  // Cache miss or stale - fetch fresh
  try {
    const rate = await fetchYahooFxRate(from, to);

    // Save to cache
    await setCachedRate(from, to, rate);

    return rate;
  } catch (error) {
    console.warn(`💱 [Yahoo FX] Failed to fetch ${from}_${to}, trying fallback...`);

    // Fallback: Try to calculate via USD
    if (from !== 'USD' && to !== 'USD') {
      try {
        const fromToUsd = await fetchYahooFxRate(from, 'USD');
        const usdToTo = await fetchYahooFxRate('USD', to);
        const calculatedRate = fromToUsd * usdToTo;

        console.log(`💱 [Yahoo FX] ✅ Calculated ${from}_${to} via USD = ${calculatedRate}`);

        // Cache the calculated rate
        await setCachedRate(from, to, calculatedRate);

        return calculatedRate;
      } catch (fallbackError) {
        console.error(`💱 [Yahoo FX] Fallback also failed for ${from}_${to}`);
      }
    }

    // Last resort: return 1 (will show as "1.00")
    console.warn(`💱 [Yahoo FX] ⚠️ Returning 1.00 for ${from}_${to} as last resort`);
    return 1;
  }
}

/**
 * Get last updated timestamp for a currency pair
 */
export async function getFxLastUpdated(fromCurrency: string, toCurrency: string): Promise<string | null> {
  const cached = await getCachedRate(fromCurrency, toCurrency);
  if (!cached) return null;

  return new Date(cached.timestamp).toISOString();
}

/**
 * Clear all FX cache (useful for debugging)
 */
export async function clearFxCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const fxKeys = allKeys.filter(key => key.startsWith(FX_CACHE_PREFIX));
    await AsyncStorage.multiRemove(fxKeys);
    console.log(`💱 [Yahoo FX] 🗑️ Cleared ${fxKeys.length} cached rates`);
  } catch (error) {
    console.error('💱 [Yahoo FX] Error clearing cache:', error);
  }
}
