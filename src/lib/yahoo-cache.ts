/**
 * Caching layer for Yahoo Finance investment data
 * - 24-hour cache for historical data (5-year charts)
 * - 5-minute cache for current prices
 * - AsyncStorage persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchDailyHistoryYahoo, fetchYahooFundamentals, YahooBar, YahooFundamentals, YahooChartResult } from './yahoo';

const HISTORICAL_CACHE_PREFIX = 'fingrow/yahoo/historical/';
const PRICE_CACHE_PREFIX = 'fingrow/yahoo/price/';

const HISTORICAL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export type HistoricalCache = {
  symbol: string;
  bars: YahooBar[];
  fundamentals?: YahooFundamentals | null;
  companyName?: string;
  timestamp: number;
};

export type PriceCache = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  timestamp: number;
};

/**
 * Get cached historical data (5-year bars + fundamentals)
 */
async function getCachedHistorical(symbol: string): Promise<HistoricalCache | null> {
  try {
    const key = `${HISTORICAL_CACHE_PREFIX}${symbol}`;
    const cached = await AsyncStorage.getItem(key);

    if (!cached) return null;

    const parsed: HistoricalCache = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age < HISTORICAL_CACHE_DURATION) {
      console.log(`📊 [Yahoo Cache] Using cached historical for ${symbol} (${Math.round(age / 3600000)}h old)`);
      return parsed;
    }

    console.log(`📊 [Yahoo Cache] Historical cache stale for ${symbol}`);
    return null;
  } catch (error) {
    console.error(`📊 [Yahoo Cache] Error reading historical cache for ${symbol}:`, error);
    return null;
  }
}

/**
 * Save historical data to cache
 */
async function setCachedHistorical(symbol: string, bars: YahooBar[], fundamentals?: YahooFundamentals | null, companyName?: string): Promise<void> {
  try {
    const key = `${HISTORICAL_CACHE_PREFIX}${symbol}`;
    const cache: HistoricalCache = {
      symbol,
      bars,
      fundamentals,
      companyName,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(cache));
    console.log(`📊 [Yahoo Cache] 💾 Cached historical for ${symbol} (${bars.length} bars)${companyName ? ` - ${companyName}` : ''}`);
  } catch (error) {
    console.error(`📊 [Yahoo Cache] Error writing historical cache for ${symbol}:`, error);
  }
}

/**
 * Get cached current price
 */
async function getCachedPrice(symbol: string): Promise<PriceCache | null> {
  try {
    const key = `${PRICE_CACHE_PREFIX}${symbol}`;
    const cached = await AsyncStorage.getItem(key);

    if (!cached) return null;

    const parsed: PriceCache = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age < PRICE_CACHE_DURATION) {
      console.log(`💰 [Yahoo Cache] Using cached price for ${symbol} (${Math.round(age / 1000)}s old)`);
      return parsed;
    }

    return null;
  } catch (error) {
    console.error(`💰 [Yahoo Cache] Error reading price cache for ${symbol}:`, error);
    return null;
  }
}

/**
 * Save current price to cache
 */
async function setCachedPrice(symbol: string, price: number, change: number, changePct: number): Promise<void> {
  try {
    const key = `${PRICE_CACHE_PREFIX}${symbol}`;
    const cache: PriceCache = {
      symbol,
      price,
      change,
      changePct,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(cache));
    console.log(`💰 [Yahoo Cache] 💾 Cached price for ${symbol}: $${price}`);
  } catch (error) {
    console.error(`💰 [Yahoo Cache] Error writing price cache for ${symbol}:`, error);
  }
}

/**
 * Fetch historical data with caching
 * Returns cached data immediately if fresh, otherwise fetches from Yahoo
 */
export async function fetchHistoricalWithCache(
  symbol: string,
  range: '1y' | '2y' | '5y' | 'max' = '5y'
): Promise<{ bars: YahooBar[]; fundamentals?: YahooFundamentals | null; companyName?: string; fromCache: boolean }> {
  // Check cache first
  const cached = await getCachedHistorical(symbol);
  if (cached) {
    return { bars: cached.bars, fundamentals: cached.fundamentals, companyName: cached.companyName, fromCache: true };
  }

  // Cache miss - fetch from Yahoo
  console.log(`📊 [Yahoo Cache] Fetching fresh historical for ${symbol}...`);

  try {
    const result = await fetchDailyHistoryYahoo(symbol, range);
    let fundamentals: YahooFundamentals | null = null;

    // Extract company name from chart metadata
    const companyName = result.meta?.longName || result.meta?.shortName;

    // Only fetch fundamentals for stocks (not crypto, FX, etc.)
    if (!symbol.includes('=X') && !symbol.includes('-USD')) {
      try {
        fundamentals = await fetchYahooFundamentals(symbol);
      } catch (error) {
        console.warn(`📊 [Yahoo Cache] Failed to fetch fundamentals for ${symbol}:`, error);
      }
    }

    // Save to cache
    await setCachedHistorical(symbol, result.bars, fundamentals, companyName);

    return { bars: result.bars, fundamentals, companyName, fromCache: false };
  } catch (error) {
    console.error(`📊 [Yahoo Cache] Failed to fetch historical for ${symbol}:`, error);

    // If we have stale cache, return it anyway (better than nothing)
    if (cached) {
      console.log(`📊 [Yahoo Cache] ⚠️ Using stale cache for ${symbol} as fallback`);
      return { bars: cached.bars, fundamentals: cached.fundamentals, companyName: cached.companyName, fromCache: true };
    }

    throw error;
  }
}

/**
 * Fetch current price with caching
 * Uses the last bar from historical data
 */
export async function fetchPriceWithCache(symbol: string): Promise<{ price: number; change: number; changePct: number; fromCache: boolean }> {
  // Check cache first
  const cached = await getCachedPrice(symbol);
  if (cached) {
    return { price: cached.price, change: cached.change, changePct: cached.changePct, fromCache: true };
  }

  // Cache miss - fetch from Yahoo (use 1d chart for faster response)
  console.log(`💰 [Yahoo Cache] Fetching fresh price for ${symbol}...`);

  try {
    const result = await fetchDailyHistoryYahoo(symbol, '1y');

    if (!result.bars || result.bars.length === 0) {
      throw new Error('No price data available');
    }

    const lastBar = result.bars[result.bars.length - 1];
    const prevBar = result.bars.length > 1 ? result.bars[result.bars.length - 2] : lastBar;

    const price = lastBar.close;
    const prevClose = prevBar.close;
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    // Save to cache
    await setCachedPrice(symbol, price, change, changePct);

    return { price, change, changePct, fromCache: false };
  } catch (error) {
    console.error(`💰 [Yahoo Cache] Failed to fetch price for ${symbol}:`, error);

    // If we have stale cache, return it anyway
    if (cached) {
      console.log(`💰 [Yahoo Cache] ⚠️ Using stale cache for ${symbol} as fallback`);
      return { price: cached.price, change: cached.change, changePct: cached.changePct, fromCache: true };
    }

    throw error;
  }
}

/**
 * Clear all investment cache (useful for debugging)
 */
export async function clearInvestmentCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(
      key => key.startsWith(HISTORICAL_CACHE_PREFIX) || key.startsWith(PRICE_CACHE_PREFIX)
    );
    await AsyncStorage.multiRemove(cacheKeys);
    console.log(`📊 [Yahoo Cache] 🗑️ Cleared ${cacheKeys.length} cached items`);
  } catch (error) {
    console.error('📊 [Yahoo Cache] Error clearing cache:', error);
  }
}
