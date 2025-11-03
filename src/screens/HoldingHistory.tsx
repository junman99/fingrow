import React from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { Screen } from '../components/Screen';
import TransactionRow from '../components/invest/TransactionRow';
import TransactionEditorSheet from '../components/invest/TransactionEditorSheet';
import { useInvestStore } from '../store/invest';
import { computePnL } from '../lib/positions';
import { formatCurrency } from '../lib/format';
import { exportHoldingTxCsv } from '../lib/export';
import Icon from '../components/Icon';

export default function HoldingHistory() {
  const { get } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const store = useInvestStore() as any;

  const symbol = route.params?.symbol as string;
  const portfolioId = route.params?.portfolioId as (string | undefined);

  const { portfolios = {}, holdings = {} } = store;
  const p = portfolioId ? portfolios[portfolioId] : null;
  const holding = portfolioId ? (p?.holdings?.[symbol]) : (holdings?.[symbol]);

  // Get ticker's NATIVE currency (not portfolio base currency!)
  const cur = React.useMemo(() => {
    // Priority: holding metadata, then infer from symbol
    if (holding?.currency) return holding.currency.toUpperCase();

    const s = symbol.toUpperCase();
    if (s.includes('-USD') || s.includes('USD')) return 'USD';
    if (s.endsWith('.L')) return 'GBP';
    if (s.endsWith('.T')) return 'JPY';
    if (s.endsWith('.TO')) return 'CAD';
    if (s.endsWith('.AX')) return 'AUD';
    if (s.endsWith('.HK')) return 'HKD';
    if (s.endsWith('.PA') || s.endsWith('.DE')) return 'EUR';
    if (s.endsWith('.SW')) return 'CHF';
    return 'USD'; // Default for US stocks
  }, [symbol, holding?.currency]);

  const lotsRaw = (holding?.lots ?? []) as any[];
  const lots = React.useMemo(() => {
    const arr = lotsRaw;
    // newest first
    return [...arr].sort((a, b) => (new Date(b.date).getTime()) - (new Date(a.date).getTime()));
  }, [lotsRaw]);

  // Summary header (PnL)
  const last = (store.quotes?.[symbol]?.last ?? 0) as number;
  const pnl = React.useMemo(() => {
    // normalize fee/fees before computing
    const norm = lotsRaw.map((l: any) => ({ ...l, fee: (l.fee ?? l.fees) })) as any[];
    return computePnL(norm as any, Number(last) || 0);
  }, [lotsRaw, last]);

  // Filters
  const [filter, setFilter] = React.useState<'all'|'buys'|'sells'>('all');
  const filteredLots = React.useMemo(() => {
    if (filter === 'all') return lots;
    return lots.filter(l => (filter === 'buys' ? l.side === 'buy' : l.side === 'sell'));
  }, [lots, filter]);

  // Group by month (YYYY-MM)
  const monthGroups = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredLots.forEach(l => {
      const d = new Date(l.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });
    // keep keys sorted desc by month
    const keys = Object.keys(groups).sort((a,b)=> b.localeCompare(a));
    return keys.map(k => ({ key: k, items: groups[k] }));
  }, [filteredLots]);

  const [showTxSheet, setShowTxSheet] = React.useState(false);
  const [editLotState, setEditLotState] = React.useState<{ id: string; lot: any } | null>(null);

  const onEditLot = (lot: any) => { setEditLotState({ id: lot.id, lot }); setShowTxSheet(true); };
  const onDeleteLot = async (lot: any) => { try { await store.removeLot(symbol, lot.id, { portfolioId }); } catch {} };

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;

  return (
    <Screen>
      <ScrollView
        alwaysBounceVertical={Platform.OS === 'ios'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: spacing.s24 }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s12 }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 28, letterSpacing: -0.5 }}>{symbol}</Text>
          <Text style={{ color: muted, fontSize: 14, marginTop: spacing.s2 }}>Transaction History</Text>
        </View>


        {/* Summary Cards */}
        <View style={{ paddingHorizontal: spacing.s16, marginBottom: spacing.s16 }}>
          <View style={{ flexDirection: 'row', gap: spacing.s8, marginBottom: spacing.s8 }}>
            <View style={{ flex: 1, backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12 }}>
              <Text style={{ color: muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.s4 }}>Shares</Text>
              <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>{pnl.qty}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12 }}>
              <Text style={{ color: muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.s4 }}>Avg Cost</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>{pnl.avgCost.toFixed(2)}</Text>
                <Text style={{ color: muted, fontSize: 12, marginLeft: 3, fontWeight: '600' }}>{cur}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <View style={{ flex: 1, backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12 }}>
              <Text style={{ color: muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.s4 }}>Realized</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ color: (pnl.realized >= 0 ? get('semantic.success') : get('semantic.danger')) as string, fontSize: 18, fontWeight: '800' }}>
                  {pnl.realized.toFixed(2)}
                </Text>
                <Text style={{ color: muted, fontSize: 12, marginLeft: 3, fontWeight: '600' }}>{cur}</Text>
              </View>
            </View>
            <View style={{ flex: 1, backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12 }}>
              <Text style={{ color: muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.s4 }}>Unrealized</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ color: (pnl.unrealized >= 0 ? get('semantic.success') : get('semantic.danger')) as string, fontSize: 18, fontWeight: '800' }}>
                  {pnl.unrealized.toFixed(2)}
                </Text>
                <Text style={{ color: muted, fontSize: 12, marginLeft: 3, fontWeight: '600' }}>{cur}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Filters and Actions */}
        <View style={{ paddingHorizontal: spacing.s16, marginBottom: spacing.s16, flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
          <View style={{ flexDirection: 'row', gap: spacing.s6, flex: 1 }}>
            {(['all','buys','sells'] as const).map(k => (
              <Pressable
                key={k}
                onPress={() => setFilter(k)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s16,
                  paddingVertical: spacing.s8,
                  borderRadius: radius.pill,
                  backgroundColor: filter === k ? (get('accent.primary') as string) : (get('surface.level1') as string),
                  opacity: pressed ? 0.8 : 1
                })}
              >
                <Text style={{ color: filter === k ? (get('text.onPrimary') as string) : text, fontWeight: '700', textTransform: 'capitalize', fontSize: 14 }}>
                  {k}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => { setEditLotState(null); setShowTxSheet(true); }}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: get('component.button.primary.bg') as string,
              opacity: pressed ? 0.9 : 1
            })}
          >
            <Icon name="plus" size={20} colorToken="text.onPrimary" />
          </Pressable>

          <Pressable
            onPress={async () => { try { if (portfolioId) await exportHoldingTxCsv(portfolioId, symbol); } catch {} }}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: get('surface.level1') as string,
              opacity: pressed ? 0.9 : 1
            })}
          >
            <Icon name="download" size={20} color={text} />
          </Pressable>
        </View>

        {/* Transactions grouped by month */}
        <View style={{ paddingHorizontal: spacing.s16 }}>
          {monthGroups.length === 0 ? (
            <View style={{
              backgroundColor: get('surface.level1') as string,
              borderRadius: radius.lg,
              padding: spacing.s20,
              alignItems: 'center'
            }}>
              <Text style={{ color: text, fontWeight: '700', fontSize: 15, marginBottom: spacing.s4 }}>No transactions yet</Text>
              <Text style={{ color: muted, fontSize: 13, textAlign: 'center' }}>Add your first transaction to start tracking</Text>
            </View>
          ) : (
            monthGroups.map(group => (
              <View key={group.key} style={{ marginBottom: spacing.s16 }}>
                <View style={{ marginBottom: spacing.s8 }}>
                  <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>
                    {(() => {
                      const [y, m] = group.key.split('-').map((x: string) => Number(x));
                      const d = new Date(y, (m || 1) - 1, 1);
                      return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
                    })()}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s4 }}>
                    {(() => {
                      const totals = group.items.reduce((acc: any, l: any) => {
                        const fee = Number((l.fee ?? l.fees) || 0);
                        const gross = Number(l.qty) * Number(l.price);
                        if (l.side === 'buy') { acc.bq += Number(l.qty) || 0; acc.bv += gross + fee; }
                        else { acc.sq += Number(l.qty) || 0; acc.sv += gross - fee; }
                        return acc;
                      }, { bq: 0, bv: 0, sq: 0, sv: 0 });
                      return (
                        <>
                          <Text style={{ color: muted, fontSize: 12 }}>
                            {group.items.length} {group.items.length === 1 ? 'transaction' : 'transactions'}
                          </Text>
                        </>
                      );
                    })()}
                  </View>
                </View>
                <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, overflow: 'hidden' }}>
                  {group.items.map((l: any, i: number) => (
                    <View key={l.id || i}>
                      <TransactionRow lot={l} currency={cur} symbol={symbol} onEdit={onEditLot} onDelete={onDeleteLot} />
                      {i < group.items.length - 1 ? <View style={{ height: 1, backgroundColor: get('border.subtle') as string, marginHorizontal: spacing.s16 }} /> : null}
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TransactionEditorSheet
        visible={showTxSheet}
        onClose={() => { setShowTxSheet(false); setEditLotState(null); }}
        symbol={symbol}
        portfolioId={portfolioId || null}
        mode={editLotState ? 'edit' : 'add'}
        lotId={editLotState?.id || undefined}
        initial={editLotState ? { side: editLotState.lot.side, qty: editLotState.lot.qty, price: editLotState.lot.price, fees: editLotState.lot.fees, date: editLotState.lot.date } : undefined}
      />
    </Screen>
  );
}
