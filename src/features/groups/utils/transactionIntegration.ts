/**
 * Transaction Integration for Group Bills
 *
 * This module connects group expenses to personal finance tracking.
 * When bills are added or settled, corresponding transactions are created
 * in the user's account system to maintain accurate financial records.
 */

import { useTxStore } from '../../../store/transactions';
import { useAccountsStore } from '../../../store/accounts';
import type { Bill, Settlement, ID } from '../../../types/groups';

/**
 * Creates a transaction when a user pays for a group bill
 *
 * @param bill - The bill that was paid
 * @param accountId - The account used to pay the bill
 * @param currentUserId - The ID of the current user (must be a payer)
 * @returns The transaction ID
 */
export async function createBillPaymentTransaction(
  bill: Bill,
  accountId: string,
  currentUserId: ID
): Promise<string> {
  const { add } = useTxStore.getState();
  const { accounts, updateAccountBalance } = useAccountsStore.getState();

  // Find how much the current user paid
  const userContribution = bill.contributions.find(c => c.memberId === currentUserId);
  if (!userContribution) {
    throw new Error('Current user is not a payer for this bill');
  }

  // Find account by ID and get its name
  const account = accounts.find(a => a.id === accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  // Create the expense transaction
  const txData = {
    type: 'expense' as const,
    amount: userContribution.amount,
    category: bill.category || 'Group Expense',
    date: new Date(bill.createdAt).toISOString(),
    note: `${bill.title} (Group Bill)`,
    title: bill.title,
    account: account.name, // Use account name, not ID
  };

  await add(txData);

  // Update account balance using account name
  await updateAccountBalance(account.name, userContribution.amount, true);

  // Return the generated transaction ID (we need to get it from the store)
  const { transactions } = useTxStore.getState();
  return transactions[0]?.id || '';
}

/**
 * Creates a transaction when someone pays you back for a group bill
 *
 * @param settlement - The settlement record
 * @param accountId - The account receiving the payment
 * @param fromMemberName - Name of the person paying
 * @param billTitle - Title of the related bill (optional)
 * @returns The transaction ID
 */
export async function createSettlementTransaction(
  settlement: Settlement,
  accountId: string,
  fromMemberName: string,
  billTitle?: string
): Promise<string> {
  const { add } = useTxStore.getState();
  const { accounts, updateAccountBalance } = useAccountsStore.getState();

  // Find account by ID and get its name
  const account = accounts.find(a => a.id === accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  // Create the income transaction
  const note = billTitle
    ? `Reimbursement from ${fromMemberName} for ${billTitle}`
    : `Reimbursement from ${fromMemberName}`;

  const txData = {
    type: 'income' as const,
    amount: settlement.amount,
    category: 'Reimbursement',
    date: new Date(settlement.createdAt).toISOString(),
    note,
    title: `Payment from ${fromMemberName}`,
    account: account.name, // Use account name, not ID
  };

  await add(txData);

  // Update account balance using account name
  await updateAccountBalance(account.name, settlement.amount, false);

  // Return the generated transaction ID
  const { transactions } = useTxStore.getState();
  return transactions[0]?.id || '';
}

/**
 * Deletes a transaction when a bill is deleted
 *
 * @param transactionId - The transaction ID to delete
 */
export async function deleteBillTransaction(transactionId: string): Promise<void> {
  const { deleteTransaction } = useTxStore.getState();
  await deleteTransaction(transactionId);
}

/**
 * Gets the list of available accounts for bill payments
 *
 * @returns Array of accounts with their IDs and names
 */
export function getAvailableAccounts(): Array<{ id: string; name: string; kind?: string }> {
  const { accounts } = useAccountsStore.getState();
  return accounts.map(a => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
  }));
}

/**
 * Gets the default account for transactions
 *
 * @returns The default account or undefined
 */
export function getDefaultAccount(): { id: string; name: string } | undefined {
  const { accounts } = useAccountsStore.getState();
  const defaultAccount = accounts.find(a => a.isDefault);
  if (defaultAccount) {
    return { id: defaultAccount.id, name: defaultAccount.name };
  }
  // If no default, return the first non-credit account
  const firstAccount = accounts.find(a => a.kind !== 'credit');
  if (firstAccount) {
    return { id: firstAccount.id, name: firstAccount.name };
  }
  return undefined;
}
