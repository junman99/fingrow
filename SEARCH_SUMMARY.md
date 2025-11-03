# Fingrow Ticker Data Fetching - Search Summary

## Key Findings

This is a **React Native (Expo) mobile app** with **NO backend server**. All ticker/stock data fetching happens client-side, directly from the mobile app to external financial APIs.

---

## 1. API Endpoints That Fetch Ticker Data

### Financial Modeling Prep (FMP)
**File:** `/opt/fingrow/app/src/lib/fmp.ts` (305 lines)

#### Functions:
- `fetchFMPBatchQuotes(symbols[])` - Get quotes for multiple stocks
  - **Endpoint:** `POST /stable/quote?symbol=AAPL,MSFT,...`
  - Free tier: Falls back to individual calls (200ms delay between requests)
  - Premium tier: Batch endpoint (1 call for all symbols)

- `fetchDailyHistoryFMP(symbol, range)` - Historical OHLCV bars
  - **Endpoint:** `/stable/historical-price-eod/full?symbol=AAPL&from=2020-01-01&to=2025-01-01`
  - Ranges: 1y, 2y, 5y, max
  - Returns: Array of {date, open, high, low, close, volume}

- `fetchFMPFundamentals(symbol)` - Company fundamentals
  - **Endpoints:** 
    - `/stable/profile?symbol=AAPL`
    - `/stable/key-metrics?symbol=AAPL&limit=1`
    - `/stable/earnings-calendar?symbol=AAPL&limit=8`
  - Parallel requests for efficiency

- `fetchFMPBatchData(symbols[], range)` - Combined quotes + historical

**Auto-detects free vs premium tier:**
- Returns HTTP 402 for batch quotes on free tier
- Silently switches to individual calls
- No errors shown to user

---

### Yahoo Finance (No API Key)
**File:** `/opt/fingrow/app/src/lib/yahoo.ts` (212 lines)

#### Functions:
- `fetchDailyHistoryYahoo(symbol, range)` - Historical data (fallback provider)
  - Tries multiple endpoints for redundancy:
    1. `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=5y&interval=1d`
    2. `https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?range=5y&interval=1d`
    3. `https://query2.finance.yahoo.com/v7/finance/spark?symbols={symbol}`

- `fetchYahooFundamentals(symbol)` - Company details
  - **Endpoint:** `https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules=summaryDetail,price,defaultKeyStatistics,assetProfile,earningsHistory`
  - Fallback to query1 if query2 fails
  - Returns placeholder data on failure (UI still works)

---

### CoinGecko (Crypto, No API Key)
**File:** `/opt/fingrow/app/src/lib/coingecko.ts` (55 lines)

#### Functions:
- `fetchCrypto(sym, days)` - Crypto price + daily history
  - **Endpoint:** `https://api.coingecko.com/api/v3/coins/{id}/market_chart?vs_currency=usd&days={days}&interval=daily`
  - Supports: BTC, ETH (auto-converts aliases like XBT to BTC)

- `fetchCryptoOhlc(sym, days)` - OHLC bars
  - **Endpoint:** `https://api.coingecko.com/api/v3/coins/{id}/ohlc?vs_currency=usd&days={days}`

---

### Exchange Rates (FX Conversion)
**File:** `/opt/fingrow/app/src/lib/fx.ts` (40 lines)

#### Functions:
- `fetchFxUSD()` - Currency conversion rates
  - **Endpoint:** `https://api.exchangerate.host/latest?base=USD`
  - Returns: {base: 'USD', ts: timestamp, rates: {SGD: 1.35, EUR: 0.92, ...}}

---

## 2. Database Queries for Ticker/Stock Data

**There is NO backend database.** All data is stored locally on the device:

### AsyncStorage (Local Device Storage)
**Location:** `/opt/fingrow/app/src/store/invest.ts`

**Keys Used:**
- `fingrow:invest:v2` - Portfolios, holdings, watchlist (persisted)
  - Structure: {portfolios, portfolioOrder, activePortfolioId}
  - Data: Holding name, quantity, purchase price, date
  
- `fingrow:invest:v1` - Legacy format (for migration)

**What's STORED:**
- Portfolio structure (holdings, watchlist, cash balance)
- User preferences (data source: yahoo vs fmp)

**What's NOT STORED (Yet):**
- Quote prices
- Historical bars
- Company fundamentals
- FX rates
- This is the gap that caching will fill!

---

## 3. Existing Caching Mechanisms

### Current Caching (Limited):

1. **Zustand In-Memory Store**
   - File: `/opt/fingrow/app/src/store/invest.ts`
   - State: `quotes: Record<string, Quote>`
   - TTL: None (lost on app restart)
   - Purpose: Fast access during app session

2. **AsyncStorage Portfolio Cache**
   - Persists: Portfolio metadata only
   - Does NOT persist: Quotes or historical data

3. **Rate Limiting (Implicit)**
   - 200ms delay between FMP individual calls
   - 120ms delay between crypto/equity refreshes
   - FMP free tier: 250 calls/day (documented in FMP_API_GUIDE.md)

### Missing Caching Features:
- No persistent quote cache across app restarts
- No TTL/staleness checks
- No LRU eviction limits
- No deduplication of parallel requests
- No compression for large datasets
- No offline data fallback

---

## 4. Main Server File (Entry Point)

**File:** `/opt/fingrow/app/index.js`
```javascript
import { registerRootComponent } from 'expo';
import App from './src/App';
registerRootComponent(App);
```

**Main App Entry:** `/opt/fingrow/app/src/App.tsx`
- Sets up navigation (bottom tabs)
- Initializes stores (hydrate on startup)
- Sets up context providers

**No Express/Node.js backend** - This is purely client-side mobile app.

---

## 5. Data Flow Summary

```
User Opens App
    ↓
App.tsx → useInvestStore.hydrate()
    ├─ Load portfolios from AsyncStorage
    ├─ Load profile settings (data source preference)
    └─ Set quotes = {} (empty)
    ↓
User Opens Invest Screen
    ↓
refreshQuotes() called (from invest.ts)
    ├─ Determine data source (yahoo or fmp)
    ├─ Get all symbols from active portfolio
    ├─ Separate crypto symbols
    ↓
For each symbol:
    ├─ Crypto: fetchCrypto() from CoinGecko
    ├─ Equity (FMP): fetchFMPBatchQuotes() + fetchDailyHistoryFMP() + fetchFMPFundamentals()
    └─ Equity (Yahoo): fetchDailyHistoryYahoo() + fetchYahooFundamentals()
    ↓
fetchFxUSD() for portfolio valuation
    ↓
Update Zustand store (quotes)
    ↓
Render UI with real prices
    ↓
App closes
    ↓
Quotes lost (in-memory only)
    ↓
App reopens
    ↓
Back to empty quotes, must fetch again!
```

---

## 6. Key Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `/src/lib/fmp.ts` | 305 | FMP API client, batch quotes, fundamentals |
| `/src/lib/yahoo.ts` | 212 | Yahoo Finance client, fallback provider |
| `/src/lib/coingecko.ts` | 55 | Crypto prices from CoinGecko |
| `/src/lib/fx.ts` | 40 | Currency conversion rates |
| `/src/store/invest.ts` | 738 | Zustand store, quote refresh logic, portfolio mgmt |
| `/src/config/secrets.ts` | 1 | API keys (gitignored) |
| `/FMP_API_GUIDE.md` | 100 | Documentation of FMP free tier handling |

---

## 7. Technology Stack

- **Language:** TypeScript
- **Mobile Framework:** React Native (Expo 54.0.0)
- **State Management:** Zustand 4.5.7
- **Storage:** AsyncStorage 2.2.0
- **External APIs:**
  - FMP Stable API (financialmodelingprep.com/stable)
  - Yahoo Finance (query1/query2 endpoints)
  - CoinGecko (api.coingecko.com)
  - exchangerate.host

---

## 8. What You Need to Know for Adding Caching

### Current Pain Points:
1. **App startup slow** - Waits for API responses
2. **Offline not supported** - No fallback data
3. **Rate limits** - FMP free tier: 250 calls/day
4. **Network dependent** - Failures break the app
5. **API call waste** - Same symbols fetched multiple times

### Caching Opportunities:
1. **Quote cache (5 min TTL)** - Instant startup, reduce API calls 5x
2. **Historical bar cache (24h TTL)** - Stable data, cache aggressively
3. **Fundamentals cache (7d TTL)** - Company info changes slowly
4. **FX rate cache (24h TTL)** - Stable exchange rates

### Implementation:
- Create `/src/lib/quoteCache.ts` (see CACHING_IMPLEMENTATION_GUIDE.md)
- Add cache check in `refreshQuotes()`
- Persist cache to AsyncStorage
- See CACHING_IMPLEMENTATION_GUIDE.md for complete code examples

---

## 9. Additional Documentation Files Created

1. **TICKER_ARCHITECTURE.md** - Complete architecture overview
2. **CODE_REFERENCE.md** - API signatures and data types
3. **CACHING_IMPLEMENTATION_GUIDE.md** - Ready-to-implement caching solutions
4. **FMP_API_GUIDE.md** - Existing FMP free tier documentation

---

## 10. Quick Reference: Where Ticker Data is Fetched

| Component | File | Function | API |
|-----------|------|----------|-----|
| Quotes | invest.ts | refreshQuotes() | FMP/Yahoo |
| History | fmp.ts | fetchDailyHistoryFMP() | FMP |
| History | yahoo.ts | fetchDailyHistoryYahoo() | Yahoo |
| Fundamentals | fmp.ts | fetchFMPFundamentals() | FMP |
| Fundamentals | yahoo.ts | fetchYahooFundamentals() | Yahoo |
| Crypto | coingecko.ts | fetchCrypto() | CoinGecko |
| FX Rates | fx.ts | fetchFxUSD() | exchangerate.host |

---

## Questions Answered

**Q: Is there a backend/Express server?**
A: No. This is a client-side React Native app. All API calls go directly from mobile app to financial data providers.

**Q: Where are ticker quotes stored?**
A: Currently only in Zustand in-memory store (lost on app restart). Should be cached in AsyncStorage.

**Q: How many API endpoints are there?**
A: Multiple endpoints across 4 providers (FMP, Yahoo, CoinGecko, exchangerate.host)

**Q: What data providers are used?**
A: FMP (primary), Yahoo Finance (fallback), CoinGecko (crypto), exchangerate.host (FX)

**Q: Is there caching?**
A: Only in-memory during app session. No persistent cache across app restarts.

**Q: What's the free tier limit?**
A: FMP: 250 calls/day, Yahoo: no official limit, CoinGecko: ~10-50 calls/min per IP

**Q: How to add caching?**
A: See CACHING_IMPLEMENTATION_GUIDE.md for ready-to-use code examples.

