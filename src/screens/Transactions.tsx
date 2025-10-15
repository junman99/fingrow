import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '../components/Screen';
import Icon from '../components/Icon';
import Input from '../components/Input';
import PopoverMenu from '../components/PopoverMenu';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
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

const Row = ({ item, onRemove }: { item: Tx; onRemove: () => void }) => {
  const { get } = useThemeTokens();
  const isIncome = item.type === 'income';

  const renderRightActions = () => (
    <Pressable accessibilityRole="button" onPress={onRemove}>
      <View style={{ width: 88, height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: get('semantic.danger') as string }}>
        <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700' }}>Delete</Text>
      </View>
    </Pressable>
  );

  const d = new Date(item.date);

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <View style={{ paddingVertical: spacing.s12, paddingHorizontal: spacing.s16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: get('border.subtle') as string }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* left icon square */}
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: isIncome ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', marginRight: spacing.s12, alignItems:'center', justifyContent:'center' }}>
            <Text style={{ color: isIncome ? (get('semantic.success') as string) : (get('semantic.danger') as string), fontWeight: '700' }}>{(item.category || '').slice(0,1).toUpperCase()}</Text>
          </View>

          {/* middle */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: get('text.primary') as string, fontWeight: '700' }}>{item.note || item.category}</Text>
            <Text numberOfLines={1} style={{ color: get('text.muted') as string, marginTop: 2 }}>{isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.category || 'General'}</Text>
          </View>

          {/* right amount */}
          <Text style={{ color: isIncome ? (get('semantic.success') as string) : (get('semantic.danger') as string), fontWeight: '700' }}>{`${isIncome ? '+' : '-'}$${Math.abs(Number(item.amount) || 0).toFixed(2)}`}</Text>
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
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all'|'income'|'expense'>('all');
  const [range, setRange] = useState<'ALL'|'7D'|'30D'|'MONTH'|'CUSTOM'>('30D');
  const [search, setSearch] = useState('');
  const [searchOn, setSearchOn] = useState(false);
  const [totalMode, setTotalMode] = useState<'SPENT'|'NET'>('SPENT');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [typeAnchor, setTypeAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [rangeMenuVisible, setRangeMenuVisible] = useState(false);
  const [rangeAnchor, setRangeAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const typeButtonRef = useRef<View>(null);
  const rangeButtonRef = useRef<View>(null);
  const normalizedSearch = search.trim().toLowerCase();

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

  // Reset filters whenever this modal/screen gains focus
  useFocusEffect(useCallback(() => {
    setFilter('all');
    setRange('30D');
    setSearch('');
    setSearchOn(false);
    setTypeMenuVisible(false);
    setRangeMenuVisible(false);
    setTypeAnchor(null);
    setRangeAnchor(null);
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

    if (normalizedSearch.length > 0) {
      base = base.filter(t => (t.note || '').toLowerCase().includes(normalizedSearch) || (t.category || '').toLowerCase().includes(normalizedSearch));
    }

    return base;
  }, [transactions, filter, range, normalizedSearch]);

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
  const success = get('semantic.success') as string;
  const danger = get('semantic.danger') as string;
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
  const totalLabel = totalMode === 'SPENT' ? 'Spending' : 'Net movement';
  const listPaddingBottom = Math.max(insets.bottom, spacing.s4);

  const onDelete = async (tx: Tx) => {
    try { await remove(tx.id); } catch {}
  };

  return (
    <Screen inTab style={{ paddingBottom: 0 }}>
      {/* AppHeader removed; hero card now contains close + summary */}

      <View style={{ flex: 1 }}>
        <FlatList
          data={sectionsRaw}
          keyExtractor={(s) => s.key}
          bounces={false}
          contentContainerStyle={{ paddingBottom: listPaddingBottom }}
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroHeader}>
                  <View style={styles.heroHeaderText}>
                    <Text style={[styles.heroTitle, { color: heroForeground }]}>Transaction history</Text>
                    <Text style={[styles.heroSubtitle, { color: heroMuted }]}>
                      All accounts • {filtered.length} items
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSearchOn((s) => !s)}
                    style={({ pressed }) => [
                      styles.heroIconButton,
                      {
                        borderColor: heroControlBorder,
                        backgroundColor: searchOn ? heroControlActive : heroControlBg,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Icon name="filter" size={16} colorToken={heroIconToken} />
                    <Text style={{ color: heroForeground, fontWeight: '600', fontSize: 12 }}>
                      {searchOn ? 'Close search' : 'Search'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.heroControlsRow}>
                  <Pressable
                    onPress={() => setTotalMode((prev) => (prev === 'SPENT' ? 'NET' : 'SPENT'))}
                    style={({ pressed }) => [
                      styles.controlPill,
                      {
                        borderColor: heroControlBorder,
                        backgroundColor: heroControlActive,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.controlPillLabel, { color: heroTextFaint }]}>Totals</Text>
                    <View style={styles.controlPillValueRow}>
                      <Icon name="trending-up" size={16} colorToken={heroIconToken} />
                      <Text style={[styles.controlPillValue, { color: heroForeground }]}>{totalLabel}</Text>
                    </View>
                    <Text style={[styles.controlHint, { color: heroTextFaint }]}>Tap to switch view</Text>
                  </Pressable>

                  <View ref={typeButtonRef} collapsable={false} style={{ flexGrow: 1, minWidth: 140 }}>
                    <Pressable
                      onPress={openTypeMenu}
                      style={({ pressed }) => [
                        styles.controlPill,
                        {
                          borderColor: heroControlBorder,
                          backgroundColor: filter === 'all' ? heroControlBg : heroControlActive,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.controlPillLabel, { color: heroTextFaint }]}>Type</Text>
                      <View style={styles.controlPillValueRow}>
                        <Icon name="filter" size={16} colorToken={heroIconToken} />
                        <Text style={[styles.controlPillValue, { color: heroForeground }]}>{typeLabel}</Text>
                      </View>
                    </Pressable>
                  </View>

                  <View ref={rangeButtonRef} collapsable={false} style={{ flexGrow: 1, minWidth: 140 }}>
                    <Pressable
                      onPress={openRangeMenu}
                      style={({ pressed }) => [
                        styles.controlPill,
                        {
                          borderColor: heroControlBorder,
                          backgroundColor: range === 'ALL' ? heroControlBg : heroControlActive,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.controlPillLabel, { color: heroTextFaint }]}>Range</Text>
                      <View style={styles.controlPillValueRow}>
                        <Icon name="history" size={16} colorToken={heroIconToken} />
                        <Text style={[styles.controlPillValue, { color: heroForeground }]}>{rangeLabel}</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                {searchOn ? (
                  <View style={[styles.searchContainer, { backgroundColor: searchContainerBg, borderColor: heroControlBorder }]}>
                    <Input value={search} onChangeText={setSearch} placeholder="Search notes or categories" style={{ margin: 0 }} />
                  </View>
                ) : null}

                <View style={styles.heroStatsRow}>
                  <View style={[styles.heroStatCard, { backgroundColor: heroTileBg, borderColor: heroControlBorder }]}>
                    <Text style={[styles.heroStatLabel, { color: heroMuted }]}>Net movement</Text>
                    {typeof percentChange === 'number' ? (
                      <View
                        style={[
                          styles.heroBadge,
                          styles.heroBadgeInline,
                          { backgroundColor: percentChange >= 0 ? successSoft : dangerSoft }
                        ]}
                      >
                        <Text style={[styles.heroBadgeText, { color: heroForeground }]}>
                          {`${percentChange >= 0 ? '▲' : '▼'} ${Math.abs(percentChange).toFixed(1)}%`}
                        </Text>
                      </View>
                    ) : null}
                    <Text style={[styles.heroStatValue, { color: heroForeground }]}>
                      {`${netTotal >= 0 ? '+' : '-'}$${Math.abs(netTotal).toFixed(2)}`}
                    </Text>
                    <View style={[styles.heroDivider, { backgroundColor: heroDivider }]} />
                    <Text style={[styles.heroStatFootnote, { color: heroMuted }]}>
                      Average ticket {avgTxn ? `$${avgTxn.toFixed(2)}` : '—'}
                    </Text>
                  </View>

                  <View style={[styles.heroStatCard, { backgroundColor: heroTileBg, borderColor: heroControlBorder }]}>
                    <View style={styles.heroStatTopRow}>
                      <Text style={[styles.heroStatLabel, { color: heroMuted }]}>Income vs spend</Text>
                    </View>
                    <View style={styles.heroSplitStat}>
                      <Text style={[styles.heroSplitLabel, { color: heroMuted }]}>Income</Text>
                      <Text style={[styles.heroSplitValue, { color: heroForeground }]}>
                        ${incomeTotal.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.heroDivider, { backgroundColor: heroDivider }]} />
                    <View style={styles.heroSplitStat}>
                      <Text style={[styles.heroSplitLabel, { color: heroMuted }]}>Spending</Text>
                      <Text style={[styles.heroSplitValue, { color: heroForeground }]}>
                        ${expenseTotal.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.heroDivider, { backgroundColor: heroDivider }]} />
                    <Text style={[styles.heroStatFootnote, { color: heroMuted }]}>
                      {filtered.length} transactions
                    </Text>
                  </View>
                </View>

              </LinearGradient>
            </View>
          }
          renderItem={({ item }) => {
            const isCollapsed = !!collapsed[item.key];
            const displayTotal = totalMode === 'SPENT' ? item.totalSpent : item.totalNet;
            const isPositive = displayTotal >= 0;
            return (
              <View style={{ marginHorizontal: spacing.s16, marginBottom: spacing.s12, borderRadius: radius.lg, backgroundColor: get('surface.level1') as string }}>
                {/* Card Header */}
                <Pressable onPress={() => setCollapsed(prev => ({ ...prev, [item.key]: !prev[item.key] }))}>
                  <View style={{ paddingVertical: spacing.s12, paddingHorizontal: spacing.s16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16 }}>{item.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                        <Text style={{ color: isPositive ? (totalMode==='NET' ? (get('semantic.success') as string) : (get('text.primary') as string)) : (get('semantic.danger') as string), fontWeight: '700' }}>
                          {totalMode==='SPENT'
                            ? `-$${Math.abs(displayTotal).toFixed(2)}`
                            : `${isPositive ? '+' : '-'}$${Math.abs(displayTotal).toFixed(2)}`}
                        </Text>
                        <Text style={{ color: get('icon.default') as string, transform: [{ rotate: (!!collapsed[item.key]) ? '180deg' : '0deg' }] }}>⌄</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
                {/* Divider when expanded and has items */}
                {!isCollapsed && item.data.length > 0 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: get('border.subtle') as string, marginHorizontal: spacing.s16 }} />
                ) : null}
                {/* Card Body */}
                {!isCollapsed && item.data.length > 0 ? (
                  <View>
                    {item.data.map((tx) => (
                      <Row key={tx.id} item={tx} onRemove={() => onDelete(tx)} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      </View>

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
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacing.s16,
    paddingTop: spacing.s12,
    paddingBottom: spacing.s16,
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
    borderRadius: radius.lg,
    padding: spacing.s12,
    gap: spacing.s8,
    borderWidth: 1,
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
