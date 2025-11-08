export type ID = string;

export type Member = { id: ID; name: string; contact?: string; archived?: boolean };

export type Contribution = { memberId: ID; amount: number };

export type Split  = { memberId: ID; share: number; settled: boolean };

export type Settlement = { id: ID; fromId: ID; toId: ID; amount: number; createdAt: number; billId?: ID; memo?: string };

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
};
