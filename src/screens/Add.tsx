import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Dimensions, Alert } from 'react-native';
import { Screen } from '../components/Screen';
import { AppHeader } from '../components/AppHeader';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useTxStore, TxType } from '../store/transactions';
import { useRecurringStore } from '../store/recurring';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Keypad from '../components/Keypad';
import DateTimeSheet from '../components/DateTimeSheet';
import {
  Utensils, ShoppingBasket, Bus, Fuel, Ticket, ShoppingBag, Wallet, Plane, HeartPulse, Dumbbell, House, Gift,
  TrendingUp, Repeat, ArrowLeftRight, GraduationCap, PawPrint, Plug, Droplets, MoreHorizontal
} from 'lucide-react-native';

type Mode = 'expense' | 'income';
type Cat = { key: string; label: string; icon: React.ComponentType<any>; type: Mode };

const EXPENSE_CATS: Cat[] = [
  { key: 'food',       label: 'Food',           icon: Utensils,       type: 'expense' },
  { key: 'groceries',  label: 'Groceries',      icon: ShoppingBasket, type: 'expense' },
  { key: 'transport',  label: 'Transport',      icon: Bus,            type: 'expense' },
  { key: 'fuel',       label: 'Fuel',           icon: Fuel,           type: 'expense' },
  { key: 'shopping',   label: 'Shopping',       icon: ShoppingBag,    type: 'expense' },
  { key: 'entertain',  label: 'Entertainment',  icon: Ticket,         type: 'expense' },
  { key: 'bills',      label: 'Bills',          icon: Plug,           type: 'expense' },
  { key: 'utilities',  label: 'Utilities',      icon: Droplets,       type: 'expense' },
  { key: 'health',     label: 'Health',         icon: HeartPulse,     type: 'expense' },
  { key: 'fitness',    label: 'Fitness',        icon: Dumbbell,       type: 'expense' },
  { key: 'home',       label: 'Home',           icon: House,          type: 'expense' },
  { key: 'education',  label: 'Education',      icon: GraduationCap,  type: 'expense' },
  { key: 'pets',       label: 'Pets',           icon: PawPrint,       type: 'expense' },
  { key: 'travel',     label: 'Travel',         icon: Plane,          type: 'expense' },
  { key: 'subs',       label: 'Subscriptions',  icon: Repeat,         type: 'expense' },
  { key: 'gifts',      label: 'Gifts',          icon: Gift,           type: 'expense' },
  { key: 'more',       label: 'More',           icon: MoreHorizontal, type: 'expense' },
];

const INCOME_CATS: Cat[] = [
  { key: 'salary',     label: 'Salary',     icon: TrendingUp,     type: 'income' },
  { key: 'refund',     label: 'Refund',     icon: ArrowLeftRight, type: 'income' },
  { key: 'bonus',      label: 'Bonus',      icon: Wallet,         type: 'income' },
  { key: 'freelance',  label: 'Freelance',  icon: Repeat,         type: 'income' },
];

function evaluateExpression(expr: string): number {
  if (!expr) return 0;
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/[^0-9+\-/*.]/g, '');
  if (/[*+\-/.]$/.test(clean)) return Number(clean.slice(0, -1)) || 0;
  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${clean || '0'})`)();
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    return 0;
  } catch {
    return 0;
  }
}

export default function Add() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();

  // Quick time & account selection
  const [txDate, setTxDate] = useState<Date>(new Date());
  const [timeOpen, setTimeOpen] = useState<boolean>(false);
  const [dtOpen, setDtOpen] = useState<boolean>(false);
  const [account, setAccount] = useState<string>('Default');
  const [accountOpen, setAccountOpen] = useState<boolean>(false);
  const [recMade, setRecMade] = useState<boolean>(false);

  function fmtChipTime(d: Date) {
    const now = new Date();
    const diff = Math.abs(d.getTime() - now.getTime());
    if (diff < 2*60*1000) return 'Now';
    const dd = new Date(d); dd.setSeconds(0,0);
    const labelDay = (dd.toDateString() === new Date().toDateString()) ? 'Today' :
      (dd.toDateString() === new Date(Date.now()+86400000).toDateString() ? 'Tomorrow' : dd.toLocaleDateString());
    const hm = dd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${labelDay} ${hm}`;
  }

  const addTx = useTxStore(s => s.add);

  const [mode, setMode] = useState<Mode>('expense');
  const [category, setCategory] = useState<Cat>(EXPENSE_CATS[0]);
  const [expr, setExpr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [notesOpen, setNotesOpen] = useState<boolean>(false);

  const result = useMemo(() => evaluateExpression(expr), [expr]);
  const [toast, setToast] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const onKey = (k: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (k === '.') {
      const parts = expr.split(/[+\-×÷*/]/);
      const last = parts[parts.length - 1] || '';
      if (last.includes('.')) return;
    }
    if (/[+\-×÷*/]/.test(k)) {
      if (!expr) return;
      if (/[+\-×÷*/]$/.test(expr)) {
        setExpr(expr.replace(/[+\-×÷*/]+$/, k));
        return;
      }
    }
    setExpr(expr + k);
  };

  const onBackspace = () => {
    Haptics.selectionAsync();
    setExpr(prev => prev.slice(0, -1));
  };

  const onSave = async () => {
    const amt = Math.max(0, Number(result.toFixed(2)));
    if (!amt) return;
    await addTx({
      type: mode as TxType,
      amount: amt,
      category: category?.label || (mode === 'expense' ? 'Expense' : 'Income'),
      date: txDate.toISOString(),
      note: notes || undefined,
      account,
    });
    nav.goBack();
  };

  const { add: addRecurring } = useRecurringStore();

  const onMakeRecurringQuick = async () => {
    try {
      const amt = Math.max(0, Number(result.toFixed(2)));
      if (!amt || !isFinite(amt)) {
        setToast('Enter an amount first');
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 1200);
        return;
      }
      const label = notes || (category?.label || 'Bill');
      const cat = category?.label || 'Bills';
      const payload = {
        amount: amt,
        label,
        category: cat,
        freq: 'monthly',
        anchorISO: new Date().toISOString()
      };
      await addRecurring(payload as any);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackStyle.Success);
      setToast('Saved as recurring');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1200);
      setRecMade(true);
    } catch (e) {
      setToast('Could not save recurring');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1200);
    }
  };

  const onOkAdd = async () => {
    const amt = Math.max(0, Number(result.toFixed(2)));
    if (!amt) return;
    await addTx({
      type: mode as TxType,
      amount: amt,
      category: category?.label || (mode === 'expense' ? 'Expense' : 'Income'),
      date: txDate.toISOString(),
      note: notes || undefined,
      account,
    });
    setToast(`$${amt.toFixed(2)} • ${category?.label || ''} added`);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
    setExpr('');
    setNotes('');
  };
  const onDoneClose = async () => {
    const amt = Math.max(0, Number(result.toFixed(2)));
    if (!amt) return;
    await addTx({
      type: mode as TxType,
      amount: amt,
      category: category?.label || (mode === 'expense' ? 'Expense' : 'Income'),
      date: txDate.toISOString(),
      note: notes || undefined,
      account,
    });
    nav.goBack();
  };



  const cats = mode === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  // --- UI building blocks ---
  const ModeToggle = () => {
    const Seg = (m: Mode, label: string) => {
      const on = mode === m;
      return (
        <Pressable onPress={() => setMode(m)} style={({ pressed }) => ({
          height: 52,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string),
          opacity: pressed ? 0.9 : 1,
          flex: 1,
        })}>
          <Text style={{ color: on ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight: '700' }}>
            {label}
          </Text>
        </Pressable>
      );
    };
    return (
      <View style={{ flexDirection: 'row', gap: spacing.s8, paddingHorizontal: spacing.s16 }}>
        {Seg('expense', 'Expense')}
        {Seg('income', 'Income')}
      </View>
    );
  };

  const { width: screenW } = Dimensions.get('window');
  const pagePad = spacing.s16;
  const gap = spacing.s12;
  const itemW = Math.floor((screenW - pagePad*2 - gap*3) / 4);

  const renderCat = ({ item }: { item: Cat }) => {
    const Icon = item.icon as any;
    const on = category?.key === item.key;
    return (
      <Pressable
        onPress={() => setCategory(item)}
        style={({ pressed }) => ({
          width: itemW,
          alignItems: 'center',
          marginBottom: spacing.s16,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string)
        }}>
          <Icon size={20} color={on ? (get('text.onPrimary') as string) : (get('icon.default') as string)} />
        </View>
        <Text numberOfLines={1} style={{ marginTop: spacing.s8, color: get('text.primary') as string }}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Screen>
      <AppHeader title="Add" />

      {/* Sticky top toggle */}
      <View style={{ marginTop: spacing.s16 }}>
        <ModeToggle />
      </View>

      {/* Categories scroll only */}
      <View style={{ flex: 1, paddingHorizontal: spacing.s16, marginTop: spacing.s16 }}>
        <FlatList
          data={cats}
          renderItem={renderCat}
          keyExtractor={(it) => it.key}
          numColumns={4}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingBottom: spacing.s24 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </View>

      {/* Sticky compose block above keypad */}
      <View style={{ padding: spacing.s16, paddingTop: 0 }}>
        {/* Chips row */}
        <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s12, marginBottom: spacing.s4 }}>
          <Pressable onPress={() => setDtOpen(true)} style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
  <Text style={{ color: get('text.primary') as string }}>Time: {fmtChipTime(txDate)}</Text>
</Pressable>
          <Pressable style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
            <Text style={{ color: get('text.primary') as string }}>Account: {account}</Text>
          </Pressable>
          <Pressable onPress={onMakeRecurringQuick} style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
            <Text style={{ color: get('text.primary') as string }}>{recMade ? 'Recurring added' : 'Make recurring'}</Text>
          </Pressable>
        </View>
        {/* Quick pick panels */}
        {timeOpen ? (
          <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12, gap: spacing.s8 }}>
            <View style={{ flexDirection:'row', gap: spacing.s8, flexWrap:'wrap' }}>
              <Pressable onPress={() => { setTxDate(new Date()); setTimeOpen(false); }} style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.lg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
                <Text style={{ color: get('text.primary') as string }}>Now</Text>
              </Pressable>
              <Pressable onPress={() => { const d=new Date(); d.setHours(20,0,0,0); setTxDate(d); setTimeOpen(false);} } style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.lg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
                <Text style={{ color: get('text.primary') as string }}>Tonight 8:00</Text>
              </Pressable>
              <Pressable onPress={() => { const d=new Date(Date.now()+86400000); d.setHours(9,0,0,0); setTxDate(d); setTimeOpen(false);} } style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.lg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
                <Text style={{ color: get('text.primary') as string }}>Tomorrow 9:00</Text>
              </Pressable>
              <Pressable onPress={() => { const d=new Date(txDate.getTime()+7*86400000); setTxDate(d); setTimeOpen(false);} } style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.lg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
                <Text style={{ color: get('text.primary') as string }}>+1 week</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {accountOpen ? (
          <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12, gap: spacing.s8 }}>
            <View style={{ flexDirection:'row', gap: spacing.s8, flexWrap:'wrap' }}>
              {['Default','Cash','Card','Savings'].map(a => (
                <Pressable key={a} onPress={() => { setAccount(a); setAccountOpen(false);} } style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.lg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
                  <Text style={{ color: get('text.primary') as string }}>{a}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}


        {/* Notes */}
        <TextInput
          placeholder="Notes (optional)"
          placeholderTextColor={get('text.muted') as string}
          style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12, color: get('text.primary') as string, marginBottom: spacing.s4 }}
          value={notes}
          onChangeText={setNotes}
          onFocus={() => setNotesOpen(true)}
          onBlur={() => setNotesOpen(false)}
        />

        {/* Amount */}
        {(/[+\-×÷*/]/.test(expr)) && (
          <Text style={{ color: get('text.muted') as string, marginBottom: spacing.s4 }}>{expr}</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.s4 }}>
          <Text style={{ color: get('text.primary') as string, fontSize: 40, fontWeight: '800' }}>
            ${result.toFixed(2)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Pressable onPress={onBackspace} style={{ paddingHorizontal: spacing.s8, paddingVertical: spacing.s8 }}><Text style={{ color: get('text.muted') as string, fontSize: 18 }}>⌫</Text></Pressable>
            <Pressable onPress={onOkAdd} style={{ backgroundColor: get('accent.primary') as string, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
              <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700' }}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Keypad at absolute bottom; hidden when notes focused */}
      {toastVisible && (
        <View style={{ position: 'absolute', left: spacing.s16, right: spacing.s16, bottom: 220, backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>{toast}</Text>
        </View>
      )}
      
      {false && !notesOpen && (
        <View style={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s8 }}>
          <Pressable onPress={onMakeRecurringQuick}
            style={{ alignSelf:'flex-end', backgroundColor: recMade ? (get('accent.primary') as string) : (get('surface.level2') as string), borderRadius: radius.lg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
            <Text style={{ color: recMade ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight: '700' }}>{recMade ? 'Recurring added' : 'Make recurring'}</Text>
          </Pressable>
        </View>
      )}
<DateTimeSheet visible={dtOpen} date={txDate} onCancel={() => setDtOpen(false)} onConfirm={(d)=>{ setTxDate(d); setDtOpen(false); }} />
{!notesOpen && (<Keypad onKey={onKey} onBackspace={onBackspace} onDone={onDoneClose} onOk={onOkAdd} />)}
    </Screen>
  );
}
