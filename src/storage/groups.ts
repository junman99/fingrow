import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Group, ID, Member } from '../types/groups';

const GROUPS_KEY = 'fingrow/groups';
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export async function listGroups(): Promise<Group[]> {
  try { const raw = await AsyncStorage.getItem(GROUPS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export async function getGroup(id: ID): Promise<Group|undefined> { const arr = await listGroups(); return arr.find(g => g.id === id); }
export async function createGroup(name: string): Promise<ID> {
  const arr = await listGroups(); const g: Group = { id: uid(), name, members: [], bills: [], createdAt: Date.now() };
  arr.unshift(g); await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(arr)); return g.id;
}
export async function addMember(groupId: ID, member: Member) {
  const arr = await listGroups(); const i = arr.findIndex(g => g.id === groupId); if (i>=0) { arr[i].members.push(member); await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(arr)); }
}
// stubs for future
export async function addBill(_: any) {}
export async function recordGroupShareToTransactions(_: ID, __: ID) {}
