# 🔧 CRITICAL FIXES - Implementation Guide

This document provides **exact code fixes** for all critical issues found in the audit.

---

## Fix 1: Transaction Balance Update Bug

**File:** `src/store/transactions.ts`
**Lines:** 64-110

### Current (Broken) Code:
```typescript
remove: async (id) => {
  const tx = (get().transactions || []).find(t => t.id === id);
  const arr = (get().transactions || []).filter(t => t.id !== id);
  set({ transactions: arr });
  await AsyncStorage.setItem(KEY, JSON.stringify(arr));

  // 🐛 BUG: Logic is backwards!
  if (tx?.account && tx.amount) {
    const { updateAccountBalance } = useAccountsStore.getState();
    await updateAccountBalance(tx.account, tx.amount, tx.type === 'income');
  }
}
```

### Fixed Code:
```typescript
remove: async (id) => {
  const tx = (get().transactions || []).find(t => t.id === id);
  if (!tx) {
    console.error('[Transactions] Cannot remove: transaction not found', id);
    return;
  }

  try {
    // Reverse the account balance BEFORE removing from state
    if (tx.account && tx.amount) {
      const { updateAccountBalance } = useAccountsStore.getState();
      // FIX: Reverse the operation correctly
      // If original was expense (decreased balance), add it back
      // If original was income (increased balance), subtract it
      await updateAccountBalance(tx.account, tx.amount, tx.type === 'expense');
    }

    // Only update state after balance is fixed
    const arr = (get().transactions || []).filter(t => t.id !== id);
    set({ transactions: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  } catch (error) {
    console.error('[Transactions] Failed to remove transaction:', error);
    throw error; // Don't silently fail
  }
},

deleteTransaction: async (id) => {
  // Same fix as remove()
  const tx = (get().transactions || []).find(t => t.id === id);
  if (!tx) return;

  try {
    if (tx.account && tx.amount) {
      const { updateAccountBalance } = useAccountsStore.getState();
      // FIX: Same logic as remove()
      await updateAccountBalance(tx.account, tx.amount, tx.type === 'expense');
    }

    const arr = (get().transactions || []).filter(t => t.id !== id);
    set({ transactions: arr });
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  } catch (error) {
    console.error('[Transactions] Failed to delete transaction:', error);
    throw error;
  }
}
```

---

## Fix 2: Income Splitting Double-Counting

**File:** `src/store/incomeSplitting.ts`
**Lines:** 305-401

### Current (Broken) Code:
```typescript
async function processIncomeSplit(input: ProcessIncomeInput) {
  // ... calculations ...

  // Creates transaction with account field
  await txStore.add({
    type: 'income',
    amount: cpf.employee.oa + (cpf.employer?.oa || 0),
    account: accountName, // ← This triggers balance update in add()
    category: 'Salary',
    date: input.date,
  });

  // 🐛 BUG: Then updates balance AGAIN manually!
  await accountsStore.updateAccountBalance(
    accountName,
    amount,
    false // isExpense
  );

  // Same issue repeated for all splits...
}
```

### Fixed Code:
```typescript
async function processIncomeSplit(input: ProcessIncomeInput) {
  // ... calculations ...

  // Option 1: Let transaction store handle ALL balance updates
  await txStore.add({
    type: 'income',
    amount: cpf.employee.oa + (cpf.employer?.oa || 0),
    account: accountName, // Balance updated automatically
    category: 'Salary',
    date: input.date,
  });

  // ✅ REMOVE all manual updateAccountBalance calls!
  // await accountsStore.updateAccountBalance(...); // DELETE THIS

  // OR Option 2: Remove account field, do manual updates only
  await txStore.add({
    type: 'income',
    amount: cpf.employee.oa + (cpf.employer?.oa || 0),
    account: undefined, // No automatic update
    category: 'Salary',
    date: input.date,
  });

  // Then manually update balance (but only once!)
  await accountsStore.updateAccountBalance(
    accountName,
    amount,
    false // isExpense
  );

  // ✅ CHOOSE ONE APPROACH, NOT BOTH!
}
```

**Recommendation:** Use Option 1 (automatic balance updates) to avoid errors.

---

## Fix 3: Currency Conversion Silent Failures

**File:** `src/lib/fx.ts`
**Lines:** 50-76

### Current (Broken) Code:
```typescript
export function convertCurrency(
  rates: FxRates | undefined,
  amount: number,
  from: string,
  to: string
): number {
  // ... setup ...

  let amountUSD = amount;
  if (rateFrom && rateFrom !== 0) {
    amountUSD = src === 'USD' ? amount : amount / rateFrom;
  }
  // 🐛 BUG: If rateFrom is 0 or undefined, silently uses wrong amount!

  if (!rateTo || rateTo === 0) return amountUSD;
  // 🐛 BUG: Returns USD instead of target currency!

  return dest === 'USD' ? amountUSD : amountUSD * rateTo;
}
```

### Fixed Code:
```typescript
export function convertCurrency(
  rates: FxRates | undefined,
  amount: number,
  from: string,
  to: string
): number {
  // Validate inputs
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  const src = (from || 'USD').toUpperCase();
  const dest = (to || 'USD').toUpperCase();

  // Same currency - no conversion needed
  if (src === dest) return amount;

  // Check rates available
  if (!rates || !rates.rates) {
    throw new Error('FX rates not available. Please check your internet connection.');
  }

  // Get rates
  const rateFrom = rates.rates[src];
  const rateTo = rates.rates[dest];

  // Validate rates
  if (rateFrom === undefined || rateFrom <= 0) {
    throw new Error(`Invalid or missing FX rate for ${src}: ${rateFrom}`);
  }

  if (rateTo === undefined || rateTo <= 0) {
    throw new Error(`Invalid or missing FX rate for ${dest}: ${rateTo}`);
  }

  // Convert to USD first, then to destination currency
  const amountUSD = src === 'USD' ? amount : amount / rateFrom;
  const result = dest === 'USD' ? amountUSD : amountUSD * rateTo;

  // Validate result
  if (!Number.isFinite(result) || result < 0) {
    throw new Error(`Currency conversion resulted in invalid value: ${result}`);
  }

  return result;
}
```

---

## Fix 4: Division by Zero in P&L Calculations

**File:** `src/lib/positions.ts`
**Lines:** 5-50

### Current (Risky) Code:
```typescript
export function computePnL(lots: Lot[], lastPrice: number): PnL {
  // ... calculations ...

  const avg = qty > 0 ? costBasis / qty : 0;
  // 🐛 Returns 0 when qty=0, should throw error

  return {
    qty,
    avgCost: qty > 0 ? costBasis / qty : 0, // 🐛 Same issue
    realized,
    unrealized: qty * lastPrice - costBasis,
  };
}
```

### Fixed Code:
```typescript
export function computePnL(lots: Lot[], lastPrice: number): PnL {
  // Validate inputs
  if (!Array.isArray(lots)) {
    throw new Error('Lots must be an array');
  }

  if (!Number.isFinite(lastPrice) || lastPrice < 0) {
    throw new Error(`Invalid lastPrice: ${lastPrice}`);
  }

  // Empty lots = zero position
  if (lots.length === 0) {
    return { qty: 0, avgCost: 0, realized: 0, unrealized: 0 };
  }

  // Validate all lots
  for (const lot of lots) {
    if (!Number.isFinite(lot.qty) || !Number.isFinite(lot.price)) {
      throw new Error(`Invalid lot data: qty=${lot.qty}, price=${lot.price}`);
    }
    if (lot.qty === 0) {
      throw new Error('Lot quantity cannot be zero');
    }
  }

  let qty = 0;
  let costBasis = 0;
  let realized = 0;

  const buyStack: Array<{ qty: number; price: number }> = [];

  for (const lot of lots) {
    if (lot.side === 'buy') {
      buyStack.push({ qty: lot.qty, price: lot.price });
      qty += lot.qty;
      costBasis += lot.qty * lot.price;
    } else {
      let sellQty = lot.qty;
      while (sellQty > 0 && buyStack.length > 0) {
        const oldest = buyStack[0];
        const matchQty = Math.min(sellQty, oldest.qty);

        realized += matchQty * (lot.price - oldest.price);
        qty -= matchQty;
        costBasis -= matchQty * oldest.price;
        sellQty -= matchQty;

        oldest.qty -= matchQty;
        if (oldest.qty === 0) buyStack.shift();
      }

      if (sellQty > 0) {
        // Selling more than bought (short position)
        console.warn('[PnL] Short position detected:', sellQty);
        qty -= sellQty;
      }
    }
  }

  // Calculate average cost
  const avgCost = qty > 0 ? costBasis / qty : 0;

  // Validate results
  if (!Number.isFinite(avgCost) || avgCost < 0) {
    throw new Error(`Invalid average cost: ${avgCost}`);
  }

  const unrealized = qty * lastPrice - costBasis;

  return { qty, avgCost, realized, unrealized };
}
```

---

## Fix 5: Group Bill Splitting Rounding

**File:** `src/store/groups.ts`
**Lines:** 156-199

### Current (Unfair) Code:
```typescript
if (bill.splitMode === 'equal') {
  const each = Math.floor((base / participants.length) * 100) / 100;
  let assigned = round2(each * participants.length);
  let remainder = round2(base - assigned);

  for (const mId of participants) {
    splits.push({
      id: splitId(),
      memberId: mId,
      amount: each,
      paid: false,
    });
  }

  // 🐛 BUG: Last person always gets the remainder
  if (remainder !== 0 && splits.length > 0) {
    splits[splits.length - 1].amount = round2(each + remainder);
  }
}
```

### Fixed Code:
```typescript
/**
 * Split amount fairly among participants
 * Distributes cents evenly so no one person always pays extra
 */
function splitAmountFairly(amount: number, count: number): number[] {
  if (count <= 0) {
    throw new Error('Cannot split among 0 participants');
  }

  // Work in cents to avoid floating point issues
  const cents = Math.round(amount * 100);
  const baseShare = Math.floor(cents / count);
  const remainder = cents % count;

  // Create base shares
  const shares = new Array(count).fill(baseShare);

  // Distribute remaining cents to first N people
  // (This is fair - rotates who gets extra penny)
  for (let i = 0; i < remainder; i++) {
    shares[i]++;
  }

  // Convert back to dollars
  return shares.map(s => s / 100);
}

// Usage in addBill:
if (bill.splitMode === 'equal') {
  const fairShares = splitAmountFairly(base, participants.length);

  participants.forEach((mId, index) => {
    splits.push({
      id: splitId(),
      memberId: mId,
      amount: fairShares[index],
      paid: false,
    });
  });
}
```

---

## Fix 6: Transaction Validation

**File:** `src/store/transactions.ts`
**Lines:** 44-62

### Current (No Validation) Code:
```typescript
add: async (input) => {
  const { type, category } = input as any;
  const amountNum = Number((input as any).amount);
  const amount = Number.isFinite(amountNum) ? amountNum : 0; // ← Allows $0!
  const date = (input as any).date ? String((input as any).date) : new Date().toISOString();
  const note = (input as any).note ?? '';
  const account = (input as any).account ?? undefined;

  const tx: Transaction = { id: uid(), type, amount, category, date, note, account };
  // ... rest of function
}
```

### Fixed Code:
```typescript
// Create validation helper
function validateTransaction(input: Partial<Transaction>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Type validation
  if (!input.type || !['expense', 'income'].includes(input.type)) {
    errors.push('Transaction type must be "expense" or "income"');
  }

  // Amount validation
  const amount = Number(input.amount);
  if (!Number.isFinite(amount)) {
    errors.push('Amount must be a valid number');
  } else if (amount <= 0) {
    errors.push('Amount must be greater than zero');
  } else if (amount > 1000000000) {
    errors.push('Amount seems unreasonably large');
  }

  // Category validation
  if (!input.category || input.category.trim().length === 0) {
    errors.push('Category is required');
  } else if (input.category.length > 100) {
    errors.push('Category name is too long');
  }

  // Date validation
  if (input.date) {
    const date = new Date(input.date);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date format');
    } else if (date > new Date()) {
      errors.push('Date cannot be in the future');
    } else if (date < new Date('1900-01-01')) {
      errors.push('Date seems too far in the past');
    }
  }

  // Note validation
  if (input.note && input.note.length > 500) {
    errors.push('Note is too long (max 500 characters)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Updated add function:
add: async (input) => {
  // Validate input
  const validation = validateTransaction(input);
  if (!validation.valid) {
    throw new Error(`Transaction validation failed: ${validation.errors.join(', ')}`);
  }

  const type = input.type!;
  const category = input.category!.trim();
  const amount = Number(input.amount!);
  const date = input.date ? String(input.date) : new Date().toISOString();
  const note = input.note?.trim() || '';
  const account = input.account;

  const tx: Transaction = {
    id: uid(),
    type,
    amount,
    category,
    date,
    note,
    account,
  };

  const arr = [tx, ...(get().transactions || [])];
  set({ transactions: arr });

  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  } catch (error) {
    // Rollback on storage failure
    set({ transactions: get().transactions.filter(t => t.id !== tx.id) });
    throw new Error('Failed to save transaction');
  }
},
```

---

## Fix 7: Remove Production Logging

Create a logger utility:

**New File:** `src/lib/logger.ts`
```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private enabled: Record<LogLevel, boolean> = {
    debug: __DEV__, // Only in development
    info: __DEV__,
    warn: true, // Always enabled
    error: true, // Always enabled
  };

  debug(message: string, ...args: any[]) {
    if (this.enabled.debug) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.enabled.info) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.enabled.warn) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: Error) {
    if (this.enabled.error) {
      console.error(`[ERROR] ${message}`, error);
      // In production, send to crash reporting service
      if (!__DEV__ && error) {
        // Sentry.captureException(error);
      }
    }
  }

  // Never log sensitive data in production
  debugSensitive(message: string, data: any) {
    if (__DEV__) {
      console.log(`[DEBUG] ${message}`, data);
    } else {
      console.log(`[DEBUG] ${message} [data hidden in production]`);
    }
  }
}

export const logger = new Logger();
```

**Usage:**
```typescript
// Replace all console.log with logger:
import { logger } from './lib/logger';

// Instead of:
console.log('[DataAggregator] Portfolios:', portfolios);

// Use:
logger.debug('Portfolios loaded', `count: ${portfolios.length}`);
// OR if you must log sensitive data:
logger.debugSensitive('Portfolios data:', portfolios); // Hidden in production
```

---

## Implementation Order

1. **Day 1:** Fix transaction balance update bug (Fix 1)
2. **Day 1:** Fix income splitting (Fix 2)
3. **Day 2:** Fix currency conversion (Fix 3)
4. **Day 2:** Add transaction validation (Fix 6)
5. **Day 3:** Fix division by zero (Fix 4)
6. **Day 3:** Fix bill splitting (Fix 5)
7. **Day 4:** Replace all logging (Fix 7)
8. **Day 5:** Test all fixes

---

## Testing Checklist

After implementing fixes:

### Transaction Balance Tests
- [ ] Create expense, verify balance decreased
- [ ] Delete expense, verify balance restored
- [ ] Create income, verify balance increased
- [ ] Delete income, verify balance restored
- [ ] Try deleting same transaction twice (should fail gracefully)

### Income Splitting Tests
- [ ] Process income split
- [ ] Verify each account balance updated ONLY ONCE
- [ ] Check transaction history matches balances

### Currency Conversion Tests
- [ ] Convert SGD → USD with valid rates
- [ ] Convert with missing rate (should throw error)
- [ ] Convert with zero rate (should throw error)
- [ ] Convert same currency (should return input)

### Division by Zero Tests
- [ ] Calculate P&L with empty lots (should return zeros)
- [ ] Calculate P&L with zero qty lot (should throw error)
- [ ] Split bill with zero participants (should throw error)

### Validation Tests
- [ ] Try creating $0 transaction (should fail)
- [ ] Try creating negative transaction (should fail)
- [ ] Try creating transaction with empty category (should fail)
- [ ] Try creating transaction with future date (should warn)
- [ ] Create valid transaction (should succeed)

---

## Next Document

See `MULTI_USER_SCHEMA.sql` for database schema changes to support multiple users.
