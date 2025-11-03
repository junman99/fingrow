# Code Reference Guide - Ticker Data Fetching

## 1. FMP API Client (`/src/lib/fmp.ts`)

### Main API Functions

```typescript
// Fetch quotes for multiple symbols (with free tier fallback)
export async function fetchFMPBatchQuotes(symbols: string[]): Promise<Record<string, FMPQuote>>

// Fetch historical OHLCV bars
export async function fetchDailyHistoryFMP(symbol: string, range: '1y'|'2y'|'5y'|'max'): Promise<FMPBar[]>

// Fetch company fundamentals (profile + metrics + earnings)
export async function fetchFMPFundamentals(symbol: string): Promise<FMPFundamentals | null>

// Combined batch: quotes + historical data
export async function fetchFMPBatchData(symbols: string[], range): Promise<{
  quotes: Record<string, FMPQuote>;
  history: Record<string, FMPBar[]>;
}>
```

### Data Types

```typescript
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

export type FMPBar = { 
  date: number;       // milliseconds
  open: number; 
  high: number; 
  low: number; 
  close: number; 
  volume: number 
};

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
```

### Important Details

**Free Tier Detection (line 144-146):**
```typescript
if (e.message && e.message.includes('402')) {
  // Silently detect free tier - no need to log this as error
  hasPremiumAccess = false;
}
```

**Rate Limiting (line 161-162):**
```typescript
// Rate limiting: wait 200ms between calls to avoid hitting rate limits
await new Promise(r => setTimeout(r, 200));
```

---

## 2. Yahoo Finance Client (`/src/lib/yahoo.ts`)

### Main API Functions

```typescript
// Fetch historical data (tries query1 → query2 → spark)
export async function fetchDailyHistoryYahoo(userSymbol: string, range: '1y'|'2y'|'5y'|'max'): Promise<YahooBar[]>

// Fetch company fundamentals
export async function fetchYahooFundamentals(userSymbol: string): Promise<YahooFundamentals | null>

// Convert user symbols to Yahoo format
export function toYahooSymbol(userSymbol: string): string
```

### Data Types

```typescript
export type YahooBar = { 
  date: number;       // milliseconds
  open: number; 
  high: number; 
  low: number; 
  close: number; 
  volume: number 
};

export type YahooFundamentals = {
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
```

---

## 3. CoinGecko Client (`/src/lib/coingecko.ts`)

### Main API Functions

```typescript
// Fetch crypto price + daily history
export async function fetchCrypto(sym: string, defaultDays: number = 365): Promise<{ last: number; line: CgPoint[] }>

// Fetch OHLC bars for crypto
export async function fetchCryptoOhlc(sym: string, days: number): Promise<CgBar[]>

// Check if symbol is crypto
export function isCryptoSymbol(sym: string): boolean

// Get base crypto symbol (BTC, ETH)
export function baseCryptoSymbol(sym: string): 'BTC' | 'ETH' | null
```

### Data Types

```typescript
export type CgPoint = { t: number; v: number };

export type CgBar = { 
  t: number;  // timestamp
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number   // close
};
```

---

## 4. Exchange Rates (`/src/lib/fx.ts`)

### Main API Functions

```typescript
// Fetch FX rates with USD base
export async function fetchFxUSD(): Promise<FxRates>

// Convert from USD to target currency
export function convertUSD(rates: FxRates | undefined, to: string, amountUSD: number): number

// Convert between any currencies
export function convertCurrency(rates: FxRates | undefined, amount: number, from: string, to: string): number
```

### Data Types

```typescript
export type FxRates = { 
  base: string;                      // 'USD'
  ts: number;                        // timestamp
  rates: Record<string, number>      // e.g., { 'SGD': 1.35, 'EUR': 0.92 }
};
```

---

## 5. Investment Store (`/src/store/invest.ts`)

### Main State Hook

```typescript
export const useInvestStore = create<State>((set, get) => ({
  // Current quotes (in-memory, ephemeral)
  quotes: Record<string, Quote>,
  
  // Control flags
  refreshing: boolean,
  lastUpdated?: number,
  error?: string,
  ready: boolean,
  
  // Data source config
  profile?: { currency?: string },
  
  // FX rates
  fxRates?: FxRates,
  
  // Main refresh method
  refreshQuotes: async (symbols?: string[]) => Promise<void>,
  
  // Persistence
  hydrate: async () => Promise<void>,
  persist: async () => Promise<void>,
  
  // ... portfolio management methods
}))
```

### Quote Data Type

```typescript
export type Quote = {
  symbol: string;
  last: number;                      // current price
  change: number;                    // absolute change today
  changePct: number;                 // percentage change
  ts: number;                        // timestamp of fetch
  line: Array<{ t: number; v: number }>; // sparkline data
  bars?: Array<{ 
    t: number;  // timestamp
    o: number;  // open
    h: number;  // high
    l: number;  // low
    c: number;  // close
    v: number   // volume
  }>;
  fundamentals?: {
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
};
```

### RefreshQuotes Implementation (lines 587-736)

**High-level flow:**
1. Get data source preference (yahoo or fmp) from profile store
2. Separate crypto and equity symbols
3. Fetch crypto via CoinGecko
4. Fetch equities via FMP or Yahoo (based on preference)
5. Fetch fundamentals for each symbol
6. Update Zustand store with all quotes
7. Persist timestamp as `lastUpdated`

**Key code snippet:**
```typescript
refreshQuotes: async (symbols?: string[]) => {
  set({ refreshing: true, error: undefined });
  const quotes = { ...get().quotes } as any;

  // Get data source preference
  let dataSource: 'yahoo' | 'fmp' = 'yahoo';
  try {
    const { useProfileStore } = await import('./profile');
    const profile = useProfileStore.getState().profile;
    dataSource = profile.dataSource || 'yahoo';
  } catch (e) {
    console.warn('[Invest Store] Failed to get profile, defaulting to Yahoo');
  }

  try {
    const target = symbols && symbols.length ? symbols : (get() as any).allSymbols();
    
    // Separate crypto and equity symbols
    const cryptoSymbols = target.filter((s: string) => isCryptoSymbol(s));
    const equitySymbols = target.filter((s: string) => !isCryptoSymbol(s));

    // Process crypto symbols...
    // Process equity symbols (FMP or Yahoo)...
    
    set({ quotes, lastUpdated: Date.now(), refreshing: false });
  } catch (e: any) {
    set({ quotes, refreshing: false, error: e?.message || 'Failed to refresh' });
  }
}
```

---

## 6. AsyncStorage Persistence

**Used in invest.ts:**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_V2 = 'fingrow:invest:v2';  // Latest version
const KEY_V1 = 'fingrow:invest:v1';  // Legacy

// Load from storage
async function hydrate() {
  const raw = await AsyncStorage.getItem(KEY_V2);
  const parsed = JSON.parse(raw);
  // ... update state
}

// Save to storage
async function persist() {
  const { portfolios, portfolioOrder, activePortfolioId } = get();
  await AsyncStorage.setItem(KEY_V2, JSON.stringify({ 
    portfolios, 
    portfolioOrder, 
    activePortfolioId 
  }));
}
```

**Note:** AsyncStorage currently persists ONLY portfolio structure, NOT quotes or historical data.

---

## 7. Configuration

**File:** `/src/config/secrets.ts` (gitignored template)

```typescript
export const FMP_API_KEY = 'your-fmp-api-key-here';
```

**Usage in invest.ts (lines 272-280):**
```typescript
// Initialize FMP API key on startup
try {
  const { useProfileStore } = await import('./profile');
  const profile = useProfileStore.getState().profile;
  if (profile.dataSource === 'fmp' && profile.fmpApiKey) {
    setFMPApiKey(profile.fmpApiKey);
  }
} catch (e) {
  console.warn('[Invest Store] Failed to initialize FMP API key:', e);
}
```

---

## 8. Where to Add Caching

### Option A: Wrap existing fetch functions

```typescript
// Before:
const quotes = await fetchFMPBatchQuotes(symbols);

// After:
const quotes = await cachedFetchFMPBatchQuotes(symbols);
```

### Option B: Cache in invest store

```typescript
export const useInvestStore = create<State>((set, get) => ({
  // Add cache metadata
  quoteCache: Record<string, { data: Quote; ts: number; ttl: number }>,
  
  // Modify refreshQuotes to check cache first
  refreshQuotes: async (symbols?: string[]) => {
    const cached = get().quoteCache[symbol];
    if (cached && Date.now() - cached.ts < cached.ttl) {
      return cached.data;  // Return cached
    }
    // Fetch fresh...
  }
}))
```

### Option C: Separate cache layer

```typescript
// /src/lib/quoteCache.ts
export class QuoteCache {
  private cache: Map<string, CachedQuote> = new Map();
  
  async get(symbol: string): Promise<Quote | null> {
    // Check cache + TTL
  }
  
  async set(symbol: string, quote: Quote, ttlMs: number): Promise<void> {
    // Store with expiration
  }
}
```

---

## 9. Current API Endpoints Reference

### FMP Stable API
```
Base URL: https://financialmodelingprep.com/stable

/quote?symbol=AAPL                                  # Get quote
/historical-price-eod/full?symbol=AAPL&from=X&to=Y # Historical data
/profile?symbol=AAPL                                # Company profile
/key-metrics?symbol=AAPL&limit=1                    # Key metrics
/earnings-calendar?symbol=AAPL&limit=8              # Earnings calendar
```

### Yahoo Finance
```
https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval=1d
https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval=1d
https://query2.finance.yahoo.com/v7/finance/spark?symbols={symbol}&range={range}&interval=1d
https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules=summaryDetail,price,defaultKeyStatistics,assetProfile,earningsHistory
```

### CoinGecko
```
https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days={days}&interval=daily
https://api.coingecko.com/api/v3/coins/{id}/ohlc?vs_currency=usd&days={days}
```

### Exchange Rates
```
https://api.exchangerate.host/latest?base=USD
```

