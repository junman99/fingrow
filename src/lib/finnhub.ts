// Finnhub API client
//
// Finnhub provides real-time stock data with generous free tier:
//   ✓ Stock quotes (real-time)
//   ✓ Historical price data (candles)
//   ✓ Company profiles
//   ✓ Basic financials
//   ✓ 60 API calls/minute free tier
//
// Documentation: https://finnhub.io/docs/api

export type FinnhubBar = {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number
};

export type FinnhubFundamentals = {
  companyName?: string;
  logo?: string;
  sector?: string;
  industry?: string;
  description?: string;
  marketCap?: number;
  peRatio?: number;
  eps?: number;
  dividendYield?: number;
  beta?: number;
  week52High?: number;
  week52Low?: number;
  avgVolume?: number;
};

export type FinnhubQuote = {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  timestamp?: number;
};

let API_KEY = '';

export function setFinnhubApiKey(key: string) {
  API_KEY = key;
}

export function getFinnhubApiKey(): string {
  return API_KEY;
}

async function fetchFinnhub(endpoint: string): Promise<any> {
  const key = API_KEY;
  if (!key) {
    throw new Error('Finnhub API key not set');
  }

  const url = `https://finnhub.io/api/v1${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${key}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid Finnhub API key');
    }
    if (res.status === 429) {
      throw new Error('Finnhub rate limit exceeded');
    }
    throw new Error(`Finnhub HTTP ${res.status}`);
  }

  return await res.json();
}

// Fetch real-time quote for a symbol
export async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote> {
  if (!symbol) throw new Error('Bad symbol');

  const data = await fetchFinnhub(`/quote?symbol=${symbol}`);

  if (!data || data.error) {
    throw new Error(`No data found for ${symbol}`);
  }

  // Finnhub returns: {c: current, d: change, dp: percent change, h: high, l: low, o: open, pc: previous close}
  return {
    symbol,
    price: data.c || 0,
    change: data.d || 0,
    changesPercentage: data.dp || 0,
    dayHigh: data.h,
    dayLow: data.l,
    previousClose: data.pc,
    timestamp: data.t,
  };
}

// Fetch historical candle data
// Resolution: 1, 5, 15, 30, 60, D, W, M
export async function fetchFinnhubCandles(
  symbol: string,
  range: '1y' | '2y' | '5y' | 'max' = '5y'
): Promise<FinnhubBar[]> {
  if (!symbol) throw new Error('Bad symbol');

  // Calculate date range (Unix timestamps)
  const to = Math.floor(Date.now() / 1000);
  let from = to;

  switch (range) {
    case '1y':
      from = to - (365 * 24 * 60 * 60);
      break;
    case '2y':
      from = to - (2 * 365 * 24 * 60 * 60);
      break;
    case '5y':
      from = to - (5 * 365 * 24 * 60 * 60);
      break;
    case 'max':
      from = to - (20 * 365 * 24 * 60 * 60); // 20 years max
      break;
  }

  // Use daily resolution (D)
  const data = await fetchFinnhub(`/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}`);

  if (!data || data.s === 'no_data' || !Array.isArray(data.t)) {
    return [];
  }

  // Finnhub returns parallel arrays: {c: close[], h: high[], l: low[], o: open[], t: timestamp[], v: volume[]}
  const bars: FinnhubBar[] = [];
  for (let i = 0; i < data.t.length; i++) {
    bars.push({
      date: data.t[i] * 1000, // Convert Unix timestamp to milliseconds
      open: data.o[i] || 0,
      high: data.h[i] || 0,
      low: data.l[i] || 0,
      close: data.c[i] || 0,
      volume: data.v[i] || 0,
    });
  }

  return bars;
}

// Fetch company profile
export async function fetchFinnhubProfile(symbol: string): Promise<FinnhubFundamentals | null> {
  if (!symbol) return null;

  try {
    // Fetch company profile and basic financials in parallel
    const [profile, metrics] = await Promise.all([
      fetchFinnhub(`/stock/profile2?symbol=${symbol}`).catch(() => null),
      fetchFinnhub(`/stock/metric?symbol=${symbol}&metric=all`).catch(() => null),
    ]);

    if (!profile) {
      return {
        companyName: symbol,
      };
    }

    // Extract metrics from the metric response
    const metric = metrics?.metric || {};

    return {
      companyName: profile.name,
      logo: profile.logo,
      sector: profile.finnhubIndustry,
      industry: profile.finnhubIndustry,
      description: profile.description,
      marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1000000 : undefined,
      peRatio: metric.peNormalizedAnnual,
      eps: metric.epsBasicExclExtraItemsAnnual,
      dividendYield: metric.dividendYieldIndicatedAnnual,
      beta: metric.beta,
      week52High: metric['52WeekHigh'],
      week52Low: metric['52WeekLow'],
      avgVolume: metric.volumeAvg10Day,
    };
  } catch (err) {
    console.error('[Finnhub] Failed to fetch fundamentals:', symbol, err);
    return {
      companyName: symbol,
    };
  }
}

// Batch fetch quotes for multiple symbols
// Note: Finnhub doesn't have a batch endpoint, so we fetch individually with rate limiting
export async function fetchFinnhubBatchQuotes(symbols: string[]): Promise<Record<string, FinnhubQuote>> {
  if (!symbols.length) return {};

  const result: Record<string, FinnhubQuote> = {};

  for (const symbol of symbols) {
    try {
      const quote = await fetchFinnhubQuote(symbol);
      result[symbol] = quote;
      // Rate limiting: wait 100ms between calls (60 calls/min = 1 call per second on free tier)
      await new Promise(r => setTimeout(r, 1100));
    } catch (e: any) {
      console.warn(`[Finnhub] Could not fetch ${symbol}:`, e.message);
    }
  }

  return result;
}
