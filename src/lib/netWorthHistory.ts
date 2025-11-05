import { Transaction } from '../store/transactions';
import { BankAccount } from '../store/accounts';
import { useInvestStore } from '../store/invest';

export type NetWorthDataPoint = {
  t: number; // timestamp
  cash: number;
  investments: number;
  debt: number;
  label?: string; // Optional label for chart display
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
    acc => acc.kind !== 'credit' && acc.kind !== 'investment' && acc.kind !== 'retirement' && acc.includeInNetWorth !== false
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

  // Track investment account transactions to estimate historical portfolio value
  let investmentValue = currentPortfolioValue;
  const investmentAccounts = currentAccounts.filter(
    acc => (acc.kind === 'investment' || acc.kind === 'retirement')
  );

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
        } else if (account.kind === 'investment' || account.kind === 'retirement') {
          // Investment/retirement account: track transfers in/out
          if (tx.type === 'income') {
            investmentValue -= tx.amount; // Deposit increased investment, so subtract to reverse
          } else if (tx.type === 'expense') {
            investmentValue += tx.amount; // Withdrawal decreased investment, so add to reverse
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
        investments: Math.max(0, investmentValue),
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
        // No data yet, use current ending values (we're going backwards, so these are the oldest values)
        result.push({
          t: date.getTime(),
          cash: Math.max(0, cash),
          investments: Math.max(0, investmentValue),
          debt: Math.max(0, debt),
        });
      }
    }
  }

  return result;
}

/**
 * Aggregate data points based on timeframe - returns ALL available data
 */
export function aggregateNetWorthData(
  data: NetWorthDataPoint[],
  timeframe: 'D' | 'W' | 'M',
  offset: number = 0 // Kept for backwards compatibility but not used
): NetWorthDataPoint[] {
  if (!data.length) return [];

  // Return all available data, aggregated by timeframe
  switch (timeframe) {
    case 'D':
      // All daily bars
      return aggregateByDay(data);

    case 'W':
      // All weekly bars
      return aggregateByWeek(data);

    case 'M':
      // All monthly bars
      return aggregateByMonth(data);

    default:
      return data;
  }
}

function aggregateByDay(data: NetWorthDataPoint[]): NetWorthDataPoint[] {
  // Add labels for daily data (format: "20 Apr")
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return data.map(point => {
    const date = new Date(point.t);
    const label = `${date.getDate()} ${monthNames[date.getMonth()]}`;
    return { ...point, label };
  });
}

function aggregateByWeek(data: NetWorthDataPoint[]): NetWorthDataPoint[] {
  if (!data.length) return [];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const result: NetWorthDataPoint[] = [];

  const now = new Date();

  // Find the most recent Sunday (same logic as AccountDetail)
  const dayOfWeek = now.getDay();
  const mostRecentSunday = new Date(now);
  mostRecentSunday.setDate(now.getDate() - dayOfWeek);
  mostRecentSunday.setHours(0, 0, 0, 0);

  // Go back and find data for each Sunday
  for (let weeksBack = 0; weeksBack < 26; weeksBack++) { // Get up to 26 weeks of data
    const weekEnd = new Date(mostRecentSunday);
    weekEnd.setDate(mostRecentSunday.getDate() - (weeksBack * 7));

    // Find the data point closest to this Sunday
    const weekEndTime = weekEnd.getTime();
    let closestPoint = data[0];
    let minDiff = Math.abs(data[0].t - weekEndTime);

    for (const point of data) {
      const diff = Math.abs(point.t - weekEndTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = point;
      }
    }

    // Only include if we found data within 7 days of this Sunday
    if (minDiff <= 7 * 24 * 60 * 60 * 1000) {
      const label = `${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`;
      result.unshift({ ...closestPoint, label, t: weekEndTime });
    }
  }

  return result;
}

function aggregateByBiWeek(data: NetWorthDataPoint[]): NetWorthDataPoint[] {
  if (!data.length) return [];

  const weeks: Map<string, NetWorthDataPoint[]> = new Map();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  // Take every other week (bi-weekly)
  const result: NetWorthDataPoint[] = [];
  const sortedWeeks = Array.from(weeks.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  sortedWeeks.forEach(([weekKey, points], index) => {
    // Show every other week (index 0, 2, 4, 6, etc.)
    if (index % 2 === 0) {
      const lastPoint = points[points.length - 1];
      const date = new Date(lastPoint.t);
      const label = `${date.getDate()} ${monthNames[date.getMonth()]}`;
      result.push({ ...lastPoint, label });
    }
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
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  Array.from(months.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([monthKey, points]) => {
      const lastPoint = points[points.length - 1];
      const date = new Date(lastPoint.t);
      // Label format: "MMM YY" (e.g., "Oct 24")
      const label = `${monthNames[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
      result.push({ ...lastPoint, label });
    });

  return result;
}
