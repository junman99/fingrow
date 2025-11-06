# 🚀 Quick Start Guide - Database Remodel

## Step 1: Initialize Database on App Startup

Find your app's entry point (usually `App.tsx` or `index.js`) and add database initialization:

```typescript
// App.tsx
import React, { useEffect, useState } from 'react';
import { initializeDatabase } from './src/db/client';
import { migrateFromAsyncStorage } from './src/db/async-storage-migration';

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const initDB = async () => {
      try {
        console.log('[App] Initializing database...');

        // 1. Create tables
        await initializeDatabase();

        // 2. Migrate data from AsyncStorage (one-time)
        const result = await migrateFromAsyncStorage();

        if (result.success) {
          console.log('[App] ✅ Migration complete:', result.stats);
        } else {
          console.error('[App] ❌ Migration failed:', result.error);
        }

        setDbReady(true);
      } catch (error) {
        console.error('[App] Failed to initialize database:', error);
        // Fall back to AsyncStorage if migration fails
        setDbReady(true);
      }
    };

    initDB();
  }, []);

  if (!dbReady) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {/* Your app content */}
    </NavigationContainer>
  );
}
```

## Step 2: Test the Migration

Run your app and check the console logs:

```
[DB] Initializing database...
[DB] Running migrations...
[DB] All tables and indexes created successfully
[DB] Database initialized successfully
[Migration] Starting AsyncStorage → SQLite migration...
[Migration] Migrated 5 accounts
[Migration] Migrated 234 transactions
[Migration] Migrated 2 portfolios
[Migration] Migrated 8 holdings and 45 lots
[Migration] Migrated 3 goals
[Migration] Migrated 1 groups
[Migration] Migrated 0 debts (filtered 2 credit cards)
[Migration] ✅ Complete!
[App] ✅ Migration complete: { accounts: 5, transactions: 234, ... }
```

## Step 3: Verify Data Migrated Correctly

Add a verification function to check the data:

```typescript
import { db } from './src/db/client';
import { accounts, transactions, portfolios } from './src/db/schema';

async function verifyMigration() {
  const allAccounts = await db.select().from(accounts);
  const allTxs = await db.select().from(transactions);
  const allPortfolios = await db.select().from(portfolios);

  console.log('✅ Accounts:', allAccounts.length);
  console.log('✅ Transactions:', allTxs.length);
  console.log('✅ Portfolios:', allPortfolios.length);

  // Check a specific account
  const firstAccount = allAccounts[0];
  console.log('First account:', {
    name: firstAccount.name,
    balance: firstAccount.balance,
    kind: firstAccount.kind,
  });
}

// Call after migration
verifyMigration();
```

## Step 4: Create Your First Query Function

Create a simple query to replace AsyncStorage usage:

```typescript
// src/db/queries/accounts.ts
import { db } from '../client';
import { accounts } from '../schema';
import { eq } from 'drizzle-orm';

export async function getAllAccounts() {
  return await db.select().from(accounts);
}

export async function getAccountById(id: string) {
  const result = await db.select().from(accounts).where(eq(accounts.id, id));
  return result[0];
}

export async function updateAccountBalance(id: string, newBalance: number) {
  return await db.update(accounts)
    .set({ balance: newBalance, updatedAt: Date.now() })
    .where(eq(accounts.id, id));
}

export async function getCreditCardAccounts() {
  return await db.select().from(accounts).where(eq(accounts.kind, 'credit'));
}
```

## Step 5: Update Your First Zustand Store

Start with the simplest store (accounts):

```typescript
// src/store/accounts.ts (UPDATED)
import { create } from 'zustand';
import { getAllAccounts, updateAccountBalance, ... } from '../db/queries/accounts';

type AccountsState = {
  accounts: BankAccount[];
  hydrate: () => Promise<void>;
  updateAccount: (id: string, patch: Partial<BankAccount>) => Promise<void>;
  // ... other methods
};

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],

  // Load from database instead of AsyncStorage
  hydrate: async () => {
    try {
      const accounts = await getAllAccounts();
      set({ accounts });
    } catch (error) {
      console.error('[AccountsStore] Failed to hydrate:', error);
    }
  },

  // Update using database instead of AsyncStorage
  updateAccount: async (id, patch) => {
    try {
      await updateAccountBalance(id, patch.balance);

      // Update local state
      const next = get().accounts.map(x => x.id === id ? { ...x, ...patch } : x);
      set({ accounts: next });
    } catch (error) {
      console.error('[AccountsStore] Failed to update:', error);
    }
  },

  // ... other methods
}));
```

## Step 6: Test Your Updated Store

In your React component:

```typescript
import { useAccountsStore } from './store/accounts';

function AccountsList() {
  const { accounts, hydrate } = useAccountsStore();

  useEffect(() => {
    hydrate(); // Load from SQLite
  }, []);

  return (
    <View>
      {accounts.map(acc => (
        <Text key={acc.id}>{acc.name}: ${acc.balance}</Text>
      ))}
    </View>
  );
}
```

## Step 7: Verify Net Worth Fix

Check that credit card debt is no longer double-counted:

```typescript
import { db } from './src/db/client';
import { accounts, debts } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function calculateNetWorth() {
  // Get all accounts (includes credit cards as negative balance)
  const allAccounts = await db.select().from(accounts)
    .where(eq(accounts.includeInNetWorth, 1));

  const totalCash = allAccounts
    .filter(a => a.kind !== 'credit')
    .reduce((sum, a) => sum + a.balance, 0);

  const totalCreditDebt = allAccounts
    .filter(a => a.kind === 'credit')
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  // Get standalone debts (NO credit cards!)
  const allDebts = await db.select().from(debts);
  const totalDebt = allDebts.reduce((sum, d) => sum + d.balance, 0);

  const netWorth = totalCash - totalCreditDebt - totalDebt;

  console.log('Net Worth Calculation:');
  console.log('  Cash:', totalCash);
  console.log('  Credit Card Debt:', totalCreditDebt);
  console.log('  Other Debt:', totalDebt);
  console.log('  Net Worth:', netWorth);

  return netWorth;
}

calculateNetWorth();
```

Expected output:
```
Net Worth Calculation:
  Cash: $10,000
  Credit Card Debt: $500   (from accounts only)
  Other Debt: $0           (credit cards filtered out)
  Net Worth: $9,500        (correct!)
```

## Common Issues & Solutions

### Issue 1: "Foreign key constraint failed"
**Cause:** Trying to insert a transaction with invalid accountId

**Solution:**
```typescript
// Make sure account exists first
const account = await getAccountById(accountId);
if (!account) {
  throw new Error('Account not found');
}

// Then insert transaction
await db.insert(transactions).values({ accountId, ... });
```

### Issue 2: "Table already exists"
**Cause:** Tables were already created

**Solution:** This is fine! The migrations are idempotent. The error is caught and ignored.

### Issue 3: Migration runs every time app starts
**Cause:** Migration complete flag not being saved

**Solution:** Check AsyncStorage:
```typescript
const flag = await AsyncStorage.getItem('fingrow:migration:v2:complete');
console.log('Migration flag:', flag); // Should be 'true' after first run
```

### Issue 4: Data not showing in UI after migration
**Cause:** Stores still using old AsyncStorage data

**Solution:** Call `hydrate()` on each store to reload from SQLite:
```typescript
useEffect(() => {
  useAccountsStore.getState().hydrate();
  useTxStore.getState().hydrate();
  useGoalsStore.getState().hydrate();
  // ... etc
}, []);
```

## Testing Checklist

- [ ] App starts without errors
- [ ] Database tables created (check logs)
- [ ] Migration completes successfully
- [ ] All accounts migrated (count matches)
- [ ] All transactions migrated (count matches)
- [ ] Credit card debt only counted once
- [ ] Net worth calculation correct
- [ ] Transactions show in UI
- [ ] Can add new transactions
- [ ] Can update account balances
- [ ] Portfolio data intact
- [ ] Goals data intact

## Rollback (If Needed)

If something goes wrong and you need to rollback:

```typescript
import { rollbackMigration } from './src/db/async-storage-migration';
import { clearAllData } from './src/db/client';

// Clear database
await clearAllData();

// Clear migration flag
await rollbackMigration();

// Restart app - will re-run migration
```

## Next Steps

1. ✅ Complete Step 1-3 (initialization & migration)
2. 🔄 Create query functions for each store
3. 🔄 Refactor stores one by one
4. 🔄 Update AI data aggregator
5. 🔄 Test thoroughly
6. 🔄 Deploy to production

## Need Help?

- Check `DATABASE_REMODEL_SUMMARY.md` for full documentation
- Check `DATABASE_ARCHITECTURE.txt` for visual architecture
- Check inline comments in code
- Review Drizzle ORM docs: https://orm.drizzle.team/
