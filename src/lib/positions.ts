// Average-cost realized/unrealized P&L calculator.
import type { Lot } from '../features/invest';

export type PnL = {
  qty: number;
  avgCost: number;
  realized: number;
  unrealized: number;
};

/** Compute average-cost P&L walking lots chronologically. */
export function computePnL(lots: Lot[], lastPrice: number): PnL {
  const sorted = [...lots].sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime());
  let qty = 0;
  let costBasis = 0; // total cost of current position (qty * avg)
  let realized = 0;

  for (const l of sorted) {
    if (l.side === 'buy') {
      const gross = l.qty * l.price + (l.fee || 0);
      costBasis += gross;
      qty += l.qty;
    } else {
      // sell: average cost reduces
      const avg = qty > 0 ? costBasis / qty : 0;
      const proceeds = l.qty * l.price - (l.fee || 0);
      const outCost = l.qty * avg;
      realized += (proceeds - outCost);
      qty -= l.qty;
      costBasis -= outCost;
      if (qty < 0) { qty = 0; costBasis = 0; } // guard
    }
  }
  const avgCost = qty > 0 ? costBasis / qty : 0;
  const unrealized = qty * (lastPrice - avgCost);
  return { qty, avgCost, realized, unrealized };
}