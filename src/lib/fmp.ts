// FinancialModelingPrep API client (Stable API)
//
// FREE TIER (250 API calls/day):
//   ✓ Stock quotes (one at a time)
//   ✓ Historical price data
//   ✓ Company profiles
//   ✓ Key metrics
//   ✓ Earnings calendar
//   ✓ Financial ratios
//   ✗ Batch quotes (multiple symbols in one call) - PREMIUM ONLY
//
// This library automatically detects free vs premium and handles accordingly:
// - Tries batch calls first (premium)
// - Silently falls back to individual calls (free tier)
// - No errors shown to user for 402 responses

import { FMP_API_KEY as DEFAULT_FMP_API_KEY } from '../config/secrets';

// Track if user has premium (detected automatically)
let hasPremiumAccess = true; // Assume premium until we detect otherwise

export type FMPBar = { date: number; open: number; high: number; low: number; close: number; volume: number };

export type FMPFundamentals = {
  companyName?: string;
  sector?: string;
  industry?: string;
  description?: string;
  marketCap?: number;
  peRatio?: number;
  forwardPE?: number;
  eps?: number;
  dividendYield?: number;
  beta?: number;
  week52High?: number;
  week52Low?: number;
  avgVolume?: number;
  earningsHistory?: Array<{
    quarter: string;
    date: number;
    actual?: number;
    estimate?: number;
  }>;
};

export type FMPQuote = {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
  dayLow?: number;
  dayHigh?: number;
  yearHigh?: number;
  yearLow?: number;
  marketCap?: number;
  volume?: number;
  avgVolume?: number;
  pe?: number;
  eps?: number;
};

let API_KEY = DEFAULT_FMP_API_KEY;

export function setFMPApiKey(key: string) {
  API_KEY = key;
}

export function getFMPApiKey(): string {
  return API_KEY;
}

export function hasFMPPremium(): boolean {
  return hasPremiumAccess;
}

async function fetchFMP(endpoint: string, useStableApi = true): Promise<any> {
  const key = API_KEY || DEFAULT_FMP_API_KEY;
  if (!key) {
    throw new Error('FMP API key not set');
  }

  // Use new Stable API (for new API keys from 2025) or legacy v3 API
  const baseUrl = useStableApi
    ? 'https://financialmodelingprep.com/stable'
    : 'https://financialmodelingprep.com/api/v3';

  const url = `${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${key}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`Invalid API key or quota exceeded: ${JSON.stringify(errorData)}`);
    }
    if (res.status === 402) {
      throw new Error(`FMP HTTP 402: Premium feature required`);
    }
    throw new Error(`FMP HTTP ${res.status}`);
  }

  return await res.json();
}

// Helper to normalize FMP quote response (Stable API uses slightly different field names)
function normalizeQuote(item: any): FMPQuote {
  return {
    symbol: item.symbol,
    price: item.price,
    change: item.change,
    changesPercentage: item.changePercentage ?? item.changesPercentage ?? 0, // Stable API uses 'changePercentage'
    dayLow: item.dayLow,
    dayHigh: item.dayHigh,
    yearHigh: item.yearHigh,
    yearLow: item.yearLow,
    marketCap: item.marketCap,
    volume: item.volume,
    avgVolume: item.avgVolume,
    pe: item.pe,
    eps: item.eps,
  };
}

// Batch quote fetch - efficient for multiple symbols
// Note: Free tier may require individual calls, premium tier supports comma-separated batch
export async function fetchFMPBatchQuotes(symbols: string[]): Promise<Record<string, FMPQuote>> {
  if (!symbols.length) return {};

  const result: Record<string, FMPQuote> = {};

  // Try batch first (for premium users)
  if (symbols.length > 1) {
    try {
      const symbolList = symbols.join(',');
      const data = await fetchFMP(`/quote?symbol=${symbolList}`);

      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          result[item.symbol] = normalizeQuote(item);
        }
        return result;
      }
    } catch (e: any) {
      // If batch fails (402 Payment Required for free tier), fall through to individual calls
      if (e.message && e.message.includes('402')) {
        // Silently detect free tier - no need to log this as error
        hasPremiumAccess = false;
      } else {
        // Other errors should be logged but not thrown (we'll try individual calls)
        console.warn('[FMP] Batch quotes failed, using individual calls:', e.message);
      }
    }
  }

  // Fetch individually for free tier (or if batch failed)
  for (const symbol of symbols) {
    try {
      const data = await fetchFMP(`/quote?symbol=${symbol}`);
      if (Array.isArray(data) && data.length > 0) {
        result[symbol] = normalizeQuote(data[0]);
      }
      // Rate limiting: wait 200ms between calls to avoid hitting rate limits
      await new Promise(r => setTimeout(r, 200));
    } catch (e: any) {
      // Silently skip symbols that fail - don't show errors to user
      console.warn(`[FMP] Could not fetch ${symbol}:`, e.message);
    }
  }

  return result;
}

// Fetch historical data for a single symbol
export async function fetchDailyHistoryFMP(symbol: string, range: '1y'|'2y'|'5y'|'max' = '5y'): Promise<FMPBar[]> {
  if (!symbol) throw new Error('Bad symbol');

  // Calculate date range
  const to = new Date();
  const from = new Date();

  switch (range) {
    case '1y':
      from.setFullYear(from.getFullYear() - 1);
      break;
    case '2y':
      from.setFullYear(from.getFullYear() - 2);
      break;
    case '5y':
      from.setFullYear(from.getFullYear() - 5);
      break;
    case 'max':
      from.setFullYear(from.getFullYear() - 20); // FMP free tier usually has ~20 years
      break;
  }

  const fromStr = from.toISOString().split('T')[0];
  const toStr = to.toISOString().split('T')[0];

  // Stable API uses /historical-price-eod/full instead of /historical-price-full
  const data = await fetchFMP(`/historical-price-eod/full?symbol=${symbol}&from=${fromStr}&to=${toStr}`);

  if (!data || !Array.isArray(data)) {
    return [];
  }

  // Convert FMP format to our format
  // Stable API returns array directly, not wrapped in {historical: [...]}
  return data.map((bar: any) => ({
    date: new Date(bar.date).getTime(),
    open: Number(bar.open || 0),
    high: Number(bar.high || 0),
    low: Number(bar.low || 0),
    close: Number(bar.close || 0),
    volume: Number(bar.volume || 0),
  })).reverse(); // FMP returns newest first, we want oldest first
}

// Fetch company profile + key metrics in one efficient call
export async function fetchFMPFundamentals(symbol: string): Promise<FMPFundamentals | null> {
  if (!symbol) return null;

  try {
    // Use batch API to get profile, key metrics, and earnings in parallel
    // Stable API endpoints: /profile, /key-metrics, /earnings-calendar
    const [profile, keyMetrics, earnings] = await Promise.all([
      fetchFMP(`/profile?symbol=${symbol}`).catch(() => []),
      fetchFMP(`/key-metrics?symbol=${symbol}&limit=1`).catch(() => []),
      fetchFMP(`/earnings-calendar?symbol=${symbol}&limit=8`).catch(() => []),
    ]);

    const prof = Array.isArray(profile) && profile.length > 0 ? profile[0] : null;
    const metrics = Array.isArray(keyMetrics) && keyMetrics.length > 0 ? keyMetrics[0] : null;
    const earningsData = Array.isArray(earnings) ? earnings : [];

    if (!prof) {
      // Return placeholder data if profile not found
      return {
        companyName: symbol,
        earningsHistory: [],
      };
    }

    // Parse earnings history - filter for this symbol only and map fields correctly
    const earningsHistory = earningsData
      .filter((e: any) => e.symbol === symbol)
      .map((e: any) => ({
        quarter: e.date ? new Date(e.date).toISOString().slice(0, 7) : '', // Convert date to YYYY-MM format
        date: e.date ? new Date(e.date).getTime() : 0,
        actual: e.epsActual,
        estimate: e.epsEstimated,
      }))
      .filter((e: any) => e.quarter)
      .slice(0, 8); // Keep last 8 earnings

    return {
      companyName: prof.companyName,
      sector: prof.sector,
      industry: prof.industry,
      description: prof.description,
      marketCap: prof.mktCap,
      peRatio: metrics?.peRatio,
      forwardPE: prof.forwardPE,
      eps: metrics?.netIncomePerShare,
      dividendYield: prof.lastDiv ? (prof.lastDiv / prof.price) : undefined,
      beta: prof.beta,
      week52High: prof.range ? parseFloat(prof.range.split('-')[1]) : undefined,
      week52Low: prof.range ? parseFloat(prof.range.split('-')[0]) : undefined,
      avgVolume: prof.volAvg,
      earningsHistory,
    };
  } catch (err) {
    console.error('[FMP] Failed to fetch fundamentals:', symbol, err);
    return {
      companyName: symbol,
      earningsHistory: [],
    };
  }
}

// Batch fetch: Get quotes + historical data for multiple symbols efficiently
// This combines data fetching to minimize API calls
export async function fetchFMPBatchData(symbols: string[], range: '1y'|'2y'|'5y'|'max' = '5y'): Promise<{
  quotes: Record<string, FMPQuote>;
  history: Record<string, FMPBar[]>;
}> {
  const quotes = await fetchFMPBatchQuotes(symbols);

  // For historical data, we need individual calls, but we batch them with Promise.all
  const historyPromises = symbols.map(async (symbol) => {
    try {
      const bars = await fetchDailyHistoryFMP(symbol, range);
      return { symbol, bars };
    } catch {
      return { symbol, bars: [] };
    }
  });

  const historyResults = await Promise.all(historyPromises);
  const history: Record<string, FMPBar[]> = {};
  for (const { symbol, bars } of historyResults) {
    history[symbol] = bars;
  }

  return { quotes, history };
}
