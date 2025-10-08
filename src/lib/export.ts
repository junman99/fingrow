import { Share, Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useInvestStore } from '../store/invest';
import { computePnL } from './positions';

/** Build holdings CSV for a portfolio. */
export function buildHoldingsCsv(portfolio: any, quotes: any, fxRates: any) {
  const rows: string[] = [];
  rows.push(['symbol','name','qty','avg_cost_native','last_native','mkt_value_native','base_currency','as_of_iso'].join(','));
  const asOf = new Date().toISOString();
  const holdings = portfolio?.holdings || {};
  Object.keys(holdings).forEach(sym => {
    const h = holdings[sym];
    const last = quotes?.[sym]?.last ?? 0;
    const pnl = computePnL(h.lots || [], last);
    const qty = pnl.qty;
    const avg = pnl.avgCost;
    const mv = qty * last;
    rows.push([sym, JSON.stringify(h.name||''), qty.toString(), avg.toFixed(4), last.toFixed(4), mv.toFixed(2), (portfolio.baseCurrency||'USD').toUpperCase(), asOf].join(','));
  });
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