export type ID = string;

export type Member = { id: ID; name: string; contact?: string; archived?: boolean };

export type Contribution = { memberId: ID; amount: number };

export type Split  = { memberId: ID; share: number; settled: boolean };

export type Settlement = {
  id: ID;
  fromId: ID;
  toId: ID;
  amount: number;
  createdAt: number;
  billId?: ID;
  memo?: string;
  // Transaction integration
  toAccountId?: string;  // Account that received the payment (if TO is current user)
  transactionId?: string;  // Link to transaction in user's accounts
};

export type Bill = {
  id: ID;
  groupId: ID;
  title: string;
  amount: number;
  tax?: number;
  taxMode?: 'abs'|'pct';
  discount?: number;
  discountMode?: 'abs'|'pct';
  finalAmount: number;
  contributions: Contribution[];
  splits: Split[];
  createdAt: number;
  paidBy?: ID;
  // Transaction integration
  category?: string;  // Transaction category (Dining, Groceries, etc)
  paidFromAccountId?: string;  // Account used to pay (if payer is current user)
  transactionId?: string;  // Link to expense transaction in user's accounts
};

export type Group = {
  id: ID;
  name: string;
  note?: string;
  currency?: string;
  members: Member[];
  bills: Bill[];
  settlements: Settlement[];
  createdAt: number;
  trackSpending?: boolean; // Track expenses in overall spending/transactions
};
