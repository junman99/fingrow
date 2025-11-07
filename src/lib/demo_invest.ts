
import { useInvestStore } from '../features/invest';

type InstrumentMeta = { name: string; type: 'stock' | 'bond' | 'crypto' | 'fund' | 'etf'; currency: string };

const META: Record<string, InstrumentMeta> = {
  AAPL: { name: 'Apple Inc.', type: 'stock', currency: 'USD' },
  MSFT: { name: 'Microsoft Corp.', type: 'stock', currency: 'USD' },
  TSLA: { name: 'Tesla, Inc.', type: 'stock', currency: 'USD' },
  SPY:  { name: 'SPDR S&P 500 ETF', type: 'etf', currency: 'USD' },
  'BTC-USD': { name: 'Bitcoin', type: 'crypto', currency: 'USD' },
};

export async function seedInvestSixMonths() {
  const s: any = (useInvestStore as any)?.getState?.();
  if (!s) throw new Error('Invest store not ready');

  const call = async (fnName: string, ...args: any[]) => {
    const fn = (useInvestStore.getState() as any)[fnName];
    if (typeof fn === 'function') return await fn(...args);
    return undefined;
  };

  // remove existing demo/testing portfolios
  const existing = (s.portfolios ?? {}) as Record<string, any>;
  for (const pid of Object.keys(existing)) {
    const nm = String(existing[pid]?.name ?? '').toLowerCase();
    if (nm.includes('demo') || nm === 'testing') await call('deletePortfolio', pid);
  }

  // create new demo portfolio
  const currency = 'USD';
  let demoId: string | null = null;
  if (typeof s.createPortfolio === 'function') {
    demoId = await s.createPortfolio('Demo Portfolio', currency, { benchmark: 'SPY', type: 'Paper' });
  } else {
    demoId = `pf-${Math.random().toString(36).slice(2,8)}`;
    (useInvestStore as any).setState((prev: any) => ({
      ...prev,
      portfolios: {
        ...(prev?.portfolios ?? {}),
        [demoId!]: {
          id: demoId,
          name: 'Demo Portfolio',
          baseCurrency: currency,
          benchmark: 'SPY',
          holdings: {},
          watchlist: [],
          type: 'Paper',
          createdAt: new Date().toISOString(),
        },
      },
      portfolioOrder: [ ...(prev?.portfolioOrder ?? []), demoId! ],
      activePortfolioId: demoId!,
    }));
  }
  if (!demoId) throw new Error('Failed to create demo portfolio');
  await call('setActivePortfolio', demoId);

  // distribute trades per-month with cap 5 per month
  const symbols = ['SPY', 'AAPL', 'MSFT', 'TSLA', 'BTC-USD'];
  const now = new Date();
  const addLot = (sym: string, side: 'buy'|'sell', qty: number, price: number, date: Date) =>
    call('addLot', sym, { side, qty, price, date: date.toISOString() }, META[sym], { portfolioId: demoId });

  const anchorFor = (sym: string) => sym === 'BTC-USD' ? 60000 : sym === 'TSLA' ? 250 : sym === 'AAPL' ? 190 : sym === 'MSFT' ? 430 : 550;

  for (let offset = 5; offset >= 0; offset--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1, 10, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 16, 0, 0, 0);
    const tradesThisMonth = 2 + Math.floor(Math.random() * 4); // 2..5
    for (let i = 0; i < tradesThisMonth; i++) {
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      const side: 'buy'|'sell' = Math.random() < 0.8 ? 'buy' : 'sell';
      const qty = side === 'buy' ? (1 + Math.floor(Math.random() * 3)) : (1 + Math.floor(Math.random() * 2));
      const anchor = anchorFor(sym);
      const price = Number((anchor * (0.9 + Math.random() * 0.2)).toFixed(2));
      const day = 1 + Math.floor(Math.random() * (monthEnd.getDate()));
      const hour = 9 + Math.floor(Math.random() * 6);
      const minute = Math.floor(Math.random() * 60);
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day, hour, minute, 0, 0);
      await addLot(sym, side, qty, price, date);
    }
  }

  await call('setWatch', symbols, { portfolioId: demoId });
  await call('refreshQuotes');
}

export async function clearInvestDemo() {
  const s: any = (useInvestStore as any)?.getState?.();
  if (!s) return;

  const call = async (fnName: string, ...args: any[]) => {
    const fn = (useInvestStore.getState() as any)[fnName];
    if (typeof fn === 'function') return await fn(...args);
    return undefined;
  };

  const before = (useInvestStore.getState() as any);
  const portfolios = (before.portfolios ?? {}) as Record<string, any>;
  for (const pid of Object.keys(portfolios)) {
    const name = String(portfolios[pid]?.name ?? '').toLowerCase();
    if (name.includes('demo') || name === 'testing') await call('deletePortfolio', pid);
  }

  // clear positions & watch in remaining portfolios
  (useInvestStore as any).setState((prev: any) => {
    const next: Record<string, any> = { ...(prev?.portfolios ?? {}) };
    for (const pid of Object.keys(next)) {
      const p = next[pid]; if (!p) continue;
      p.holdings = {}; p.watchlist = []; p.updatedAt = new Date().toISOString();
      next[pid] = p;
    }
    return { ...prev, portfolios: next, quotes: {}, refreshing: false, error: undefined };
  });

  const after = (useInvestStore.getState() as any);
  const ids = Object.keys(after.portfolios ?? {});
  const nextActive = ids.length ? (after.activePortfolioId && ids.includes(after.activePortfolioId) ? after.activePortfolioId : ids[0]) : null;
  (useInvestStore as any).setState({ activePortfolioId: nextActive });
  try { (useInvestStore.getState() as any)._syncMirrors?.(); } catch {}
  await call('persist');
}
