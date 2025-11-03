# Caching Implementation Guide

## Current State Analysis

### What Happens Now (No Persistent Caching)

```
App Launch
    ↓
useInvestStore.hydrate()
    ├─→ Loads portfolios from AsyncStorage
    └─→ Sets quotes = {} (empty)
    ↓
User opens Invest screen
    ↓
refreshQuotes() called
    ├─→ Fetch FMP/Yahoo APIs
    ├─→ Update Zustand store (quotes)
    └─→ Render UI
    ↓
App closed or screensaver
    ↓
Quotes lost! (only in memory)
    ↓
App reopened
    ↓
quotes = {} again
    ↓
Must re-fetch all data
```

### Problems This Creates

1. **Slow app startup** - Empty quotes until API calls complete
2. **Network dependent** - No fallback if offline
3. **Rate limit issues** - FMP free tier has 250 calls/day
4. **Poor UX** - Blank screens until data loads
5. **Wasted API calls** - Same symbols fetched multiple times per day

---

## Caching Strategy

### What to Cache

#### 1. Quote Data (Price + Change)
- **TTL:** 5-15 minutes during market hours, 1 hour after hours
- **Storage:** AsyncStorage + in-memory
- **Invalidation:** Manual refresh button or timer
- **Size:** ~200 bytes per symbol

#### 2. Historical Bars (OHLCV)
- **TTL:** 24 hours (data doesn't change after market close)
- **Storage:** AsyncStorage (compressed) + in-memory
- **Invalidation:** By range (1y, 2y, 5y separately)
- **Size:** ~5KB per symbol per range

#### 3. Fundamentals (P/E, Market Cap, etc.)
- **TTL:** 7 days (company info changes slowly)
- **Storage:** AsyncStorage
- **Invalidation:** Manual or weekly refresh
- **Size:** ~1KB per symbol

#### 4. FX Rates
- **TTL:** 24 hours
- **Storage:** AsyncStorage
- **Invalidation:** Daily refresh
- **Size:** ~100 bytes

---

## Implementation Approaches

### Approach 1: Simple AsyncStorage Cache (RECOMMENDED FOR START)

```typescript
// /src/lib/quoteCache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'fingrow:quotes:v1';
const CACHE_TTL = {
  quote: 5 * 60 * 1000,      // 5 minutes
  bars: 24 * 60 * 60 * 1000,  // 24 hours
  fundamentals: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export type CachedQuote = {
  data: Quote;
  fetchedAt: number;
  type: 'quote' | 'bars' | 'fundamentals';
};

export class QuoteCache {
  private cache: Map<string, CachedQuote> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.cache = new Map(data);
      }
    } catch (e) {
      console.warn('[QuoteCache] Failed to load cache:', e);
    }
    this.initialized = true;
  }

  async get(symbol: string): Promise<Quote | null> {
    const cached = this.cache.get(symbol);
    if (!cached) return null;

    const age = Date.now() - cached.fetchedAt;
    const ttl = CACHE_TTL[cached.type];

    if (age > ttl) {
      this.cache.delete(symbol);
      await this.save();
      return null;
    }

    return cached.data;
  }

  async set(symbol: string, quote: Quote, type: 'quote' | 'bars' | 'fundamentals'): Promise<void> {
    this.cache.set(symbol, {
      data: quote,
      fetchedAt: Date.now(),
      type,
    });
    await this.save();
  }

  async clear(): Promise<void> {
    this.cache.clear();
    await AsyncStorage.removeItem(CACHE_KEY);
  }

  private async save(): Promise<void> {
    try {
      const data = Array.from(this.cache.entries());
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[QuoteCache] Failed to save cache:', e);
    }
  }

  getSize(): number {
    return this.cache.size;
  }
}

export const quoteCache = new QuoteCache();
```

**Usage in invest.ts:**

```typescript
// In invest store setup
async hydrate() {
  await quoteCache.init();
  // ... existing hydrate code
}

// In refreshQuotes
refreshQuotes: async (symbols?: string[]) => {
  const quotes = { ...get().quotes } as any;
  
  // Check cache first
  for (const sym of symbols) {
    const cached = await quoteCache.get(sym);
    if (cached) {
      quotes[sym] = cached;
    }
  }
  
  // Only fetch symbols not in cache
  const toFetch = symbols.filter(s => !quotes[s]);
  if (toFetch.length === 0) return; // All cached!
  
  // ... existing fetch code ...
  
  // Cache the results
  for (const sym in quotes) {
    await quoteCache.set(sym, quotes[sym], 'quote');
  }
}
```

### Approach 2: In-Memory LRU Cache (Fast, No Persistence)

```typescript
// /src/lib/lruCache.ts

export class LRUCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize: number = 100, ttlMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  set(key: K, value: V): void {
    this.cache.delete(key); // Remove if exists
    this.cache.set(key, { value, timestamp: Date.now() });

    // Evict LRU if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const quoteCache = new LRUCache<string, Quote>(100); // 100 symbols max
```

### Approach 3: Hybrid (AsyncStorage + In-Memory)

Combines both:
- In-memory for speed (check first)
- AsyncStorage for persistence across restarts
- LRU eviction for in-memory, TTL for storage

```typescript
export class HybridQuoteCache {
  private memory: LRUCache<string, CachedQuote>;
  private async storage: AsyncStorage;

  async get(symbol: string): Promise<Quote | null> {
    // Check memory first (fastest)
    let cached = this.memory.get(symbol);
    if (cached) return cached.data;

    // Check storage (slower)
    cached = await this.getFromStorage(symbol);
    if (cached) {
      this.memory.set(symbol, cached); // Promote to memory
      return cached.data;
    }

    return null;
  }

  async set(symbol: string, quote: Quote): Promise<void> {
    const cached = { data: quote, fetchedAt: Date.now() };
    this.memory.set(symbol, cached);      // Fast path
    await this.saveToStorage(symbol, cached); // Persist
  }
}
```

---

## Implementation Steps

### Step 1: Create Cache Module
1. Create `/src/lib/quoteCache.ts` with QuoteCache class
2. Add init() to quoteCache at app startup
3. Export singleton instance

### Step 2: Integrate with Invest Store
1. Import quoteCache in invest.ts
2. Call `quoteCache.init()` in hydrate()
3. Check cache before fetching in refreshQuotes()
4. Save fetched quotes to cache

### Step 3: Add Cache Controls
1. Add "Clear Cache" button in Settings
2. Add cache size info in debug screen
3. Add manual refresh button on Invest screen

### Step 4: Monitor & Optimize
1. Log cache hits/misses
2. Track cache size growth
3. Adjust TTLs based on usage patterns

---

## Detailed Implementation: Simple Approach

### File 1: `/src/lib/quoteCache.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Quote } from '../store/invest';

const CACHE_KEY = 'fingrow:quotes:cache:v1';

export type CacheMetadata = {
  symbol: string;
  fetchedAt: number;
  ttlMs: number;
};

export type CachedData = {
  quote: Quote;
  metadata: CacheMetadata;
};

const DEFAULT_TTLS = {
  quote: 5 * 60 * 1000,                    // 5 minutes
  bars: 24 * 60 * 60 * 1000,               // 24 hours
  fundamentals: 7 * 24 * 60 * 60 * 1000,   // 7 days
  fx: 24 * 60 * 60 * 1000,                 // 24 hours
};

export class QuoteCache {
  private memory: Map<string, CachedData> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const entries = JSON.parse(raw) as Array<[string, CachedData]>;
        this.memory = new Map(entries);
        this.pruneExpired();
      }
      this.initialized = true;
    } catch (e) {
      console.warn('[QuoteCache] Init failed:', e);
      this.initialized = true;
    }
  }

  async get(symbol: string): Promise<Quote | null> {
    const cached = this.memory.get(symbol);
    if (!cached) return null;

    const age = Date.now() - cached.metadata.fetchedAt;
    if (age > cached.metadata.ttlMs) {
      this.memory.delete(symbol);
      await this.save();
      return null;
    }

    return cached.quote;
  }

  async set(symbol: string, quote: Quote, ttlMs?: number): Promise<void> {
    const cached: CachedData = {
      quote,
      metadata: {
        symbol,
        fetchedAt: Date.now(),
        ttlMs: ttlMs || DEFAULT_TTLS.quote,
      },
    };
    this.memory.set(symbol, cached);
    await this.save();
  }

  async getMultiple(symbols: string[]): Promise<Record<string, Quote>> {
    const result: Record<string, Quote> = {};
    for (const sym of symbols) {
      const quote = await this.get(sym);
      if (quote) result[sym] = quote;
    }
    return result;
  }

  async setMultiple(quotes: Record<string, Quote>, ttlMs?: number): Promise<void> {
    for (const [sym, quote] of Object.entries(quotes)) {
      await this.set(sym, quote, ttlMs);
    }
  }

  async clear(): Promise<void> {
    this.memory.clear();
    await AsyncStorage.removeItem(CACHE_KEY);
  }

  getStats(): { size: number; symbols: string[] } {
    return {
      size: this.memory.size,
      symbols: Array.from(this.memory.keys()),
    };
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [sym, cached] of this.memory.entries()) {
      if (now - cached.metadata.fetchedAt > cached.metadata.ttlMs) {
        this.memory.delete(sym);
      }
    }
  }

  private async save(): Promise<void> {
    try {
      this.pruneExpired();
      const entries = Array.from(this.memory.entries());
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('[QuoteCache] Save failed:', e);
    }
  }
}

export const quoteCache = new QuoteCache();
```

### File 2: Integration in `invest.ts`

Add to the hydrate function:
```typescript
hydrate: async () => {
  try {
    // Initialize cache FIRST
    await quoteCache.init();

    // ... existing portfolio hydration code ...

  } finally {
    set({ ready: true });
    // ... rest of hydrate
  }
}
```

Modify refreshQuotes to use cache:
```typescript
refreshQuotes: async (symbols?: string[]) => {
  set({ refreshing: true, error: undefined });
  let quotes = { ...get().quotes } as any;

  const target = symbols && symbols.length ? symbols : (get() as any).allSymbols();

  // CHECK CACHE FIRST!
  const cachedQuotes = await quoteCache.getMultiple(target);
  quotes = { ...quotes, ...cachedQuotes };

  // Only fetch symbols NOT in cache
  const toFetch = target.filter(s => !cachedQuotes[s]);

  if (toFetch.length === 0) {
    // All symbols cached!
    set({ quotes, refreshing: false });
    return;
  }

  // ... existing fetch code for toFetch symbols ...

  // After fetching, SAVE TO CACHE
  await quoteCache.setMultiple(quotes);

  set({ quotes, lastUpdated: Date.now(), refreshing: false });
}
```

---

## Testing Cache Implementation

```typescript
// Test in Invest screen or Settings

async function testCache() {
  // Clear cache
  await quoteCache.clear();
  
  // Fetch fresh
  await refreshQuotes(['AAPL', 'MSFT']);
  console.log('Cached:', quoteCache.getStats());
  
  // Close app, reopen
  // Should see cached data immediately!
  
  // Test stale data
  const cached = await quoteCache.get('AAPL');
  console.log('Got cached AAPL:', !!cached);
}
```

---

## Future Enhancements

1. **Progressive loading** - Return cached quotes immediately, fetch fresh in background
2. **Batch deduplication** - If multiple screens request same symbol, fetch once
3. **Compression** - Compress historical bars with gzip before storing
4. **Selective cache** - Different TTLs for crypto vs equities
5. **Cache warming** - Pre-fetch popular symbols on app start
6. **Analytics** - Track cache hit rate to optimize TTLs

---

## Performance Impact

### Before Caching
- App startup: Wait for API calls (~3-5 seconds for 10 symbols)
- Network required: Always
- API calls: 50-100 per day for 10 symbols
- Data loss: On app restart

### After Caching
- App startup: Instant (load from cache)
- Network required: Only for fresh data
- API calls: 10-20 per day for 10 symbols
- Data loss: After TTL expires
- Battery usage: Reduced (fewer network calls)

---

## Monitoring & Debugging

Add to Settings screen:

```typescript
function CacheDebugScreen() {
  const [stats, setStats] = useState({ size: 0, symbols: [] });

  useEffect(() => {
    setStats(quoteCache.getStats());
  }, []);

  return (
    <View>
      <Text>Cached symbols: {stats.size}</Text>
      <Text>{stats.symbols.join(', ')}</Text>
      <Button title="Clear Cache" onPress={async () => {
        await quoteCache.clear();
        setStats({ size: 0, symbols: [] });
      }} />
    </View>
  );
}
```

