# 🚀 Caching Quick Start - 5 Minute Guide

## ✅ Already Done For You

I've already set everything up! Here's what's ready:

1. ✅ React Query installed
2. ✅ Persistent cache configured (survives app restarts)
3. ✅ Custom hooks created
4. ✅ App wrapper updated
5. ✅ Documentation written

## 🎯 Test It Right Now (30 seconds)

### On Your Phone (Expo Go):

1. **First time** - Open the app
   - You'll see normal loading (fetching from FMP/Yahoo)
   - Data loads in 2-3 seconds

2. **Close the app completely**
   - Swipe away or force close

3. **Reopen the app**
   - **Should be INSTANT!** (< 100ms)
   - Data loaded from cache
   - No API calls!

**If it's instant on 2nd open = caching is working! 🎉**

## 📝 Use It In Your Code (Copy-Paste Ready)

### Example 1: Simple Ticker Display

```typescript
import { useTickerData } from '../hooks/useTickerData';

function MyStockCard({ symbol }: { symbol: string }) {
  const { data, isLoading, error } = useTickerData({
    symbol,
    dataSource: 'yahoo', // or 'fmp'
  });

  if (isLoading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <View>
      <Text>{data.symbol}: ${data.last.toFixed(2)}</Text>
      <Text style={{ color: data.changePct >= 0 ? 'green' : 'red' }}>
        {data.changePct >= 0 ? '+' : ''}{data.changePct.toFixed(2)}%
      </Text>
    </View>
  );
}
```

### Example 2: Portfolio/Watchlist

```typescript
import { useMultipleTickerData } from '../hooks/useTickerData';

function WatchlistScreen() {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA'];

  const tickerResults = useMultipleTickerData(symbols, 'yahoo');

  // Check if any are still loading
  const isLoading = tickerResults.some(r => r.isLoading);

  // Extract successful data
  const quotes = tickerResults
    .filter(r => r.data)
    .map(r => r.data!);

  if (isLoading) return <LoadingSpinner />;

  return (
    <FlatList
      data={quotes}
      renderItem={({ item }) => (
        <View>
          <Text>{item.symbol}: ${item.last}</Text>
          <Text>{item.changePct}%</Text>
        </View>
      )}
    />
  );
}
```

### Example 3: With Pull-to-Refresh

```typescript
import { useMultipleTickerData } from '../hooks/useTickerData';
import { useQueryClient } from '@tanstack/react-query';

function PortfolioScreen() {
  const queryClient = useQueryClient();
  const symbols = ['AAPL', 'MSFT'];

  const tickerResults = useMultipleTickerData(symbols, 'yahoo');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);

    // Force refresh all tickers
    symbols.forEach(symbol => {
      queryClient.invalidateQueries({ queryKey: ['ticker', symbol] });
    });

    // Wait for refetch
    await Promise.all(tickerResults.map(r => r.refetch()));
    setRefreshing(false);
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Your content */}
    </ScrollView>
  );
}
```

## 🎓 What Each Hook Does

### `useTickerData()` - Single Ticker
- **Use for**: Individual stock screens
- **Cache**: 5 minutes
- **Returns**: Quote with price, change%, sparkline, bars

### `useMultipleTickerData()` - Multiple Tickers
- **Use for**: Watchlists, portfolios
- **Cache**: 5 minutes per ticker
- **Returns**: Array of query results

### `useHistoricalData()` - Long-term Charts
- **Use for**: 1Y, 5Y chart views
- **Cache**: 24 HOURS! (historical data doesn't change)
- **Returns**: Historical OHLCV data

## 🔧 Common Patterns

### Conditional Fetching
```typescript
const { data } = useTickerData({
  symbol: 'AAPL',
  enabled: isUserLoggedIn, // Only fetch if logged in
});
```

### Manual Refresh Single Ticker
```typescript
const { data, refetch } = useTickerData({ symbol: 'AAPL' });

<Button onPress={() => refetch()} title="Refresh" />
```

### Clear All Cache (Settings Screen)
```typescript
import { useQueryClient } from '@tanstack/react-query';

function SettingsScreen() {
  const queryClient = useQueryClient();

  const clearCache = () => {
    queryClient.clear();
    Alert.alert('Cache cleared!');
  };

  return <Button onPress={clearCache} title="Clear Cache" />;
}
```

## 📊 How It Works

```
User opens app
     ↓
Check cache (instant!)
     ↓
Is data < 5 min old?
     ↓
    YES → Show cached data (done!)
     ↓
    NO → Fetch from API in background
     ↓
Update cache for next time
```

## 🎯 Migration From Zustand

### Before (Zustand)
```typescript
useEffect(() => {
  useInvestStore.getState().refreshQuotes(['AAPL', 'MSFT']);
}, []);

const quotes = useInvestStore(state => state.quotes);
```

### After (React Query)
```typescript
const tickerResults = useMultipleTickerData(['AAPL', 'MSFT'], 'yahoo');

const quotes = tickerResults
  .filter(r => r.data)
  .reduce((acc, r) => {
    if (r.data) acc[r.data.symbol] = r.data;
    return acc;
  }, {});
```

## 💡 Pro Tips

1. **Cache is automatic** - Just use the hooks, caching happens behind the scenes
2. **Persists across restarts** - Cache survives app closes
3. **Background updates** - Stale data refreshes automatically
4. **Works offline** - Shows cached data when offline
5. **No duplicates** - Multiple components using same ticker = 1 API call

## 🐛 Troubleshooting

### Not seeing instant loads?
1. Make sure you closed app completely
2. Check AsyncStorage permissions
3. Look for errors in console

### Too many API calls?
1. Check you're using hooks correctly
2. Don't create new hook instances on every render
3. Use `enabled` to conditionally fetch

### Want to debug?
```bash
npm install @tanstack/react-query-devtools
```

Then in App.tsx:
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools/native';

// Add inside your providers
<ReactQueryDevtools initialIsOpen={false} />
```

## 📚 Full Documentation

- **Complete Guide**: `/CACHING_GUIDE.md`
- **Summary**: `/CACHING_IMPLEMENTATION_SUMMARY.md`
- **Hook Source**: `/src/hooks/useTickerData.ts`

## ✨ That's It!

You're ready to use caching in your app. Start by testing it (close and reopen app), then gradually migrate your screens to use the new hooks.

**Questions?** Check the full guides above.

**Need help?** React Query docs: https://tanstack.com/query/latest

---

**Next Step**: Try using `useTickerData()` in one of your existing screens!
