
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchDailyHistoryYahoo, fetchYahooFundamentals } from '../lib/yahoo';
import { fetchDailyHistoryFMP, fetchFMPFundamentals, fetchFMPBatchQuotes, setFMPApiKey } from '../lib/fmp';
import { isCryptoSymbol, fetchCrypto, baseCryptoSymbol, fetchCryptoOhlc } from '../lib/coingecko';
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
};

export type Holding = {
  symbol: string;
  name: string;
  type: InstrumentType;
  currency: string;
  lots: Lot[]; // FIFO assumed for realized PnL elsewhere
  archived?: boolean;
};

export type Quote = {
  symbol: string;
  last: number;
  change: number;       // absolute change today
  changePct: number;
  ts: number;
  line: Array<{ t: number; v: number }>; // sparkline / chart
  bars?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
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

export type Portfolio = {
  id: string;
  name: string;
  baseCurrency: string;   // e.g., 'SGD'
  benchmark?: string;     // e.g., 'SPY', 'QQQ', 'STI'
  watchlist: string[];
  holdings: Record<string, Holding>;
  holdingsOrder?: string[];
  type?: 'Live' | 'Paper';
  archived?: boolean;
  cash?: number;          // cash balance in baseCurrency
  cashEvents?: Array<{ date: string; amount: number }>; // history of cash adjustments
  createdAt: string;
  updatedAt?: string;
};

type State = {
  // v1 mirrors (kept for UI components that still read these)
  holdings: Record<string, Holding>;
  watchlist: string[];

  // v2 persisted
  portfolios: Record<string, Portfolio>;
  portfolioOrder: string[];
  activePortfolioId: string | null;
  profile?: { currency?: string };

  // ephemeral
  quotes: Record<string, Quote>;
  ready: boolean;
  lastUpdated?: number;
  refreshing: boolean;
  error?: string;
  fxRates?: FxRates;

  // lifecycle
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  refreshFx: () => Promise<void>;

  // portfolio ops
  createPortfolio: (name: string, baseCurrency: string, opts?: { benchmark?: string, seedFromActive?: boolean, type?: 'Live'|'Paper' }) => Promise<string>;
  renamePortfolio: (id: string, name: string) => Promise<void>;
  setActivePortfolio: (id: string) => Promise<void>;
  archivePortfolio: (id: string) => Promise<void>;
  setPortfolioArchived: (id: string, archived: boolean) => Promise<void>;
  deletePortfolio: (id: string) => Promise<void>;

  // order ops
  setPortfolioOrder: (order: string[]) => Promise<void>;

  // holdings ops
  addHolding: (symbol: string, meta: { name: string; type: InstrumentType; currency: string }, opts?: { portfolioId?: string }) => Promise<void>;
  moveHoldingBetweenPortfolios: (args: { symbol: string; fromId: string; toId: string; mode?: 'lots'|'aggregate' }) => Promise<void>;
  addLot: (symbol: string, lot: Omit<Lot,'id'>, meta: { name: string; type: InstrumentType; currency: string }, opts?: { portfolioId?: string }) => Promise<void>;
  updateLot: (symbol: string, lotId: string, patch: Partial<Lot>, opts?: { portfolioId?: string }) => Promise<void>;
  removeLot: (symbol: string, lotId: string, opts?: { portfolioId?: string }) => Promise<void>;
  removeHolding: (symbol: string, opts?: { portfolioId?: string }) => Promise<void>;
  setHoldingsArchived: (args: { portfolioId?: string; symbols: string[]; archived: boolean }) => Promise<void>;
  setHoldingsOrder: (portfolioId: string, order: string[]) => Promise<void>;

  // cash ops
  addCash: (amount: number, opts?: { portfolioId?: string }) => Promise<void>; // positive=deposit, negative=withdraw

  // watchlist ops
  setWatch: (symbols: string[], opts?: { portfolioId?: string }) => Promise<void>;
  addWatch: (symbol: string, opts?: { portfolioId?: string }) => Promise<void>;
  removeWatch: (symbol: string, opts?: { portfolioId?: string }) => Promise<void>;

  // quotes
  refreshQuotes: (symbols?: string[]) => Promise<void>;

  // selectors
  activePortfolio: () => Portfolio | null;
  allSymbols: () => string[];
};

const KEY_V1 = 'fingrow:invest:v1';
const KEY_V2 = 'fingrow:invest:v2';

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

function uniq<T>(arr: T[]) { return Array.from(new Set(arr)); }

export const useInvestStore = create<State>((set, get) => ({
  // mirrors for active portfolio (not persisted in v2)
  holdings: {},
  watchlist: [],

  // v2 persisted
  portfolios: {},
  portfolioOrder: [],
  activePortfolioId: null,

  // ephemeral
  quotes: {},
  ready: false,
  fxRates: undefined,
  refreshing: false,
  error: undefined,

  activePortfolio: () => {
    const { activePortfolioId, portfolios } = get();
    return activePortfolioId ? (portfolios[activePortfolioId] || null) : null;
  },

  allSymbols: () => {
    const { portfolios } = get();
    const syms: string[] = [];
    Object.values(portfolios || {}).forEach((p: any) => {
      if (!p) return;
      const holds = (p.holdings || {}) as Record<string, any>;
      const watch = (p.watchlist || []) as string[];
      try { Object.keys(holds).forEach(s => syms.push(s)); } catch {}
      try { watch.forEach(s => syms.push(s)); } catch {}
    });
    return uniq(syms);
  },

  // helper to sync v1 mirrors
  // ensure UI reading `holdings` / `watchlist` sees active portfolio
  // call this after any portfolio change or active switch
  // (not exported)
  // @ts-ignore
  _syncMirrors: () => {
    const p = get().activePortfolio();
    set({ holdings: p?.holdings || {}, watchlist: p?.watchlist || [] });
  },

  refreshFx: async () => { try { const fx = await fetchFxUSD(); set({ fxRates: fx }); } catch (e) {} },

  hydrate: async () => {
    try {
      // Try v2
      const raw2 = await AsyncStorage.getItem(KEY_V2);
      if (raw2) {
        const parsed = JSON.parse(raw2);
        set({
          portfolios: parsed.portfolios || {},
          portfolioOrder: parsed.portfolioOrder || Object.keys(parsed.portfolios || {}),
          activePortfolioId: parsed.activePortfolioId || null,
        });
        (get() as any)._syncMirrors();
        set({ ready: true });
        return;
      }
      // Fallback: migrate from v1
      const raw1 = await AsyncStorage.getItem(KEY_V1);
      if (raw1) {
        const parsed = JSON.parse(raw1);
        const defaultId = 'pf-' + Math.random().toString(36).slice(2, 8);
        const portfolio: Portfolio = {
          id: defaultId,
          name: 'My Portfolio',
          baseCurrency: 'SGD',
          benchmark: 'SPY',
          watchlist: parsed.watchlist || [],
          holdings: parsed.holdings || {},
          type: 'Live',
          cash: 0,
          cashEvents: [],
          createdAt: new Date().toISOString(),
        };
        const portfolios: Record<string, Portfolio> = { [defaultId]: portfolio };
        set({ portfolios, portfolioOrder: [defaultId], activePortfolioId: defaultId });
        (get() as any)._syncMirrors();
        await AsyncStorage.setItem(KEY_V2, JSON.stringify({ portfolios, portfolioOrder: [defaultId], activePortfolioId: defaultId }));
      } else {
        // Fresh start: seed with empty default
        const defaultId = 'pf-' + Math.random().toString(36).slice(2, 8);
        const portfolio: Portfolio = {
          id: defaultId,
          name: 'My Portfolio',
          baseCurrency: 'SGD',
          benchmark: 'SPY',
          watchlist: ['AAPL','TSLA','SPY','BTC-USD'],
          holdings: {},
          type: 'Live',
          cash: 0,
          cashEvents: [],
          createdAt: new Date().toISOString(),
        };
        const portfolios: Record<string, Portfolio> = { [defaultId]: portfolio };
        set({ portfolios, portfolioOrder: [defaultId], activePortfolioId: defaultId });
        (get() as any)._syncMirrors();
        await AsyncStorage.setItem(KEY_V2, JSON.stringify({ portfolios, portfolioOrder: [defaultId], activePortfolioId: defaultId }));
      }
    } catch (e) {
      // ignore
    } finally {
      set({ ready: true });

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
    }
  },

  persist: async () => {
    const { portfolios, portfolioOrder, activePortfolioId } = get() as any;
    await AsyncStorage.setItem(KEY_V2, JSON.stringify({ portfolios, portfolioOrder, activePortfolioId }));
  },

  createPortfolio: async (name, baseCurrency, opts) => {
    const id = 'pf-' + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    const pActive = get().activePortfolio();
    const seed = opts?.seedFromActive && pActive ? { holdings: { ...pActive.holdings }, watchlist: [...pActive.watchlist] } : { holdings: {}, watchlist: [] };
    const portfolio: Portfolio = {
      id, name, baseCurrency,
      benchmark: opts?.benchmark || 'SPY',
      type: opts?.type || 'Live',
      holdings: seed.holdings,
      watchlist: seed.watchlist,
      cash: 0,
      cashEvents: [],
      createdAt: now, updatedAt: now,
    };
    set({
      portfolios: { ...get().portfolios, [id]: portfolio },
      portfolioOrder: [...get().portfolioOrder, id],
      activePortfolioId: id,
    });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
    return id;
  },

  renamePortfolio: async (id, name) => {
    const p = get().portfolios[id];
    if (!p) return;
    const next = { ...p, name, updatedAt: new Date().toISOString() };
    set({ portfolios: { ...get().portfolios, [id]: next } });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },

  setActivePortfolio: async (id) => {
    if (!get().portfolios[id]) return;
    set({ activePortfolioId: id });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },


  archivePortfolio: async (id) => {
    const p = get().portfolios[id];
    if (!p) return;
    const next = { ...p, archived: true, updatedAt: new Date().toISOString() };
    const portfolios = { ...get().portfolios, [id]: next };
    const order = get().portfolioOrder.filter(x => x !== id);
    let active = get().activePortfolioId;
    if (active === id) active = order[0] || null;
    set({ portfolios, portfolioOrder: order, activePortfolioId: active });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },
  setPortfolioArchived: async (id, archived) => {
    const p = get().portfolios[id];
    if (!p) return;
    const next = { ...p, archived: !!archived, updatedAt: new Date().toISOString() } as Portfolio;
    const portfolios = { ...get().portfolios, [id]: next } as Record<string, Portfolio>;
    let order = get().portfolioOrder.slice();
    if (archived) {
      order = order.filter(x => x !== id);
      let active = get().activePortfolioId;
      if (active === id) active = order[0] || null;
      set({ portfolios, portfolioOrder: order, activePortfolioId: active });
    } else {
      if (!order.includes(id)) order = [...order, id];
      set({ portfolios, portfolioOrder: order });
    }
    ;(get() as any)._syncMirrors();
    await (get() as any).persist();
  },
  deletePortfolio: async (id) => {
    const portfolios = { ...get().portfolios };
    if (!portfolios[id]) return;
    delete portfolios[id];
    const order = get().portfolioOrder.filter(x => x !== id);
    let active = get().activePortfolioId;
    if (active === id) active = order[0] || null;
    set({ portfolios, portfolioOrder: order, activePortfolioId: active });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },
  setPortfolioOrder: async (order) => {
    const currentActive = get().activePortfolioId;
    const nextActive = currentActive && order.includes(currentActive) ? currentActive : (order[0] || null);
    set({ portfolioOrder: order, activePortfolioId: nextActive });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },
  
  addHolding: async (symbol, meta, opts) => {
    const pid = opts?.portfolioId || get().activePortfolioId;
    if (!pid) return;
    const portfolios = { ...get().portfolios } as any;
    const p = portfolios[pid];
    const holdings = { ...(p?.holdings || {}) };
    if (!holdings[symbol]) {
      holdings[symbol] = { symbol, name: meta.name, type: meta.type, currency: meta.currency, lots: [] };
      portfolios[pid] = { ...p, holdings, updatedAt: new Date().toISOString() };
      set({ portfolios });
      (get() as any)._syncMirrors();
      await (get() as any).persist();
    }
  },
  removeHolding: async (symbol, opts) => {
    const pid = opts?.portfolioId || get().activePortfolioId;
    if (!pid) return;
    const portfolios = { ...get().portfolios } as any;
    const p = portfolios[pid];
    if (!p || !p.holdings || !p.holdings[symbol]) return;
    const nextHoldings = { ...p.holdings };
    delete nextHoldings[symbol];
    portfolios[pid] = { ...p, holdings: nextHoldings, updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },
  setHoldingsArchived: async ({ portfolioId, symbols, archived }) => {
    const pid = portfolioId || get().activePortfolioId;
    if (!pid || !symbols || !symbols.length) return;
    const portfolios = { ...get().portfolios } as any;
    const p = portfolios[pid];
    if (!p) return;
    const nextHoldings = { ...p.holdings } as Record<string, Holding>;
    for (const s of symbols) {
      if (nextHoldings[s]) nextHoldings[s] = { ...nextHoldings[s], archived } as any;
    }
    portfolios[pid] = { ...p, holdings: nextHoldings, updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },
  setHoldingsOrder: async (portfolioId, order) => {
    const pid = portfolioId || get().activePortfolioId;
    if (!pid) return;
    const portfolios = { ...get().portfolios } as any;
    const p = portfolios[pid];
    if (!p) return;
    portfolios[pid] = { ...p, holdingsOrder: order, updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },
  addCash: async (amount, opts) => {
    const pid = opts?.portfolioId || get().activePortfolioId;
    if (!pid) return;
    const portfolios = { ...get().portfolios } as any;
    const p = portfolios[pid];
    if (!p) return;
    const cur = Number(p.cash || 0);
    const nextCash = Number((cur + Number(amount || 0)).toFixed(2));
    const evs = Array.isArray(p.cashEvents) ? [...p.cashEvents] : [];
    evs.push({ date: new Date().toISOString(), amount: Number(amount || 0) });
    portfolios[pid] = { ...p, cash: nextCash, cashEvents: evs, updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },
addLot: async (symbol, lot, meta, opts) => {
    const pid = opts?.portfolioId || get().activePortfolioId;
    if (!pid) return;
    const id = Math.random().toString(36).slice(2);
    const portfolios = { ...get().portfolios };
    const p = portfolios[pid];
    const holdings = { ...(p?.holdings || {}) };
    if (!holdings[symbol]) {
      holdings[symbol] = { symbol, name: meta.name, type: meta.type, currency: meta.currency, lots: [] };
    }
    holdings[symbol] = { ...holdings[symbol], lots: [...holdings[symbol].lots, { ...lot, id }] };
    portfolios[pid] = { ...p, holdings, updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },

  updateLot: async (symbol, lotId, patch, opts) => {
    const pid = opts?.portfolioId || get().activePortfolioId;
    if (!pid) return;
    const portfolios = { ...get().portfolios } as any;
    const p = portfolios[pid];
    const holdings = { ...(p?.holdings || {}) };
    if (!holdings[symbol]) return;
    holdings[symbol] = { ...holdings[symbol], lots: holdings[symbol].lots.map((l:any)=> l.id===lotId ? { ...l, ...patch } : l) };
    portfolios[pid] = { ...p, holdings, updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },

  removeLot: async (symbol, lotId, opts) => {
    const pid = opts?.portfolioId || get().activePortfolioId;
    if (!pid) return;
    const portfolios = { ...get().portfolios } as any;
    const p = portfolios[pid];
    const holdings = { ...(p?.holdings || {}) };
    if (!holdings[symbol]) return;
    holdings[symbol] = { ...holdings[symbol], lots: holdings[symbol].lots.filter((l:any)=> l.id !== lotId) };
    if (holdings[symbol].lots.length === 0) {
      delete holdings[symbol];
    }
    portfolios[pid] = { ...p, holdings, updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },
  moveHoldingBetweenPortfolios: async ({ symbol, fromId, toId, mode }) => {
    const s: any = get();
    if (!symbol || !fromId || !toId || fromId === toId) return;
    const portfolios = { ...(s.portfolios || {}) };
    const src = portfolios[fromId];
    const dst = portfolios[toId];
    if (!src || !dst) return;
    const sh = { ...(src.holdings || {}) };
    const dh = { ...(dst.holdings || {}) };
    const srcH = sh[symbol];
    if (!srcH || !Array.isArray(srcH.lots) || srcH.lots.length === 0) return;
    if (mode === 'aggregate') {
      // aggregate qty & average price into one lot
      const lots = srcH.lots;
      let qty = 0, cost = 0;
      for (const l of lots) {
        if (l.side === 'buy') { qty += l.qty; cost += l.qty * l.price + (l.fee || 0); }
        else { // sells reduce qty & cost at average
          const avg = qty > 0 ? cost / qty : 0;
          qty -= l.qty;
          cost -= avg * l.qty;
          if (qty < 0) { qty = 0; cost = 0; }
        }
      }
      const avg = qty > 0 ? cost / qty : 0;
      const newLot = { id: 'lot-'+Math.random().toString(36).slice(2,8), side: 'buy', qty, price: Number(avg.toFixed(6)), date: new Date().toISOString() };
      const destH = dh[symbol] || { symbol, name: srcH.name, type: srcH.type, currency: srcH.currency, lots: [] };
      destH.lots = [...(destH.lots || []), newLot];
      dh[symbol] = destH;
    } else {
      // move all lots 1:1 (default)
      const destH = dh[symbol] || { symbol, name: srcH.name, type: srcH.type, currency: srcH.currency, lots: [] };
      destH.lots = [...(destH.lots || []), ...srcH.lots];
      dh[symbol] = destH;
    }
    // remove from source
    delete sh[symbol];
    portfolios[fromId] = { ...src, holdings: sh, updatedAt: new Date().toISOString() };
    portfolios[toId] = { ...dst, holdings: dh, updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors?.();
    await (get() as any).persist?.();
  },


  setWatch: async (symbols, opts) => {
    const pid = opts?.portfolioId || get().activePortfolioId;
    if (!pid) return;
    const portfolios = { ...get().portfolios };
    const p = portfolios[pid];
    portfolios[pid] = { ...p, watchlist: symbols, updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },

  addWatch: async (symbol, opts) => {
    const pid = opts?.portfolioId || get().activePortfolioId;
    if (!pid) return;
    const portfolios = { ...get().portfolios };
    const p = portfolios[pid];
    const s = new Set(p.watchlist || []);
    s.add(symbol);
    portfolios[pid] = { ...p, watchlist: Array.from(s), updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },

  removeWatch: async (symbol, opts) => {
    const pid = opts?.portfolioId || get().activePortfolioId;
    if (!pid) return;
    const portfolios = { ...get().portfolios };
    const p = portfolios[pid];
    portfolios[pid] = { ...p, watchlist: (p.watchlist || []).filter(s=>s!==symbol), updatedAt: new Date().toISOString() };
    set({ portfolios });
    (get() as any)._syncMirrors();
    await (get() as any).persist();
  },

  refreshQuotes: async (symbols?: string[]) => {
    set({ refreshing: true, error: undefined });
    const quotes = { ...get().quotes } as any;

    // Get data source preference from profile
    let dataSource: 'yahoo' | 'fmp' = 'yahoo';
    let fmpApiKey = '';
    try {
      const { useProfileStore } = await import('./profile');
      const profile = useProfileStore.getState().profile;
      dataSource = profile.dataSource || 'yahoo';
      fmpApiKey = profile.fmpApiKey || '';

      // Set FMP API key if using FMP
      if (dataSource === 'fmp' && fmpApiKey) {
        setFMPApiKey(fmpApiKey);
      }
    } catch (e) {
      console.warn('[Invest Store] Failed to get profile, defaulting to Yahoo');
    }

    try {
      const target = symbols && symbols.length ? symbols : (get() as any).allSymbols();

      // Separate crypto and equity symbols
      const cryptoSymbols = target.filter((s: string) => isCryptoSymbol(s));
      const equitySymbols = target.filter((s: string) => !isCryptoSymbol(s));

      // Process crypto symbols (always use CoinGecko)
      for (const sym of cryptoSymbols) {
        try {
          const base = baseCryptoSymbol(sym);
          const cg = await fetchCrypto(base || sym, 365);
          const last = Number(cg?.line?.length ? cg.line[cg.line.length - 1].v : 0);
          const prev = Number(cg?.line?.length > 1 ? cg.line[cg.line.length - 2].v : last);
          const change = last - prev;
          const changePct = Number(prev ? ((change / prev) * 100).toFixed(2) : 0);
          let bars: any[] | undefined = undefined;
          try {
            const ohlc = await fetchCryptoOhlc(base || sym, 365);
            bars = (ohlc || []).map(b => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: 0 }));
          } catch {}
          quotes[sym] = {
            symbol: sym,
            last,
            change,
            changePct,
            ts: Date.now(),
            line: Array.isArray(cg?.line) ? cg.line : [],
            bars
          };
        } catch (e) {
          // keep existing quote if fetch fails
        }
        await new Promise(r => setTimeout(r, 120));
      }

      // Process equity symbols based on data source
      if (dataSource === 'fmp' && fmpApiKey && equitySymbols.length > 0) {
        // FMP: Use batch calls to minimize API usage (1 call for all quotes)
        try {
          const batchQuotes = await fetchFMPBatchQuotes(equitySymbols);

          // Process each equity symbol
          for (const sym of equitySymbols) {
            try {
              const quote = batchQuotes[sym];
              if (!quote) continue;

              // Fetch historical data and fundamentals
              const [rawBars, fundamentals] = await Promise.all([
                fetchDailyHistoryFMP(sym, '5y').catch(() => []),
                fetchFMPFundamentals(sym).catch(() => null),
              ]);

              if (rawBars && rawBars.length > 0) {
                const last = quote.price || (rawBars.length ? rawBars[rawBars.length-1].close : 0);
                const change = quote.change || 0;
                const changePct = quote.changesPercentage || 0;
                const line = rawBars.map(b => ({ t: b.date, v: Number(b.close.toFixed(2)) }));
                const cbars = rawBars.map(b => ({ t: b.date, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume }));

                quotes[sym] = {
                  symbol: sym,
                  last,
                  change,
                  changePct,
                  ts: Date.now(),
                  line,
                  bars: cbars,
                  fundamentals: fundamentals || undefined
                };
              }
            } catch (e) {
              console.error('[Invest Store] Failed to fetch FMP data for:', sym, e);
            }
            await new Promise(r => setTimeout(r, 120));
          }
        } catch (e) {
          console.error('[Invest Store] FMP batch failed, falling back to Yahoo:', e);
          // Fall back to Yahoo if FMP fails
          dataSource = 'yahoo';
        }
      }

      // Yahoo Finance (default or fallback)
      if (dataSource === 'yahoo' && equitySymbols.length > 0) {
        for (const sym of equitySymbols) {
          try {
            let rawBars: any[] = [];
            try {
              rawBars = await fetchDailyHistoryYahoo(sym as any, '5y' as any);
            } catch (e) {
              console.error('[Invest Store] Failed to fetch Yahoo data for:', sym, e);
            }

            if (!rawBars || !rawBars.length) { /* keep existing quote */ }
            else {
              const last = rawBars.length ? rawBars[rawBars.length-1].close : 0;
              const prevClose = rawBars.length > 1 ? (rawBars[rawBars.length-2].close || 0) : last;
              const change = last - prevClose;
              const changePct = Number((prevClose ? (change / prevClose) * 100 : 0).toFixed(2));
              const line = rawBars.map(b => ({ t: b.date, v: Number((b.close ?? 0).toFixed ? (b.close as any).toFixed(2) : Number(b.close ?? 0).toFixed(2)) }));
              const cbars = rawBars.map(b => ({ t: b.date, o: b.open ?? b.close, h: b.high ?? b.close, l: b.low ?? b.close, c: b.close ?? 0, v: b.volume ?? 0 }));

              // Fetch fundamentals for stocks/ETFs
              let fundamentals = undefined;
              try {
                const fund = await fetchYahooFundamentals(sym);
                if (fund) {
                  fundamentals = fund;
                }
              } catch (e) {
                // Silently fail - using placeholder data
              }

              quotes[sym] = { symbol: sym, last, change, changePct, ts: Date.now(), line, bars: cbars, fundamentals };
            }
          } catch (e) {
            // keep existing quote if fetch fails for this symbol
          }
          await new Promise(r => setTimeout(r, 120));
        }
      }

      set({ quotes, lastUpdated: Date.now(), refreshing: false });
    } catch (e: any) {
      set({ quotes, refreshing: false, error: e?.message || 'Failed to refresh' });
    }
  },
}));
