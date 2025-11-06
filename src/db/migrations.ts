/**
 * Database Migrations
 * Manually creates tables - simpler than importing SQL files
 */

import { type SQLiteDatabase } from 'expo-sqlite/next';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  console.log('[DB] Running migrations...');

  try {
    // Check if migrations have been run
    const result = await db.getAllAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='accounts'"
    );

    if (result[0]?.count > 0) {
      console.log('[DB] Tables already exist, skipping migrations');
      return;
    }

    // Create all tables in correct order (respecting foreign keys)

    // 1. Independent tables (no foreign keys)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        institution TEXT,
        mask TEXT,
        balance REAL DEFAULT 0 NOT NULL,
        kind TEXT DEFAULT 'checking',
        include_in_net_worth INTEGER DEFAULT 1,
        note TEXT,
        is_default INTEGER DEFAULT 0,
        apr REAL,
        credit_limit REAL,
        min_payment_percent REAL,
        last_synced_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS accounts_name_idx ON accounts (name);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS accounts_kind_idx ON accounts (kind);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS portfolios (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        base_currency TEXT DEFAULT 'USD' NOT NULL,
        benchmark TEXT,
        type TEXT DEFAULT 'Live',
        cash REAL DEFAULT 0 NOT NULL,
        archived INTEGER DEFAULT 0,
        tracking_enabled INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS portfolios_name_idx ON portfolios (name);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS portfolios_archived_idx ON portfolios (archived);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        target_amount REAL NOT NULL,
        current_amount REAL DEFAULT 0 NOT NULL,
        target_date INTEGER,
        icon TEXT,
        category TEXT,
        round_ups INTEGER DEFAULT 0,
        auto_save_cadence TEXT,
        auto_save_amount REAL,
        is_pinned INTEGER DEFAULT 0,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS goals_type_idx ON goals (type);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS goals_completed_idx ON goals (completed_at);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS goals_pinned_idx ON goals (is_pinned);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        unlocked_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS achievements_type_idx ON achievements (type);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS achievements_unlocked_idx ON achievements (unlocked_at);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id TEXT PRIMARY KEY DEFAULT 'singleton' NOT NULL,
        level INTEGER DEFAULT 1 NOT NULL,
        xp INTEGER DEFAULT 0 NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS groups_name_idx ON groups (name);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        apr REAL,
        balance REAL NOT NULL,
        min_due REAL NOT NULL,
        due_date INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS debts_type_idx ON debts (type);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS debts_due_idx ON debts (due_date);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY DEFAULT 'singleton' NOT NULL,
        monthly_budget REAL,
        warn_threshold REAL DEFAULT 0.8,
        updated_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS quotes_cache (
        symbol TEXT PRIMARY KEY NOT NULL,
        last REAL NOT NULL,
        change REAL NOT NULL,
        change_pct REAL NOT NULL,
        ts INTEGER NOT NULL,
        cached_at INTEGER NOT NULL,
        line TEXT,
        bars TEXT,
        fundamentals TEXT
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS quotes_cache_cached_idx ON quotes_cache (cached_at);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS fx_rates_cache (
        base_currency TEXT PRIMARY KEY DEFAULT 'USD' NOT NULL,
        rates TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS fx_rates_cache_fetched_idx ON fx_rates_cache (fetched_at);`);

    // 2. Tables with foreign keys to above tables

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date INTEGER NOT NULL,
        note TEXT,
        title TEXT,
        account_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (date);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS transactions_category_idx ON transactions (category);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions (type);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS transactions_account_idx ON transactions (account_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS transactions_date_category_idx ON transactions (date, category);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS holdings (
        id TEXT PRIMARY KEY NOT NULL,
        portfolio_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        currency TEXT NOT NULL,
        archived INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS holdings_portfolio_idx ON holdings (portfolio_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS holdings_symbol_idx ON holdings (symbol);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS holdings_portfolio_symbol_idx ON holdings (portfolio_id, symbol);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS lots (
        id TEXT PRIMARY KEY NOT NULL,
        holding_id TEXT NOT NULL,
        side TEXT NOT NULL,
        qty REAL NOT NULL,
        price REAL NOT NULL,
        fee REAL DEFAULT 0,
        date INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS lots_holding_idx ON lots (holding_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS lots_date_idx ON lots (date);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS lots_holding_date_idx ON lots (holding_id, date);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id TEXT PRIMARY KEY NOT NULL,
        portfolio_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS watchlist_portfolio_idx ON watchlist (portfolio_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS watchlist_symbol_idx ON watchlist (symbol);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS watchlist_portfolio_symbol_idx ON watchlist (portfolio_id, symbol);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cash_events (
        id TEXT PRIMARY KEY NOT NULL,
        portfolio_id TEXT NOT NULL,
        amount REAL NOT NULL,
        date INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS cash_events_portfolio_idx ON cash_events (portfolio_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS cash_events_date_idx ON cash_events (date);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS goal_history (
        id TEXT PRIMARY KEY NOT NULL,
        goal_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        date INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS goal_history_goal_idx ON goal_history (goal_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS goal_history_date_idx ON goal_history (date);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS goal_transaction_links (
        goal_id TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (goal_id, transaction_id),
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS goal_tx_links_goal_idx ON goal_transaction_links (goal_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS goal_tx_links_tx_idx ON goal_transaction_links (transaction_id);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS group_members (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        contact TEXT,
        archived INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS group_members_group_idx ON group_members (group_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS group_members_name_idx ON group_members (name);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        tax_mode TEXT NOT NULL,
        tax REAL DEFAULT 0 NOT NULL,
        discount_mode TEXT NOT NULL,
        discount REAL DEFAULT 0 NOT NULL,
        final_amount REAL NOT NULL,
        split_mode TEXT NOT NULL,
        proportional_tax INTEGER DEFAULT 0,
        date INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS bills_group_idx ON bills (group_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS bills_date_idx ON bills (date);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_splits (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        amount REAL NOT NULL,
        shares REAL,
        paid INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS bill_splits_bill_idx ON bill_splits (bill_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS bill_splits_member_idx ON bill_splits (member_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS bill_splits_paid_idx ON bill_splits (paid);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_contributions (
        id TEXT PRIMARY KEY NOT NULL,
        bill_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS bill_contributions_bill_idx ON bill_contributions (bill_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS bill_contributions_member_idx ON bill_contributions (member_id);`);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settlements (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL,
        from_member_id TEXT NOT NULL,
        to_member_id TEXT NOT NULL,
        amount REAL NOT NULL,
        bill_id TEXT,
        memo TEXT,
        date INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (from_member_id) REFERENCES group_members(id) ON DELETE CASCADE,
        FOREIGN KEY (to_member_id) REFERENCES group_members(id) ON DELETE CASCADE,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL
      );
    `);

    await db.execAsync(`CREATE INDEX IF NOT EXISTS settlements_group_idx ON settlements (group_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS settlements_from_idx ON settlements (from_member_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS settlements_to_idx ON settlements (to_member_id);`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS settlements_date_idx ON settlements (date);`);

    console.log('[DB] All tables and indexes created successfully');
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    throw error;
  }
}
