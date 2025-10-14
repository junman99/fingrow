import React from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import TransactionRow from '../components/invest/TransactionRow';
import TransactionEditorSheet from '../components/invest/TransactionEditorSheet';
import { useInvestStore } from '../store/invest';
import { computePnL } from '../lib/positions';
import { formatCurrency } from '../lib/format';
import { exportHoldingTxCsv } from '../lib/export';

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
  const cur = (p?.baseCurrency || 'USD').toUpperCase();

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
        contentContainerStyle={{ padding: spacing.s16, gap: spacing.s16 }}
      >
        {/* Hero header */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: get('surface.level2') as string }}>
                <Text style={{ fontSize: 26, fontWeight: '900', color: get('text.primary') as string }}>{symbol?.slice(0,1)}</Text>
              </View>
              <View>
                <Text style={{ color: text, fontWeight: '900', fontSize: 20 }}>{symbol}</Text>
                <Text style={{ color: muted }}>Transaction History</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Export CSV"
                onPress={async () => { try { if (portfolioId) await exportHoldingTxCsv(portfolioId, symbol); } catch {} }}
                style={({ pressed }) => ({ height: 40, paddingHorizontal: spacing.s12, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}
              >
                <Text style={{ color: text, fontWeight: '700' }}>Export CSV</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add transaction"
                onPress={() => { setEditLotState(null); setShowTxSheet(true); }}
                style={({ pressed }) => ({
                  height: 40,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.primary.bg') as string),
                })}
              >
                <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700' }}>Add</Text>
              </Pressable>
            </View>
          </View>

          {/* Quick stats */}
          <View style={{ marginTop: spacing.s12, flexDirection: 'row', gap: spacing.s12, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: get('text.muted') as string }}>Total transactions</Text>
              <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>{lots.length}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: get('text.muted') as string }}>Realized / Unrealized</Text>
              <Text style={{ color: (pnl.realized >= 0 ? get('semantic.success') : get('semantic.danger')) as string, fontWeight: '800' }}>{formatCurrency(pnl.realized, cur)} / {formatCurrency(pnl.unrealized, cur)}</Text>
            </View>
          </View>
        </Card>

        {/* Summary */}
        <Card>
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontWeight: '800' }}>Summary</Text>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: get('text.muted') as string }}>Shares</Text>
              <Text style={{ color: text, fontWeight:'700' }}>{pnl.qty}</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: get('text.muted') as string }}>Average cost</Text>
              <Text style={{ color: text }}>{formatCurrency(pnl.avgCost, cur)}</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: get('text.muted') as string }}>Market value</Text>
              <Text style={{ color: text }}>{formatCurrency((pnl.qty || 0) * (Number(last) || 0), cur)}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: get('border.subtle') as string, marginVertical: spacing.s4 }} />
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: get('text.muted') as string }}>Realized P&L</Text>
              <Text style={{ color: (pnl.realized >= 0 ? get('semantic.success') : get('semantic.danger')) as string, fontWeight:'700' }}>{formatCurrency(pnl.realized, cur)}</Text>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: get('text.muted') as string }}>Unrealized P&L</Text>
              <Text style={{ color: (pnl.unrealized >= 0 ? get('semantic.success') : get('semantic.danger')) as string, fontWeight:'700' }}>{formatCurrency(pnl.unrealized, cur)}</Text>
            </View>
          </View>
        </Card>

        {/* Filters */}
        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          {(['all','buys','sells'] as const).map(k => (
            <Pressable key={k} accessibilityRole="button" onPress={() => setFilter(k)}
              style={({ pressed }) => ({ paddingHorizontal: spacing.s12, paddingVertical: spacing.s6, borderRadius: radius.pill, borderWidth: 1, borderColor: get('component.button.secondary.border') as string, backgroundColor: filter===k ? (get('accent.primary') as string) : (pressed ? (get('surface.level2') as string) : (get('surface.level1') as string)) })}>
              <Text style={{ color: filter===k ? (get('text.onPrimary') as string) : text, fontWeight:'700', textTransform:'capitalize' }}>{k}</Text>
            </Pressable>
          ))}
        </View>

        {/* Transactions grouped by month */}
        {monthGroups.length === 0 ? (
          <Card>
            <Text style={{ color: muted }}>No transactions yet.</Text>
          </Card>
        ) : (
          monthGroups.map(group => (
            <Card key={group.key} padding={0}>
              <View style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s12, gap: spacing.s6 }}>
                <Text style={{ color: text, fontWeight:'800' }}>{(() => {
                  const [y,m] = group.key.split('-').map((x:string)=> Number(x));
                  const d = new Date(y, (m||1)-1, 1);
                  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
                })()}</Text>
                {(() => {
                  const totals = group.items.reduce((acc:any, l:any) => {
                    const fee = Number((l.fee ?? l.fees) || 0);
                    const gross = Number(l.qty) * Number(l.price);
                    if (l.side === 'buy') { acc.bq += Number(l.qty)||0; acc.bv += gross + fee; }
                    else { acc.sq += Number(l.qty)||0; acc.sv += gross - fee; }
                    return acc;
                  }, { bq:0, bv:0, sq:0, sv:0 });
                  const net = totals.sv - totals.bv; // positive means net inflow
                  return (
                    <View style={{ flexDirection:'row', gap: spacing.s12, flexWrap:'wrap' }}>
                      <Text style={{ color: get('text.muted') as string }}>Buys: {totals.bq} • {formatCurrency(totals.bv, cur)}</Text>
                      <Text style={{ color: get('text.muted') as string }}>Sells: {totals.sq} • {formatCurrency(totals.sv, cur)}</Text>
                      <Text style={{ color: (net >= 0 ? (get('semantic.success') as string) : (get('semantic.danger') as string)), fontWeight:'700' }}>Net: {formatCurrency(net, cur)}</Text>
                    </View>
                  );
                })()}
              </View>
              {group.items.map((l: any, i: number) => (
                <View key={l.id || i}>
                  <TransactionRow lot={l} currency={cur} onEdit={onEditLot} onDelete={onDeleteLot} />
                  {i < group.items.length - 1 ? <View style={{ height: 1, backgroundColor: get('border.subtle') as string }} /> : null}
                </View>
              ))}
            </Card>
          ))
        )}
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
