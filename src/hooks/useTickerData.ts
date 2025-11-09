import { useQuery, useQueries, UseQueryResult } from '@tanstack/react-query';
import { fetchDailyHistoryYahoo, fetchYahooFundamentals } from '../lib/yahoo';
import { fetchDailyHistoryFMP, fetchFMPFundamentals, fetchFMPBatchQuotes } from '../lib/fmp';
import { fetchFinnhubCandles, fetchFinnhubProfile } from '../lib/finnhub';
import { isCryptoSymbol, fetchYahooCrypto, baseCryptoSymbol, fetchYahooCryptoOhlc } from '../lib/yahoo-crypto';
import type { Quote } from '../features/invest';

type DataSource = 'yahoo' | 'fmp' | 'finnhub';

interface TickerDataOptions {
  symbol: string;
  dataSource?: DataSource;
  enabled?: boolean;
}

/**
 * Custom hook to fetch and cache ticker data using React Query
 *
 * Benefits:
 * - Automatic caching (5 min for quotes, 1 hour for historical)
 * - Background refetch on app reconnect
 * - Deduplication of requests
 * - Automatic retry on failure
 * - Reduced API calls to FMP/Yahoo/Finnhub
 */
export function useTickerData({ symbol, dataSource = 'yahoo', enabled = true }: TickerDataOptions): UseQueryResult<Quote, Error> {
  const isCrypto = isCryptoSymbol(symbol);

  return useQuery({
    queryKey: ['ticker', symbol, dataSource],
    queryFn: async (): Promise<Quote> => {
      // Crypto symbols always use CoinGecko
      if (isCrypto) {
        const base = baseCryptoSymbol(symbol);
        const cg = await fetchYahooCrypto(base || symbol, 365);
        const last = Number(cg?.line?.length ? cg.line[cg.line.length - 1].v : 0);
        const prev = Number(cg?.line?.length > 1 ? cg.line[cg.line.length - 2].v : last);
        const change = last - prev;
        const changePct = Number(prev ? ((change / prev) * 100).toFixed(2) : 0);

        let bars: any[] | undefined = undefined;
        try {
          const ohlc = await fetchYahooCryptoOhlc(base || symbol, 365);
          bars = (ohlc || []).map(b => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: 0 }));
        } catch {}

        return {
          symbol,
          last,
          change,
          changePct,
          ts: Date.now(),
          line: Array.isArray(cg?.line) ? cg.line : [],
          bars
        };
      }

      // Equity symbols use FMP, Yahoo, or Finnhub based on dataSource
      if (dataSource === 'fmp') {
        const [rawBars, fundamentals] = await Promise.all([
          fetchDailyHistoryFMP(symbol, '5y'),
          fetchFMPFundamentals(symbol).catch(() => null),
        ]);

        if (!rawBars || rawBars.length === 0) {
          throw new Error(`No data found for ${symbol}`);
        }

        const last = rawBars.length ? rawBars[rawBars.length - 1].close : 0;
        const prev = rawBars.length > 1 ? rawBars[rawBars.length - 2].close : last;
        const change = last - prev;
        const changePct = prev ? ((change / prev) * 100) : 0;
        const line = rawBars.map(b => ({ t: b.date, v: Number(b.close.toFixed(2)) }));
        const cbars = rawBars.map(b => ({
          t: b.date,
          o: b.open,
          h: b.high,
          l: b.low,
          c: b.close,
          v: b.volume
        }));

        return {
          symbol,
          last,
          change,
          changePct,
          ts: Date.now(),
          line,
          bars: cbars,
          fundamentals: fundamentals || undefined
        };
      } else if (dataSource === 'finnhub') {
        // Finnhub
        const [rawBars, fundamentals] = await Promise.all([
          fetchFinnhubCandles(symbol, '5y'),
          fetchFinnhubProfile(symbol).catch(() => null),
        ]);

        if (!rawBars || rawBars.length === 0) {
          throw new Error(`No data found for ${symbol}`);
        }

        const last = rawBars.length ? rawBars[rawBars.length - 1].close : 0;
        const prev = rawBars.length > 1 ? rawBars[rawBars.length - 2].close : last;
        const change = last - prev;
        const changePct = prev ? ((change / prev) * 100) : 0;
        const line = rawBars.map(b => ({ t: b.date, v: Number(b.close.toFixed(2)) }));
        const cbars = rawBars.map(b => ({
          t: b.date,
          o: b.open,
          h: b.high,
          l: b.low,
          c: b.close,
          v: b.volume
        }));

        return {
          symbol,
          last,
          change,
          changePct,
          ts: Date.now(),
          line,
          bars: cbars,
          fundamentals: fundamentals || undefined
        };
      } else {
        // Yahoo Finance
        const [rawBars, fundamentals] = await Promise.all([
          fetchDailyHistoryYahoo(symbol, '5y'),
          fetchYahooFundamentals(symbol).catch(() => null),
        ]);

        if (!rawBars || rawBars.length === 0) {
          throw new Error(`No data found for ${symbol}`);
        }

        const last = rawBars.length ? rawBars[rawBars.length - 1].close : 0;
        const prev = rawBars.length > 1 ? rawBars[rawBars.length - 2].close : last;
        const change = last - prev;
        const changePct = prev ? ((change / prev) * 100) : 0;
        const line = rawBars.map(b => ({ t: b.date, v: Number(b.close.toFixed(2)) }));
        const cbars = rawBars.map(b => ({
          t: b.date,
          o: b.open,
          h: b.high,
          l: b.low,
          c: b.close,
          v: b.volume
        }));

        return {
          symbol,
          last,
          change,
          changePct,
          ts: Date.now(),
          line,
          bars: cbars,
          fundamentals: fundamentals || undefined
        };
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - quote data is considered fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    retry: 2,
  });
}

/**
 * Hook to fetch multiple tickers at once with React Query
 * This deduplicates requests and caches each ticker independently
 */
export function useMultipleTickerData(symbols: string[], dataSource: DataSource = 'yahoo') {
  return useQueries({
    queries: symbols.map(symbol => ({
      queryKey: ['ticker', symbol, dataSource],
      queryFn: async (): Promise<Quote> => {
        const isCrypto = isCryptoSymbol(symbol);

        if (isCrypto) {
          const base = baseCryptoSymbol(symbol);
          const cg = await fetchYahooCrypto(base || symbol, 365);
          const last = Number(cg?.line?.length ? cg.line[cg.line.length - 1].v : 0);
          const prev = Number(cg?.line?.length > 1 ? cg.line[cg.line.length - 2].v : last);
          const change = last - prev;
          const changePct = Number(prev ? ((change / prev) * 100).toFixed(2) : 0);

          let bars: any[] | undefined = undefined;
          try {
            const ohlc = await fetchYahooCryptoOhlc(base || symbol, 365);
            bars = (ohlc || []).map(b => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: 0 }));
          } catch {}

          return {
            symbol,
            last,
            change,
            changePct,
            ts: Date.now(),
            line: Array.isArray(cg?.line) ? cg.line : [],
            bars
          };
        }

        // For equity symbols, use the appropriate data source
        if (dataSource === 'fmp') {
          const [rawBars, fundamentals] = await Promise.all([
            fetchDailyHistoryFMP(symbol, '5y'),
            fetchFMPFundamentals(symbol).catch(() => null),
          ]);

          if (!rawBars || rawBars.length === 0) {
            throw new Error(`No data found for ${symbol}`);
          }

          const last = rawBars.length ? rawBars[rawBars.length - 1].close : 0;
          const prev = rawBars.length > 1 ? rawBars[rawBars.length - 2].close : last;
          const change = last - prev;
          const changePct = prev ? ((change / prev) * 100) : 0;
          const line = rawBars.map(b => ({ t: b.date, v: Number(b.close.toFixed(2)) }));
          const cbars = rawBars.map(b => ({
            t: b.date,
            o: b.open,
            h: b.high,
            l: b.low,
            c: b.close,
            v: b.volume
          }));

          return {
            symbol,
            last,
            change,
            changePct,
            ts: Date.now(),
            line,
            bars: cbars,
            fundamentals: fundamentals || undefined
          };
        } else if (dataSource === 'finnhub') {
          const [rawBars, fundamentals] = await Promise.all([
            fetchFinnhubCandles(symbol, '5y'),
            fetchFinnhubProfile(symbol).catch(() => null),
          ]);

          if (!rawBars || rawBars.length === 0) {
            throw new Error(`No data found for ${symbol}`);
          }

          const last = rawBars.length ? rawBars[rawBars.length - 1].close : 0;
          const prev = rawBars.length > 1 ? rawBars[rawBars.length - 2].close : last;
          const change = last - prev;
          const changePct = prev ? ((change / prev) * 100) : 0;
          const line = rawBars.map(b => ({ t: b.date, v: Number(b.close.toFixed(2)) }));
          const cbars = rawBars.map(b => ({
            t: b.date,
            o: b.open,
            h: b.high,
            l: b.low,
            c: b.close,
            v: b.volume
          }));

          return {
            symbol,
            last,
            change,
            changePct,
            ts: Date.now(),
            line,
            bars: cbars,
            fundamentals: fundamentals || undefined
          };
        } else {
          const [rawBars, fundamentals] = await Promise.all([
            fetchDailyHistoryYahoo(symbol, '5y'),
            fetchYahooFundamentals(symbol).catch(() => null),
          ]);

          if (!rawBars || rawBars.length === 0) {
            throw new Error(`No data found for ${symbol}`);
          }

          const last = rawBars.length ? rawBars[rawBars.length - 1].close : 0;
          const prev = rawBars.length > 1 ? rawBars[rawBars.length - 2].close : last;
          const change = last - prev;
          const changePct = prev ? ((change / prev) * 100) : 0;
          const line = rawBars.map(b => ({ t: b.date, v: Number(b.close.toFixed(2)) }));
          const cbars = rawBars.map(b => ({
            t: b.date,
            o: b.open,
            h: b.high,
            l: b.low,
            c: b.close,
            v: b.volume
          }));

          return {
            symbol,
            last,
            change,
            changePct,
            ts: Date.now(),
            line,
            bars: cbars,
            fundamentals: fundamentals || undefined
          };
        }
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    })),
  });
}

/**
 * Hook for historical data with longer cache time
 * Historical data (1Y, 5Y) doesn't change, so we can cache it for 24 hours
 */
export function useHistoricalData(symbol: string, range: '1y' | '5y' = '5y', dataSource: DataSource = 'yahoo') {
  const isCrypto = isCryptoSymbol(symbol);

  return useQuery({
    queryKey: ['historical', symbol, range, dataSource],
    queryFn: async () => {
      if (isCrypto) {
        const base = baseCryptoSymbol(symbol);
        const days = range === '5y' ? 365 * 5 : 365;
        return await fetchYahooCrypto(base || symbol, days);
      } else if (dataSource === 'fmp') {
        return await fetchDailyHistoryFMP(symbol, range);
      } else if (dataSource === 'finnhub') {
        return await fetchFinnhubCandles(symbol, range);
      } else {
        return await fetchDailyHistoryYahoo(symbol, range);
      }
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - historical data doesn't change
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days - keep historical data longer
    retry: 2,
  });
}
