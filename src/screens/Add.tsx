import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '../components/Screen';
import Keypad from '../components/Keypad';
import DateTimeSheet from '../components/DateTimeSheet';
import Icon from '../components/Icon';

import { spacing, radius, elevation } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useTxStore, TxType } from '../store/transactions';
import { useRecurringStore } from '../store/recurring';
import {
  Utensils, ShoppingBasket, Bus, Fuel, Ticket, ShoppingBag, Wallet, Plane, HeartPulse, Dumbbell, House, Gift,
  TrendingUp, Repeat, ArrowLeftRight, GraduationCap, PawPrint, Plug, Droplets, MoreHorizontal
} from 'lucide-react-native';

type Mode = 'expense' | 'income';
type Cat = { key: string; label: string; icon: React.ComponentType<any>; type: Mode };

type SummaryChipProps = {
  icon: 'category' | 'clock' | 'wallet' | 'note' | 'recurring';
  label: string;
  onPress?: () => void;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB | null {
  const normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return { r, g, b };
  }
  if (normalized.length === 6 || normalized.length === 8) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function rgbaToRgb(input: string): RGB | null {
  const match = input.match(/rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (!match) return null;
  const r = Math.min(255, parseInt(match[1], 10));
  const g = Math.min(255, parseInt(match[2], 10));
  const b = Math.min(255, parseInt(match[3], 10));
  return { r, g, b };
}

function toRgb(color: string): RGB | null {
  if (!color) return null;
  if (color.startsWith('#')) return hexToRgb(color);
  if (color.startsWith('rgb')) return rgbaToRgb(color);
  return null;
}

function mixColor(color: string, base: string, weight: number): string {
  const a = toRgb(color);
  const b = toRgb(base);
  if (!a || !b) return color;
  const w = Math.min(Math.max(weight, 0), 1);
  const r = Math.round(a.r * w + b.r * (1 - w));
  const g = Math.round(a.g * w + b.g * (1 - w));
  const bCh = Math.round(a.b * w + b.b * (1 - w));
  return `rgb(${r},${g},${bCh})`;
}

function withAlpha(color: string, alpha: number): string {
  const rgb = toRgb(color);
  if (!rgb) return color;
  const clamped = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${clamped})`;
}

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
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quick time & account selection
  const [txDate, setTxDate] = useState<Date>(new Date());
  const [dtOpen, setDtOpen] = useState<boolean>(false);
  const [account, setAccount] = useState<string>('Wallet');
  const [accountOpen, setAccountOpen] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [noteOpen, setNoteOpen] = useState<boolean>(false);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [recMade, setRecMade] = useState<boolean>(false);
  const [hasEvaluated, setHasEvaluated] = useState<boolean>(false);

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

  const result = useMemo(() => evaluateExpression(expr), [expr]);
  const [toast, setToast] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const backgroundDefault = get('background.default') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const borderSubtle = get('border.subtle') as string;
  // Use an even darker purple background for the category selection area
  // to give a stronger, more solid backdrop behind the header and chips.
  const heroGradientStart = '#16051f';
  const heroGradientEnd = '#210828';

  const showToast = useCallback((message: string, duration = 1600) => {
    setToast(message);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      toastTimerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const onKey = (k: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (hasEvaluated) setHasEvaluated(false);
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
    if (hasEvaluated) setHasEvaluated(false);
    setExpr(prev => prev.slice(0, -1));
  };

  const { add: addRecurring } = useRecurringStore();
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const keypadHeightEstimate = 360;
  const keypadReserve = keypadHeightEstimate + insets.bottom + spacing.s16;
  const whenLabel = useMemo(() => fmtChipTime(txDate), [txDate]);
  const noteChipLabel = useMemo(() => {
    if (!note.trim()) return 'Add note';
    return note.trim().length > 28 ? `${note.trim().slice(0, 27)}…` : note.trim();
  }, [note]);
  const displayValue = useMemo(() => {
    if (!expr) return result ? result.toFixed(2) : '0';
    return hasEvaluated ? result.toFixed(2) : expr;
  }, [expr, hasEvaluated, result]);

  const onNoteCancel = useCallback(() => {
    setNoteDraft(note);
    setNoteOpen(false);
  }, [note]);

  const onNoteSave = useCallback(() => {
    const trimmed = noteDraft.trim();
    setNote(trimmed);
    setNoteDraft(trimmed);
    setNoteOpen(false);
  }, [noteDraft]);

  const onNoteClear = useCallback(() => {
    setNote('');
    setNoteDraft('');
  }, []);

  const onEvaluate = useCallback(() => {
    if (!expr) {
      showToast('Enter an amount first');
      return;
    }
    setHasEvaluated(true);
    setExpr(result.toFixed(2));
  }, [expr, result, showToast]);

  // --- helpers for new layout ---
  const ModeToggle = () => {
    const Option = (value: Mode, label: string) => {
      const active = mode === value;
      return (
        <Pressable
          key={value}
          accessibilityRole="button"
          onPress={() => setMode(value)}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.s8,
            paddingVertical: spacing.s4,
            borderRadius: radius.pill,
            backgroundColor: active ? 'rgba(255,255,255,0.22)' : 'transparent',
            opacity: pressed ? 0.9 : 1,
            minWidth: 48,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700', letterSpacing: 0.6 }}>{label}</Text>
        </Pressable>
      );
    };

    return (
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderRadius: radius.pill,
          paddingHorizontal: spacing.s4,
          paddingVertical: spacing.s4,
          gap: spacing.s2,
        }}
      >
        {Option('expense', 'EXP')}
        {Option('income', 'INC')}
      </View>
    );
  };

  const SummaryChip = ({ icon, label, onPress, fullWidth, style }: SummaryChipProps) => {
    const iconName =
      icon === 'category'
        ? 'receipt'
        : icon === 'clock'
        ? 'history'
        : icon === 'wallet'
        ? 'wallet'
        : icon === 'note'
        ? 'edit'
        : 'plus-circle';

    return (
      <Pressable
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.85 : 1,
            alignSelf: fullWidth ? 'stretch' : undefined,
          },
          style,
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s6,
            paddingHorizontal: spacing.s10,
            paddingVertical: spacing.s6,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255,255,255,0.12)',
          }}
        >
          <Icon name={iconName} size={14} colorToken="text.onSurface" />
          <Text style={{ color: 'rgba(250,250,252,0.95)', fontWeight: '600', fontSize: 12 }}>{label}</Text>
        </View>
      </Pressable>
    );
  };

  const containerPad = spacing.s16;
  const gridGap = spacing.s8;
  const availableWidth = Math.max(0, screenW - containerPad * 2);
  const numColumns = availableWidth >= 320 ? 4 : 3;
  const itemWidth = Math.floor((availableWidth - gridGap * (numColumns - 1)) / numColumns);
  const tileMaxHeight = Math.max(240, screenH - keypadHeightEstimate - insets.bottom - spacing.s32);

  const renderCat = (item: Cat, index: number) => {
    const IconComp = item.icon as any;
    const selected = category?.key === item.key;
    const base = withAlpha(mixColor(surface1, '#0e121f', 0.6), 0.2);
    const bg = selected ? withAlpha(accentPrimary, 0.2) : base;
    const border = selected ? withAlpha(accentPrimary, 0.35) : 'rgba(255,255,255,0.18)';

    return (
      <Pressable
        key={item.key}
        onPress={() => setCategory(item)}
        style={({ pressed }) => ({
          width: itemWidth,
          alignItems: 'center',
          marginRight: index % numColumns === numColumns - 1 ? 0 : gridGap,
          marginBottom: gridGap,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: '100%',
            borderRadius: radius.lg,
            paddingVertical: spacing.s10,
            paddingHorizontal: spacing.s6,
            backgroundColor: bg,
            borderWidth: 1,
            borderColor: border,
            alignItems: 'center',
            justifyContent: 'center',
            ...(selected ? elevation.level2 : elevation.level1),
          }}
        >
          <IconComp size={20} color={selected ? accentPrimary : textPrimary} />
          <Text style={{ marginTop: spacing.s6, color: selected ? accentPrimary : textPrimary, fontWeight: '600' }} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      </Pressable>
    );
  };

  const onMakeRecurringQuick = async () => {
    try {
      const amt = Math.max(0, Number(result.toFixed(2)));
      if (!amt || !Number.isFinite(amt)) {
        showToast('Enter an amount first');
        return;
      }
      const payload = {
        amount: amt,
        label: note?.trim() || category?.label || 'Recurring',
        category: category?.label || 'Bills',
        freq: 'monthly' as const,
        anchorISO: new Date().toISOString(),
      };
      await addRecurring(payload as any);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRecMade(true);
      showToast('Saved as recurring');
    } catch {
      showToast('Could not save recurring');
    }
  };

  // Recurring editor modal state
  const [recurringOpen, setRecurringOpen] = useState<boolean>(false);
  const [recLabel, setRecLabel] = useState<string>(note?.trim() || category?.label || 'Recurring');
  const [recFreq, setRecFreq] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly');
  const [recStart, setRecStart] = useState<Date>(new Date());
  const [recEndEnabled, setRecEndEnabled] = useState<boolean>(false);
  const [recEndDate, setRecEndDate] = useState<Date>(new Date());
  const [recAutoPost, setRecAutoPost] = useState<boolean>(false);
  const [recRemind, setRecRemind] = useState<boolean>(true);
  const [recDateOpen, setRecDateOpen] = useState<boolean>(false);
  const [recEndDateOpen, setRecEndDateOpen] = useState<boolean>(false);
  const [recAmount, setRecAmount] = useState<string>('0.00');

  const openRecurringEditor = () => {
    setRecLabel(note?.trim() || category?.label || 'Recurring');
    setRecFreq('monthly');
    setRecStart(new Date());
    setRecEndEnabled(false);
    setRecEndDate(new Date());
    setRecAutoPost(false);
    setRecRemind(true);
    setRecAmount(result ? result.toFixed(2) : '0.00');
    setRecurringOpen(true);
  };

  const onSaveRecurring = async () => {
    try {
      const parsed = parseFloat(recAmount || '0');
      const amt = Math.max(0, Number(isFinite(parsed) ? parsed : 0));
      if (!amt) {
        showToast('Enter an amount first');
        return;
      }
      const payload: any = {
        label: recLabel || (category?.label || 'Recurring'),
        category: category?.label || 'Bills',
        amount: amt,
        freq: recFreq,
        anchorISO: recStart.toISOString(),
        autoPost: recAutoPost,
        remind: recRemind,
      };
      if (recEndEnabled) payload.endISO = recEndDate.toISOString();
      await addRecurring(payload);
      setRecurringOpen(false);
      setRecMade(true);
      showToast('Saved recurring');
    } catch (err) {
      showToast('Could not save recurring');
    }
  };

  const addTxCommon = async () => {
    const amt = Math.max(0, Number(result.toFixed(2)));
    if (!amt) {
      showToast('Enter an amount first');
      return false;
    }
    await addTx({
      type: mode as TxType,
      amount: amt,
      category: category?.label || (mode === 'expense' ? 'Expense' : 'Income'),
      date: txDate.toISOString(),
      note: note.trim() ? note.trim() : undefined,
      account,
    });
    return true;
  };

  const onAddAndStay = async () => {
    const ok = await addTxCommon();
    if (!ok) return;
    showToast(`${mode === 'expense' ? '-' : '+'}$${result.toFixed(2)} added`, 2000);
    setExpr('');
    setHasEvaluated(false);
  };

  const onSaveAndClose = async () => {
    const ok = await addTxCommon();
    if (!ok) return;
    setHasEvaluated(false);
    nav.goBack();
  };

  const keypadHeader = (
    <View style={{ gap: spacing.s6 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, paddingRight: spacing.s4 }}
      >
        <SummaryChip
          icon="category"
          label={category?.label || 'Category'}
          onPress={() => {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        />
        <SummaryChip
          icon="clock"
          label={whenLabel}
          onPress={() => {
            setAccountOpen(false);
            setDtOpen(true);
          }}
        />
        <SummaryChip
          icon="wallet"
          label={account}
          onPress={() => setAccountOpen(true)}
        />
        <SummaryChip
          icon="recurring"
          label={recMade ? 'Recurring saved' : 'Recurring'}
          onPress={() => {
            // open detailed recurring editor instead of quick save
            openRecurringEditor();
          }}
        />
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ModeToggle />
        <Text style={{ color: 'rgba(255,255,255,0.96)', fontSize: 32, fontWeight: '800' }}>${displayValue}</Text>
      </View>

      <SummaryChip
        icon="note"
        label={noteChipLabel}
        onPress={() => {
          setNoteDraft(note);
          setNoteOpen(true);
        }}
        fullWidth
      />
    </View>
  );

  return (
    <Screen style={{ paddingBottom: 0 }} inTab>
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={[heroGradientStart, heroGradientEnd, backgroundDefault]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          // increased height so gradient covers header and the summary chips row
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 520 }}
        />

        <View style={{ flex: 1, paddingTop: spacing.s8, paddingHorizontal: containerPad, paddingBottom: keypadReserve }}>
          <View style={{ marginBottom: spacing.s12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Choose a category</Text>
                <Text style={{ color: textMuted, marginTop: spacing.s4 }}>Tailor budgets and insights by tagging spend.</Text>
              </View>
              <Pressable
                onPress={() => setCategory((mode === 'expense' ? EXPENSE_CATS : INCOME_CATS)[0])}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s10,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: surface2,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <Text style={{ color: textMuted, fontWeight: '600', fontSize: 12 }}>Reset</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: spacing.s8, paddingBottom: spacing.s12 }}
              style={{ maxHeight: tileMaxHeight }}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(mode === 'expense' ? EXPENSE_CATS : INCOME_CATS).map((item, index) => renderCat(item, index))}</View>
            </ScrollView>
          </View>
        </View>

        {toastVisible ? (
          <View
            style={{
              position: 'absolute',
              left: spacing.s16,
              right: spacing.s16,
              bottom: insets.bottom + 220,
              borderRadius: radius.lg,
              paddingVertical: spacing.s12,
              paddingHorizontal: spacing.s16,
              backgroundColor: mixColor(accentPrimary, surface1, 0.5),
              ...(elevation.level1 as any),
            }}
          >
            <Text style={{ color: textPrimary, fontWeight: '700' }}>{toast}</Text>
          </View>
        ) : null}

        <DateTimeSheet
          visible={dtOpen}
          date={txDate}
          onCancel={() => setDtOpen(false)}
          onConfirm={(d) => {
            setTxDate(d);
            setDtOpen(false);
          }}
        />

        <Modal visible={accountOpen} transparent animationType="fade" onRequestClose={() => setAccountOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(8,10,18,0.72)', justifyContent: 'center', alignItems: 'center', padding: spacing.s16 }}>
            <TouchableWithoutFeedback onPress={() => setAccountOpen(false)}>
              <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
            </TouchableWithoutFeedback>
            <View
              style={{
                width: '100%',
                maxWidth: 360,
                borderRadius: radius.xl,
                padding: spacing.s16,
                backgroundColor: 'rgba(11,13,22,0.88)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18 }}>Choose account</Text>
                <Pressable onPress={() => setAccountOpen(false)} hitSlop={12}>
                  <Text style={{ color: textMuted, fontWeight: '600' }}>Close</Text>
                </Pressable>
              </View>

              <View style={{ gap: spacing.s8 }}>
                {['Wallet', 'Cash', 'Credit card', 'Savings'].map((name) => {
                  const active = account === name;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => {
                        setAccount(name);
                        setAccountOpen(false);
                      }}
                      style={({ pressed }) => ({
                        paddingVertical: spacing.s10,
                        paddingHorizontal: spacing.s12,
                        borderRadius: radius.lg,
                        backgroundColor: active ? mixColor(accentPrimary, surface1, 0.4) : surface2,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text style={{ color: textPrimary, fontWeight: active ? '700' : '500' }}>{name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={noteOpen} transparent animationType="fade" onRequestClose={onNoteCancel}>
          <View style={{ flex: 1, backgroundColor: 'rgba(8,10,18,0.72)', justifyContent: 'center', alignItems: 'center', padding: spacing.s16 }}>
            <TouchableWithoutFeedback onPress={onNoteCancel}>
              <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
            </TouchableWithoutFeedback>
            <View
              style={{
                width: '100%',
                maxWidth: 360,
                borderRadius: radius.xl,
                padding: spacing.s16,
                backgroundColor: 'rgba(11,13,22,0.88)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18 }}>Add note</Text>
                <Pressable onPress={onNoteCancel} hitSlop={12}>
                  <Text style={{ color: textMuted, fontWeight: '600' }}>Close</Text>
                </Pressable>
              </View>
              <TextInput
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="Add a quick note"
                placeholderTextColor={`${textMuted}99`}
                multiline
                autoFocus
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={onNoteSave}
                style={{
                  minHeight: 96,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: borderSubtle,
                  padding: spacing.s12,
                  backgroundColor: surface2,
                  color: textPrimary,
                  fontSize: 16,
                  textAlignVertical: 'top',
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.s8, marginTop: spacing.s12 }}>
                {noteDraft.length > 0 || note.length > 0 ? (
                  <Pressable
                    onPress={onNoteClear}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.s10,
                      paddingVertical: spacing.s6,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: borderSubtle,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={{ color: textMuted, fontWeight: '600' }}>Clear</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onNoteCancel}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s8,
                    borderRadius: radius.pill,
                    backgroundColor: surface2,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: textMuted, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onNoteSave}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s8,
                    borderRadius: radius.pill,
                    backgroundColor: accentPrimary,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: textOnPrimary, fontWeight: '700' }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={recurringOpen} transparent animationType="fade" onRequestClose={() => setRecurringOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(8,10,18,0.72)', justifyContent: 'center', alignItems: 'center', padding: spacing.s16 }}>
              <TouchableWithoutFeedback onPress={() => setRecurringOpen(false)}>
                <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
              </TouchableWithoutFeedback>
              <View
                style={{
                  width: '100%',
                  maxWidth: 460,
                  borderRadius: radius.xl,
                  padding: spacing.s16,
                  backgroundColor: 'rgba(11,13,22,0.98)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                  maxHeight: Math.max(520, Math.min(820, Dimensions.get('window').height - 80)),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18 }}>Add recurring</Text>
                  <Pressable onPress={() => setRecurringOpen(false)} hitSlop={12}>
                    <Text style={{ color: textMuted, fontWeight: '600' }}>Close</Text>
                  </Pressable>
                </View>

                <View style={{ gap: spacing.s10 }}>
                  <View>
                    <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>Name</Text>
                    <TextInput
                      value={recLabel}
                      onChangeText={setRecLabel}
                      placeholder="e.g. Rent, Netflix"
                      placeholderTextColor={`${textMuted}88`}
                      style={{
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: borderSubtle,
                        padding: spacing.s10,
                        backgroundColor: surface2,
                        color: textPrimary,
                      }}
                    />
                  </View>

                  <View>
                    <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>Amount</Text>
                    <TextInput
                      value={recAmount}
                      onChangeText={(t) => setRecAmount(t.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      placeholderTextColor={`${textMuted}88`}
                      keyboardType="decimal-pad"
                      style={{
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: borderSubtle,
                        padding: spacing.s10,
                        backgroundColor: surface2,
                        color: textPrimary,
                        fontWeight: '700',
                        fontSize: 16,
                      }}
                    />
                  </View>

                  <View>
                    <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>Frequency</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                      {(['monthly','biweekly','weekly'] as any[]).map((f) => (
                        <Pressable
                          key={f}
                          onPress={() => setRecFreq(f)}
                          style={({ pressed }) => ({
                            paddingHorizontal: spacing.s10,
                            paddingVertical: spacing.s8,
                            borderRadius: radius.pill,
                            backgroundColor: recFreq === f ? mixColor(accentPrimary, surface1, 0.35) : surface2,
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Text style={{ color: recFreq === f ? textOnPrimary : textPrimary, fontWeight: recFreq === f ? '700' : '600' }}>{f[0].toUpperCase() + f.slice(1)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>Start date</Text>
                    <Pressable onPress={() => setRecDateOpen(true)} style={{ padding: spacing.s10, borderRadius: radius.lg, backgroundColor: surface2, borderWidth: 1, borderColor: borderSubtle }}>
                      <Text style={{ color: textPrimary }}>{recStart.toLocaleDateString()}</Text>
                    </Pressable>
                  </View>

                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ color: textMuted, fontSize: 12 }}>End</Text>
                        <Text style={{ color: textMuted, fontSize: 12 }}>{recEndEnabled ? 'Ends on selected date' : 'Never'}</Text>
                      </View>
                      <Switch value={recEndEnabled} onValueChange={setRecEndEnabled} thumbColor={recEndEnabled ? accentPrimary : undefined} />
                    </View>
                    {recEndEnabled ? (
                      <Pressable onPress={() => setRecEndDateOpen(true)} style={{ marginTop: spacing.s8, padding: spacing.s10, borderRadius: radius.lg, backgroundColor: surface2, borderWidth: 1, borderColor: borderSubtle }}>
                        <Text style={{ color: textPrimary }}>{recEndDate.toLocaleDateString()}</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textMuted, fontSize: 12 }}>Auto post</Text>
                      <Text style={{ color: textMuted, fontSize: 12 }}>Automatically create transaction on due</Text>
                    </View>
                    <Switch value={recAutoPost} onValueChange={setRecAutoPost} thumbColor={recAutoPost ? accentPrimary : undefined} />
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textMuted, fontSize: 12 }}>Reminders</Text>
                      <Text style={{ color: textMuted, fontSize: 12 }}>Notify me when a payment is due</Text>
                    </View>
                    <Switch value={recRemind} onValueChange={setRecRemind} thumbColor={recRemind ? accentPrimary : undefined} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.s8, marginTop: spacing.s12 }}>
                  <Pressable onPress={() => setRecurringOpen(false)} style={({ pressed }) => ({ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: surface2, opacity: pressed ? 0.85 : 1 })}>
                    <Text style={{ color: textMuted, fontWeight: '600' }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={onSaveRecurring} style={({ pressed }) => ({ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: accentPrimary, opacity: pressed ? 0.85 : 1 })}>
                    <Text style={{ color: textOnPrimary, fontWeight: '700' }}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <DateTimeSheet
          visible={recDateOpen}
          date={recStart}
          onCancel={() => setRecDateOpen(false)}
          onConfirm={(d) => {
            setRecStart(d);
            setRecDateOpen(false);
          }}
        />

        <DateTimeSheet
          visible={recEndDateOpen}
          date={recEndDate}
          onCancel={() => setRecEndDateOpen(false)}
          onConfirm={(d) => {
            setRecEndDate(d);
            setRecEndDateOpen(false);
          }}
        />

        {!recurringOpen && !noteOpen && !accountOpen && !dtOpen && !recDateOpen && !recEndDateOpen ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <Keypad
              onKey={onKey}
              onBackspace={onBackspace}
              onDone={onSaveAndClose}
              onOk={onAddAndStay}
              onEvaluate={onEvaluate}
              header={keypadHeader}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
