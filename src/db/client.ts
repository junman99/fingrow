/**
 * Fingrow Database Client
 * Initializes and manages the SQLite database connection using Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite/next';
import * as schema from './schema';
import { runMigrations } from './migrations';

// Database name
const DB_NAME = 'fingrow.db';

// Initialize SQLite database
const expoDb = openDatabaseSync(DB_NAME);

// Create Drizzle ORM instance with schema
export const db = drizzle(expoDb, { schema });

// Export raw expo db for advanced queries if needed
export const rawDb = expoDb;

// Type-safe database instance
export type Database = typeof db;

/**
 * Initialize database and run migrations
 * Call this once on app startup
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('[DB] Initializing database...');

    // Enable foreign keys (SQLite default is OFF!)
    await rawDb.execAsync('PRAGMA foreign_keys = ON;');

    // Enable WAL mode for better concurrency
    await rawDb.execAsync('PRAGMA journal_mode = WAL;');

    // Run migrations - create tables if they don't exist
    await runMigrations(rawDb);

    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Close database connection
 * Call this on app shutdown (rarely needed in React Native)
 */
export async function closeDatabase(): Promise<void> {
  try {
    await rawDb.closeAsync();
    console.log('[DB] Database connection closed');
  } catch (error) {
    console.error('[DB] Failed to close database:', error);
    throw error;
  }
}

/**
 * Get database stats (for debugging)
 */
export async function getDatabaseStats() {
  const result = await rawDb.getAllAsync(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type='table'
    ORDER BY name;
  `);

  return {
    tables: result,
    dbName: DB_NAME,
  };
}

/**
 * Clear all data (for testing/development)
 * WARNING: This deletes ALL data!
 */
export async function clearAllData(): Promise<void> {
  console.warn('[DB] Clearing all data...');

  // Get all table names
  const tables = await rawDb.getAllAsync<{ name: string }>(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%';
  `);

  // Disable foreign keys temporarily
  await rawDb.execAsync('PRAGMA foreign_keys = OFF;');

  // Delete all rows from each table
  for (const table of tables) {
    await rawDb.execAsync(`DELETE FROM ${table.name};`);
  }

  // Re-enable foreign keys
  await rawDb.execAsync('PRAGMA foreign_keys = ON;');

  console.log('[DB] All data cleared');
}

export default db;
