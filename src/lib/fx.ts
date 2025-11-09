import AsyncStorage from '@react-native-async-storage/async-storage';

// FX via exchangerate-api.com (free, no API key required).
// We normalize to base USD for equities & crypto (Yahoo Finance & CoinGecko nominally in USD).
export type FxRates = { base: string; ts: number; rates: Record<string, number> };

// Extended type for cached rates with all cross-pairs
export type FxRatesExtended = {
  timestamp: number;
  lastUpdated: string;
  base: string;
  totalPairs: number;
  rates: Record<string, number>;
};

// Configuration
const FX_CACHE_KEY = 'fingrow/fx/rates';
const FX_CACHE_TIMESTAMP_KEY = 'fingrow/fx/timestamp';
const FX_SERVER_URL = 'http://54.251.186.141:8080/fx-rates.json';
const FX_FALLBACK_API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Fetch latest FX rates with base USD (e.g., USD->SGD). */
export async function fetchFxUSD(): Promise<FxRates> {
  const url = 'https://open.er-api.com/v6/latest/USD';
  const res = await fetch(url);
  if (!res.ok) throw new Error('FX HTTP ' + res.status);
  const json = await res.json();

  // Check if the API returned success
  if (json.result !== 'success') {
    throw new Error('FX API error: ' + (json.error?.info || 'Unknown error'));
  }

  return { base: 'USD', ts: Date.now(), rates: json?.rates || {} };
}

export function convertUSD(rates: FxRates | undefined, to: string, amountUSD: number): number {
  if (!rates || !rates.rates) return amountUSD;
  const rate = rates.rates[(to || 'USD').toUpperCase()];
  if (!rate) return amountUSD;
  return amountUSD * rate;
}

export function convertCurrency(rates: FxRates | undefined, amount: number, from: string, to: string): number {
  if (!Number.isFinite(amount)) return 0;
  const src = (from || 'USD').toUpperCase();
  const dest = (to || 'USD').toUpperCase();

  // Debug logging
  const shouldLog = Math.random() < 0.02; // Log 2% of calls
  if (shouldLog) {
    console.log('💱 [convertCurrency]', {
      amount,
      from: src,
      to: dest,
      hasRates: !!rates,
      ratesCount: rates?.rates ? Object.keys(rates.rates).length : 0,
      srcRate: rates?.rates?.[src],
      destRate: rates?.rates?.[dest],
    });
  }

  if (!rates || !rates.rates) {
    console.warn('⚠️ [convertCurrency] No FX rates available!');
    return amount;
  }

  if (src === dest) {
    if (shouldLog) console.log('💱 [convertCurrency] Same currency, returning amount:', amount);
    return amount;
  }

  let amountUSD = amount;
  if (src !== 'USD') {
    const rateFrom = rates.rates[src];
    if (rateFrom && rateFrom !== 0) {
      amountUSD = amount / rateFrom;
    }
  }

  if (dest === 'USD') return amountUSD;
  const rateTo = rates.rates[dest];
  if (!rateTo || rateTo === 0) return amountUSD;
  const result = amountUSD * rateTo;

  if (shouldLog) {
    console.log('💱 [convertCurrency] Result:', { amountUSD, rateTo, result });
  }

  return result;
}

/**
 * NEW CACHING SYSTEM
 * Fetches FX rates from Lightsail server with fallback to direct API
 * Caches rates locally for 24 hours
 */

/** Get cached FX rates from AsyncStorage */
async function getCachedRates(): Promise<FxRatesExtended | null> {
  try {
    const cached = await AsyncStorage.getItem(FX_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as FxRatesExtended;
    return parsed;
  } catch (error) {
    console.error('💱 [getCachedRates] Error reading cache:', error);
    return null;
  }
}

/** Save FX rates to AsyncStorage */
async function setCachedRates(rates: FxRatesExtended): Promise<void> {
  try {
    await AsyncStorage.setItem(FX_CACHE_KEY, JSON.stringify(rates));
    await AsyncStorage.setItem(FX_CACHE_TIMESTAMP_KEY, String(rates.timestamp));
    console.log(`💱 [setCachedRates] Cached ${rates.totalPairs} FX pairs. Last updated: ${rates.lastUpdated}`);
  } catch (error) {
    console.error('💱 [setCachedRates] Error saving cache:', error);
  }
}

/** Check if cached rates are stale (>24 hours old) */
function isCacheStale(timestamp: number): boolean {
  const age = Date.now() - timestamp;
  const isStale = age > CACHE_MAX_AGE_MS;

  if (isStale) {
    console.log(`💱 [isCacheStale] Cache is ${Math.round(age / (60 * 60 * 1000))} hours old (stale)`);
  }

  return isStale;
}

/** Fetch from Lightsail server */
async function fetchFromServer(): Promise<FxRatesExtended> {
  console.log(`💱 [fetchFromServer] Fetching from ${FX_SERVER_URL}...`);

  const response = await fetch(FX_SERVER_URL, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`💱 [fetchFromServer] Server returned ${response.status}`);
    throw new Error(`Server returned ${response.status}`);
  }

  const data = await response.json() as FxRatesExtended;
  console.log(`💱 [fetchFromServer] ✅ Success! Got ${data.totalPairs} pairs`);
  console.log(`💱 [fetchFromServer] Sample rates from server: SGD_USD=${data.rates['SGD_USD']}, USD_SGD=${data.rates['USD_SGD']}`);

  return data;
}

/** Fetch from direct API (fallback) - calculates all cross-rates from USD base */
async function fetchFromFallbackAPI(): Promise<FxRatesExtended> {
  console.log(`💱 [fetchFromFallbackAPI] Fetching from ${FX_FALLBACK_API_URL}...`);

  const response = await fetch(FX_FALLBACK_API_URL);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const json = await response.json();

  if (json.result !== 'success') {
    throw new Error(`API error: ${json.error?.info || 'Unknown error'}`);
  }

  // Get USD-based rates from API
  const usdRates: Record<string, number> = json.rates || {};
  const currencies = Object.keys(usdRates);

  console.log(`💱 [fetchFromFallbackAPI] Got ${currencies.length} currencies, calculating cross-rates...`);

  // Calculate ALL cross-rates (just like the server does)
  const allRates: Record<string, number> = {};

  // Add USD_ pairs
  for (const [currency, rate] of Object.entries(usdRates)) {
    allRates[`USD_${currency}`] = rate;
  }

  // Calculate cross-rates for all currency pairs
  for (const fromCurrency of currencies) {
    for (const toCurrency of currencies) {
      if (fromCurrency === toCurrency) continue; // Skip same currency

      const key = `${fromCurrency}_${toCurrency}`;
      if (allRates[key]) continue; // Already calculated

      const fromRate = usdRates[fromCurrency];
      const toRate = usdRates[toCurrency];

      if (fromRate && toRate && fromRate !== 0) {
        // Calculate cross-rate: FROM -> USD -> TO
        // If 1 USD = X FROM and 1 USD = Y TO
        // Then 1 FROM = (1/X) USD = (1/X) * Y TO = Y/X TO
        allRates[key] = toRate / fromRate;
      }
    }
  }

  const extended: FxRatesExtended = {
    timestamp: Date.now(),
    lastUpdated: new Date().toISOString(),
    base: 'USD',
    totalPairs: Object.keys(allRates).length,
    rates: allRates
  };

  console.log(`💱 [fetchFromFallbackAPI] ✅ Calculated ${extended.totalPairs} total pairs (including cross-rates)`);
  console.log(`💱 [fetchFromFallbackAPI] Sample: SGD_USD=${allRates['SGD_USD']}, USD_SGD=${allRates['USD_SGD']}`);

  return extended;
}

/**
 * Main function: Get FX rates with smart caching
 * 1. Check cache first
 * 2. If stale, try to fetch from server
 * 3. If server fails, try fallback API
 * 4. If all fails, use stale cache
 * 5. If no cache, throw error
 */
export async function getFxRates(): Promise<FxRatesExtended> {
  try {
    console.log('💱 [getFxRates] Starting...');

    // Check cache
    const cached = await getCachedRates();

    if (cached && !isCacheStale(cached.timestamp)) {
      console.log(`💱 [getFxRates] ✅ Using cached rates (${cached.totalPairs} pairs, fresh)`);
      console.log(`💱 [getFxRates] Sample from cache: SGD_USD=${cached.rates['SGD_USD']}, USD_SGD=${cached.rates['USD_SGD']}`);
      return cached;
    }

    // Cache is stale or doesn't exist, try to fetch fresh data
    if (cached) {
      console.log('💱 [getFxRates] ⚠️ Cache is stale, fetching fresh data...');
    } else {
      console.log('💱 [getFxRates] ⚠️ No cache found, fetching fresh data...');
    }

    // Try server first
    try {
      const serverRates = await fetchFromServer();
      await setCachedRates(serverRates);
      return serverRates;
    } catch (serverError) {
      console.warn('💱 [getFxRates] ❌ Server fetch failed:', serverError);

      // Try fallback API
      try {
        const fallbackRates = await fetchFromFallbackAPI();
        await setCachedRates(fallbackRates);
        return fallbackRates;
      } catch (fallbackError) {
        console.warn('💱 [getFxRates] ❌ Fallback API failed:', fallbackError);

        // Use stale cache if available
        if (cached) {
          console.log(`💱 [getFxRates] ⚠️ Using stale cache as last resort (${cached.totalPairs} pairs)`);
          console.log(`💱 [getFxRates] Stale cache sample: SGD_USD=${cached.rates['SGD_USD']}, USD_SGD=${cached.rates['USD_SGD']}`);
          return cached;
        }

        // No cache available, throw error
        throw new Error('Failed to fetch FX rates from all sources and no cache available');
      }
    }
  } catch (error) {
    console.error('💱 [getFxRates] 💥 Critical error:', error);
    throw error;
  }
}

/**
 * Get exchange rate between two currencies
 * Uses the new caching system
 */
export async function getExchangeRate(from: string, to: string): Promise<number> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  if (fromUpper === toUpper) return 1;

  const rates = await getFxRates();
  const key = `${fromUpper}_${toUpper}`;
  const rate = rates.rates[key];

  if (rate) {
    return rate;
  }

  // Fallback: calculate via USD if direct pair not found
  const fromToUSD = rates.rates[`${fromUpper}_USD`];
  const usdToTo = rates.rates[`USD_${toUpper}`];

  if (fromToUSD && usdToTo) {
    return fromToUSD * usdToTo;
  }

  console.warn(`💱 [getExchangeRate] No rate found for ${fromUpper} -> ${toUpper}`);
  return 1; // Fallback to 1:1
}

/**
 * Get last update timestamp from cache
 * Returns null if no cache exists
 */
export async function getFxLastUpdated(): Promise<string | null> {
  try {
    const cached = await getCachedRates();
    return cached?.lastUpdated || null;
  } catch (error) {
    console.error('💱 [getFxLastUpdated] Error:', error);
    return null;
  }
}

/**
 * Force refresh FX rates (bypass cache)
 */
export async function refreshFxRates(): Promise<FxRatesExtended> {
  console.log('💱 [refreshFxRates] Force refreshing FX rates...');

  try {
    const serverRates = await fetchFromServer();
    await setCachedRates(serverRates);
    return serverRates;
  } catch (serverError) {
    console.warn('💱 [refreshFxRates] Server fetch failed, trying fallback...');
    const fallbackRates = await fetchFromFallbackAPI();
    await setCachedRates(fallbackRates);
    return fallbackRates;
  }
}
