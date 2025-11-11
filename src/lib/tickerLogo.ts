/**
 * Ticker Logo Fetching and Caching
 * Uses Logo.dev API with 30-day local cache
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOGODEV_CONFIG, isLogoDevEnabled } from '../config/logodev';

const CACHE_PREFIX = 'fingrow/ticker_logo/';

type CachedLogo = {
  url: string;
  timestamp: number;
  ticker: string;
};

/**
 * Get cached logo if fresh (< 30 days old)
 */
async function getCachedLogo(ticker: string): Promise<string | null> {
  if (!isLogoDevEnabled()) return null;

  try {
    const key = `${CACHE_PREFIX}${ticker.toUpperCase()}`;
    const cached = await AsyncStorage.getItem(key);

    if (!cached) return null;

    const parsed: CachedLogo = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age < LOGODEV_CONFIG.cacheDuration) {
      console.log(`📸 [TickerLogo] Using cached logo for ${ticker} (${Math.round(age / (24 * 60 * 60 * 1000))} days old)`);
      return parsed.url;
    }

    console.log(`📸 [TickerLogo] Cache expired for ${ticker} (${Math.round(age / (24 * 60 * 60 * 1000))} days old)`);
    return null;
  } catch (error) {
    console.error('📸 [TickerLogo] Cache read error:', error);
    return null;
  }
}

/**
 * Save logo URL to cache
 */
async function setCachedLogo(ticker: string, url: string): Promise<void> {
  if (!isLogoDevEnabled()) return;

  try {
    const key = `${CACHE_PREFIX}${ticker.toUpperCase()}`;
    const cache: CachedLogo = {
      url,
      timestamp: Date.now(),
      ticker: ticker.toUpperCase(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(cache));
    console.log(`📸 [TickerLogo] Cached logo for ${ticker}`);
  } catch (error) {
    console.error('📸 [TickerLogo] Cache write error:', error);
  }
}

/**
 * Fetch logo URL from Logo.dev API
 * Uses domain-based approach since ticker endpoint has limited coverage
 */
async function fetchTickerLogo(ticker: string): Promise<string | null> {
  if (!isLogoDevEnabled()) {
    console.log('📸 [TickerLogo] Logo.dev API token not configured');
    return null;
  }

  const cleanTicker = ticker.toUpperCase().replace(/[^A-Z0-9]/g, '');

  try {
    // Logo.dev URLs are always valid - they return a placeholder if logo doesn't exist
    // Just return the URL directly without validation
    const tickerUrl = LOGODEV_CONFIG.tickerLogoUrl(cleanTicker, LOGODEV_CONFIG.apiToken);
    console.log(`📸 [TickerLogo] ✅ Generated URL for ${cleanTicker}`);
    return tickerUrl;
  } catch (error) {
    console.error(`📸 [TickerLogo] Error generating URL for ${ticker}:`, error);
    return null;
  }
}

/**
 * Get ticker logo URL with caching
 * Returns null if logo not available or API not configured
 */
export async function getTickerLogoUrl(ticker: string): Promise<string | null> {
  if (!ticker || !isLogoDevEnabled()) return null;

  const cleanTicker = ticker.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Check cache first
  const cached = await getCachedLogo(cleanTicker);
  if (cached) return cached;

  // Cache miss - fetch from API
  const url = await fetchTickerLogo(cleanTicker);

  if (url) {
    // Save to cache
    await setCachedLogo(cleanTicker, url);
    return url;
  }

  return null;
}

/**
 * Preload logos for multiple tickers (fire and forget)
 * Useful for warming up the cache
 */
export async function preloadTickerLogos(tickers: string[]): Promise<void> {
  if (!isLogoDevEnabled()) return;

  console.log(`📸 [TickerLogo] Preloading logos for ${tickers.length} tickers...`);

  // Fire and forget - don't await
  tickers.forEach(ticker => {
    getTickerLogoUrl(ticker).catch(err => {
      console.error(`📸 [TickerLogo] Preload failed for ${ticker}:`, err);
    });
  });
}

/**
 * Clear all cached logos (for debugging)
 */
export async function clearTickerLogoCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const logoKeys = allKeys.filter(key => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(logoKeys);
    console.log(`📸 [TickerLogo] 🗑️ Cleared ${logoKeys.length} cached logos`);
  } catch (error) {
    console.error('📸 [TickerLogo] Error clearing cache:', error);
  }
}
