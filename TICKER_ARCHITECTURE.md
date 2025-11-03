# Fingrow - Ticker/Stock Data Fetching Architecture

## Project Overview
This is a **React Native (Expo) mobile app** with a **client-side only architecture**. There is NO backend server or Express/Node.js API. All ticker/stock data fetching happens directly from the mobile app to external financial APIs.

---

## Core Stock Data Fetching Components

### 1. Primary Data Sources

#### A. FMP (Financial Modeling Prep) - `/opt/fingrow/app/src/lib/fmp.ts`
**Status:** Fully integrated with free tier support
**API Base:** `https://financialmodelingprep.com/stable` (new Stable API)

**Key Functions:**
- `fetchFMPBatchQuotes(symbols: string[])` - Fetch quotes for multiple symbols
  - Tries batch endpoint first (premium feature)
  - Falls back to individual calls for free tier users
  - Auto-detects free vs premium tier
  - Includes 200ms delay between individual calls (rate limiting)

- `fetchDailyHistoryFMP(symbol, range)` - Historical price data
  - Supports ranges: '1y', '2y', '5y', 'max'
  - Returns OHLCV bars

- `fetchFMPFundamentals(symbol)` - Company fundamentals
  - Profile, key metrics, earnings calendar (3 parallel calls)
  - Includes P/E ratio, market cap, sector, industry, etc.

- `fetchFMPBatchData(symbols, range)` - Combined quotes + historical

**Free Tier Handling:**
- 250 API calls/day limit
- Batch calls return 402 error, silently falls back to individual calls
- No errors shown to user
- Auto-detects when premium feature used (sets `hasPremiumAccess = false`)

#### B. Yahoo Finance - `/opt/fingrow/app/src/lib/yahoo.ts`
**Status:** No API key required, fallback provider
**API Endpoints:**
- `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval=1d`
- `https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?range={range}&interval=1d` (fallback)
- `https://query2.finance.yahoo.com/v7/finance/spark` (spark fallback)
- `https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}` (fundamentals)

**Key Functions:**
- `fetchDailyHistoryYahoo(userSymbol, range)` - Historical data
  - Tries query1 → query2 → spark fallback
  - Handles symbol conversion (e.g., .TO for Toronto)

- `fetchYahooFundamentals(userSymbol)` - Company details
  - Queries query2 first, falls back to query1
  - Returns placeholder data on failure (for UI continuity)

#### C. CoinGecko - `/opt/fingrow/app/src/lib/coingecko.ts`
**Status:** Free, no API key required
**Purpose:** Crypto data (BTC, ETH)

**Key Functions:**
- `fetchCrypto(sym, defaultDays = 365)` - Crypto price + history
  - Returns last price and daily line data
  - Supports BTC, XBT, ETH variations

- `fetchCryptoOhlc(sym, days)` - OHLC bars for crypto

#### D. Exchange Rates - `/opt/fingrow/app/src/lib/fx.ts`
**Status:** Free via exchangerate.host (ECB rates)
**Purpose:** Currency conversion for portfolio valuations

**Key Function:**
- `fetchFxUSD()` - Latest FX rates with USD base

---

## 2. State Management & Quote Caching

### Store Location: `/opt/fingrow/app/src/store/invest.ts`

**Main Function:** `refreshQuotes(symbols?: string[])`
- Orchestrates all ticker data fetching
- Reads data source preference from profile store (yahoo vs fmp)
- Separates crypto and equity symbols
- Updates Zustand store with quotes

**State Structure:**
```typescript
quotes: Record<string, Quote> {
  symbol: string;
  last: number;
  change: number;
  changePct: number;
  ts: number;  // Timestamp of fetch
  line: Array<{ t: number; v: number }>;  // Sparkline
  bars?: Array<{ t; o; h; l; c; v }>;  // OHLCV
  fundamentals?: { ... };  // Company data
}
```

**Persistence Layer:**
- Uses `AsyncStorage` from `@react-native-async-storage/async-storage`
- Keys: `fingrow:invest:v2` (portfolios), `fingrow:invest:v1` (legacy)
- Methods: `hydrate()`, `persist()`

---

## 3. Current Caching Mechanisms

### What EXISTS:
1. **Zustand ephemeral state:**
   - `quotes` object holds in-memory cached quotes
   - `lastUpdated` timestamp tracks refresh time
   - Only valid while app is open
   - Lost on app restart

2. **AsyncStorage persistence:**
   - Stores portfolio data (holdings, watchlist, cash)
   - Portfolio metadata (name, type, base currency)
   - **Does NOT cache** ticker quotes or historical data
   - Only persists portfolio structure

3. **Rate limiting (implicit):**
   - 200ms delay between individual FMP calls
   - 120ms delay between crypto/equity refreshes
   - Free tier: 250 API calls/day (documented)

### What's MISSING:
1. **No persistent quote cache** - Quotes lost on app restart
2. **No expiration logic** - No TTL/staleness checks
3. **No LRU/size limits** - Quote cache unbounded
4. **No duplicate request deduplication** - Parallel requests for same symbol will fetch twice
5. **No compression/optimization** - Full OHLCV stored for all symbols

---

## 4. Data Flow Diagram

```
[User Actions]
    ↓
[useInvestStore.refreshQuotes(symbols)]
    ↓
[Check dataSource (yaml vs fmp) from profile store]
    ├─→ [FMP Path]
    │   ├─→ fetchFMPBatchQuotes()
    │   ├─→ fetchDailyHistoryFMP()
    │   └─→ fetchFMPFundamentals()
    │
    └─→ [Yahoo Path]
        ├─→ fetchDailyHistoryYahoo()
        └─→ fetchYahooFundamentals()
    
    [Crypto]
    └─→ fetchCrypto()
        └─→ fetchCryptoOhlc()
    
    [FX Rates (on startup)]
    └─→ fetchFxUSD()
        
    ↓
[Update quotes in Zustand store]
    ↓
[Render components with quotes]
```

---

## 5. File Structure Reference

### API Integration Layer:
```
/src/lib/
├── fmp.ts              (FMP API client - 305 lines)
├── yahoo.ts            (Yahoo Finance client - 212 lines)
├── coingecko.ts        (CoinGecko client - 55 lines)
├── fx.ts               (Exchange rates - 40 lines)
└── positions.ts        (PnL calculations)
```

### Store/State Management:
```
/src/store/
├── invest.ts           (Quote + portfolio store - 738 lines, Zustand)
├── profile.ts          (User preferences, data source config)
└── ... (other stores)
```

### Configuration:
```
/src/config/
└── secrets.ts          (API keys, gitignored template)
```

---

## 6. Integration Points

### Where Quotes Are Fetched:
1. **Invest screen** - Displays holdings and performance
2. **Portfolio details** - Shows quotes and charts
3. **Watchlist** - Real-time price updates
4. **Portfolio comparison** - Historical performance

### Where Quotes Are Used:
- Line charts (SparklineChart, MonthCompareChart)
- Portfolio valuation calculations
- PnL calculations
- Position tracking

---

## 7. Key Observations for Caching Implementation

### What Should Be Cached:
1. **Quote data** (last, change, changePct)
   - TTL: 5-15 minutes (active market hours)
   - TTL: 1 hour (after market hours)
   
2. **Historical bars** (OHLCV)
   - TTL: 24 hours (stable data)
   - Can cache multiple ranges (1y, 2y, 5y)

3. **Fundamentals data**
   - TTL: 7 days (company info changes slowly)
   - Cache by symbol

4. **FX rates**
   - TTL: 24 hours (daily updates)

### Storage Options:
1. **AsyncStorage** - Persist quotes across app restarts (current use)
2. **In-memory LRU** - Fast access with bounded memory
3. **SQLite** (via `expo-sqlite`) - Not yet used, but available
4. **File system** (via `expo-file-system`) - Heavier, for large datasets

### Smart Features to Add:
1. **Stale-while-revalidate** - Return cached data while fetching fresh
2. **Batch deduplication** - Group duplicate symbol requests
3. **Progressive loading** - Return quotes in chunks
4. **Error recovery** - Use cached data if fetch fails
5. **Offline support** - Return cached data when offline

---

## 8. API Rate Limits Summary

### FMP Free Tier:
- 250 calls/day
- Batch quotes: 1 call (premium) vs 100 calls (free)
- Historical: 1 call per symbol
- Fundamentals: ~3 calls per symbol (profile + metrics + earnings)

### Yahoo Finance:
- No official limit documented
- Rotating between query1/query2 for resilience
- Fallback to spark endpoint

### CoinGecko:
- 10-50 calls/minute per IP
- Free tier unlimited

### Exchange Rates:
- Typically unlimited on free tier

---

## 9. Configuration & Secrets

**File:** `/opt/fingrow/app/src/config/secrets.ts` (template)

```typescript
export const FMP_API_KEY = 'your-fmp-api-key-here';
```

**How it's used:**
- Loaded at app startup in `invest.ts` hydrate()
- Can be overridden via `setFMPApiKey()` function
- User can set custom API key in Settings screen

---

## 10. Recommended Next Steps

To add caching, you should:

1. Create `/src/lib/cache.ts` - Unified caching layer
2. Wrap `fetchFMPBatchQuotes`, `fetchDailyHistoryFMP`, etc. with cache logic
3. Store cache in AsyncStorage with TTL metadata
4. Implement stale-while-revalidate pattern
5. Add cache invalidation on user actions
6. Monitor cache size and implement LRU eviction

---

## Technical Stack Summary

**Language:** TypeScript
**Mobile Framework:** React Native (Expo)
**State Management:** Zustand 4.5.7
**Storage:** AsyncStorage 2.2.0
**External APIs:**
- FMP Stable API (financialmodelingprep.com)
- Yahoo Finance (query1/query2/v10 endpoints)
- CoinGecko (api.coingecko.com)
- exchangerate.host

**No Backend Server:** All API calls are client-side, directly from the mobile app

