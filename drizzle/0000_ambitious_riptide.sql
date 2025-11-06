CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`institution` text,
	`mask` text,
	`balance` real DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'checking',
	`include_in_net_worth` integer DEFAULT true,
	`note` text,
	`is_default` integer DEFAULT false,
	`apr` real,
	`credit_limit` real,
	`min_payment_percent` real,
	`last_synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_name_idx` ON `accounts` (`name`);--> statement-breakpoint
CREATE INDEX `accounts_kind_idx` ON `accounts` (`kind`);--> statement-breakpoint
CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`icon` text NOT NULL,
	`unlocked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `achievements_type_idx` ON `achievements` (`type`);--> statement-breakpoint
CREATE INDEX `achievements_unlocked_idx` ON `achievements` (`unlocked_at`);--> statement-breakpoint
CREATE TABLE `bill_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bill_contributions_bill_idx` ON `bill_contributions` (`bill_id`);--> statement-breakpoint
CREATE INDEX `bill_contributions_member_idx` ON `bill_contributions` (`member_id`);--> statement-breakpoint
CREATE TABLE `bill_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount` real NOT NULL,
	`shares` real,
	`paid` integer DEFAULT false,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bill_splits_bill_idx` ON `bill_splits` (`bill_id`);--> statement-breakpoint
CREATE INDEX `bill_splits_member_idx` ON `bill_splits` (`member_id`);--> statement-breakpoint
CREATE INDEX `bill_splits_paid_idx` ON `bill_splits` (`paid`);--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`title` text NOT NULL,
	`amount` real NOT NULL,
	`tax_mode` text NOT NULL,
	`tax` real DEFAULT 0 NOT NULL,
	`discount_mode` text NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`final_amount` real NOT NULL,
	`split_mode` text NOT NULL,
	`proportional_tax` integer DEFAULT false,
	`date` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bills_group_idx` ON `bills` (`group_id`);--> statement-breakpoint
CREATE INDEX `bills_date_idx` ON `bills` (`date`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`monthly_budget` real,
	`warn_threshold` real DEFAULT 0.8,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cash_events` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`amount` real NOT NULL,
	`date` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cash_events_portfolio_idx` ON `cash_events` (`portfolio_id`);--> statement-breakpoint
CREATE INDEX `cash_events_date_idx` ON `cash_events` (`date`);--> statement-breakpoint
CREATE TABLE `debts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`apr` real,
	`balance` real NOT NULL,
	`min_due` real NOT NULL,
	`due_date` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `debts_type_idx` ON `debts` (`type`);--> statement-breakpoint
CREATE INDEX `debts_due_idx` ON `debts` (`due_date`);--> statement-breakpoint
CREATE TABLE `fx_rates_cache` (
	`base_currency` text PRIMARY KEY DEFAULT 'USD' NOT NULL,
	`rates` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fx_rates_cache_fetched_idx` ON `fx_rates_cache` (`fetched_at`);--> statement-breakpoint
CREATE TABLE `goal_history` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`date` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_history_goal_idx` ON `goal_history` (`goal_id`);--> statement-breakpoint
CREATE INDEX `goal_history_date_idx` ON `goal_history` (`date`);--> statement-breakpoint
CREATE TABLE `goal_transaction_links` (
	`goal_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`goal_id`, `transaction_id`),
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_tx_links_goal_idx` ON `goal_transaction_links` (`goal_id`);--> statement-breakpoint
CREATE INDEX `goal_tx_links_tx_idx` ON `goal_transaction_links` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`target_amount` real NOT NULL,
	`current_amount` real DEFAULT 0 NOT NULL,
	`target_date` integer,
	`icon` text,
	`category` text,
	`round_ups` integer DEFAULT false,
	`auto_save_cadence` text,
	`auto_save_amount` real,
	`is_pinned` integer DEFAULT false,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `goals_type_idx` ON `goals` (`type`);--> statement-breakpoint
CREATE INDEX `goals_completed_idx` ON `goals` (`completed_at`);--> statement-breakpoint
CREATE INDEX `goals_pinned_idx` ON `goals` (`is_pinned`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`contact` text,
	`archived` integer DEFAULT false,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_members_group_idx` ON `group_members` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_members_name_idx` ON `group_members` (`name`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `groups_name_idx` ON `groups` (`name`);--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`archived` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `holdings_portfolio_idx` ON `holdings` (`portfolio_id`);--> statement-breakpoint
CREATE INDEX `holdings_symbol_idx` ON `holdings` (`symbol`);--> statement-breakpoint
CREATE INDEX `holdings_portfolio_symbol_idx` ON `holdings` (`portfolio_id`,`symbol`);--> statement-breakpoint
CREATE TABLE `lots` (
	`id` text PRIMARY KEY NOT NULL,
	`holding_id` text NOT NULL,
	`side` text NOT NULL,
	`qty` real NOT NULL,
	`price` real NOT NULL,
	`fee` real DEFAULT 0,
	`date` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`holding_id`) REFERENCES `holdings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lots_holding_idx` ON `lots` (`holding_id`);--> statement-breakpoint
CREATE INDEX `lots_date_idx` ON `lots` (`date`);--> statement-breakpoint
CREATE INDEX `lots_holding_date_idx` ON `lots` (`holding_id`,`date`);--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`benchmark` text,
	`type` text DEFAULT 'Live',
	`cash` real DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false,
	`tracking_enabled` integer DEFAULT true,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `portfolios_name_idx` ON `portfolios` (`name`);--> statement-breakpoint
CREATE INDEX `portfolios_archived_idx` ON `portfolios` (`archived`);--> statement-breakpoint
CREATE TABLE `quotes_cache` (
	`symbol` text PRIMARY KEY NOT NULL,
	`last` real NOT NULL,
	`change` real NOT NULL,
	`change_pct` real NOT NULL,
	`ts` integer NOT NULL,
	`cached_at` integer NOT NULL,
	`line` text,
	`bars` text,
	`fundamentals` text
);
--> statement-breakpoint
CREATE INDEX `quotes_cache_cached_idx` ON `quotes_cache` (`cached_at`);--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`from_member_id` text NOT NULL,
	`to_member_id` text NOT NULL,
	`amount` real NOT NULL,
	`bill_id` text,
	`memo` text,
	`date` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `settlements_group_idx` ON `settlements` (`group_id`);--> statement-breakpoint
CREATE INDEX `settlements_from_idx` ON `settlements` (`from_member_id`);--> statement-breakpoint
CREATE INDEX `settlements_to_idx` ON `settlements` (`to_member_id`);--> statement-breakpoint
CREATE INDEX `settlements_date_idx` ON `settlements` (`date`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`date` integer NOT NULL,
	`note` text,
	`title` text,
	`account_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`type`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_category_idx` ON `transactions` (`date`,`category`);--> statement-breakpoint
CREATE TABLE `user_progress` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` text PRIMARY KEY NOT NULL,
	`portfolio_id` text NOT NULL,
	`symbol` text NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watchlist_portfolio_idx` ON `watchlist` (`portfolio_id`);--> statement-breakpoint
CREATE INDEX `watchlist_symbol_idx` ON `watchlist` (`symbol`);--> statement-breakpoint
CREATE INDEX `watchlist_portfolio_symbol_idx` ON `watchlist` (`portfolio_id`,`symbol`);