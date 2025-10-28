import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Group, Member, Bill, ID, Contribution, Settlement } from '../types/groups';
import { round2, sum } from '../lib/format';

type SplitMode = 'equal'|'shares'|'exact';
type PayerMode = 'single'|'multi-even'|'multi-custom';

type State = {
  groups: Group[];
  ready: boolean;
  hydrate: () => Promise<void>;
  createGroup: (input: { name: string; note?: string; members?: { name: string; contact?: string }[] }) => Promise<ID>;
  addMember: (groupId: ID, input: { name: string; contact?: string }) => Promise<ID>;
  updateMember: (groupId: ID, memberId: ID, patch: Partial<Member>) => Promise<void>;
  archiveMember: (groupId: ID, memberId: ID, archived?: boolean) => Promise<void>;
  deleteMember: (groupId: ID, memberId: ID) => Promise<void>;
  addBill: (input: {
    groupId: ID;
    title: string;
    amount: number;
    taxMode: 'abs'|'pct';
    tax: number;
    discountMode: 'abs'|'pct';
    discount: number;
    participants: ID[];
    splitMode: SplitMode;
    shares?: Record<ID, number>;
    exacts?: Record<ID, number>;
    proportionalTax?: boolean;
    payerMode: PayerMode;
    paidBy?: ID;
    payersEven?: ID[];
    contributions?: Record<ID, number>;
  }) => Promise<ID>;
  balances: (groupId: ID) => Record<ID, number>;
  addSettlement: (groupId: ID, fromId: ID, toId: ID, amount: number, billId?: ID, memo?: string) => Promise<ID>;
  markSplitPaid: (groupId: ID, billId: ID, memberId: ID) => Promise<void>;
  findBill: (groupId: ID, billId: ID) => Bill | undefined;
  updateGroup: (groupId: ID, patch: { name?: string; note?: string }) => Promise<void>;
  deleteGroup: (groupId: ID) => Promise<void>;
};

const KEY = 'fingrow/groups';
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

async function save(arr: Group[]) { await AsyncStorage.setItem(KEY, JSON.stringify(arr)); }

function migrate(groups: Group[]): Group[] {
  return groups.map(g => ({
    ...g,
    settlements: g.settlements || [],
    bills: (g.bills || []).map(b => {
      if (!(b as any).contributions && (b as any).paidBy) {
        return { ...b, contributions: [{ memberId: (b as any).paidBy as ID, amount: b.finalAmount }], paidBy: undefined };
      }
      if (!(b as any).contributions) {
        return { ...b, contributions: [] };
      }
      return b;
    })
  }));
}

export const useGroupsStore = create<State>((set, get) => ({
  groups: [],
  ready: false,
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(KEY);
    const arr: Group[] = raw ? JSON.parse(raw) : [];
    const migrated = migrate(arr);
    set({ groups: migrated, ready: true });
    await save(migrated);
  },
  createGroup: async ({ name, note, members }) => {
    const arr = [...get().groups];
    const g: Group = { id: uid(), name, note, members: [], bills: [], settlements: [], createdAt: Date.now() };
    (members || []).forEach(m => {
      if (!m.name?.trim()) return;
      const mem: Member = { id: uid(), name: m.name.trim(), contact: m.contact?.trim() || undefined };
      g.members.push(mem);
    });
    arr.unshift(g);
    set({ groups: arr }); await save(arr);
    return g.id;
  },
  addMember: async (groupId, input) => {
    const arr = [...get().groups];
    const i = arr.findIndex(g => g.id === groupId);
    if (i < 0) throw new Error('Group not found');
    const m: Member = { id: uid(), name: input.name.trim(), contact: input.contact?.trim() || undefined };
    arr[i].members.push(m);
    set({ groups: arr }); await save(arr);
    return m.id;
  },
  updateMember: async (groupId, memberId, patch) => {
    const arr = [...get().groups];
    const gi = arr.findIndex(g => g.id === groupId);
    if (gi < 0) throw new Error('Group not found');
    const mi = arr[gi].members.findIndex(m => m.id === memberId);
    if (mi < 0) throw new Error('Member not found');
    arr[gi].members[mi] = { ...arr[gi].members[mi], ...patch };
    set({ groups: arr }); await save(arr);
  },
  archiveMember: async (groupId, memberId, archived=true) => {
    const arr = [...get().groups];
    const gi = arr.findIndex(g => g.id === groupId);
    if (gi < 0) throw new Error('Group not found');
    const mi = arr[gi].members.findIndex(m => m.id === memberId);
    if (mi >= 0) { arr[gi].members[mi].archived = archived; set({ groups: arr }); await save(arr); }
  },
  deleteMember: async (groupId, memberId) => {
    const arr = [...get().groups];
    const gi = arr.findIndex(g => g.id === groupId);
    if (gi < 0) throw new Error('Group not found');
    arr[gi].members = arr[gi].members.filter(m => m.id !== memberId);
    set({ groups: arr });
    await save(arr);
  },
  addBill: async (input) => {
    const arr = [...get().groups];
    const gi = arr.findIndex(g => g.id === input.groupId);
    if (gi < 0) throw new Error('Group not found');
    const group = arr[gi];

    const activeIds = new Set(group.members.filter(m => !m.archived).map(m => m.id));
    const participants = input.participants.filter(id => activeIds.has(id));
    if (participants.length === 0) throw new Error('Select at least one active participant');

    const taxVal = input.taxMode === 'pct' ? (input.amount * input.tax / 100) : input.tax;
    const discVal = input.discountMode === 'pct' ? (input.amount * input.discount / 100) : input.discount;
    const base = input.amount;
    const finalAmount = round2(base + (taxVal || 0) - (discVal || 0));
    if (finalAmount <= 0) throw new Error('Final amount must be greater than 0');

    let baseSplits: { memberId: ID; share: number }[] = [];
    if (input.splitMode === 'equal') {
      const each = Math.floor((base / participants.length) * 100) / 100;
      let assigned = round2(each * participants.length);
      let remainder = round2(base - assigned);
      baseSplits = participants.map((id, idx) => ({ memberId: id, share: idx === participants.length - 1 ? round2(each + remainder) : each }));
    } else if (input.splitMode === 'shares') {
      const weights = participants.map(id => input.shares?.[id] ?? 1);
      const weightSum = sum(weights) || 1;
      let assigned = 0;
      baseSplits = participants.map((id, idx) => {
        let share = round2(base * (weights[idx] / weightSum));
        if (idx === participants.length - 1) share = round2(base - assigned);
        assigned = round2(assigned + share);
        return { memberId: id, share };
      });
    } else {
      const totals = participants.map(id => input.exacts?.[id] ?? 0);
      const sumEx = round2(sum(totals));
      if (input.proportionalTax) {
        // Allow custom amounts that don't sum to base - the difference will be split proportionally with tax/fees
        baseSplits = participants.map(id => ({ memberId: id, share: round2(input.exacts?.[id] ?? 0) }));
      } else {
        baseSplits = [];
      }
    }

    let finalSplits: { memberId: ID; share: number; settled: boolean }[] = [];
    if (input.splitMode === 'exact' && !input.proportionalTax) {
      const totals = participants.map(id => input.exacts?.[id] ?? 0);
      const s = round2(sum(totals));
      if (Math.abs(s - finalAmount) > 0.01) throw new Error('Exact amounts must sum to final amount');
      finalSplits = participants.map(id => ({ memberId: id, share: round2(input.exacts?.[id] ?? 0), settled: false }));
    } else {
      const baseSum = round2(sum(baseSplits.map(s => s.share))) || 1;
      let assigned = 0;
      finalSplits = participants.map((id, idx) => {
        const baseShare = baseSplits.find(s => s.memberId === id)?.share ?? 0;
        let finalShare = input.proportionalTax ? round2(baseShare + (baseShare / (baseSum||1)) * ((taxVal||0) - (discVal||0))) : baseShare;
        if (idx === participants.length - 1) finalShare = round2(finalAmount - assigned);
        assigned = round2(assigned + finalShare);
        return { memberId: id, share: finalShare, settled: false };
      });
    }

    let contributions: Contribution[] = [];
    if (input.payerMode === 'single') {
      if (!input.paidBy) throw new Error('Select a payer');
      contributions = [{ memberId: input.paidBy, amount: finalAmount }];
    } else if (input.payerMode === 'multi-even') {
      const payers = (input.payersEven || []).filter(id => activeIds.has(id));
      if (payers.length === 0) throw new Error('Select at least one payer');
      const each = Math.floor((finalAmount / payers.length) * 100) / 100;
      let assigned = round2(each * payers.length);
      let remainder = round2(finalAmount - assigned);
      contributions = payers.map((id, idx) => ({
        memberId: id,
        amount: idx === payers.length - 1 ? round2(each + remainder) : each
      }));
    } else {
      const entries = Object.entries(input.contributions || {}).filter(([id,v]) => activeIds.has(id as ID) && (Number(v)||0) > 0);
      const total = round2(sum(entries.map(([_,v]) => Number(v)||0)));
      if (Math.abs(total - finalAmount) > 0.01) throw new Error('Contributions must sum to final amount');
      contributions = entries.map(([id,v]) => ({ memberId: id as ID, amount: round2(Number(v)||0) }));
    }

    const bill: Bill = {
      id: uid(),
      groupId: group.id,
      title: input.title.trim() || 'Untitled bill',
      amount: base,
      tax: input.tax, taxMode: input.taxMode,
      discount: input.discount, discountMode: input.discountMode,
      finalAmount,
      contributions,
      splits: finalSplits,
      createdAt: Date.now()
    };
    arr[gi] = { ...group, bills: [bill, ...group.bills] };
    set({ groups: arr }); await save(arr);
    return bill.id;
  },
  balances: (groupId) => {
    const g = get().groups.find(x => x.id === groupId);
    const res: Record<ID, number> = {};
    if (!g) return res;
    g.members.forEach(m => (res[m.id] = 0));
    g.bills.forEach(b => {
      b.contributions.forEach(c => { res[c.memberId] = round2((res[c.memberId] || 0) + c.amount); });
      b.splits.forEach(s => { res[s.memberId] = round2((res[s.memberId] || 0) - s.share); });
    });
    (g.settlements || []).forEach(s => {
      res[s.fromId] = round2((res[s.fromId] || 0) + s.amount);
      res[s.toId] = round2((res[s.toId] || 0) - s.amount);
    });
    return res;
  },
  addSettlement: async (groupId, fromId, toId, amount, billId, memo) => {
    const arr = [...get().groups];
    const gi = arr.findIndex(g => g.id === groupId);
    if (gi < 0) throw new Error('Group not found');
    const group = arr[gi];
    const s: Settlement = { id: uid(), fromId, toId, amount: round2(amount), createdAt: Date.now(), billId, memo };
    arr[gi] = { ...group, settlements: [s, ...(group.settlements || [])] };
    set({ groups: arr }); await save(arr);
    return s.id;
  },
  markSplitPaid: async (groupId, billId, memberId) => {
    const arr = [...get().groups];
    const gi = arr.findIndex(g => g.id === groupId);
    if (gi < 0) throw new Error('Group not found');
    const group = arr[gi];
    const bill = group.bills.find(b => b.id === billId);
    if (!bill) throw new Error('Bill not found');
    const split = bill.splits.find(s => s.memberId === memberId);
    if (!split) throw new Error('Split not found');
    if (split.settled) return;

    const totalContrib = bill.contributions.reduce((a,c)=>a+c.amount,0) || 1;
    const newSettlements: Settlement[] = [];
    // Spread the member's payment to payers pro-rata by their contributions
    bill.contributions.forEach(c => {
      const amount = round2(split.share * (c.amount / totalContrib));
      if (c.memberId === memberId) return; // skip self
      if (amount < 0.01) return; // ignore dust
      newSettlements.push({ id: uid(), fromId: memberId, toId: c.memberId, amount, createdAt: Date.now(), billId });
    });

    const updatedBills = group.bills.map(b => {
      if (b.id === billId) {
        return {
          ...b,
          splits: b.splits.map(s => s.memberId === memberId ? { ...s, settled: true } : s)
        };
      }
      return b;
    });

    arr[gi] = { ...group, bills: updatedBills, settlements: [...newSettlements, ...(group.settlements || [])] };
    set({ groups: arr }); await save(arr);
  },
  findBill: (groupId, billId) => {
    const g = get().groups.find(x => x.id === groupId);
    return g?.bills.find(b => b.id === billId);
  },
  updateGroup: async (groupId: ID, patch: { name?: string; note?: string }) => {
    const arr = [...get().groups];
    const gi = arr.findIndex(g => g.id === groupId);
    if (gi < 0) throw new Error('Group not found');
    arr[gi] = { ...arr[gi], ...patch };
    set({ groups: arr });
    await save(arr);
  },
  deleteGroup: async (groupId: ID) => {
    const arr = get().groups.filter(g => g.id !== groupId);
    set({ groups: arr });
    await save(arr);
  }
}));
