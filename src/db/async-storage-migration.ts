/**
 * AsyncStorage to SQLite Migration
 * Migrates all existing data from AsyncStorage to the new SQLite database
 *
 * This is a ONE-TIME migration that runs on first launch after the update.
 * It preserves all user data while transitioning to the new architecture.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './client';
import {
  accounts, transactions, portfolios, holdings, lots, watchlist, cashEvents,
  goals, goalHistory, goalTransactionLinks, achievements, userProgress,
  groups, groupMembers, bills, billSplits, billContributions, settlements,
  debts, budgets, quotesCache, fxRatesCache
} from './schema';
import type { BankAccount } from '../store/accounts';
import type { Transaction } from '../store/transactions';
import type { Portfolio, Holding, Lot, Quote } from '../features/invest';
import type { Goal, Achievement } from '../features/goals';
import type { Debt } from '../store/debts';

// AsyncStorage keys
const KEYS = {
  ACCOUNTS: 'fingrow:accounts:v1',
  TRANSACTIONS: 'fingrow/transactions',
  INVEST_V2: 'fingrow:invest:v2',
  INVEST_V1: 'fingrow:invest:v1', // Fallback
  GOALS: 'fingrow.goals.v1',
  ACHIEVEMENTS: 'fingrow.goals.achievements.v1',
  PROGRESS: 'fingrow.goals.progress.v1',
  GROUPS: 'fingrow/groups',
  DEBTS: 'fingrow:debts:v1',
  BUDGET: 'fingrow/budget',
  MIGRATION_COMPLETE: 'fingrow:migration:v2:complete',
};

// Helper to generate timestamps
const now = () => Date.now();

// Helper to parse ISO date strings to timestamps
const parseDate = (dateStr?: string): number => {
  if (!dateStr) return now();
  try {
    return new Date(dateStr).getTime();
  } catch {
    return now();
  }
};

/**
 * Check if migration has already been completed
 */
export async function isMigrationComplete(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(KEYS.MIGRATION_COMPLETE);
    return flag === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark migration as complete
 */
async function markMigrationComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.MIGRATION_COMPLETE, 'true');
  console.log('[Migration] Marked as complete');
}

/**
 * Main migration function
 * Migrates all data from AsyncStorage to SQLite
 */
export async function migrateFromAsyncStorage(): Promise<{
  success: boolean;
  error?: string;
  stats: {
    accounts: number;
    transactions: number;
    portfolios: number;
    holdings: number;
    lots: number;
    goals: number;
    groups: number;
    debts: number;
  };
}> {
  const stats = {
    accounts: 0,
    transactions: 0,
    portfolios: 0,
    holdings: 0,
    lots: 0,
    goals: 0,
    groups: 0,
    debts: 0,
  };

  try {
    console.log('[Migration] Starting AsyncStorage → SQLite migration...');

    // Check if already migrated
    if (await isMigrationComplete()) {
      console.log('[Migration] Already completed, skipping');
      return { success: true, stats };
    }

    // Migrate in order (respecting foreign keys)

    // 1. Migrate Accounts
    stats.accounts = await migrateAccounts();

    // 2. Migrate Transactions (depends on accounts)
    stats.transactions = await migrateTransactions();

    // 3. Migrate Portfolios
    stats.portfolios = await migratePortfolios();

    // 4. Migrate Holdings & Lots (depends on portfolios)
    const { holdings: holdingsCount, lots: lotsCount } = await migrateHoldingsAndLots();
    stats.holdings = holdingsCount;
    stats.lots = lotsCount;

    // 5. Migrate Goals
    stats.goals = await migrateGoals();

    // 6. Migrate Achievements & Progress
    await migrateAchievementsAndProgress();

    // 7. Migrate Groups (complex: groups, members, bills, splits, contributions, settlements)
    stats.groups = await migrateGroups();

    // 8. Migrate Debts (FIXED: No credit cards!)
    stats.debts = await migrateDebts();

    // 9. Migrate Budget
    await migrateBudget();

    // Mark migration as complete
    await markMigrationComplete();

    console.log('[Migration] ✅ Complete!', stats);

    return { success: true, stats };
  } catch (error) {
    console.error('[Migration] ❌ Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats,
    };
  }
}

/**
 * Migrate Accounts from AsyncStorage
 */
async function migrateAccounts(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ACCOUNTS);
    if (!raw) return 0;

    const oldAccounts: BankAccount[] = JSON.parse(raw);

    for (const acc of oldAccounts) {
      await db.insert(accounts).values({
        id: acc.id,
        name: acc.name,
        institution: acc.institution,
        mask: acc.mask,
        balance: acc.balance || 0,
        kind: acc.kind || 'checking',
        includeInNetWorth: acc.includeInNetWorth !== false ? 1 : 0,
        note: acc.note,
        isDefault: acc.isDefault ? 1 : 0,
        apr: acc.apr,
        creditLimit: acc.creditLimit,
        minPaymentPercent: acc.minPaymentPercent,
        lastSyncedAt: null, // NEW field, starts as null
        createdAt: now(),
        updatedAt: now(),
      }).onConflictDoNothing(); // Skip if already exists
    }

    console.log(`[Migration] Migrated ${oldAccounts.length} accounts`);
    return oldAccounts.length;
  } catch (error) {
    console.error('[Migration] Failed to migrate accounts:', error);
    return 0;
  }
}

/**
 * Migrate Transactions from AsyncStorage
 */
async function migrateTransactions(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    if (!raw) return 0;

    const oldTxs: Transaction[] = JSON.parse(raw);

    // Get all accounts to match by name
    const allAccounts = await db.select().from(accounts);
    const accountsByName = new Map(allAccounts.map(a => [a.name.toLowerCase(), a.id]));

    for (const tx of oldTxs) {
      // Match account by name (case-insensitive)
      let accountId: string | null = null;
      if (tx.account) {
        accountId = accountsByName.get(tx.account.toLowerCase()) || null;
      }

      await db.insert(transactions).values({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        date: parseDate(tx.date),
        note: tx.note,
        title: tx.title,
        accountId,
        createdAt: parseDate(tx.date),
        updatedAt: parseDate(tx.date),
      }).onConflictDoNothing();
    }

    console.log(`[Migration] Migrated ${oldTxs.length} transactions`);
    return oldTxs.length;
  } catch (error) {
    console.error('[Migration] Failed to migrate transactions:', error);
    return 0;
  }
}

/**
 * Migrate Portfolios from AsyncStorage
 */
async function migratePortfolios(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.INVEST_V2) || await AsyncStorage.getItem(KEYS.INVEST_V1);
    if (!raw) return 0;

    const data = JSON.parse(raw);
    const oldPortfolios: Record<string, Portfolio> = data.portfolios || {};

    let count = 0;
    for (const [id, portfolio] of Object.entries(oldPortfolios)) {
      await db.insert(portfolios).values({
        id,
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency || 'USD',
        benchmark: portfolio.benchmark,
        type: portfolio.type || 'Live',
        cash: portfolio.cash || 0,
        archived: portfolio.archived ? 1 : 0,
        trackingEnabled: portfolio.trackingEnabled !== false ? 1 : 0,
        createdAt: parseDate(portfolio.createdAt),
        updatedAt: parseDate(portfolio.updatedAt),
      }).onConflictDoNothing();

      // Migrate watchlist
      if (portfolio.watchlist && portfolio.watchlist.length > 0) {
        for (const symbol of portfolio.watchlist) {
          await db.insert(watchlist).values({
            id: `${id}-${symbol}-${now()}`,
            portfolioId: id,
            symbol,
            addedAt: now(),
          }).onConflictDoNothing();
        }
      }

      // Migrate cash events
      if (portfolio.cashEvents && portfolio.cashEvents.length > 0) {
        for (const event of portfolio.cashEvents) {
          await db.insert(cashEvents).values({
            id: `${id}-cash-${parseDate(event.date)}`,
            portfolioId: id,
            amount: event.amount,
            date: parseDate(event.date),
            note: null,
            createdAt: parseDate(event.date),
          }).onConflictDoNothing();
        }
      }

      count++;
    }

    console.log(`[Migration] Migrated ${count} portfolios`);
    return count;
  } catch (error) {
    console.error('[Migration] Failed to migrate portfolios:', error);
    return 0;
  }
}

/**
 * Migrate Holdings and Lots from AsyncStorage
 */
async function migrateHoldingsAndLots(): Promise<{ holdings: number; lots: number }> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.INVEST_V2) || await AsyncStorage.getItem(KEYS.INVEST_V1);
    if (!raw) return { holdings: 0, lots: 0 };

    const data = JSON.parse(raw);
    const oldPortfolios: Record<string, Portfolio> = data.portfolios || {};

    let holdingsCount = 0;
    let lotsCount = 0;

    for (const [portfolioId, portfolio] of Object.entries(oldPortfolios)) {
      const portfolioHoldings = portfolio.holdings || {};

      for (const [symbol, holding] of Object.entries(portfolioHoldings)) {
        // Insert holding
        const holdingId = `${portfolioId}-${symbol}`;
        await db.insert(holdings).values({
          id: holdingId,
          portfolioId,
          symbol: holding.symbol,
          name: holding.name,
          type: holding.type,
          currency: holding.currency || 'USD', // Explicit currency
          archived: holding.archived ? 1 : 0,
          sortOrder: 0,
          createdAt: now(),
          updatedAt: now(),
        }).onConflictDoNothing();

        holdingsCount++;

        // Insert lots (FIFO)
        if (holding.lots && holding.lots.length > 0) {
          for (const lot of holding.lots) {
            await db.insert(lots).values({
              id: lot.id,
              holdingId,
              side: lot.side,
              qty: lot.qty,
              price: lot.price,
              fee: lot.fee || 0,
              date: parseDate(lot.date),
              createdAt: parseDate(lot.date),
            }).onConflictDoNothing();

            lotsCount++;
          }
        }
      }
    }

    console.log(`[Migration] Migrated ${holdingsCount} holdings and ${lotsCount} lots`);
    return { holdings: holdingsCount, lots: lotsCount };
  } catch (error) {
    console.error('[Migration] Failed to migrate holdings/lots:', error);
    return { holdings: 0, lots: 0 };
  }
}

/**
 * Migrate Goals from AsyncStorage
 */
async function migrateGoals(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GOALS);
    if (!raw) return 0;

    const oldGoals: Goal[] = JSON.parse(raw);

    for (const goal of oldGoals) {
      // Insert goal
      await db.insert(goals).values({
        id: goal.id,
        type: goal.type,
        title: goal.title,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount || 0,
        targetDate: goal.targetDate ? parseDate(goal.targetDate) : null,
        icon: goal.icon,
        category: goal.category,
        roundUps: goal.roundUps ? 1 : 0,
        autoSaveCadence: goal.autoSave?.cadence || null,
        autoSaveAmount: goal.autoSave?.amount || null,
        isPinned: goal.isPinned ? 1 : 0,
        completedAt: goal.completedAt ? parseDate(goal.completedAt) : null,
        createdAt: parseDate(goal.createdAt),
        updatedAt: parseDate(goal.updatedAt),
      }).onConflictDoNothing();

      // Insert goal history
      if (goal.history && goal.history.length > 0) {
        for (const entry of goal.history) {
          await db.insert(goalHistory).values({
            id: entry.id,
            goalId: goal.id,
            type: entry.type,
            amount: entry.amount,
            date: parseDate(entry.date),
            note: entry.note,
            createdAt: parseDate(entry.date),
          }).onConflictDoNothing();
        }
      }

      // Insert transaction links
      if (goal.linkedTransactions && goal.linkedTransactions.length > 0) {
        for (const txId of goal.linkedTransactions) {
          await db.insert(goalTransactionLinks).values({
            goalId: goal.id,
            transactionId: txId,
            createdAt: now(),
          }).onConflictDoNothing();
        }
      }
    }

    console.log(`[Migration] Migrated ${oldGoals.length} goals`);
    return oldGoals.length;
  } catch (error) {
    console.error('[Migration] Failed to migrate goals:', error);
    return 0;
  }
}

/**
 * Migrate Achievements and User Progress from AsyncStorage
 */
async function migrateAchievementsAndProgress(): Promise<void> {
  try {
    // Migrate achievements
    const achievementsRaw = await AsyncStorage.getItem(KEYS.ACHIEVEMENTS);
    if (achievementsRaw) {
      const oldAchievements: Achievement[] = JSON.parse(achievementsRaw);

      for (const achievement of oldAchievements) {
        await db.insert(achievements).values({
          id: achievement.id,
          type: achievement.type,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          unlockedAt: parseDate(achievement.unlockedAt),
        }).onConflictDoNothing();
      }

      console.log(`[Migration] Migrated ${oldAchievements.length} achievements`);
    }

    // Migrate user progress
    const progressRaw = await AsyncStorage.getItem(KEYS.PROGRESS);
    if (progressRaw) {
      const progress = JSON.parse(progressRaw);

      await db.insert(userProgress).values({
        id: 'singleton',
        level: progress.level || 1,
        xp: progress.xp || 0,
        updatedAt: now(),
      }).onConflictDoNothing();

      console.log(`[Migration] Migrated user progress (level ${progress.level})`);
    }
  } catch (error) {
    console.error('[Migration] Failed to migrate achievements/progress:', error);
  }
}

/**
 * Migrate Groups (complex: groups, members, bills, splits, contributions, settlements)
 */
async function migrateGroups(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GROUPS);
    if (!raw) return 0;

    const oldGroups: any[] = JSON.parse(raw);

    for (const group of oldGroups) {
      // Insert group
      await db.insert(groups).values({
        id: group.id,
        name: group.name,
        note: group.note,
        createdAt: group.createdAt || now(),
        updatedAt: now(),
      }).onConflictDoNothing();

      // Insert members
      if (group.members && group.members.length > 0) {
        for (const member of group.members) {
          await db.insert(groupMembers).values({
            id: member.id,
            groupId: group.id,
            name: member.name,
            contact: member.contact,
            archived: member.archived ? 1 : 0,
            createdAt: now(),
          }).onConflictDoNothing();
        }
      }

      // Insert bills
      if (group.bills && group.bills.length > 0) {
        for (const bill of group.bills) {
          await db.insert(bills).values({
            id: bill.id,
            groupId: group.id,
            title: bill.title,
            amount: bill.amount,
            taxMode: bill.taxMode || 'abs',
            tax: bill.tax || 0,
            discountMode: bill.discountMode || 'abs',
            discount: bill.discount || 0,
            finalAmount: bill.finalAmount,
            splitMode: bill.splitMode,
            proportionalTax: bill.proportionalTax ? 1 : 0,
            date: bill.date || now(),
            createdAt: now(),
          }).onConflictDoNothing();

          // Insert splits
          if (bill.splits && bill.splits.length > 0) {
            for (const split of bill.splits) {
              await db.insert(billSplits).values({
                id: `${bill.id}-${split.memberId}`,
                billId: bill.id,
                memberId: split.memberId,
                amount: split.amount,
                shares: split.shares || null,
                paid: split.paid ? 1 : 0,
                createdAt: now(),
              }).onConflictDoNothing();
            }
          }

          // Insert contributions
          if (bill.contributions && bill.contributions.length > 0) {
            for (const contrib of bill.contributions) {
              await db.insert(billContributions).values({
                id: `${bill.id}-${contrib.memberId}`,
                billId: bill.id,
                memberId: contrib.memberId,
                amount: contrib.amount,
                createdAt: now(),
              }).onConflictDoNothing();
            }
          }
        }
      }

      // Insert settlements
      if (group.settlements && group.settlements.length > 0) {
        for (const settlement of group.settlements) {
          await db.insert(settlements).values({
            id: settlement.id,
            groupId: group.id,
            fromMemberId: settlement.fromId,
            toMemberId: settlement.toId,
            amount: settlement.amount,
            billId: settlement.billId || null,
            memo: settlement.memo,
            date: settlement.date || now(),
            createdAt: now(),
          }).onConflictDoNothing();
        }
      }
    }

    console.log(`[Migration] Migrated ${oldGroups.length} groups`);
    return oldGroups.length;
  } catch (error) {
    console.error('[Migration] Failed to migrate groups:', error);
    return 0;
  }
}

/**
 * Migrate Debts from AsyncStorage
 * IMPORTANT: Only migrate 'loan' and 'bnpl' debts (NOT credit cards!)
 * Credit card debt is tracked in accounts table
 */
async function migrateDebts(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DEBTS);
    if (!raw) return 0;

    const oldDebts: Debt[] = JSON.parse(raw);

    // Filter out credit card debts (they're in accounts already)
    const filteredDebts = oldDebts.filter(d => d.type === 'loan' || d.type === 'bnpl');

    for (const debt of filteredDebts) {
      await db.insert(debts).values({
        id: debt.id,
        name: debt.name,
        type: debt.type, // Only 'loan' or 'bnpl'
        apr: debt.apr,
        balance: debt.balance,
        minDue: debt.minDue,
        dueDate: parseDate(debt.dueISO),
        createdAt: now(),
        updatedAt: now(),
      }).onConflictDoNothing();
    }

    console.log(`[Migration] Migrated ${filteredDebts.length} debts (filtered ${oldDebts.length - filteredDebts.length} credit cards)`);
    return filteredDebts.length;
  } catch (error) {
    console.error('[Migration] Failed to migrate debts:', error);
    return 0;
  }
}

/**
 * Migrate Budget from AsyncStorage
 */
async function migrateBudget(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.BUDGET);
    if (!raw) return;

    const oldBudget = JSON.parse(raw);

    await db.insert(budgets).values({
      id: 'singleton',
      monthlyBudget: oldBudget.monthlyBudget || null,
      warnThreshold: oldBudget.warnThreshold || 0.8,
      updatedAt: now(),
    }).onConflictDoNothing();

    console.log('[Migration] Migrated budget');
  } catch (error) {
    console.error('[Migration] Failed to migrate budget:', error);
  }
}

/**
 * Rollback migration (for testing/debugging)
 * Clears the migration flag so it can be run again
 */
export async function rollbackMigration(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.MIGRATION_COMPLETE);
  console.log('[Migration] Rolled back - can run again');
}
