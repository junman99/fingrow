-- ============================================================================
-- FINGROW MULTI-USER DATABASE SCHEMA
-- Production-ready schema with user isolation and security
-- ============================================================================

-- ============================================================================
-- USERS TABLE (New)
-- ============================================================================
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- Hashed with bcrypt
  name TEXT,
  phone TEXT,
  country_code TEXT,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  email_verified INTEGER DEFAULT 0,
  phone_verified INTEGER DEFAULT 0,
  two_factor_enabled INTEGER DEFAULT 0,
  two_factor_secret TEXT,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER -- Soft delete
);

CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_deleted_idx ON users(deleted_at);

-- ============================================================================
-- USER SESSIONS (New)
-- ============================================================================
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_id TEXT,
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

CREATE INDEX user_sessions_user_idx ON user_sessions(user_id);
CREATE INDEX user_sessions_expires_idx ON user_sessions(expires_at);

-- ============================================================================
-- ACCOUNTS TABLE (Updated)
-- ============================================================================
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- NEW
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

CREATE INDEX accounts_user_idx ON accounts(user_id); -- NEW
CREATE INDEX accounts_name_idx ON accounts(name);
CREATE INDEX accounts_kind_idx ON accounts(kind);
CREATE INDEX accounts_user_kind_idx ON accounts(user_id, kind); -- NEW composite

-- ============================================================================
-- TRANSACTIONS TABLE (Updated)
-- ============================================================================
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- NEW
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  date INTEGER NOT NULL,
  note TEXT,
  title TEXT,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX transactions_user_idx ON transactions(user_id); -- NEW
CREATE INDEX transactions_date_idx ON transactions(date);
CREATE INDEX transactions_category_idx ON transactions(category);
CREATE INDEX transactions_type_idx ON transactions(type);
CREATE INDEX transactions_account_idx ON transactions(account_id);
CREATE INDEX transactions_user_date_idx ON transactions(user_id, date); -- NEW composite
CREATE INDEX transactions_user_category_idx ON transactions(user_id, category); -- NEW composite

-- ============================================================================
-- PORTFOLIOS TABLE (Updated)
-- ============================================================================
CREATE TABLE portfolios (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- NEW
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

CREATE INDEX portfolios_user_idx ON portfolios(user_id); -- NEW
CREATE INDEX portfolios_name_idx ON portfolios(name);
CREATE INDEX portfolios_archived_idx ON portfolios(archived);
CREATE INDEX portfolios_user_archived_idx ON portfolios(user_id, archived); -- NEW composite

-- ============================================================================
-- HOLDINGS TABLE (Updated - no direct user_id, through portfolio)
-- ============================================================================
CREATE TABLE holdings (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  archived INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX holdings_portfolio_idx ON holdings(portfolio_id);
CREATE INDEX holdings_symbol_idx ON holdings(symbol);
CREATE INDEX holdings_portfolio_symbol_idx ON holdings(portfolio_id, symbol);

-- ============================================================================
-- LOTS TABLE (no change needed - inherits user from holding→portfolio→user)
-- ============================================================================
CREATE TABLE lots (
  id TEXT PRIMARY KEY,
  holding_id TEXT NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  qty REAL NOT NULL,
  price REAL NOT NULL,
  fee REAL DEFAULT 0,
  date INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX lots_holding_idx ON lots(holding_id);
CREATE INDEX lots_date_idx ON lots(date);
CREATE INDEX lots_holding_date_idx ON lots(holding_id, date);

-- ============================================================================
-- WATCHLIST TABLE (no change needed)
-- ============================================================================
CREATE TABLE watchlist (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  added_at INTEGER NOT NULL
);

CREATE INDEX watchlist_portfolio_idx ON watchlist(portfolio_id);
CREATE INDEX watchlist_symbol_idx ON watchlist(symbol);
CREATE INDEX watchlist_portfolio_symbol_idx ON watchlist(portfolio_id, symbol);

-- ============================================================================
-- CASH EVENTS TABLE (no change needed)
-- ============================================================================
CREATE TABLE cash_events (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  date INTEGER NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX cash_events_portfolio_idx ON cash_events(portfolio_id);
CREATE INDEX cash_events_date_idx ON cash_events(date);

-- ============================================================================
-- GOALS TABLE (Updated)
-- ============================================================================
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- NEW
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

CREATE INDEX goals_user_idx ON goals(user_id); -- NEW
CREATE INDEX goals_type_idx ON goals(type);
CREATE INDEX goals_completed_idx ON goals(completed_at);
CREATE INDEX goals_pinned_idx ON goals(is_pinned);
CREATE INDEX goals_user_completed_idx ON goals(user_id, completed_at); -- NEW composite

-- ============================================================================
-- GOAL HISTORY TABLE (no change needed - inherits user from goal)
-- ============================================================================
CREATE TABLE goal_history (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  date INTEGER NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX goal_history_goal_idx ON goal_history(goal_id);
CREATE INDEX goal_history_date_idx ON goal_history(date);

-- ============================================================================
-- GOAL TRANSACTION LINKS (no change needed)
-- ============================================================================
CREATE TABLE goal_transaction_links (
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (goal_id, transaction_id)
);

CREATE INDEX goal_tx_links_goal_idx ON goal_transaction_links(goal_id);
CREATE INDEX goal_tx_links_tx_idx ON goal_transaction_links(transaction_id);

-- ============================================================================
-- ACHIEVEMENTS TABLE (Updated)
-- ============================================================================
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- NEW
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL
);

CREATE INDEX achievements_user_idx ON achievements(user_id); -- NEW
CREATE INDEX achievements_type_idx ON achievements(type);
CREATE INDEX achievements_unlocked_idx ON achievements(unlocked_at);

-- ============================================================================
-- USER PROGRESS TABLE (Updated)
-- ============================================================================
CREATE TABLE user_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- Changed from 'singleton'
  level INTEGER DEFAULT 1 NOT NULL,
  xp INTEGER DEFAULT 0 NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================================================
-- GROUPS TABLE (Updated)
-- ============================================================================
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- NEW: Group owner
  name TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX groups_owner_idx ON groups(owner_user_id); -- NEW
CREATE INDEX groups_name_idx ON groups(name);

-- ============================================================================
-- GROUP MEMBERS TABLE (Updated)
-- ============================================================================
CREATE TABLE group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- NEW: Link to actual user (optional)
  name TEXT NOT NULL,
  contact TEXT,
  archived INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX group_members_group_idx ON group_members(group_id);
CREATE INDEX group_members_user_idx ON group_members(user_id); -- NEW
CREATE INDEX group_members_name_idx ON group_members(name);

-- ============================================================================
-- BILLS TABLE (no change needed - inherits user from group)
-- ============================================================================
CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
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
  created_at INTEGER NOT NULL
);

CREATE INDEX bills_group_idx ON bills(group_id);
CREATE INDEX bills_date_idx ON bills(date);

-- ============================================================================
-- BILL SPLITS TABLE (no change needed)
-- ============================================================================
CREATE TABLE bill_splits (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  shares REAL,
  paid INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX bill_splits_bill_idx ON bill_splits(bill_id);
CREATE INDEX bill_splits_member_idx ON bill_splits(member_id);
CREATE INDEX bill_splits_paid_idx ON bill_splits(paid);

-- ============================================================================
-- BILL CONTRIBUTIONS TABLE (no change needed)
-- ============================================================================
CREATE TABLE bill_contributions (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX bill_contributions_bill_idx ON bill_contributions(bill_id);
CREATE INDEX bill_contributions_member_idx ON bill_contributions(member_id);

-- ============================================================================
-- SETTLEMENTS TABLE (no change needed)
-- ============================================================================
CREATE TABLE settlements (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_member_id TEXT NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  to_member_id TEXT NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  bill_id TEXT REFERENCES bills(id) ON DELETE SET NULL,
  memo TEXT,
  date INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX settlements_group_idx ON settlements(group_id);
CREATE INDEX settlements_from_idx ON settlements(from_member_id);
CREATE INDEX settlements_to_idx ON settlements(to_member_id);
CREATE INDEX settlements_date_idx ON settlements(date);

-- ============================================================================
-- DEBTS TABLE (Updated)
-- ============================================================================
CREATE TABLE debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- NEW
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'loan' or 'bnpl' ONLY (no 'credit')
  apr REAL,
  balance REAL NOT NULL,
  min_due REAL NOT NULL,
  due_date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX debts_user_idx ON debts(user_id); -- NEW
CREATE INDEX debts_type_idx ON debts(type);
CREATE INDEX debts_due_idx ON debts(due_date);

-- ============================================================================
-- BUDGETS TABLE (Updated)
-- ============================================================================
CREATE TABLE budgets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- Changed from 'singleton'
  monthly_budget REAL,
  warn_threshold REAL DEFAULT 0.8,
  updated_at INTEGER NOT NULL
);

-- ============================================================================
-- QUOTES CACHE TABLE (Global - shared across users)
-- ============================================================================
CREATE TABLE quotes_cache (
  symbol TEXT PRIMARY KEY,
  last REAL NOT NULL,
  change REAL NOT NULL,
  change_pct REAL NOT NULL,
  ts INTEGER NOT NULL,
  cached_at INTEGER NOT NULL,
  line TEXT, -- JSON
  bars TEXT, -- JSON
  fundamentals TEXT -- JSON
);

CREATE INDEX quotes_cache_cached_idx ON quotes_cache(cached_at);

-- ============================================================================
-- FX RATES CACHE TABLE (Global - shared across users)
-- ============================================================================
CREATE TABLE fx_rates_cache (
  base_currency TEXT PRIMARY KEY DEFAULT 'USD',
  rates TEXT NOT NULL, -- JSON
  fetched_at INTEGER NOT NULL
);

CREATE INDEX fx_rates_cache_fetched_idx ON fx_rates_cache(fetched_at);

-- ============================================================================
-- AUDIT LOG TABLE (New - for security and compliance)
-- ============================================================================
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'login', 'logout', 'create_transaction', 'delete_account', etc.
  entity_type TEXT, -- 'transaction', 'account', 'goal', etc.
  entity_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT, -- JSON with action-specific details (NO sensitive data)
  created_at INTEGER NOT NULL
);

CREATE INDEX audit_log_user_idx ON audit_log(user_id);
CREATE INDEX audit_log_action_idx ON audit_log(action);
CREATE INDEX audit_log_created_idx ON audit_log(created_at);

-- ============================================================================
-- USER PREFERENCES TABLE (New - for per-user settings)
-- ============================================================================
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'system', -- 'light', 'dark', 'system'
  language TEXT DEFAULT 'en',
  notifications_enabled INTEGER DEFAULT 1,
  biometric_enabled INTEGER DEFAULT 0,
  data_source TEXT DEFAULT 'yahoo', -- 'yahoo', 'fmp', 'finnhub'
  ai_tier TEXT DEFAULT 'free', -- 'free', 'premium'
  updated_at INTEGER NOT NULL
);

-- ============================================================================
-- SCHEMA VERSION TABLE (for migration tracking)
-- ============================================================================
CREATE TABLE schema_version (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  version INTEGER NOT NULL,
  applied_at INTEGER NOT NULL
);

-- Insert initial version
INSERT INTO schema_version (id, version, applied_at)
VALUES ('singleton', 1, strftime('%s', 'now') * 1000);

-- ============================================================================
-- ROW LEVEL SECURITY VIEWS (Helper views for user isolation)
-- ============================================================================

-- Note: SQLite doesn't have built-in RLS like PostgreSQL
-- Instead, we enforce user filtering in application code
-- But we can create helper views for common patterns:

-- Example: User's transactions view
CREATE VIEW user_transactions AS
SELECT t.*
FROM transactions t
WHERE t.user_id = (SELECT id FROM users WHERE id = 'current_user_id_placeholder');

-- In practice, you'll filter by user_id in your queries:
-- SELECT * FROM transactions WHERE user_id = ?

-- ============================================================================
-- TRIGGERS FOR AUDIT LOGGING (Example)
-- ============================================================================

-- Trigger to log account deletions
CREATE TRIGGER audit_account_delete
AFTER DELETE ON accounts
BEGIN
  INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, created_at)
  VALUES (
    hex(randomblob(16)),
    OLD.user_id,
    'delete_account',
    'account',
    OLD.id,
    strftime('%s', 'now') * 1000
  );
END;

-- Trigger to log transaction creation
CREATE TRIGGER audit_transaction_create
AFTER INSERT ON transactions
BEGIN
  INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, created_at)
  VALUES (
    hex(randomblob(16)),
    NEW.user_id,
    'create_transaction',
    'transaction',
    NEW.id,
    strftime('%s', 'now') * 1000
  );
END;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Composite indexes for common query patterns
CREATE INDEX accounts_user_balance_idx ON accounts(user_id, balance);
CREATE INDEX transactions_user_date_amount_idx ON transactions(user_id, date, amount);
CREATE INDEX portfolios_user_tracking_idx ON portfolios(user_id, tracking_enabled);

-- ============================================================================
-- DATA INTEGRITY CONSTRAINTS
-- ============================================================================

-- Note: SQLite has limited CHECK constraint support in older versions
-- Modern SQLite (3.37+) supports these:

-- Ensure transaction amounts are positive
-- ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0);

-- Ensure account balances are realistic (not too large)
-- ALTER TABLE accounts ADD CONSTRAINT accounts_balance_range CHECK (balance > -1000000000 AND balance < 1000000000);

-- For older SQLite, enforce these in application code

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- To migrate existing single-user data to multi-user:
-- 1. Create a default user account
-- 2. Add user_id column to all tables (initially NULL)
-- 3. Update all rows with default user's ID
-- 4. Make user_id NOT NULL
-- 5. Add foreign key constraints

-- Example migration script:
/*
-- Step 1: Create default user
INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
VALUES ('default-user-id', 'user@example.com', 'hashed-password', 'Default User', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- Step 2: Add user_id to existing table
ALTER TABLE accounts ADD COLUMN user_id TEXT;

-- Step 3: Update all rows with default user
UPDATE accounts SET user_id = 'default-user-id' WHERE user_id IS NULL;

-- Step 4: Now we can't add NOT NULL constraint to existing column in SQLite
-- So we need to recreate the table (or handle in Drizzle migration)
*/

-- ============================================================================
-- QUERY EXAMPLES
-- ============================================================================

-- Get all transactions for a user
-- SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 100;

-- Get user's net worth
-- SELECT
--   (SELECT SUM(balance) FROM accounts WHERE user_id = ? AND kind != 'credit') AS cash,
--   (SELECT SUM(balance) FROM accounts WHERE user_id = ? AND kind = 'credit') AS credit_debt,
--   (SELECT SUM(balance) FROM debts WHERE user_id = ?) AS other_debt;

-- Get user's portfolio summary
-- SELECT p.*, COUNT(h.id) AS holdings_count
-- FROM portfolios p
-- LEFT JOIN holdings h ON h.portfolio_id = p.id
-- WHERE p.user_id = ?
-- GROUP BY p.id;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
