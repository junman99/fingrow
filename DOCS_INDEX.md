# Documentation Index - Ticker/Stock Data Fetching

## Overview

This codebase is a **React Native (Expo) mobile app** with **client-side ticker data fetching**. There is NO backend server. All financial data comes directly from external APIs.

---

## Documentation Files

### 1. **SEARCH_SUMMARY.md** (START HERE!)
**Best for:** Quick overview, answering key questions
- What APIs are used
- Where ticker data is fetched
- Existing caching mechanisms
- Quick reference tables
- **Read this first to understand the landscape**

### 2. **TICKER_ARCHITECTURE.md**
**Best for:** Deep understanding of the full system
- Complete architecture overview
- Data flow diagrams
- All API providers (FMP, Yahoo, CoinGecko, FX)
- Current caching mechanisms
- Rate limits for each provider
- Technical stack summary

### 3. **CODE_REFERENCE.md**
**Best for:** Looking up API signatures and data types
- Function signatures with full examples
- Data type definitions (TypeScript)
- Import statements
- Parameter descriptions
- Return types
- **Use this when coding**

### 4. **CACHING_IMPLEMENTATION_GUIDE.md**
**Best for:** Implementing quote caching
- Current problems (no persistent cache)
- Caching strategy with TTLs
- 3 implementation approaches (Simple, LRU, Hybrid)
- Complete code examples ready to use
- Step-by-step implementation instructions
- Testing strategies
- Performance impact analysis
- **Use this to add caching**

### 5. **FMP_API_GUIDE.md** (Existing)
**Best for:** Understanding FMP free tier handling
- Free vs Premium tier differences
- Auto-detection of tier
- Silent fallback mechanisms
- API usage tips
- Testing results

### 6. **README.md** (Existing)
**Best for:** General project info
- Project overview
- Setup instructions
- Main features

---

## Quick Decision Tree

**I want to...**

- **Understand what this app does with ticker data**
  → Read SEARCH_SUMMARY.md

- **See all API endpoints and function signatures**
  → Read CODE_REFERENCE.md

- **Understand the complete data flow**
  → Read TICKER_ARCHITECTURE.md

- **Learn how to add caching**
  → Read CACHING_IMPLEMENTATION_GUIDE.md

- **Debug FMP free tier issues**
  → Read FMP_API_GUIDE.md

- **Understand why API calls fail**
  → Check CACHING_IMPLEMENTATION_GUIDE.md (rate limits section)

---

## Key Discoveries

### 1. No Backend Server
This is entirely client-side. All API calls go directly from the mobile app to:
- Financial Modeling Prep (FMP)
- Yahoo Finance
- CoinGecko
- exchangerate.host

### 2. No Persistent Quote Caching
Currently:
- Quotes only cached in-memory (lost on app restart)
- Portfolio data cached to AsyncStorage (but NOT quotes)
- This is the main inefficiency to fix

### 3. Free Tier Handling
FMP free tier (250 calls/day) is already handled:
- Auto-detects 402 errors
- Falls back to individual calls
- No errors shown to user
- See FMP_API_GUIDE.md for details

### 4. Four Data Sources
- **FMP:** Primary for stocks (free tier: 250 calls/day)
- **Yahoo Finance:** Fallback for stocks (no limit)
- **CoinGecko:** Crypto only (10-50 calls/min)
- **exchangerate.host:** Currency conversion (unlimited)

### 5. Implementation Recommendation
Start with the Simple AsyncStorage cache approach:
```
Quote cache with 5 min TTL → Instant app startup
Historical bars 24h TTL → Reduces API calls 80%
Fundamentals 7d TTL → Company info stable
```

See CACHING_IMPLEMENTATION_GUIDE.md for complete code.

---

## File Locations Quick Reference

### Core API Clients
```
/src/lib/fmp.ts              (305 lines) - FMP API client
/src/lib/yahoo.ts            (212 lines) - Yahoo Finance client
/src/lib/coingecko.ts        (55 lines)  - Crypto data
/src/lib/fx.ts               (40 lines)  - Currency conversion
```

### State Management
```
/src/store/invest.ts         (738 lines) - Main quote/portfolio store
/src/store/profile.ts        - User preferences (data source)
```

### Configuration
```
/src/config/secrets.ts       - API keys (gitignored)
```

### Where to Add Caching
```
/src/lib/quoteCache.ts       - NEW FILE (see CACHING_IMPLEMENTATION_GUIDE.md)
```

---

## Data Types You'll See

### Quote (In-memory, currently not persisted)
```typescript
{
  symbol: string;
  last: number;              // current price
  change: number;            // $ change today
  changePct: number;         // % change today
  ts: number;                // timestamp
  line: [{t, v}];           // sparkline
  bars: [{t, o, h, l, c, v}]; // OHLCV
  fundamentals: {...};       // P/E, market cap, etc.
}
```

### Portfolio (Persisted to AsyncStorage)
```typescript
{
  id: string;
  name: string;
  baseCurrency: string;      // e.g., 'SGD'
  holdings: {                // symbol -> Holding
    AAPL: {
      symbol: string;
      name: string;
      type: 'stock'|'crypto';
      currency: string;
      lots: [{
        id: string;
        side: 'buy'|'sell';
        qty: number;
        price: number;
        date: string;
      }];
    }
  };
  watchlist: string[];       // symbols to track
  cash: number;              // cash balance
}
```

---

## Next Steps

1. **Read SEARCH_SUMMARY.md** to understand the current state
2. **Review CODE_REFERENCE.md** to see all available functions
3. **Read CACHING_IMPLEMENTATION_GUIDE.md** to plan caching
4. **Copy the code examples** from CACHING_IMPLEMENTATION_GUIDE.md
5. **Integrate with invest.ts** following the guide
6. **Test** using the test strategies provided

---

## Questions?

**Q: Is there a backend I need to modify?**
A: No. Everything is client-side.

**Q: Where should I add caching?**
A: Create `/src/lib/quoteCache.ts` (see CACHING_IMPLEMENTATION_GUIDE.md)

**Q: What API should I use for stocks?**
A: FMP is primary, Yahoo is fallback (see CODE_REFERENCE.md)

**Q: How often should I refresh quotes?**
A: 5-15 minutes during market hours (see CACHING_IMPLEMENTATION_GUIDE.md)

**Q: Can I use a different data source?**
A: Yes, user can choose Yahoo or FMP in Settings (profile store)

**Q: What about historical data?**
A: Cache with 24-hour TTL (see CACHING_IMPLEMENTATION_GUIDE.md)

---

## Document Statistics

| Document | Lines | Focus |
|----------|-------|-------|
| SEARCH_SUMMARY.md | 300+ | Overview, Q&A |
| TICKER_ARCHITECTURE.md | 350+ | Complete system |
| CODE_REFERENCE.md | 450+ | API signatures |
| CACHING_IMPLEMENTATION_GUIDE.md | 600+ | Implementation |
| FMP_API_GUIDE.md | 100 | FMP specific |
| **TOTAL** | **1,970+** | Complete reference |

---

## Last Updated
November 1, 2025

Created by: Code Search Analysis
