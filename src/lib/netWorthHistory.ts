import { Transaction } from '../store/transactions';
import { BankAccount } from '../store/accounts';
import { useInvestStore } from '../store/invest';

export type NetWorthDataPoint = {
  t: number; // timestamp
  cash: number;
  investments: number;
  debt: number;
};

/**
 * Calculate historical net worth by working backwards from current state through transactions
 */
export function calculateHistoricalNetWorth(
  currentAccounts: BankAccount[],
  transactions: Transaction[],
  currentPortfolioValue: number,
  daysBack: number = 180
): NetWorthDataPoint[] {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 3600 * 1000;

  // Filter transactions within the time range and sort by date (newest first)
  const relevantTxs = transactions
    .filter(tx => new Date(tx.date).getTime() >= startTime)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Initialize with current state
  const cashAccounts = currentAccounts.filter(
    acc => acc.kind !== 'credit' && acc.includeInNetWorth !== false
  );
  const creditCards = currentAccounts.filter(
    acc => acc.kind === 'credit' && acc.includeInNetWorth !== false
  );

  let currentCash = cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  let currentCreditDebt = creditCards.reduce((sum, acc) => sum + Math.abs(acc.balance || 0), 0);

  // Create daily snapshots
  const dailyData: Map<string, NetWorthDataPoint> = new Map();

  // Start with today's values
  const todayKey = new Date(now).toISOString().split('T')[0];
  dailyData.set(todayKey, {
    t: now,
    cash: currentCash,
    investments: currentPortfolioValue,
    debt: currentCreditDebt,
  });

  // Work backwards through transactions
  let cash = currentCash;
  let debt = currentCreditDebt;

  for (const tx of relevantTxs) {
    const txDate = new Date(tx.date);
    const txTime = txDate.getTime();
    const dateKey = txDate.toISOString().split('T')[0];

    // Reverse the transaction to get the previous state
    if (tx.account) {
      const account = currentAccounts.find(a => a.name === tx.account);
      if (account) {
        if (account.kind === 'credit') {
          // Credit card: reverse the transaction
          if (tx.type === 'expense') {
            debt -= tx.amount; // Expense increased debt, so subtract to reverse
          } else {
            debt += tx.amount; // Income decreased debt, so add to reverse
          }
        } else {
          // Regular account
          if (tx.type === 'expense') {
            cash += tx.amount; // Expense decreased cash, so add to reverse
          } else {
            cash -= tx.amount; // Income increased cash, so subtract to reverse
          }
        }
      }
    }

    // Store the state for this date (if not already set with more recent data)
    if (!dailyData.has(dateKey)) {
      dailyData.set(dateKey, {
        t: txTime,
        cash: Math.max(0, cash),
        investments: currentPortfolioValue, // TODO: Could be improved with actual historical portfolio data
        debt: Math.max(0, debt),
      });
    }
  }

  // Fill in missing days by interpolating or using last known value
  const result: NetWorthDataPoint[] = [];
  for (let i = daysBack; i >= 0; i--) {
    const date = new Date(now - i * 24 * 3600 * 1000);
    const dateKey = date.toISOString().split('T')[0];

    if (dailyData.has(dateKey)) {
      result.push(dailyData.get(dateKey)!);
    } else {
      // Use the last known values
      const lastPoint = result[result.length - 1];
      if (lastPoint) {
        result.push({
          t: date.getTime(),
          cash: lastPoint.cash,
          investments: lastPoint.investments,
          debt: lastPoint.debt,
        });
      } else {
        // No data yet, use starting values
        result.push({
          t: date.getTime(),
          cash: Math.max(0, cash),
          investments: currentPortfolioValue,
          debt: Math.max(0, debt),
        });
      }
    }
  }

  return result;
}

/**
 * Aggregate data points based on timeframe
 */
export function aggregateNetWorthData(
  data: NetWorthDataPoint[],
  timeframe: '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'
): NetWorthDataPoint[] {
  if (!data.length) return [];

  const now = data[data.length - 1]?.t || Date.now();
  const msDay = 24 * 60 * 60 * 1000;

  // Determine time range
  let startTime: number;
  switch (timeframe) {
    case '1W':
      startTime = now - 7 * msDay;
      break;
    case '1M':
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      startTime = oneMonthAgo.getTime();
      break;
    case '3M':
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      startTime = threeMonthsAgo.getTime();
      break;
    case '6M':
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      startTime = sixMonthsAgo.getTime();
      break;
    case '1Y':
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      startTime = oneYearAgo.getTime();
      break;
    case 'ALL':
    default:
      startTime = 0;
  }

  // Filter data to timeframe
  const filteredData = data.filter(d => d.t >= startTime);
  if (!filteredData.length) return data;

  // Aggregate based on timeframe
  switch (timeframe) {
    case '1W':
      // Daily bars (7 bars)
      return aggregateByDay(filteredData);

    case '1M':
      // Daily bars (~30 bars)
      return aggregateByDay(filteredData);

    case '3M':
      // Weekly bars (~13 bars)
      return aggregateByWeek(filteredData);

    case '6M':
      // Monthly bars (6 bars)
      return aggregateByMonth(filteredData);

    case '1Y':
      // Monthly bars (12 bars)
      return aggregateByMonth(filteredData);

    case 'ALL':
      // Monthly bars (all time)
      return aggregateByMonth(filteredData);

    default:
      return filteredData;
  }
}

function aggregateByDay(data: NetWorthDataPoint[]): NetWorthDataPoint[] {
  // Already in daily format, just return as is
  return data;
}

function aggregateByWeek(data: NetWorthDataPoint[]): NetWorthDataPoint[] {
  if (!data.length) return [];

  const weeks: Map<string, NetWorthDataPoint[]> = new Map();

  data.forEach(point => {
    const date = new Date(point.t);
    // Get the week start (Sunday)
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, []);
    }
    weeks.get(weekKey)!.push(point);
  });

  // Take the last point of each week (end-of-week data)
  const result: NetWorthDataPoint[] = [];
  Array.from(weeks.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([_, points]) => {
      result.push(points[points.length - 1]);
    });

  return result;
}

function aggregateByMonth(data: NetWorthDataPoint[]): NetWorthDataPoint[] {
  if (!data.length) return [];

  const months: Map<string, NetWorthDataPoint[]> = new Map();

  data.forEach(point => {
    const date = new Date(point.t);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!months.has(monthKey)) {
      months.set(monthKey, []);
    }
    months.get(monthKey)!.push(point);
  });

  // Take the last point of each month (end-of-month data)
  const result: NetWorthDataPoint[] = [];
  Array.from(months.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([_, points]) => {
      result.push(points[points.length - 1]);
    });

  return result;
}
