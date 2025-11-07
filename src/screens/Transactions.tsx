import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import Icon from '../components/Icon';
import Input from '../components/Input';
import PopoverMenu from '../components/PopoverMenu';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { useAccountsStore } from '../store/accounts';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tx = ReturnType<typeof useTxStore.getState>['transactions'][number];

type Section = {
  key: string;
  title: string;
  data: Tx[];
  totalSpent: number;
  totalNet: number;
};

const RANGE_SEQUENCE = ['ALL', '7D', '30D', 'MONTH', 'CUSTOM'] as const;
const RANGE_LABELS: Record<typeof RANGE_SEQUENCE[number], string> = {
  ALL: 'All time',
  '7D': 'Last 7 days',
  '30D': 'Last 30 days',
  MONTH: 'This month',
  CUSTOM: 'Custom range',
};

function withOpacity(color: string, opacity: number) {
  if (!color) return color;
  if (color.startsWith('#')) {
    if (color.length === 4) {
      const hex = color.slice(1).split('').map((c) => c + c).join('');
      const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255).toString(16).padStart(2, '0');
      return `#${hex}${alpha}`;
    }
    if (color.length === 7) {
      const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255).toString(16).padStart(2, '0');
      return `${color}${alpha}`;
    }
  }
  if (color.startsWith('rgb')) {
    const parts = color.replace(/rgba?\(/, '').replace(')', '').split(',').map((part) => Number(part.trim()));
    if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
      const [r, g, b] = parts;
      return `rgba(${r},${g},${b},${opacity})`;
    }
  }
  return color;
}

const TYPE_OPTIONS: { label: string; value: 'all' | 'income' | 'expense'; description?: string }[] = [
  { label: 'All activity', value: 'all', description: 'Display every transaction' },
  { label: 'Income only', value: 'income', description: 'Focus on credits and inflows' },
  { label: 'Spending only', value: 'expense', description: 'Show just your outflows' },
];

const RANGE_OPTIONS: { label: string; value: typeof RANGE_SEQUENCE[number] }[] = RANGE_SEQUENCE.map((key) => ({
  label: RANGE_LABELS[key],
  value: key,
}));

// Animated pressable component
const AnimatedPressable: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}> = ({ onPress, children, style }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const Row = ({ item, onRemove, onEdit }: { item: Tx; onRemove: () => void; onEdit: () => void }) => {
  const { get } = useThemeTokens();
  const isIncome = item.type === 'income';

  const renderRightActions = () => (
    <View style={{ flexDirection: 'row' }}>
      <Pressable accessibilityRole="button" onPress={onEdit}>
        <View style={{ width: 80, height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: get('accent.primary') as string }}>
          <Icon name="edit" size={20} colorToken="text.onPrimary" />
          <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 13, marginTop: spacing.s4 }}>Edit</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onRemove}>
        <View style={{ width: 80, height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: get('semantic.danger') as string }}>
          <Icon name="trash" size={20} colorToken="text.onPrimary" />
          <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 13, marginTop: spacing.s4 }}>Delete</Text>
        </View>
      </Pressable>
    </View>
  );

  const d = new Date(item.date);
  const amount = Math.abs(Number(item.amount) || 0);
  const categoryInitial = (item.category || 'T').charAt(0).toUpperCase();

  const fmtTime = (date: Date) => {
    if (isNaN(date.getTime())) return '';
    const h = date.getHours();
    const m = date.getMinutes();
    const hh = ((h % 12) || 12).toString();
    const mm = m.toString().padStart(2, '0');
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${hh}:${mm} ${ampm}`;
  };

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <View style={{
        paddingVertical: spacing.s12,
        paddingHorizontal: spacing.s16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: get('border.subtle') as string,
        backgroundColor: get('surface.level1') as string
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Category indicator - circular with initial */}
          <View style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            backgroundColor: isIncome ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            marginRight: spacing.s12,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Text style={{
              color: isIncome ? (get('semantic.success') as string) : (get('semantic.danger') as string),
              fontWeight: '700',
              fontSize: 16
            }}>
              {categoryInitial}
            </Text>
          </View>

          {/* Content */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{
              color: get('text.primary') as string,
              fontWeight: '700',
              fontSize: 15
            }}>
              {item.note || item.category || 'Transaction'}
            </Text>
            <Text numberOfLines={1} style={{
              color: get('text.muted') as string,
              fontSize: 13,
              marginTop: 2
            }}>
              {fmtTime(d)} • {item.category}{item.account ? ` • ${item.account}` : ''}
            </Text>
          </View>

          {/* Amount */}
          <Text style={{
            color: isIncome ? (get('semantic.success') as string) : (get('semantic.danger') as string),
            fontWeight: '700',
            fontSize: 15,
            marginLeft: spacing.s8
          }}>
            {isIncome ? '+' : '-'}${amount.toFixed(2)}
          </Text>
        </View>
      </View>
    </Swipeable>
  );
};

function formatSectionTitle(d: Date) {
  const now = new Date();
  const start = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const diffDays = Math.round((start(d) - start(now)) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today · ' + d.toLocaleDateString(undefined, { weekday: 'short' });
  if (diffDays === -1) return 'Yesterday · ' + d.toLocaleDateString(undefined, { weekday: 'short' });
  const dateStr = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  const dayStr = d.toLocaleDateString(undefined, { weekday: 'short' });
  return `${dateStr} · ${dayStr}`;
}


function groupByDate(items: Tx[]): Section[] {
  const groups: Record<string, Tx[]> = {};
  const pad = (n: number) => String(n).padStart(2, '0');
  for (const t of items) {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; // local day key
    (groups[key] ||= []).push(t);
  }
  const keys = Object.keys(groups).sort((a,b) => a < b ? 1 : -1);
  return keys.map(k => {
    const data = groups[k].slice().sort((a,b)=> (a.date < b.date ? 1 : -1));
    const totalSpent = data.filter(t => t.type !== 'income').reduce((acc,t)=> acc + Number(t.amount||0), 0);
    const totalNet = data.reduce((acc,t)=> acc + (t.type==='income' ? Number(t.amount||0) : -Number(t.amount||0)), 0);
    return { key: k, title: formatSectionTitle(new Date(k)), data, totalSpent, totalNet };
  });
}


export const Transactions: React.FC = () => {
  const { get } = useThemeTokens();
  const { transactions, remove } = useTxStore();
  const { accounts } = useAccountsStore();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [filter, setFilter] = useState<'all'|'income'|'expense'>('all');
  const [range, setRange] = useState<'ALL'|'7D'|'30D'|'MONTH'|'CUSTOM'>('MONTH');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchOn, setSearchOn] = useState(false);
  const [totalMode, setTotalMode] = useState<'SPENT'|'NET'>('SPENT');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [typeAnchor, setTypeAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [rangeMenuVisible, setRangeMenuVisible] = useState(false);
  const [rangeAnchor, setRangeAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const typeButtonRef = useRef<View>(null);
  const rangeButtonRef = useRef<View>(null);
  const accountButtonRef = useRef<View>(null);
  const normalizedSearch = search.trim().toLowerCase();

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Animation for search bar
  const searchHeightAnim = useRef(new Animated.Value(0)).current;

  // Animate search bar when toggled
  useEffect(() => {
    Animated.timing(searchHeightAnim, {
      toValue: searchOn ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [searchOn]);

  const openTypeMenu = useCallback(() => {
    const ref: any = typeButtonRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x: number, y: number, w: number, h: number) => {
        setTypeAnchor({ x, y, w, h });
        setTypeMenuVisible(true);
      });
    } else if (typeAnchor) {
      setTypeMenuVisible(true);
    } else {
      setTypeAnchor({ x: 200, y: 80, w: 1, h: 1 });
      setTypeMenuVisible(true);
    }
  }, [typeAnchor]);

  const openRangeMenu = useCallback(() => {
    const ref: any = rangeButtonRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x: number, y: number, w: number, h: number) => {
        setRangeAnchor({ x, y, w, h });
        setRangeMenuVisible(true);
      });
    } else if (rangeAnchor) {
      setRangeMenuVisible(true);
    } else {
      setRangeAnchor({ x: 220, y: 80, w: 1, h: 1 });
      setRangeMenuVisible(true);
    }
  }, [rangeAnchor]);

  const openAccountMenu = useCallback(() => {
    const ref: any = accountButtonRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x: number, y: number, w: number, h: number) => {
        setAccountAnchor({ x, y, w, h });
        setAccountMenuVisible(true);
      });
    } else if (accountAnchor) {
      setAccountMenuVisible(true);
    } else {
      setAccountAnchor({ x: 240, y: 80, w: 1, h: 1 });
      setAccountMenuVisible(true);
    }
  }, [accountAnchor]);

  // Reset filters whenever this modal/screen gains focus
  useFocusEffect(useCallback(() => {
    setFilter('all');
    setRange('MONTH');
    setAccountFilter('all');
    setSearch('');
    setSearchOn(false);
    setTypeMenuVisible(false);
    setRangeMenuVisible(false);
    setAccountMenuVisible(false);
    setTypeAnchor(null);
    setRangeAnchor(null);
    setAccountAnchor(null);
    return undefined;
  }, []));


  // hydrate collapse state
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('tx_collapsed_v1');
        if (raw) setCollapsed(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  // persist collapse state
  useEffect(() => {
    AsyncStorage.setItem('tx_collapsed_v1', JSON.stringify(collapsed)).catch(() => {});
  }, [collapsed]);

  const filtered = useMemo(() => {
    let base = filter==='all' ? transactions : transactions.filter(t => t.type === filter);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let fromTs = 0;
    if (range === '7D') fromTs = now.getTime() - 7*24*60*60*1000;
    else if (range === '30D') fromTs = now.getTime() - 30*24*60*60*1000;
    else if (range === 'MONTH') fromTs = startOfMonth;
    else if (range === 'ALL') fromTs = 0;

    if (fromTs) base = base.filter(t => new Date(t.date).getTime() >= fromTs);

    if (accountFilter !== 'all') {
      base = base.filter(t => t.accountId === accountFilter);
    }

    if (normalizedSearch.length > 0) {
      base = base.filter(t => (t.note || '').toLowerCase().includes(normalizedSearch) || (t.category || '').toLowerCase().includes(normalizedSearch));
    }

    return base;
  }, [transactions, filter, range, accountFilter, normalizedSearch]);

  const sectionsRaw = useMemo(() => groupByDate(filtered), [filtered]);

  // Summary metrics for the hero card
  const incomeTotal = useMemo(() => filtered.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount || 0), 0), [filtered]);
  const expenseTotal = useMemo(() => filtered.filter(t => t.type !== 'income').reduce((a, t) => a + Number(t.amount || 0), 0), [filtered]);
  const netTotal = useMemo(() => incomeTotal - expenseTotal, [incomeTotal, expenseTotal]);
  const avgTxn = useMemo(() => filtered.length ? (filtered.reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0) / filtered.length) : 0, [filtered]);
  const percentChange = useMemo(() => {
    const nowDate = new Date();
    const now = nowDate.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    let currentStart: number | null = null;
    let previousStart: number | null = null;

    if (range === '7D') {
      const windowMs = 7 * dayMs;
      currentStart = now - windowMs;
      previousStart = currentStart - windowMs;
    } else if (range === '30D') {
      const windowMs = 30 * dayMs;
      currentStart = now - windowMs;
      previousStart = currentStart - windowMs;
    } else if (range === 'MONTH') {
      currentStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
      previousStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1).getTime();
    } else {
      return null;
    }

    if (currentStart === null || previousStart === null) return null;
    if (previousStart < 0) previousStart = 0;
    if (previousStart >= currentStart) return null;
    const matchesFilters = (t: Tx) => {
      if (filter !== 'all' && t.type !== filter) return false;
      if (normalizedSearch.length > 0) {
        const note = (t.note || '').toLowerCase();
        const category = (t.category || '').toLowerCase();
        if (!note.includes(normalizedSearch) && !category.includes(normalizedSearch)) return false;
      }
      return true;
    };
    const contribution = (t: Tx) => {
      const amount = Number(t.amount || 0);
      if (!Number.isFinite(amount)) return 0;
      return t.type === 'income' ? amount : -amount;
    };

    let currentNet = 0;
    let previousNet = 0;
    for (const t of transactions) {
      if (!matchesFilters(t)) continue;
      const ts = new Date(t.date).getTime();
      if (Number.isNaN(ts)) continue;
      if (ts >= currentStart && ts <= now) {
        currentNet += contribution(t);
      } else if (ts >= previousStart && ts < currentStart) {
        previousNet += contribution(t);
      }
    }

    if (Math.abs(previousNet) < 1e-6) return null;
    return ((currentNet - previousNet) / Math.abs(previousNet)) * 100;
  }, [transactions, filter, normalizedSearch, range]);
  const onPrimary = get('text.onPrimary') as string;
  const textPrimary = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const success = get('semantic.success') as string;
  const danger = get('semantic.danger') as string;
  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;
  const backgroundHex = ((get('background.default') as string) || '').toLowerCase();
  const isLightTheme = backgroundHex.includes('#f7') || backgroundHex.includes('#f8') || backgroundHex.includes('fff');
  const heroForeground = isLightTheme ? onPrimary : textPrimary;
  const heroIconToken = isLightTheme ? 'text.onPrimary' : 'text.primary';
  const gradientColors = isLightTheme
    ? ['#1a1f33', '#262b46']
    : ['rgba(13,16,30,0.94)', 'rgba(33,27,58,0.92)'];

  const heroMuted = withOpacity(heroForeground, 0.78);
  const heroDivider = withOpacity(heroForeground, 0.18);
  const heroTileBg = withOpacity(heroForeground, 0.12);
  const heroControlBg = withOpacity(heroForeground, 0.08);
  const heroControlActive = withOpacity(heroForeground, 0.24);
  const heroControlBorder = withOpacity(heroForeground, 0.22);
  const heroTextFaint = withOpacity(heroForeground, 0.65);
  const successSoft = withOpacity(success, 0.3);
  const dangerSoft = withOpacity(danger, 0.3);
  const searchContainerBg = withOpacity(heroForeground, 0.1);
  const typeLabel = filter === 'all' ? 'All activity' : filter === 'income' ? 'Income only' : 'Spending only';
  const rangeLabel = RANGE_LABELS[range];

  // Account filter options
  const accountOptions = useMemo(() => {
    const options = [{ label: 'All accounts', value: 'all', description: 'Show all transactions' }];
    if (Array.isArray(accounts)) {
      for (const acc of accounts) {
        options.push({
          label: acc.name || 'Unnamed Account',
          value: acc.id,
          description: acc.type || 'Account'
        });
      }
    }
    return options;
  }, [accounts]);

  const accountLabel = accountFilter === 'all'
    ? 'All accounts'
    : (accounts?.find(a => a.id === accountFilter)?.name || 'Account');

  const totalLabel = totalMode === 'SPENT' ? 'Spending' : 'Net movement';
  const listPaddingBottom = Math.max(insets.bottom, spacing.s4);

  const onDelete = async (tx: Tx) => {
    try { await remove(tx.id); } catch {}
  };

  const onEdit = (tx: Tx) => {
    (nav as any).navigate('Add', { id: tx.id });
  };

  return (
    <Screen inTab style={{ paddingBottom: 0 }}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* Header with back button */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.s16,
          paddingTop: spacing.s12,
          paddingBottom: spacing.s8,
          marginBottom: spacing.s8,
        }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? withOpacity(surface1, 0.5) : 'transparent',
              marginRight: spacing.s8,
            })}
          >
            <Icon name="chevron-left" size={24} colorToken="text.primary" />
          </Pressable>
          <Text style={{
            fontSize: 28,
            fontWeight: '800',
            color: textPrimary,
            letterSpacing: -0.5,
          }}>
            History
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <FlatList
          data={sectionsRaw}
          keyExtractor={(s) => s.key}
          bounces={false}
          contentContainerStyle={{ paddingBottom: listPaddingBottom }}
          ListEmptyComponent={
            sectionsRaw.length === 0 ? (
              <View style={{
                marginHorizontal: spacing.s16,
                marginTop: spacing.s24,
                padding: spacing.s24,
                borderRadius: radius.xl,
                backgroundColor: get('surface.level1') as string,
                alignItems: 'center',
                gap: spacing.s12,
                borderWidth: 1,
                borderColor: get('border.subtle') as string
              }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.lg,
                  backgroundColor: withOpacity(get('accent.primary') as string, 0.1),
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name="inbox" size={28} colorToken="accent.primary" />
                </View>
                <Text style={{
                  color: get('text.primary') as string,
                  fontWeight: '700',
                  fontSize: 18,
                  textAlign: 'center'
                }}>
                  No transactions found
                </Text>
                <Text style={{
                  color: get('text.muted') as string,
                  fontSize: 14,
                  textAlign: 'center',
                  lineHeight: 20
                }}>
                  {normalizedSearch.length > 0
                    ? 'Try adjusting your search or filters'
                    : filter !== 'all' || range !== 'ALL'
                    ? 'No transactions match your current filters'
                    : 'Start tracking your finances by adding your first transaction'}
                </Text>
              </View>
            ) : null
          }
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              {/* Page Header with Stats */}
              <View style={{ marginBottom: spacing.s16 }}>
                {/* Overview Stats - Direct on Background */}
                <View style={{ gap: spacing.s12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: muted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s4 }}>
                        Total Spending
                      </Text>
                      <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
                        ${expenseTotal.toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: muted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s4 }}>
                        Total Income
                      </Text>
                      <Text style={{ color: success, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
                        +${incomeTotal.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ color: muted, fontSize: 13 }}>
                        Net: <Text style={{ color: netTotal >= 0 ? success : danger, fontWeight: '700' }}>
                          {netTotal >= 0 ? '+' : ''}${netTotal.toFixed(2)}
                        </Text>
                      </Text>
                      <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s2 }}>
                        Avg per transaction: ${avgTxn.toFixed(2)}
                      </Text>
                    </View>
                    {typeof percentChange === 'number' && (
                      <View style={{
                        paddingHorizontal: spacing.s10,
                        paddingVertical: spacing.s6,
                        borderRadius: radius.pill,
                        backgroundColor: withOpacity(percentChange >= 0 ? success : danger, 0.15)
                      }}>
                        <Text style={{ color: percentChange >= 0 ? success : danger, fontWeight: '700', fontSize: 12 }}>
                          {percentChange >= 0 ? '▲' : '▼'} {Math.abs(percentChange).toFixed(1)}% vs prior
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Filters Row */}
              <View style={{ flexDirection: 'row', gap: spacing.s8, marginBottom: spacing.s4, alignItems: 'center' }}>
                <View ref={typeButtonRef} collapsable={false}>
                  <AnimatedPressable onPress={openTypeMenu}>
                    <View
                      style={{
                        paddingVertical: spacing.s8,
                        paddingHorizontal: spacing.s12,
                        borderRadius: radius.pill,
                        backgroundColor: filter !== 'all' ? (get('accent.primary') as string) : surface1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.s6
                      }}
                    >
                      <Icon name="filter" size={16} color={filter !== 'all' ? textOnPrimary : textPrimary} />
                    </View>
                  </AnimatedPressable>
                </View>

                <View ref={rangeButtonRef} collapsable={false}>
                  <AnimatedPressable onPress={openRangeMenu}>
                    <View
                      style={{
                        paddingVertical: spacing.s8,
                        paddingHorizontal: spacing.s12,
                        borderRadius: radius.pill,
                        backgroundColor: range !== 'ALL' ? (get('accent.primary') as string) : surface1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.s6
                      }}
                    >
                      <Icon name="calendar" size={16} color={range !== 'ALL' ? textOnPrimary : textPrimary} />
                    </View>
                  </AnimatedPressable>
                </View>

                <View ref={accountButtonRef} collapsable={false}>
                  <AnimatedPressable onPress={openAccountMenu}>
                    <View
                      style={{
                        paddingVertical: spacing.s8,
                        paddingHorizontal: spacing.s12,
                        borderRadius: radius.pill,
                        backgroundColor: accountFilter !== 'all' ? (get('accent.primary') as string) : surface1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.s6
                      }}
                    >
                      <Icon name="credit-card" size={16} color={accountFilter !== 'all' ? textOnPrimary : textPrimary} />
                    </View>
                  </AnimatedPressable>
                </View>

                <View style={{ flex: 1 }} />

                <AnimatedPressable onPress={() => setSearchOn((s) => !s)}>
                  <View
                    style={{
                      paddingVertical: spacing.s8,
                      paddingHorizontal: spacing.s12,
                      borderRadius: radius.pill,
                      backgroundColor: searchOn ? (get('accent.primary') as string) : surface1,
                    }}
                  >
                    <Icon
                      name={searchOn ? 'x' : 'search'}
                      size={16}
                      colorToken={searchOn ? 'text.onPrimary' : 'text.primary'}
                    />
                  </View>
                </AnimatedPressable>
              </View>

              <Animated.View
                style={{
                  height: searchHeightAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 52],
                  }),
                  opacity: searchHeightAnim,
                  overflow: 'hidden',
                }}
              >
                <View style={{ marginTop: spacing.s8 }}>
                  <Input
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search notes or categories"
                    style={{ margin: 0 }}
                  />
                </View>
              </Animated.View>
            </View>
          }
          renderItem={({ item }) => {
            const isCollapsed = !!collapsed[item.key];
            const displayTotal = totalMode === 'SPENT' ? item.totalSpent : item.totalNet;
            const isPositive = displayTotal >= 0;
            const dayIncome = item.data.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount || 0), 0);
            const dayExpense = item.data.filter(t => t.type !== 'income').reduce((a, t) => a + Number(t.amount || 0), 0);
            const hasLargeTransaction = item.data.some(t => Math.abs(Number(t.amount) || 0) >= 500);

            return (
              <View style={{
                marginHorizontal: spacing.s16,
                marginBottom: spacing.s12,
                borderRadius: radius.xl,
                backgroundColor: get('surface.level1') as string,
                borderWidth: 1,
                borderColor: get('border.subtle') as string,
                overflow: 'hidden'
              }}>
                {/* Card Header */}
                <AnimatedPressable
                  onPress={() => setCollapsed(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                >
                  <View style={{
                    paddingVertical: spacing.s16,
                    paddingHorizontal: spacing.s16,
                    backgroundColor: get('surface.level1') as string
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{
                            color: get('text.primary') as string,
                            fontWeight: '800',
                            fontSize: 17,
                            letterSpacing: -0.3
                          }}>
                            {item.title}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                            <Text style={{
                              color: get('text.muted') as string,
                              fontSize: 13,
                              fontWeight: '500'
                            }}>
                              {item.data.length} transaction{item.data.length !== 1 ? 's' : ''}
                            </Text>
                            {hasLargeTransaction && (
                              <>
                                <Text style={{ color: get('text.muted') as string }}>•</Text>
                                <View style={{
                                  paddingHorizontal: spacing.s6,
                                  paddingVertical: spacing.s2,
                                  borderRadius: radius.pill,
                                  backgroundColor: withOpacity(get('semantic.warning') as string, 0.15)
                                }}>
                                  <Text style={{
                                    color: get('semantic.warning') as string,
                                    fontSize: 10,
                                    fontWeight: '700'
                                  }}>
                                    Large txn
                                  </Text>
                                </View>
                              </>
                            )}
                          </View>
                        </View>
                        {(dayIncome > 0 || dayExpense > 0) && (
                          <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s6 }}>
                            {dayExpense > 0 && (
                              <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>
                                Spent: ${dayExpense.toFixed(2)}
                              </Text>
                            )}
                            {dayIncome > 0 && (
                              <Text style={{ color: get('semantic.success') as string, fontSize: 12, fontWeight: '600' }}>
                                Earned: +${dayIncome.toFixed(2)}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                      <View style={{ marginLeft: spacing.s8 }}>
                        <Icon
                          name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                          size={20}
                          colorToken="icon.default"
                        />
                      </View>
                    </View>
                  </View>
                </AnimatedPressable>
                {/* Card Body */}
                {!isCollapsed && item.data.length > 0 && (
                  <View>
                    {item.data.map((tx) => (
                      <Row key={tx.id} item={tx} onRemove={() => onDelete(tx)} onEdit={() => onEdit(tx)} />
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
        </View>
      </Animated.View>

      <PopoverMenu
        visible={typeMenuVisible}
        onClose={() => {
          setTypeMenuVisible(false);
        }}
        anchor={typeAnchor}
        items={TYPE_OPTIONS.map((opt) => ({
          key: opt.value,
          label: opt.value === filter ? `${opt.label} ✓` : opt.label,
          onPress: () => setFilter(opt.value),
        }))}
      />

      <PopoverMenu
        visible={rangeMenuVisible}
        onClose={() => {
          setRangeMenuVisible(false);
        }}
        anchor={rangeAnchor}
        items={RANGE_OPTIONS.map((opt) => ({
          key: opt.value,
          label: opt.value === range ? `${opt.label} ✓` : opt.label,
          onPress: () => setRange(opt.value),
        }))}
      />

      <PopoverMenu
        visible={accountMenuVisible}
        onClose={() => {
          setAccountMenuVisible(false);
        }}
        anchor={accountAnchor}
        items={accountOptions.map((opt) => ({
          key: opt.value,
          label: opt.value === accountFilter ? `${opt.label} ✓` : opt.label,
          onPress: () => setAccountFilter(opt.value),
        }))}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacing.s16,
    paddingTop: spacing.s12,
    paddingBottom: spacing.s4,
    gap: spacing.s16,
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.s16,
    gap: spacing.s16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s12,
  },
  heroHeaderText: {
    flex: 1,
    gap: spacing.s4,
  },
  heroIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.s12,
    paddingVertical: spacing.s8,
  },
  heroControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s10,
  },
  controlPill: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.s12,
    paddingVertical: spacing.s10,
    gap: spacing.s6,
    flexGrow: 1,
    minWidth: 140,
  },
  controlPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  controlPillValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s6,
  },
  controlPillValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  controlHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  searchContainer: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.s8,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: spacing.s12,
    flexWrap: 'wrap',
  },
  heroStatCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.s16,
    gap: spacing.s8,
    minWidth: 0,
  },
  heroStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroStatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  heroBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.s8,
    paddingVertical: spacing.s4,
  },
  heroBadgeInline: {
    alignSelf: 'flex-start',
    marginTop: spacing.s4,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  heroStatFootnote: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroSplitStat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s4,
  },
  heroSplitLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroSplitValue: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default Transactions;
