import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchDailyHistoryStooq } from '../lib/stooq';
import { isCryptoSymbol, fetchCrypto, baseCryptoSymbol } from '../lib/coingecko';
import { fetchFxUSD, type FxRates } from '../lib/fx';
import { computePnL } from '../lib/positions';

export type InstrumentType = 'stock' | 'bond' | 'crypto' | 'fund' | 'etf';

export type Lot = {
  id: string;
  side: 'buy' | 'sell';
  qty: number;
  price: number;         // price in instrument currency
  fee?: number;
  date: string;          // ISO
  fx?: number;           // fx rate to base at fill time (optional)
};

export type Holding = {
  symbol: string;
  name: string;
  type: InstrumentType;
  currency: string;
  lots: Lot[];
};

export type Quote = {
  symbol: string;
  last: number;
  change: number;       // absolute change today
  changePct: number;
  ts: number;
  line: Array<{ t: number; v: number }>; // sparkline / chart
  bars?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
};

type State = {
  // persisted
  holdings: Record<string, Holding>;
  watchlist: string[];
  // ephemeral
  quotes: Record<string, Quote>;
  ready: boolean;
  lastUpdated?: number;
  refreshing: boolean;
  error?: string;
  fxRates?: FxRates;
  refreshFx: () => Promise<void>;
  updateLot: (symbol: string, lotId: string, patch: Partial<Lot>) => Promise<void>;
  hydrate: () => Promise<void>;
  addLot: (symbol: string, lot: Omit<Lot, 'id'>, meta: { name: string; type: InstrumentType; currency: string }) => Promise<void>;
  removeLot: (symbol: string, lotId: string) => Promise<void>;
  setWatch: (symbols: string[]) => Promise<void>;
  addWatch: (symbol: string) => Promise<void>;
  removeWatch: (symbol: string) => Promise<void>;
  refreshQuotes: (symbols: string[]) => Promise<void>;
};

const KEY = 'fingrow:invest:v1';

// small demo quote generator (client-only); replace with real API later
function genDemoLine(base: number): Array<{ t: number; v: number }> {
  const now = Date.now();
  const out: Array<{ t: number; v: number }> = [];
  let v = base;
  for (let i=60; i>=0; i--) {
    // minute steps over ~1h; small random walk
    v = Math.max(0.1, v * (1 + (Math.random()-0.5) * 0.01));
    out.push({ t: now - i*60_000, v: Number(v.toFixed(2)) });
  }
  return out;
}

const DEMO_META: Record<string, { name: string; type: InstrumentType; currency: string; price: number }> = {
  AAPL: { name:'Apple Inc.', type:'stock', currency:'USD', price: 192.2 },
  TSLA: { name:'Tesla, Inc.', type:'stock', currency:'USD', price: 248.5 },
  'BTC-USD': { name:'Bitcoin', type:'crypto', currency:'USD', price: 61500 },
  SPY:  { name:'SPDR S&P 500 ETF', type:'etf', currency:'USD', price: 556.1 },
};

export const useInvestStore = create<State>((set, get) => ({
  holdings: {},
  watchlist: ['AAPL','TSLA','SPY','BTCUSD'],
  quotes: {},
  ready: false,
  fxRates: undefined,
  refreshing: false,
  error: undefined,
  refreshFx: async () => { try { const fx = await fetchFxUSD(); set({ fxRates: fx }); } catch (e) {} },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({ holdings: parsed.holdings || {}, watchlist: parsed.watchlist || [] });
      }
    } finally {
      set({ ready: true });
    }
  },
  persist: async () => {
    const { holdings, watchlist } = get() as any;
    await AsyncStorage.setItem(KEY, JSON.stringify({ holdings, watchlist }));
  },
  addLot: async (symbol, lot, meta) => {
    const id = Math.random().toString(36).slice(2);
    const holdings = { ...get().holdings };
    if (!holdings[symbol]) {
      holdings[symbol] = { symbol, name: meta.name, type: meta.type, currency: meta.currency, lots: [] };
    }
    holdings[symbol] = { ...holdings[symbol], lots: [...holdings[symbol].lots, { ...lot, id }] };
    set({ holdings });
    await (get() as any).persist();
  },
  updateLot: async (symbol, lotId, patch) => {
    const holdings = { ...get().holdings } as any;
    if (!holdings[symbol]) return;
    holdings[symbol] = { ...holdings[symbol], lots: holdings[symbol].lots.map((l:any)=> l.id===lotId ? { ...l, ...patch } : l) };
    set({ holdings });
    await (get() as any).persist();
  },
  removeLot: async (symbol, lotId) => {
    const holdings = { ...get().holdings };
    if (!holdings[symbol]) return;
    holdings[symbol] = { ...holdings[symbol], lots: holdings[symbol].lots.filter(l => l.id !== lotId) };
    set({ holdings });
    await (get() as any).persist();
  },
  setWatch: async (symbols) => {
    set({ watchlist: symbols });
    await (get() as any).persist();
  },
  addWatch: async (symbol) => {
    const s = new Set(get().watchlist);
    s.add(symbol);
    set({ watchlist: Array.from(s) });
    await (get() as any).persist();
  },
  removeWatch: async (symbol) => {
    set({ watchlist: get().watchlist.filter(s => s !== symbol) });
    await (get() as any).persist();
  },
  
    refreshQuotes: async (symbols) => {
    set({ refreshing: true, error: undefined });
    const quotes = { ...get().quotes } as any;
    try {
      await Promise.all(symbols.map(async (sym) => {
        try {
          if (isCryptoSymbol(sym)) {
            const base = baseCryptoSymbol(sym)!;
            const { last, line } = await fetchCrypto(base, 365);
            const prev = line[line.length - 2]?.v ?? last;
            const change = Number((last - prev).toFixed(2));
            const changePct = Number((prev ? (change / prev) * 100 : 0).toFixed(2));
            quotes[sym] = { symbol: sym, last: Number(last.toFixed(2)), change, changePct, ts: Date.now(), line };
          } else {
            const bars = await fetchDailyHistoryStooq(sym);
            if (!bars.length) return;
            const lastBar = bars[bars.length - 1];
            const prevBar = bars[bars.length - 2] || lastBar;
            const last = Number(lastBar.close.toFixed(2));
            const change = Number((lastBar.close - prevBar.close).toFixed(2));
            const changePct = Number((prevBar.close ? (change / prevBar.close) * 100 : 0).toFixed(2));
            const line = bars.map(b => ({ t: b.date, v: Number(b.close.toFixed(2)) }));
            const cbars = bars.map(b => ({ t: b.date, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume }));
            quotes[sym] = { symbol: sym, last, change, changePct, ts: Date.now(), line, bars: cbars };
          }
        } catch (e) {
          // keep existing quote if fetch fails
        }
      }));
      set({ quotes, lastUpdated: Date.now(), refreshing: false });
    } catch (e: any) {
      set({ quotes, refreshing: false, error: e?.message || 'Failed to refresh' });
    }
  },
}));