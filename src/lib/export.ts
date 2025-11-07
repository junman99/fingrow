import { Share, Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useInvestStore } from '../features/invest';
import { computePnL } from './positions';

/** Build holdings CSV for a portfolio. */
export function buildHoldingsCsv(portfolio: any, quotes: any, fxRates: any) {
  const rows: string[] = [];
  const asOf = new Date().toISOString();
  const base = (portfolio.baseCurrency||'USD').toUpperCase();
  type Item = { sym: string; name: string; qty: number; avg: number; last: number; mv: number };
  const items: Item[] = [];
  const holdings = portfolio?.holdings || {};
  Object.keys(holdings).forEach(sym => {
    const h = holdings[sym];
    const last = quotes?.[sym]?.last ?? 0;
    const pnl = computePnL(h.lots || [], last);
    const qty = pnl.qty;
    const avg = pnl.avgCost;
    const mv = qty * last;
    if (qty > 0) items.push({ sym, name: h.name||'', qty, avg, last, mv });
  });
  const cash = Number(portfolio?.cash || 0);
  const total = items.reduce((s,i)=> s + (i.mv||0), 0) + (Number.isFinite(cash) ? cash : 0);
  rows.push(['symbol','name','qty','avg_cost_native','last_native','mkt_value_native','weight_pct','base_currency','as_of_iso'].join(','));
  items.forEach(i => {
    const weight = total > 0 ? (i.mv / total) * 100 : 0;
    rows.push([i.sym, JSON.stringify(i.name||''), i.qty.toString(), i.avg.toFixed(4), i.last.toFixed(4), i.mv.toFixed(2), weight.toFixed(2), base, asOf].join(','));
  });
  // Cash row
  if (!Number.isNaN(cash)) {
    const w = total > 0 ? (cash / total) * 100 : 0;
    rows.push(['CASH', '"Cash"', '0', '0', '1.0000', cash.toFixed(2), w.toFixed(2), base, asOf].join(','));
  }
  return rows.join('\n');
}

/** Create and share a CSV for the given portfolio id using current store state. */
export async function exportPortfolioCsv(portfolioId: string) {
  const s: any = (useInvestStore as any).getState();
  const p = s.portfolios?.[portfolioId];
  if (!p) throw new Error('Portfolio not found');
  const csv = buildHoldingsCsv(p, s.quotes, s.fxRates);
  const filename = `portfolio_${p.name?.replace(/[^a-z0-9_-]/gi,'_') || 'export'}_${new Date().toISOString().slice(0,10)}.csv`;
  const uri = ((FileSystem as any)?.cacheDirectory || '') + filename;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: 'utf8' as any });
  try {
    await Share.share(Platform.select({ ios: { url: uri }, default: { message: uri } }) as any);
  } catch (e) {
    Alert.alert('CSV saved', uri);
  }
  return uri;
}

/** Build transactions CSV for a single holding within a portfolio. */
export function buildHoldingTxCsv(portfolio: any, symbol: string) {
  const rows: string[] = [];
  rows.push(['date_iso','side','qty','price_native','fees_native','cash_flow_native','currency'].join(','));
  const holding = portfolio?.holdings?.[symbol];
  if (!holding) return rows.join('\n');
  const cur = (holding.currency || portfolio.baseCurrency || 'USD').toUpperCase();
  const lots = Array.isArray(holding.lots) ? holding.lots : [];
  const norm = lots.map((l:any) => ({ ...l, fee: (l.fee ?? l.fees) || 0 }));
  norm.sort((a:any,b:any)=> new Date(a.date).getTime() - new Date(b.date).getTime());
  norm.forEach((l:any) => {
    const fees = Number(l.fee || 0);
    const gross = Number(l.qty) * Number(l.price);
    // cash flow: buys negative (spend), sells positive (receive)
    const cf = l.side === 'buy' ? -(gross + fees) : (gross - fees);
    rows.push([
      new Date(l.date).toISOString(),
      String(l.side||'buy'),
      String(l.qty||0),
      (Number(l.price||0)).toFixed(4),
      fees.toFixed(2),
      cf.toFixed(2),
      cur,
    ].join(','));
  });
  return rows.join('\n');
}

/** Create and share a CSV for a holding's transactions. */
export async function exportHoldingTxCsv(portfolioId: string, symbol: string) {
  const s: any = (useInvestStore as any).getState();
  const p = s.portfolios?.[portfolioId];
  if (!p) throw new Error('Portfolio not found');
  const csv = buildHoldingTxCsv(p, symbol);
  const filename = `tx_${symbol.replace(/[^a-z0-9_-]/gi,'_')}_${p.name?.replace(/[^a-z0-9_-]/gi,'_') || 'portfolio'}_${new Date().toISOString().slice(0,10)}.csv`;
  const uri = ((FileSystem as any)?.cacheDirectory || '') + filename;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: 'utf8' as any });
  try {
    await Share.share(Platform.select({ ios: { url: uri }, default: { message: uri } }) as any);
  } catch (e) {
    Alert.alert('CSV saved', uri);
  }
  return uri;
}
