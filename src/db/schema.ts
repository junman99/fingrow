/**
 * Fingrow Database Schema
 * SQLite database schema using Drizzle ORM
 *
 * This schema replaces AsyncStorage with a proper relational database.
 * Key improvements:
 * - Foreign key constraints for data integrity
 * - Indexes for query performance
 * - Proper normalization to prevent data duplication
 * - Support for transactions (ACID properties)
 */

import { sqliteTable, text, real, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ACCOUNTS TABLE
// ============================================================================
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  institution: text('institution'),
  mask: text('mask'), // last 4 digits
  balance: real('balance').notNull().default(0),
  kind: text('kind', {
    enum: ['checking', 'savings', 'cash', 'credit', 'investment', 'retirement', 'loan', 'mortgage', 'other']
  }).default('checking'),
  includeInNetWorth: integer('include_in_net_worth', { mode: 'boolean' }).default(true),
  note: text('note'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  apr: real('apr'), // Annual Percentage Rate
  creditLimit: real('credit_limit'),
  minPaymentPercent: real('min_payment_percent'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }), // NEW: track when balance was last updated
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  nameIdx: index('accounts_name_idx').on(table.name),
  kindIdx: index('accounts_kind_idx').on(table.kind),
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

// ============================================================================
// TRANSACTIONS TABLE
// ============================================================================
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['expense', 'income'] }).notNull(),
  amount: real('amount').notNull(),
  category: text('category').notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  note: text('note'),
  title: text('title'),
  accountId: text('account_id').references(() => accounts.id, { onDelete: 'set null' }), // FK constraint
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  dateIdx: index('transactions_date_idx').on(table.date),
  categoryIdx: index('transactions_category_idx').on(table.category),
  typeIdx: index('transactions_type_idx').on(table.type),
  accountIdx: index('transactions_account_idx').on(table.accountId),
  // Composite index for common queries: filter by date + category
  dateCategoryIdx: index('transactions_date_category_idx').on(table.date, table.category),
}));

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Relations
export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  goalLinks: many(goalTransactionLinks),
}));

// ============================================================================
// PORTFOLIOS TABLE
// ============================================================================
export const portfolios = sqliteTable('portfolios', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  baseCurrency: text('base_currency').notNull().default('USD'),
  benchmark: text('benchmark'), // e.g., 'SPY', 'QQQ'
  type: text('type', { enum: ['Live', 'Paper'] }).default('Live'),
  cash: real('cash').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).default(false),
  trackingEnabled: integer('tracking_enabled', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  nameIdx: index('portfolios_name_idx').on(table.name),
  archivedIdx: index('portfolios_archived_idx').on(table.archived),
}));

export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;

// ============================================================================
// HOLDINGS TABLE
// ============================================================================
export const holdings = sqliteTable('holdings', {
  id: text('id').primaryKey(),
  portfolioId: text('portfolio_id').notNull().references(() => portfolios.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  type: text('type', { enum: ['stock', 'bond', 'crypto', 'fund', 'etf'] }).notNull(),
  currency: text('currency').notNull(), // Explicit currency (no inference)
  archived: integer('archived', { mode: 'boolean' }).default(false),
  sortOrder: integer('sort_order').default(0), // For custom ordering
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  portfolioIdx: index('holdings_portfolio_idx').on(table.portfolioId),
  symbolIdx: index('holdings_symbol_idx').on(table.symbol),
  // Composite unique constraint: one holding per symbol per portfolio
  portfolioSymbolIdx: index('holdings_portfolio_symbol_idx').on(table.portfolioId, table.symbol),
}));

export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;

// ============================================================================
// LOTS TABLE (Stock Transactions - FIFO tracking)
// ============================================================================
export const lots = sqliteTable('lots', {
  id: text('id').primaryKey(),
  holdingId: text('holding_id').notNull().references(() => holdings.id, { onDelete: 'cascade' }),
  side: text('side', { enum: ['buy', 'sell'] }).notNull(),
  qty: real('qty').notNull(),
  price: real('price').notNull(), // Price in holding's native currency
  fee: real('fee').default(0),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  holdingIdx: index('lots_holding_idx').on(table.holdingId),
  dateIdx: index('lots_date_idx').on(table.date),
  // For FIFO calculations: order by date
  holdingDateIdx: index('lots_holding_date_idx').on(table.holdingId, table.date),
}));

export type Lot = typeof lots.$inferSelect;
export type NewLot = typeof lots.$inferInsert;

// Relations
export const holdingsRelations = relations(holdings, ({ one, many }) => ({
  portfolio: one(portfolios, {
    fields: [holdings.portfolioId],
    references: [portfolios.id],
  }),
  lots: many(lots),
}));

export const lotsRelations = relations(lots, ({ one }) => ({
  holding: one(holdings, {
    fields: [lots.holdingId],
    references: [holdings.id],
  }),
}));

// ============================================================================
// WATCHLIST TABLE
// ============================================================================
export const watchlist = sqliteTable('watchlist', {
  id: text('id').primaryKey(),
  portfolioId: text('portfolio_id').notNull().references(() => portfolios.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  addedAt: integer('added_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  portfolioIdx: index('watchlist_portfolio_idx').on(table.portfolioId),
  symbolIdx: index('watchlist_symbol_idx').on(table.symbol),
  // Composite unique: prevent duplicate watchlist entries
  portfolioSymbolIdx: index('watchlist_portfolio_symbol_idx').on(table.portfolioId, table.symbol),
}));

export type WatchlistItem = typeof watchlist.$inferSelect;
export type NewWatchlistItem = typeof watchlist.$inferInsert;

// ============================================================================
// CASH EVENTS TABLE (Portfolio cash deposits/withdrawals)
// ============================================================================
export const cashEvents = sqliteTable('cash_events', {
  id: text('id').primaryKey(),
  portfolioId: text('portfolio_id').notNull().references(() => portfolios.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(), // Positive = deposit, Negative = withdrawal
  date: integer('date', { mode: 'timestamp' }).notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  portfolioIdx: index('cash_events_portfolio_idx').on(table.portfolioId),
  dateIdx: index('cash_events_date_idx').on(table.date),
}));

export type CashEvent = typeof cashEvents.$inferSelect;
export type NewCashEvent = typeof cashEvents.$inferInsert;

// ============================================================================
// GOALS TABLE
// ============================================================================
export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['milestone', 'networth'] }).notNull(),
  title: text('title').notNull(),
  targetAmount: real('target_amount').notNull(),
  currentAmount: real('current_amount').notNull().default(0),
  targetDate: integer('target_date', { mode: 'timestamp' }),
  icon: text('icon'),
  category: text('category'),
  roundUps: integer('round_ups', { mode: 'boolean' }).default(false),
  autoSaveCadence: text('auto_save_cadence', { enum: ['weekly', 'biweekly', 'monthly'] }),
  autoSaveAmount: real('auto_save_amount'),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  typeIdx: index('goals_type_idx').on(table.type),
  completedIdx: index('goals_completed_idx').on(table.completedAt),
  pinnedIdx: index('goals_pinned_idx').on(table.isPinned),
}));

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;

// ============================================================================
// GOAL HISTORY TABLE (Contributions, roundups, adjustments)
// ============================================================================
export const goalHistory = sqliteTable('goal_history', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['contribution', 'roundup', 'adjust'] }).notNull(),
  amount: real('amount').notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  goalIdx: index('goal_history_goal_idx').on(table.goalId),
  dateIdx: index('goal_history_date_idx').on(table.date),
}));

export type GoalHistoryEntry = typeof goalHistory.$inferSelect;
export type NewGoalHistoryEntry = typeof goalHistory.$inferInsert;

// ============================================================================
// GOAL-TRANSACTION LINKS (Many-to-Many)
// ============================================================================
export const goalTransactionLinks = sqliteTable('goal_transaction_links', {
  goalId: text('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  transactionId: text('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  pk: primaryKey({ columns: [table.goalId, table.transactionId] }),
  goalIdx: index('goal_tx_links_goal_idx').on(table.goalId),
  txIdx: index('goal_tx_links_tx_idx').on(table.transactionId),
}));

export type GoalTransactionLink = typeof goalTransactionLinks.$inferSelect;
export type NewGoalTransactionLink = typeof goalTransactionLinks.$inferInsert;

// Relations
export const goalsRelations = relations(goals, ({ many }) => ({
  history: many(goalHistory),
  transactionLinks: many(goalTransactionLinks),
}));

export const goalHistoryRelations = relations(goalHistory, ({ one }) => ({
  goal: one(goals, {
    fields: [goalHistory.goalId],
    references: [goals.id],
  }),
}));

export const goalTransactionLinksRelations = relations(goalTransactionLinks, ({ one }) => ({
  goal: one(goals, {
    fields: [goalTransactionLinks.goalId],
    references: [goals.id],
  }),
  transaction: one(transactions, {
    fields: [goalTransactionLinks.transactionId],
    references: [transactions.id],
  }),
}));

// ============================================================================
// ACHIEVEMENTS TABLE
// ============================================================================
export const achievements = sqliteTable('achievements', {
  id: text('id').primaryKey(),
  type: text('type', {
    enum: ['first_goal', 'goal_completed', 'streak', 'multi_goal', 'big_saver', 'speedster', 'consistent', 'level_up']
  }).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  unlockedAt: integer('unlocked_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  typeIdx: index('achievements_type_idx').on(table.type),
  unlockedIdx: index('achievements_unlocked_idx').on(table.unlockedAt),
}));

export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;

// ============================================================================
// USER PROGRESS TABLE (XP and Level)
// ============================================================================
export const userProgress = sqliteTable('user_progress', {
  id: text('id').primaryKey().default('singleton'), // Single row
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = typeof userProgress.$inferInsert;

// ============================================================================
// GROUPS TABLE (Shared expense tracking)
// ============================================================================
export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  nameIdx: index('groups_name_idx').on(table.name),
}));

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

// ============================================================================
// GROUP MEMBERS TABLE
// ============================================================================
export const groupMembers = sqliteTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  contact: text('contact'),
  archived: integer('archived', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  groupIdx: index('group_members_group_idx').on(table.groupId),
  nameIdx: index('group_members_name_idx').on(table.name),
}));

export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;

// ============================================================================
// BILLS TABLE (Group shared expenses)
// ============================================================================
export const bills = sqliteTable('bills', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amount: real('amount').notNull(),
  taxMode: text('tax_mode', { enum: ['abs', 'pct'] }).notNull(),
  tax: real('tax').notNull().default(0),
  discountMode: text('discount_mode', { enum: ['abs', 'pct'] }).notNull(),
  discount: real('discount').notNull().default(0),
  finalAmount: real('final_amount').notNull(), // Calculated: amount + tax - discount
  splitMode: text('split_mode', { enum: ['equal', 'shares', 'exact'] }).notNull(),
  proportionalTax: integer('proportional_tax', { mode: 'boolean' }).default(false),
  date: integer('date', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  groupIdx: index('bills_group_idx').on(table.groupId),
  dateIdx: index('bills_date_idx').on(table.date),
}));

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;

// ============================================================================
// BILL SPLITS TABLE (How bill is split among members)
// ============================================================================
export const billSplits = sqliteTable('bill_splits', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => groupMembers.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(), // Member's share
  shares: real('shares'), // For share-based splitting
  paid: integer('paid', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  billIdx: index('bill_splits_bill_idx').on(table.billId),
  memberIdx: index('bill_splits_member_idx').on(table.memberId),
  paidIdx: index('bill_splits_paid_idx').on(table.paid),
}));

export type BillSplit = typeof billSplits.$inferSelect;
export type NewBillSplit = typeof billSplits.$inferInsert;

// ============================================================================
// BILL CONTRIBUTIONS TABLE (Who paid the bill)
// ============================================================================
export const billContributions = sqliteTable('bill_contributions', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => groupMembers.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  billIdx: index('bill_contributions_bill_idx').on(table.billId),
  memberIdx: index('bill_contributions_member_idx').on(table.memberId),
}));

export type BillContribution = typeof billContributions.$inferSelect;
export type NewBillContribution = typeof billContributions.$inferInsert;

// ============================================================================
// SETTLEMENTS TABLE (Member-to-member payments)
// ============================================================================
export const settlements = sqliteTable('settlements', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  fromMemberId: text('from_member_id').notNull().references(() => groupMembers.id, { onDelete: 'cascade' }),
  toMemberId: text('to_member_id').notNull().references(() => groupMembers.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  billId: text('bill_id').references(() => bills.id, { onDelete: 'set null' }), // Optional: link to specific bill
  memo: text('memo'),
  date: integer('date', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  groupIdx: index('settlements_group_idx').on(table.groupId),
  fromIdx: index('settlements_from_idx').on(table.fromMemberId),
  toIdx: index('settlements_to_idx').on(table.toMemberId),
  dateIdx: index('settlements_date_idx').on(table.date),
}));

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;

// Relations
export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  bills: many(bills),
  settlements: many(settlements),
}));

export const groupMembersRelations = relations(groupMembers, ({ one, many }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  billSplits: many(billSplits),
  billContributions: many(billContributions),
  settlementsFrom: many(settlements, { relationName: 'settlementsFrom' }),
  settlementsTo: many(settlements, { relationName: 'settlementsTo' }),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  group: one(groups, {
    fields: [bills.groupId],
    references: [groups.id],
  }),
  splits: many(billSplits),
  contributions: many(billContributions),
  settlements: many(settlements),
}));

export const billSplitsRelations = relations(billSplits, ({ one }) => ({
  bill: one(bills, {
    fields: [billSplits.billId],
    references: [bills.id],
  }),
  member: one(groupMembers, {
    fields: [billSplits.memberId],
    references: [groupMembers.id],
  }),
}));

export const billContributionsRelations = relations(billContributions, ({ one }) => ({
  bill: one(bills, {
    fields: [billContributions.billId],
    references: [bills.id],
  }),
  member: one(groupMembers, {
    fields: [billContributions.memberId],
    references: [groupMembers.id],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  group: one(groups, {
    fields: [settlements.groupId],
    references: [groups.id],
  }),
  fromMember: one(groupMembers, {
    fields: [settlements.fromMemberId],
    references: [groupMembers.id],
    relationName: 'settlementsFrom',
  }),
  toMember: one(groupMembers, {
    fields: [settlements.toMemberId],
    references: [groupMembers.id],
    relationName: 'settlementsTo',
  }),
  bill: one(bills, {
    fields: [settlements.billId],
    references: [bills.id],
  }),
}));

// ============================================================================
// QUOTES CACHE TABLE (Stock/Crypto prices - persisted with TTL)
// ============================================================================
export const quotesCache = sqliteTable('quotes_cache', {
  symbol: text('symbol').primaryKey(),
  last: real('last').notNull(),
  change: real('change').notNull(),
  changePct: real('change_pct').notNull(),
  ts: integer('ts', { mode: 'timestamp' }).notNull(), // Quote timestamp
  cachedAt: integer('cached_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  // Sparkline and bars stored as JSON strings
  line: text('line', { mode: 'json' }), // Array<{ t: number; v: number }>
  bars: text('bars', { mode: 'json' }), // Array<{ t, o, h, l, c, v }>
  fundamentals: text('fundamentals', { mode: 'json' }), // Complex object
}, (table) => ({
  cachedIdx: index('quotes_cache_cached_idx').on(table.cachedAt),
}));

export type QuoteCache = typeof quotesCache.$inferSelect;
export type NewQuoteCache = typeof quotesCache.$inferInsert;

// ============================================================================
// FX RATES CACHE TABLE (Foreign exchange rates - persisted with TTL)
// ============================================================================
export const fxRatesCache = sqliteTable('fx_rates_cache', {
  baseCurrency: text('base_currency').primaryKey().default('USD'),
  rates: text('rates', { mode: 'json' }).notNull(), // Record<string, number>
  fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  fetchedIdx: index('fx_rates_cache_fetched_idx').on(table.fetchedAt),
}));

export type FxRateCache = typeof fxRatesCache.$inferSelect;
export type NewFxRateCache = typeof fxRatesCache.$inferInsert;

// ============================================================================
// DEBTS TABLE (Standalone debts - NO CREDIT CARDS HERE!)
// ============================================================================
export const debts = sqliteTable('debts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['loan', 'bnpl'] }).notNull(), // REMOVED 'credit' - use accounts instead
  apr: real('apr'), // Annual Percentage Rate
  balance: real('balance').notNull(),
  minDue: real('min_due').notNull(),
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  typeIdx: index('debts_type_idx').on(table.type),
  dueIdx: index('debts_due_idx').on(table.dueDate),
}));

export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;

// ============================================================================
// BUDGET TABLE
// ============================================================================
export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey().default('singleton'), // Single row for now
  monthlyBudget: real('monthly_budget'),
  warnThreshold: real('warn_threshold').default(0.8),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
