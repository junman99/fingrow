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
 * Get portfolio data
 */
export function getPortfolioData(symbol?: string): AggregatedData {
  const { holdings, quotes, activePortfolio } = useInvestStore.getState();
  const { accounts } = useAccountsStore.getState();

  const portfolio = activePortfolio?.();

  if (!portfolio) {
    return {
      summary: "User has no active portfolio",
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
  }> = [];

  let totalValue = 0;
  let totalCost = 0;

  // Calculate positions
  Object.entries(holdings || {}).forEach(([sym, holding]) => {
    if (symbol && sym !== symbol.toUpperCase()) return;

    const lots = holding.lots || [];
    const shares = lots.reduce((sum, lot) => {
      return sum + (lot.side === 'buy' ? lot.qty : -lot.qty);
    }, 0);

    if (shares === 0) return;

    const currentPrice = quotes[sym]?.last || 0;
    const value = shares * currentPrice;
    const costBasis = lots
      .filter(lot => lot.side === 'buy')
      .reduce((sum, lot) => sum + (lot.qty * lot.price), 0);

    const gainLoss = value - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

    positions.push({
      symbol: sym,
      shares,
      value,
      costBasis,
      gainLoss,
      gainLossPercent
    });

    totalValue += value;
    totalCost += costBasis;
  });

  // Add cash
  const cash = typeof portfolio.cash === 'number' ? portfolio.cash : 0;

  // Add investment account balances
  const investmentAccounts = accounts.filter(
    acc => (acc.kind === 'investment' || acc.kind === 'retirement') && acc.includeInNetWorth !== false
  );
  const investmentAccountBalance = investmentAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  totalValue += cash + investmentAccountBalance;

  const totalGainLoss = totalValue - totalCost - cash - investmentAccountBalance;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // Build summary
  let summary = `User's portfolio value is $${totalValue.toFixed(2)}`;

  if (symbol && positions.length > 0) {
    const pos = positions[0];
    summary = `User holds ${pos.shares} shares of ${pos.symbol} worth $${pos.value.toFixed(2)}. `;
    summary += `Cost basis: $${pos.costBasis.toFixed(2)}. `;
    summary += pos.gainLoss >= 0
      ? `Gain: $${pos.gainLoss.toFixed(2)} (+${pos.gainLossPercent.toFixed(1)}%)`
      : `Loss: $${Math.abs(pos.gainLoss).toFixed(2)} (${pos.gainLossPercent.toFixed(1)}%)`;
  } else if (positions.length > 0) {
    summary += `. Total ${totalGainLoss >= 0 ? 'gain' : 'loss'}: $${Math.abs(totalGainLoss).toFixed(2)} `;
    summary += `(${totalGainLoss >= 0 ? '+' : ''}${totalGainLossPercent.toFixed(1)}%). `;
    summary += `Top holdings: `;
    summary += positions
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map(p => `${p.symbol} $${p.value.toFixed(2)}`)
      .join(', ');
    if (cash > 0) summary += `. Cash: $${cash.toFixed(2)}`;
  }

  return {
    summary,
    metadata: {
      totalValue,
      totalGainLoss,
      totalGainLossPercent,
      positions,
      cash,
      positionCount: positions.length
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
  const cashAccounts = accounts.filter(
    acc => acc.kind !== 'credit' && acc.includeInNetWorth !== false
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
  summary += `Debt $${totalDebt.toFixed(2)}`;

  // TODO: Compare with previous period if requested
  // This would require querying historical net worth data

  return {
    summary,
    metadata: {
      netWorth: currentNetWorth,
      cash: totalCash,
      investments: portfolioValue,
      debt: totalDebt
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
