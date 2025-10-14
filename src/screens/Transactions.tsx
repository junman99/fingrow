import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { Screen } from '../components/Screen';
import Icon from '../components/Icon';
import Input from '../components/Input';
import Sparkline from '../components/Sparkline';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius, elevation } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { Swipeable } from 'react-native-gesture-handler';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

type Tx = ReturnType<typeof useTxStore.getState>['transactions'][number];

type Section = {
  key: string;
  title: string;
  data: Tx[];
  totalSpent: number;
  totalNet: number;
};

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
  const nav = useNavigation<any>();
  const { get } = useThemeTokens();
  const { transactions, remove } = useTxStore();
  const [filter, setFilter] = useState<'all'|'income'|'expense'>('all');
  const [range, setRange] = useState<'ALL'|'7D'|'30D'|'MONTH'|'CUSTOM'>('ALL');
  const [search, setSearch] = useState('');
  const [searchOn, setSearchOn] = useState(false);
  const [totalMode, setTotalMode] = useState<'SPENT'|'NET'>('SPENT');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const listRef = useRef<FlatList<Section>>(null);

  // Reset filters whenever this modal/screen gains focus
  useFocusEffect(useCallback(() => {
    setFilter('all');
    setRange('ALL');
    setSearch('');
    setSearchOn(false);
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

    const q = search.trim().toLowerCase();
    if (q.length > 0) {
      base = base.filter(t => (t.note || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q));
    }

    return base;
  }, [transactions, filter, range, search]);

  const sectionsRaw = useMemo(() => groupByDate(filtered), [filtered]);

  // Summary metrics for the hero card
  const incomeTotal = useMemo(() => filtered.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount || 0), 0), [filtered]);
  const expenseTotal = useMemo(() => filtered.filter(t => t.type !== 'income').reduce((a, t) => a + Number(t.amount || 0), 0), [filtered]);
  const netTotal = useMemo(() => incomeTotal - expenseTotal, [incomeTotal, expenseTotal]);
  const avgTxn = useMemo(() => filtered.length ? (filtered.reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0) / filtered.length) : 0, [filtered]);
  const topCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of filtered) counts[t.category || 'General'] = (counts[t.category || 'General'] || 0) + 1;
    const entries = Object.entries(counts).sort((a,b)=> b[1]-a[1]);
    return entries[0]?.[0] || '—';
  }, [filtered]);

  // 7-day sparkline / trend: build daily totals for last 7 days
  const sparkData = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const key = d.toISOString().slice(0,10);
      return { key, date: d };
    });
    const map: Record<string, number> = {};
    for (const t of filtered) {
      const k = new Date(t.date).toISOString().slice(0,10);
      if (k in map) map[k] += Math.abs(Number(t.amount || 0));
      else map[k] = Math.abs(Number(t.amount || 0));
    }
    return days.map(d => map[d.key] || 0);
  }, [filtered]);

  // percent change vs previous 7-day window
  const percentChange = useMemo(() => {
    const now = new Date();
    const curr = sparkData.reduce((a,v)=>a+v,0);
    // previous 7 days
    const prevMap: Record<string, number> = {};
    for (const t of transactions) {
      const dd = new Date(t.date);
      const daysAgo = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()).getTime())/(24*60*60*1000));
      if (daysAgo >= 7 && daysAgo < 14) {
        const k = new Date(t.date).toISOString().slice(0,10);
        prevMap[k] = (prevMap[k] || 0) + Math.abs(Number(t.amount || 0));
      }
    }
    const prev = Object.values(prevMap).reduce((a,b)=>a+b,0);
    if (prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  }, [sparkData, transactions]);

  const onDelete = async (tx: Tx) => {
    try { await remove(tx.id); } catch {}
  };

  return (
    <Screen>
      {/* AppHeader removed; hero card now contains close + summary */}

      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef as any}
          data={sectionsRaw}
          keyExtractor={(s) => s.key}
          bounces={false}
          ListHeaderComponent={
          <View style={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s8, paddingTop: spacing.s8 }}>
            {/* Hero card */}
            <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: get('surface.level1') as string, ...elevation.level1 as any }}>
            <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, paddingBottom: spacing.s12, backgroundColor: get('surface.level1') as string }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.s12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: get('text.primary') as string, fontWeight: '800', fontSize: 18 }}>Transactions</Text>
                  <Text style={{ color: get('text.muted') as string, marginTop: 2 }}>All accounts • {filtered.length} items</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                  <Pressable onPress={() => { /* export placeholder */ }} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 10, backgroundColor: get('surface.level2') as string, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
                    <Icon name="archive" size={16} colorToken="icon.muted" />
                  </Pressable>
                  <Pressable onPress={() => nav.navigate('Add')} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 10, backgroundColor: get('accent.primary') as string, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.9 : 1 })}>
                    <Icon name="plus" size={16} colorToken="text.onPrimary" />
                  </Pressable>
                  <Pressable onPress={() => nav.goBack()} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 10, backgroundColor: get('surface.level2') as string, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
                    <Icon name="chevron-left" size={18} colorToken="icon.muted" />
                  </Pressable>
                </View>
              </View>

              {/* Useful stats row */}
              <View style={{ marginTop: spacing.s12, flexDirection: 'column', gap: spacing.s12 }}>
                <View style={{ flexDirection: 'row', gap: spacing.s12, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>Net</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: netTotal >= 0 ? (get('semantic.success') as string) : (get('semantic.danger') as string), fontWeight: '800', fontSize: 16 }}>{`${netTotal >= 0 ? '+' : '-'}$${Math.abs(netTotal).toFixed(2)}`}</Text>
                    {typeof percentChange === 'number' ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: percentChange >= 0 ? (get('semantic.success') as string) : (get('semantic.danger') as string) }}>
                        <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 12 }}>{`${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(0)}%`}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>Income</Text>
                  <Text style={{ color: get('semantic.success') as string, fontWeight: '800' }}>{`$${incomeTotal.toFixed(2)}`}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>Expense</Text>
                  <Text style={{ color: get('semantic.danger') as string, fontWeight: '800' }}>{`$${expenseTotal.toFixed(2)}`}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>Avg</Text>
                  <Text style={{ color: get('text.primary') as string, fontWeight: '800' }}>{`$${avgTxn.toFixed(2)}`}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>Top</Text>
                  <Text style={{ color: get('text.primary') as string, fontWeight: '800' }}>{topCategory}</Text>
                </View>
                </View>

                {/* Sparkline */}
                <View style={{ paddingHorizontal: spacing.s4 }}>
                  <Sparkline data={sparkData} color={get('accent.primary') as string} height={36} />
                </View>
              </View>
              </View>
            </View>

            {/* Total mode toggle */}
            <View style={{ flexDirection: 'row', gap: spacing.s8, marginBottom: spacing.s8 }}>
              {(['SPENT','NET'] as const).map(m => (
                <Pressable key={m} onPress={() => setTotalMode(m)}>
                  <View style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s6, borderRadius: radius.pill, backgroundColor: totalMode===m ? (get('accent.soft') as string) : (get('surface.level2') as string) }}>
                    <Text style={{ color: totalMode===m ? (get('accent.primary') as string) : (get('text.muted') as string), fontWeight: totalMode===m ? '700' : '500' }}>{m === 'SPENT' ? 'Spent Only' : 'Net'}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Filter chips */}
            <View style={{ flexDirection: 'row', gap: spacing.s8, flexWrap: 'wrap', marginBottom: spacing.s8 }}>
              {(['All','Income','Expense'] as const).map(lbl => {
                const active = (filter === 'all' && lbl==='All') || (filter==='income' && lbl==='Income') || (filter==='expense' && lbl==='Expense');
                return (
                  <Pressable key={lbl} onPress={() => setFilter(lbl.toLowerCase() as any)}>
                    <View style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s6, borderRadius: radius.pill, backgroundColor: active ? (get('accent.soft') as string) : (get('surface.level2') as string) }}>
                      <Text style={{ color: active ? (get('accent.primary') as string) : (get('text.muted') as string), fontWeight: active ? '700' : '500' }}>{lbl}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Top categories (compact) */}
            <View style={{ marginBottom: spacing.s8 }}>
              <Text style={{ color: get('text.muted') as string, fontSize: 12, marginBottom: spacing.s6 }}>Top categories</Text>
              <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                {(() => {
                  const cats: [string, number][] = Object.entries(filtered.reduce((acc:any, t)=> { acc[t.category||'General'] = (acc[t.category||'General']||0) + Math.abs(Number(t.amount||0)); return acc; }, {})).sort((a:any,b:any)=> b[1]-a[1]).slice(0,3);
                  const total = cats.reduce((a,c)=>a+c[1],0) || 1;
                  return cats.map(([name, amt]) => (
                    <View key={name} style={{ flex: 1 }}>
                      <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: get('surface.level2') as string, overflow: 'hidden' }}>
                          <View style={{ width: `${Math.round((amt/total)*100)}%`, height: 8, backgroundColor: get('accent.primary') as string }} />
                        </View>
                        <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>{`$${amt.toFixed(0)}`}</Text>
                      </View>
                    </View>
                  ));
                })()}
              </View>
            </View>

            {/* Range chips */}
            <View style={{ flexDirection: 'row', gap: spacing.s8, flexWrap: 'wrap', marginBottom: spacing.s8 }}>
              {(['ALL','7D','30D','MONTH','CUSTOM'] as const).map(lbl => {
                const active = (range === lbl);
                return (
                  <Pressable key={lbl} onPress={() => setRange(lbl)}>
                    <View style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s6, borderRadius: radius.pill, backgroundColor: active ? (get('accent.soft') as string) : (get('surface.level2') as string) }}>
                      <Text style={{ color: active ? (get('accent.primary') as string) : (get('text.muted') as string), fontWeight: active ? '700' : '500' }}>{lbl === 'MONTH' ? 'This Month' : lbl}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Search toggle + field */}
            <View style={{ flexDirection: 'row', gap: spacing.s8, alignItems: 'center' }}>
              <Pressable onPress={() => setSearchOn(s => !s)}>
                <Text style={{ color: get('accent.primary') as string, fontWeight: '600' }}>{searchOn ? 'Hide search' : 'Search'}</Text>
              </Pressable>
                {searchOn ? (
                  <View style={{ flex: 1 }}>
                    <Input value={search} onChangeText={setSearch} placeholder="Search notes or categories" />
                  </View>
                ) : null}
              </View>
            </View>
          }
          onViewableItemsChanged={({ viewableItems }) => {
            const first = viewableItems.find(v => (v as any).item && (v as any).index === 0);
            const sec = (first?.item as any);
            if (sec?.key) {
              const d = new Date(sec.key);
              const label = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
              setCurrentMonth(label);
            }
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
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

      {/* Month jump pill */}
      {currentMonth ? (
        <View style={{ position: 'absolute', top: spacing.s8 + 44, right: spacing.s16 }}>
          <Pressable onPress={() => setMonthPickerOpen(s => !s)}>
            <View style={{ backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s6, borderRadius: radius.pill }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>{currentMonth}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {/* Month picker overlay */}
      {monthPickerOpen ? (
        <View style={{ position: 'absolute', top: 90, right: spacing.s16, backgroundColor: get('surface.level2') as string, borderRadius: radius.lg, padding: spacing.s8 }}>
          {Array.from(new Set(sectionsRaw.map(s => new Date(s.key).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })))).map((m) => (
            <Pressable key={m} onPress={() => {
              setMonthPickerOpen(false);
              const idx = sectionsRaw.findIndex(s => new Date(s.key).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) === m);
              if (idx >= 0) {
                listRef.current?.scrollToIndex({ index: idx, viewOffset: 0, animated: true });
              }
            }}>
              <View style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.md }}>
                <Text style={{ color: get('text.primary') as string }}>{m}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
};

export default Transactions;
