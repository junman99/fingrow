/**
 * Data Aggregator
 * Queries local database and aggregates financial data
 * Only summaries are sent to AI - raw data stays on device
 */

import { useTxStore } from '../../store/transactions';
import { useAccountsStore } from '../../store/accounts';
import { useInvestStore } from '../../store/invest';
import { useBudgetsStore } from '../../store/budgets';
import { useDebtsStore } from '../../store/debts';
import { useProfileStore } from '../../store/profile';
import { convertCurrency, type FxRates } from '../fx';

export type AggregatedData = {
  summary: string; // Human-readable summary for AI
  metadata?: Record<string, any>; // Structured data for UI
};

/**
 * Get spending data for a category and period
 */
export function getSpendingData(category?: string, period?: string): AggregatedData {
  const { transactions = [] } = useTxStore.getState();
  const { monthlyBudget } = useBudgetsStore.getState();

  const { startDate, endDate, periodLabel } = parsePeriod(period);

  // Filter transactions - add safety check
  const filtered = (transactions || []).filter(tx => {
    if (!tx || !tx.date) return false;
    const txDate = new Date(tx.date);
    const matchesDate = txDate >= startDate && txDate <= endDate;
    const matchesType = tx.type === 'expense';
    const matchesCategory = !category || tx.category?.toLowerCase().includes(category.toLowerCase());

    return matchesDate && matchesType && matchesCategory;
  });

  // Aggregate by category
  const byCategory: Record<string, number> = {};
  let total = 0;

  filtered.forEach(tx => {
    const cat = tx.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + (tx.amount || 0);
    total += tx.amount || 0;
  });

  // Sort categories by amount
  const sortedCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5); // Top 5

  // Build summary
  let summary = `User spent $${total.toFixed(2)}`;

  if (category) {
    summary += ` on ${category}`;
  }

  summary += ` ${periodLabel}`;

  if (sortedCategories.length > 1 && !category) {
    summary += `. Top categories: `;
    summary += sortedCategories.map(([cat, amt]) => `${cat} $${amt.toFixed(2)}`).join(', ');
  }

  // Check monthly budget if querying this month and no specific category
  if (monthlyBudget && periodLabel === 'this month' && !category) {
    const remaining = monthlyBudget - total;
    summary += `. Monthly budget: $${monthlyBudget.toFixed(2)}, `;
    summary += remaining >= 0
      ? `$${remaining.toFixed(2)} remaining`
      : `$${Math.abs(remaining).toFixed(2)} over budget`;
  }

  return {
    summary,
    metadata: {
      total,
      transactionCount: filtered.length,
      byCategory: Object.fromEntries(sortedCategories),
      budget: monthlyBudget,
      period: periodLabel
    }
  };
}

/**
 * Get portfolio data - calculates total across ALL portfolios with currency conversion
 */
export function getPortfolioData(symbol?: string): AggregatedData {
  const { portfolios, quotes, fxRates } = useInvestStore.getState();
  const { profile } = useProfileStore.getState();
  const investCurrency = String(profile.investCurrency || 'SGD').toUpperCase();

  console.log('[DataAggregator] Total portfolios:', Object.keys(portfolios || {}).length);
  console.log('[DataAggregator] Portfolios:', JSON.stringify(Object.entries(portfolios || {}).map(([id, p]: [string, any]) => ({
    id,
    name: p.name,
    trackingEnabled: p.trackingEnabled,
    baseCurrency: p.baseCurrency,
    cash: p.cash,
    holdingsCount: Object.keys(p.holdings || {}).length
  })), null, 2));

  if (!portfolios || Object.keys(portfolios).length === 0) {
    return {
      summary: "User has no portfolios",
      metadata: { totalValue: 0, positions: [] }
    };
  }

  const positions: Array<{
    symbol: string;
    shares: number;
    value: number;
    costBasis: number;
    gainLoss: number;
    gainLossPercent: number;
    portfolioName: string;
  }> = [];

  const portfolioBreakdown: Array<{
    name: string;
    value: number;
    cash: number;
    gainLoss: number;
    holdings: Array<{ symbol: string; shares: number; value: number }>;
  }> = [];

  let totalValue = 0;
  let totalCost = 0;
  let totalCash = 0;

  // Calculate total value by summing ALL portfolios (each converted to investment currency)
  Object.values(portfolios || {}).forEach((p: any) => {
    // Skip portfolios with tracking disabled or corrupted data
    if (!p || (p.trackingEnabled === false) || !p.name || !p.baseCurrency) {
      console.log('[DataAggregator] Skipping portfolio:', p?.name, 'trackingEnabled:', p?.trackingEnabled, 'corrupted:', !p?.name || !p?.baseCurrency);
      return;
    }

    console.log('[DataAggregator] Processing portfolio:', p.name, 'baseCurrency:', p.baseCurrency, 'cash:', p.cash);

    // Calculate holdings value for this portfolio (converted to investment currency)
    let portfolioHoldingsValue = 0;
    let portfolioHoldingsCost = 0;
    const portfolioHoldings: Array<{ symbol: string; shares: number; value: number }> = [];

    console.log('[DataAggregator] Portfolio holdings:', Object.keys(p.holdings || {}).length, 'symbols:', Object.keys(p.holdings || {}));

    Object.entries(p.holdings || {}).forEach(([sym, h]: [string, any]) => {
      if (symbol && sym !== symbol.toUpperCase()) return;

      const lots = h?.lots || [];
      console.log('[DataAggregator] Processing holding:', sym, 'lots:', lots.length);
      const qty = lots.reduce((s: number, l: any) => s + (l.side === 'buy' ? l.qty : -l.qty), 0);
      console.log('[DataAggregator]', sym, 'total qty:', qty);
      if (qty <= 0) {
        console.log('[DataAggregator] Skipping', sym, '- zero or negative quantity');
        return;
      }

      const q = quotes[sym];
      const lastNative = Number(q?.last || 0);

      // Skip if quote is missing or 0 (stale/failed quote)
      if (!lastNative || lastNative <= 0) {
        console.log('[DataAggregator] Skipping', sym, '- no valid quote (last:', lastNative, ')');
        return;
      }

      // Get ticker currency
      let tickerCurrency = h.currency;
      if (!tickerCurrency) {
        const s = sym.toUpperCase();
        if (s.includes('-USD') || s.includes('USD')) tickerCurrency = 'USD';
        else if (s.endsWith('.L')) tickerCurrency = 'GBP';
        else if (s.endsWith('.T')) tickerCurrency = 'JPY';
        else if (s.endsWith('.TO')) tickerCurrency = 'CAD';
        else if (s.endsWith('.AX')) tickerCurrency = 'AUD';
        else if (s.endsWith('.HK')) tickerCurrency = 'HKD';
        else if (s.endsWith('.PA') || s.endsWith('.DE')) tickerCurrency = 'EUR';
        else if (s.endsWith('.SW')) tickerCurrency = 'CHF';
        else tickerCurrency = 'USD';
      }
      tickerCurrency = String(tickerCurrency).toUpperCase();

      // Convert ticker price to investment currency
      const last = convertCurrency(fxRates, lastNative, tickerCurrency, investCurrency);
      const value = qty * last;

      // Calculate cost basis (also convert to investment currency)
      const costBasis = lots
        .filter((lot: any) => lot.side === 'buy')
        .reduce((sum: number, lot: any) => {
          const lotCost = lot.qty * lot.price;
          return sum + convertCurrency(fxRates, lotCost, tickerCurrency, investCurrency);
        }, 0);

      portfolioHoldingsValue += value;
      portfolioHoldingsCost += costBasis;

      // Add to portfolio holdings for breakdown
      portfolioHoldings.push({ symbol: sym, shares: qty, value });

      // Add to positions array for summary
      const gainLoss = value - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

      console.log('[DataAggregator]', sym, 'value:', value, 'costBasis:', costBasis, 'gainLoss:', gainLoss, 'qty:', qty, 'last:', last);

      positions.push({
        symbol: sym,
        shares: qty,
        value,
        costBasis,
        gainLoss,
        gainLossPercent,
        portfolioName: p.name
      });
    });

    // Convert cash from portfolio currency to investment currency
    const portfolioBaseCurrency = String(p.baseCurrency || 'USD').toUpperCase();
    const cash = Number(p.cash || 0);
    const portfolioCashValue = convertCurrency(fxRates, cash, portfolioBaseCurrency, investCurrency);

    // Add portfolio breakdown
    const portfolioGainLoss = portfolioHoldingsValue - portfolioHoldingsCost;
    portfolioBreakdown.push({
      name: p.name,
      value: portfolioHoldingsValue + portfolioCashValue,
      cash: portfolioCashValue,
      gainLoss: portfolioGainLoss,
      holdings: portfolioHoldings
    });

    totalValue += portfolioHoldingsValue + portfolioCashValue;
    totalCost += portfolioHoldingsCost;
    totalCash += portfolioCashValue;
  });

  const totalGainLoss = totalValue - totalCost - totalCash;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  console.log('[DataAggregator] FINAL TOTALS:', {
    totalValue,
    totalCost,
    totalCash,
    totalGainLoss,
    totalGainLossPercent,
    positionsCount: positions.length,
    calculation: `${totalValue} - ${totalCost} - ${totalCash} = ${totalGainLoss}`
  });

  // Build summary (all values in investCurrency) with per-portfolio breakdown
  let summary = `User's total investment portfolio value: ${investCurrency} $${totalValue.toFixed(2)}. `;
  summary += `Total ${totalGainLoss >= 0 ? 'profit' : 'loss'}: ${investCurrency} $${Math.abs(totalGainLoss).toFixed(2)} `;
  summary += `(${totalGainLoss >= 0 ? '+' : ''}${totalGainLossPercent.toFixed(1)}%).\n\n`;

  // Add breakdown by portfolio
  if (portfolioBreakdown.length > 0) {
    summary += `Portfolio Breakdown:\n`;
    portfolioBreakdown.forEach((pf, idx) => {
      summary += `${idx + 1}. ${pf.name}: ${investCurrency} $${pf.value.toFixed(2)}`;
      if (pf.cash > 0) summary += ` (includes ${investCurrency} $${pf.cash.toFixed(2)} cash)`;
      summary += `. ${pf.gainLoss >= 0 ? 'Profit' : 'Loss'}: ${investCurrency} $${Math.abs(pf.gainLoss).toFixed(2)}.\n`;
      if (pf.holdings.length > 0) {
        summary += `   Holdings: `;
        summary += pf.holdings
          .sort((a, b) => b.value - a.value)
          .map(h => `${h.symbol} (${h.shares} shares, ${investCurrency} $${h.value.toFixed(2)})`)
          .join(', ');
        summary += `\n`;
      }
    });
  }

  return {
    summary,
    metadata: {
      totalValue,
      totalGainLoss,
      totalGainLossPercent,
      positions,
      portfolioBreakdown,
      cash: totalCash,
      currency: investCurrency,
      positionCount: positions.length,
      portfolioCount: portfolioBreakdown.length
    }
  };
}

/**
 * Get net worth data
 */
export function getNetWorthData(period?: string): AggregatedData {
  const { accounts } = useAccountsStore.getState();
  const { debts } = useDebtsStore.getState();
  const portfolioData = getPortfolioData();

  // Calculate current net worth
  // Cash accounts = checking, savings, cash (exclude credit, investment, retirement - same as Money tab)
  const cashAccounts = accounts.filter(
    acc => acc.kind !== 'credit' && acc.kind !== 'investment' && acc.kind !== 'retirement' && acc.includeInNetWorth !== false
  );
  const totalCash = cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  const creditCards = accounts.filter(
    acc => acc.kind === 'credit' && acc.includeInNetWorth !== false
  );
  const totalCreditDebt = creditCards.reduce((sum, acc) => sum + Math.abs(acc.balance || 0), 0);

  const totalDebt = (debts || []).reduce((sum, d) => sum + (d.balance || 0), 0) + totalCreditDebt;

  const portfolioValue = portfolioData.metadata?.totalValue || 0;
  const currentNetWorth = totalCash + portfolioValue - totalDebt;

  // Build summary
  let summary = `User's current net worth is $${currentNetWorth.toFixed(2)}. `;
  summary += `Breakdown: Cash $${totalCash.toFixed(2)}, `;
  summary += `Investments $${portfolioValue.toFixed(2)}, `;
  summary += `Debt $${totalDebt.toFixed(2)}. `;

  // Add individual cash account balances
  if (cashAccounts.length > 0) {
    summary += `Cash accounts: `;
    const accountDetails = cashAccounts.map(acc => {
      const type = acc.kind === 'checking' ? 'checking' : acc.kind === 'savings' ? 'savings' : acc.kind;
      return `${acc.name} (${type}) $${(acc.balance || 0).toFixed(2)}`;
    }).join(', ');
    summary += accountDetails;
  }

  // TODO: Compare with previous period if requested
  // This would require querying historical net worth data

  return {
    summary,
    metadata: {
      netWorth: currentNetWorth,
      cash: totalCash,
      investments: portfolioValue,
      debt: totalDebt,
      cashAccounts: cashAccounts.map(acc => ({
        name: acc.name,
        kind: acc.kind,
        balance: acc.balance || 0
      }))
    }
  };
}

/**
 * Get budget data
 */
export function getBudgetData(category?: string, period?: string): AggregatedData {
  const spendingData = getSpendingData(category, period);
  const { monthlyBudget } = useBudgetsStore.getState();

  // Only support monthly budget queries
  if (!monthlyBudget || category) {
    return {
      summary: `User has no monthly budget set${category ? '. Category-specific budgets are not supported.' : ''}`,
      metadata: { hasBudget: false }
    };
  }

  const spent = spendingData.metadata?.total || 0;
  const remaining = monthlyBudget - spent;
  const percentUsed = monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0;

  let summary = `User's monthly budget is $${monthlyBudget.toFixed(2)}. `;
  summary += `Spent $${spent.toFixed(2)} (${percentUsed.toFixed(1)}%). `;
  summary += remaining >= 0
    ? `$${remaining.toFixed(2)} remaining`
    : `$${Math.abs(remaining).toFixed(2)} over budget`;

  return {
    summary,
    metadata: {
      limit: monthlyBudget,
      spent,
      remaining,
      percentUsed,
      isOverBudget: remaining < 0
    }
  };
}

/**
 * Parse period string into date range
 */
function parsePeriod(period?: string): {
  startDate: Date;
  endDate: Date;
  periodLabel: string;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!period || period === 'today') {
    return {
      startDate: today,
      endDate: now,
      periodLabel: 'today'
    };
  }

  if (period === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return {
      startDate: yesterday,
      endDate: today,
      periodLabel: 'yesterday'
    };
  }

  if (period === 'this_week') {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    return {
      startDate: startOfWeek,
      endDate: now,
      periodLabel: 'this week'
    };
  }

  if (period === 'last_week') {
    const startOfLastWeek = new Date(today);
    startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    return {
      startDate: startOfLastWeek,
      endDate: endOfLastWeek,
      periodLabel: 'last week'
    };
  }

  if (period === 'this_month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: startOfMonth,
      endDate: now,
      periodLabel: 'this month'
    };
  }

  if (period === 'last_month') {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      startDate: startOfLastMonth,
      endDate: endOfLastMonth,
      periodLabel: 'last month'
    };
  }

  if (period === 'this_year') {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return {
      startDate: startOfYear,
      endDate: now,
      periodLabel: 'this year'
    };
  }

  // Parse "past_X_days/weeks/months"
  const pastMatch = period.match(/past_(\d+)_(day|week|month)s?/);
  if (pastMatch) {
    const count = parseInt(pastMatch[1]);
    const unit = pastMatch[2];
    const start = new Date(today);

    if (unit === 'day') {
      start.setDate(today.getDate() - count);
      return { startDate: start, endDate: now, periodLabel: `past ${count} days` };
    } else if (unit === 'week') {
      start.setDate(today.getDate() - count * 7);
      return { startDate: start, endDate: now, periodLabel: `past ${count} weeks` };
    } else if (unit === 'month') {
      start.setMonth(today.getMonth() - count);
      return { startDate: start, endDate: now, periodLabel: `past ${count} months` };
    }
  }

  // Default to this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: startOfMonth,
    endDate: now,
    periodLabel: 'this month'
  };
}
