import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { Screen } from '../components/Screen';
// FinGrow TODO: Avoid nesting FlatList inside ScreenScroll; prefer FlatList as primary scroller.
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { Card } from '../components/Card';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { useAccountsStore } from '../store/accounts';
import { useInvestStore } from '../store/invest';
import { formatCurrency } from '../lib/format';
import { useNavigation } from '@react-navigation/native';
import { useRecurringStore, computeNextDue, Recurring } from '../store/recurring';
import { usePlansStore } from '../store/plans';
import { useDebtsStore } from '../store/debts';
import { useTxStore } from '../store/transactions';

type Segment = 'Summary' | 'Accounts' | 'Portfolio' | 'Debts';

const Segmented: React.FC<{ value: Segment; onChange: (s: Segment)=>void }> = ({ value, onChange }) => {
  const { get } = useThemeTokens();
  const bg = get('surface.level2') as string;
  const active = (get('component.chip.active.bg') as string) || (get('accent.primary') as string);
  const activeText = get('text.onPrimary') as string;
  const text = get('text.muted') as string;
  const outline = get('border.subtle') as string;
  return (
    <View style={{ flexDirection: 'row', backgroundColor: bg, padding: spacing.s4, borderRadius: radius.pill, alignSelf: 'center', borderWidth: 1, borderColor: outline }}>
      {(['Summary','Accounts','Portfolio','Debts'] as Segment[]).map(seg => {
        const isOn = value === seg;
        return (
          <Pressable accessibilityRole="button" key={seg} onPress={()=>onChange(seg)} hitSlop={12} style={({pressed}) => ({
            paddingVertical: spacing.s8, paddingHorizontal: spacing.s16, borderRadius: radius.pill,
            backgroundColor: isOn ? active : 'transparent', opacity: pressed ? 0.9 : 1
          })}>
            <Text style={{ color: isOn ? activeText : text, fontWeight: '700' }}>{seg}</Text>
          </Pressable>
        )
      })}
    </View>
  );
};

function sumUpcoming(recurring: Recurring[], now: Date, withinDays: number) {
  const cutoff = new Date(now.getTime() + withinDays*24*60*60*1000);
  let total = 0;
  const list: { id: string; label: string; amount: number; due: Date }[] = [];
  for (const r of recurring) {
    const due = computeNextDue(r, now);
    if (due && due <= cutoff) {
      total += Number(r.amount||0);
      list.push({ id: r.id, label: r.label || r.category, amount: r.amount, due });
    }
  }
  list.sort((a,b)=> a.due.getTime() - b.due.getTime());
  return { total, list };
}

const Money: React.FC = () => {
  const nav = useNavigation<any>();
  const { get } = useThemeTokens();
  const [seg, setSeg] = useState<Segment>('Summary');
  const { accounts, hydrate: hydrateAcc } = useAccountsStore();
  const { holdings, quotes, hydrate, refreshQuotes, fxRates } = useInvestStore();
  const { items: recurring, hydrate: hydrateRecur } = useRecurringStore();
  const { plan, hydrate: hydratePlan } = usePlansStore();
  const { transactions, hydrate: hydrateTx } = useTxStore();

  useEffect(()=>{ hydrateAcc(); hydrate(); hydrateRecur(); hydrateTx(); hydratePlan(); },[]);

  const muted = get('text.muted') as string;
  const text = get('text.primary') as string;
  const onSurface = get('text.onSurface') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;

// Debts
const { items: debts, hydrate: hydrateDebts } = useDebtsStore();
useEffect(()=>{ hydrateDebts(); },[]);

      // Cash
const avgDaily = useMemo(()=>{
  if (!transactions || transactions.length===0) return 0;
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30*24*60*60*1000);
  const spent = transactions
    .filter(t => t.type === 'expense' && new Date(t.date) >= cutoff)
    .reduce((s,t)=> s + Math.abs(t.amount||0), 0);
  return spent / 30;
}, [transactions]);
const totalCash = (accounts || []).reduce((s,a)=> s + (a.balance||0), 0);
const runwayDays = avgDaily > 0 ? Math.floor(totalCash / avgDaily) : 0;

  // Portfolio value & pulse (today change)
  const portfolioCalc = useMemo(()=>{
    const symbols = Object.keys(holdings || {});
    let totalUSD = 0;
    let changeUSD = 0;
    for (const sym of symbols) {
      const q = quotes[sym]?.last || 0;
      const ch = quotes[sym]?.change || 0;
      const qty = (holdings[sym]?.lots || []).reduce((acc,l)=> acc + (l.side==='buy'? l.qty : -l.qty), 0);
      totalUSD += q * qty;
      changeUSD += ch * qty;
    }
    // Convert to user's FX if available (keep simple, use fx base rates if present)
    // For now we display USD-formatted for consistency
    return { totalUSD, changeUSD };
  }, [holdings, quotes]);

  // Upcoming bills (30 days)
  const upcoming = useMemo(()=> sumUpcoming(recurring||[], new Date(), 30), [recurring]);

  const debtDue = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 30*24*60*60*1000);
    let total = 0; const list: { id: string; name: string; minDue: number; due: Date }[] = [];
    for (const d of debts || []) {
      const due = new Date(d.dueISO);
      if (!isNaN(due.getTime()) && due <= cutoff) { total += d.minDue||0; list.push({ id: d.id, name: d.name, minDue: d.minDue||0, due }); }
    }
    list.sort((a,b)=> a.due.getTime() - b.due.getTime());
    return { total, list };
  }, [debts]);

  // Spendable formula v1: cash - (next 30d bills). (Later: minus debt mins + planned DCA + goals)
  const spendable = Math.max(0, totalCash - upcoming.total - debtDue.total);

  // Net worth v1: cash + portfolio (later: +CPF/CDP + other assets - debts)
  const netWorth = totalCash + portfolioCalc.totalUSD - (debts||[]).reduce((s,d)=> s + (d.balance||0), 0);

  const nextActions: string[] = [];
  if (upcoming.total > 0 && totalCash < upcoming.total) {
    nextActions.push(`Top up cash by ${formatCurrency(upcoming.total - totalCash)} to cover upcoming bills.`);
  } else if (spendable > 0 && portfolioCalc.totalUSD > 0) {
    const suggest = Math.max(0, Math.floor(spendable * 0.25));
    if (suggest > 0) nextActions.push(`Consider DCA ~${formatCurrency(suggest)} into your portfolio. Tap to plan.`);
  }
  if ((Object.keys(holdings||{}).length || 0) > 0) {
    const change = portfolioCalc.changeUSD;
    if (Math.abs(change) > 1) nextActions.push(`Portfolio moved ${change >= 0 ? 'up' : 'down'} ${formatCurrency(Math.abs(change))} today.`);
  }
  if (debtDue.total > 0 && debtDue.total > totalCash) { nextActions.push('Debt minimums exceed cash on hand — consider moving funds or adjusting spend.'); }
  if ((recurring||[]).length === 0) {
    nextActions.push('Add your recurring bills so Spendable can be accurate.');
  }
  if ((accounts||[]).length === 0) {
    nextActions.push('Add a bank account to see total cash and runway.');
  }

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <Text style={{ color: text, fontSize: 24, fontWeight: '800' }}>Money</Text>
        <Segmented value={seg} onChange={setSeg} />

        {seg === 'Summary' ? (
          <View style={{ gap: spacing.s12 }}>
            {/* Top KPIs */}
            <View style={{ flexDirection:'row', gap: spacing.s12 }}>
              <Card style={{ flex:1, padding: spacing.s16, backgroundColor: cardBg }}>
                <Text style={{ color: muted, marginBottom: spacing.s8 }}>Net worth</Text>
                <Text style={{ color: onSurface, fontSize: 20, fontWeight:'700' }}>{formatCurrency(netWorth)}</Text>
              </Card>
              <Card style={{ flex:1, padding: spacing.s16, backgroundColor: cardBg }}>
                <Text style={{ color: muted, marginBottom: spacing.s8 }}>Spendable (30d)</Text>
                <Text style={{ color: onSurface, fontSize: 20, fontWeight:'700' }}>{formatCurrency(spendable)}</Text>
              </Card>
            </View>

            <View style={{ flexDirection:'row', gap: spacing.s12 }}>
              <Card style={{ flex:1, padding: spacing.s16, backgroundColor: cardBg }}>
                <Text style={{ color: muted, marginBottom: spacing.s8 }}>Debt min (30d)</Text>
                <Text style={{ color: onSurface, fontSize: 20, fontWeight:'700' }}>{formatCurrency(debtDue.total)}</Text>
              </Card>
              <Card style={{ flex:1, padding: spacing.s16, backgroundColor: cardBg }}>
                <Text style={{ color: muted, marginBottom: spacing.s8 }}>Runway</Text>
                <Text style={{ color: onSurface, fontSize: 20, fontWeight:'700' }}>{runwayDays} days</Text>
              </Card>
            </View>

            {/* Portfolio pulse */}
            <Card style={{ padding: spacing.s16, backgroundColor: cardBg }}>
              <Text style={{ color: text, fontWeight:'700', marginBottom: spacing.s8 }}>Portfolio pulse</Text>
              <Text numberOfLines={2} style={{ color: muted }}>
                Value: {formatCurrency(portfolioCalc.totalUSD)} • Today: {portfolioCalc.changeUSD >= 0 ? '+' : '-'}{formatCurrency(Math.abs(portfolioCalc.changeUSD))}
              </Text>
              <View style={{ height: spacing.s12 }} />
              <Button title="Open portfolio" variant="secondary" onPress={()=> nav.navigate('Invest', { screen: 'InvestHome' })} />
{/* Allocation chips */}
{Object.keys(holdings||{}).length > 0 ? (() => {
  const syms = Object.keys(holdings||{});
  const totalUSD = syms.reduce((acc, sym) => {
    const q = quotes[sym]?.last || 0;
    const qty = (holdings[sym]?.lots || []).reduce((s,l)=> s + (l.side==='buy'? l.qty : -l.qty), 0);
    return acc + q * qty;
  }, 0);
  const arr = syms.map(sym => {
    const q = quotes[sym]?.last || 0;
    const qty = (holdings[sym]?.lots || []).reduce((s,l)=> s + (l.side==='buy'? l.qty : -l.qty), 0);
    const val = q * qty;
    const wt = totalUSD > 0 ? val/totalUSD : 0;
    return { sym, wt };
  }).sort((a,b)=> b.wt - a.wt).slice(0, 3);
  return (
    <View style={{ flexDirection:'row', gap: spacing.s8, flexWrap:'wrap' }}>
      {arr.map(x => (
        <View key={x.sym} style={{ paddingVertical: spacing.s4, paddingHorizontal: spacing.s12, borderRadius: 999, borderWidth:1, borderColor: border }}>
          <Text style={{ color: onSurface, fontWeight:'600' }}>{x.sym} {(x.wt*100).toFixed(0)}%</Text>
        </View>
      ))}
    </View>
  );
})() : null}

            </Card>

            {/* Upcoming bills */}
            <Card style={{ backgroundColor: cardBg }}>
              <View style={{ padding: spacing.s16 }}>
                <Text style={{ color: text, fontWeight:'700', marginBottom: spacing.s8 }}>Upcoming bills (30 days)</Text>
                {upcoming.list.length === 0 ? (
                  <Text style={{ color: muted }}>No bills due in the next 30 days.</Text>
                ) : null}
              </View>
              {upcoming.list.length > 0 ? (
                <FlatList
                  data={upcoming.list}
                  keyExtractor={(x)=>x.id}
                  contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s12 }}
                  renderItem={({item}) => (
                    <View style={{ paddingVertical: spacing.s12, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth: 1, borderBottomColor: border }}>
                      <View>
                        <Text style={{ color: text, fontWeight:'600' }}>{item.label}</Text>
                        <Text style={{ color: muted }}>{item.due.toDateString()}</Text>
                      </View>
                      <Text>{formatCurrency(item.amount)}</Text>
                    </View>
                  )}
                  ListFooterComponent={<View style={{ height: spacing.s4 }} />}
                />
              ) : null}
              <View style={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s16 }}>
                <Button title="Manage bills" variant="secondary" onPress={()=> nav.navigate('Bills')} />
              </View>
            </Card>

            {/* Next actions */}
            <Card style={{ padding: spacing.s16, backgroundColor: cardBg }}>
              <Text style={{ color: text, fontWeight:'700', marginBottom: spacing.s8 }}>Next actions</Text>
              {nextActions.length === 0 ? <Text style={{ color: muted }}>All caught up. Nice—keep it rolling 🎉</Text> : null}
              <Button title="Plan DCA" variant="secondary" onPress={()=> nav.navigate('DCAPlanner', { suggest: Math.max(0, Math.floor(spendable * 0.25)) })} />
              {nextActions.map((t, i)=> (
                <View key={i} style={{ flexDirection:'row', gap: spacing.s8, marginTop: i===0?0:spacing.s8 }}>
                  <Text>•</Text>
                  <Text style={{ color: onSurface, flex:1 }}>{t}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : seg === 'Accounts' ? (
          (accounts.length === 0 ? (
            <Card style={{ padding: spacing.s16, backgroundColor: cardBg }}>
              <Text style={{ color: muted, marginBottom: spacing.s12 }} numberOfLines={2}>
                Link a bank or add a manual account to see your balances.
              </Text>
              <Button title="Add account" onPress={()=> nav.navigate('AddAccount')} />
            </Card>
          ) : (
            <View style={{ gap: spacing.s12 }}>
              <Card style={{ padding: spacing.s16, backgroundColor: cardBg }}>
                <Text style={{ color: text, fontWeight: '700', marginBottom: spacing.s8 }}>Total cash</Text>
                <Text style={{ color: onSurface, fontSize: 20 }}>{formatCurrency(accounts.reduce((s,a)=> s+a.balance, 0))}</Text>
              </Card>
              <Card style={{ backgroundColor: cardBg }}>
                <FlatList
                  data={accounts}
                  keyExtractor={(a)=>a.id}
                  contentContainerStyle={{ padding: spacing.s12 }}
                  renderItem={({item}) => (
                    <Pressable onPress={()=> nav.navigate('AccountDetail', { id: item.id })} style={{ paddingVertical: spacing.s12, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth: 1, borderBottomColor: border }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap: spacing.s12 }}>
                        <Icon name="wallet" size={18} />
                        <View>
                          <Text style={{ fontWeight:'700' }}>{item.name}</Text>
                          <Text style={{ color: muted }}>{item.institution ?? 'Manual'}{item.mask ? (' • '+item.mask) : ''}</Text>
                        </View>
                      </View>
                      <Text>{formatCurrency(item.balance)}</Text>
                    </Pressable>
                  )}
                />
              </Card>
            </View>
          ))
        ) : seg === 'Portfolio' ? (
          <View style={{ gap: spacing.s12 }}>
            <Card style={{ padding: spacing.s16, backgroundColor: cardBg }}>
              <Text style={{ color: text, fontWeight: '700', marginBottom: spacing.s8 }}>Portfolio value</Text>
              <Text style={{ color: onSurface, fontSize: 20 }}>{formatCurrency(portfolioCalc.totalUSD)}</Text>
              <View style={{ height: spacing.s12 }} />
              <Button title="Open portfolio" variant="secondary" onPress={()=> nav.navigate('Invest', { screen: 'InvestHome' })} />
{/* Allocation chips */}
{Object.keys(holdings||{}).length > 0 ? (() => {
  const syms = Object.keys(holdings||{});
  const totalUSD = syms.reduce((acc, sym) => {
    const q = quotes[sym]?.last || 0;
    const qty = (holdings[sym]?.lots || []).reduce((s,l)=> s + (l.side==='buy'? l.qty : -l.qty), 0);
    return acc + q * qty;
  }, 0);
  const arr = syms.map(sym => {
    const q = quotes[sym]?.last || 0;
    const qty = (holdings[sym]?.lots || []).reduce((s,l)=> s + (l.side==='buy'? l.qty : -l.qty), 0);
    const val = q * qty;
    const wt = totalUSD > 0 ? val/totalUSD : 0;
    return { sym, wt };
  }).sort((a,b)=> b.wt - a.wt).slice(0, 3);
  return (
    <View style={{ flexDirection:'row', gap: spacing.s8, flexWrap:'wrap' }}>
      {arr.map(x => (
        <View key={x.sym} style={{ paddingVertical: spacing.s4, paddingHorizontal: spacing.s12, borderRadius: 999, borderWidth:1, borderColor: border }}>
          <Text style={{ color: onSurface, fontWeight:'600' }}>{x.sym} {(x.wt*100).toFixed(0)}%</Text>
        </View>
      ))}
    </View>
  );
})() : null}

            </Card>
          </View>
        ) : (
          <View style={{ gap: spacing.s12 }}>
            <Card style={{ padding: spacing.s16, backgroundColor: cardBg }}>
              <Text style={{ color: text, fontWeight: '700', marginBottom: spacing.s8 }}>Debt overview</Text>
              <Text style={{ color: muted }}>Total balance</Text>
              <Text style={{ color: onSurface, fontSize: 20, fontWeight: '700' }}>
                {formatCurrency((debts||[]).reduce((s,d)=> s + (d.balance||0), 0))}
              </Text>
              <View style={{ height: spacing.s8 }} />
              <Text style={{ color: muted }}>Minimum due (30 days)</Text>
              <Text style={{ color: onSurface, fontSize: 20, fontWeight: '700' }}>{formatCurrency(debtDue.total)}</Text>
              <View style={{ height: spacing.s12 }} />
              <Button title="Add debt" onPress={()=> nav.navigate('AddDebt')} />
              <View style={{ height: spacing.s8 }} />
              <Button title="Simulate payoff" variant="secondary" onPress={()=> nav.navigate('PayoffSimulator')} />
            </Card>

            <Card style={{ backgroundColor: cardBg }}>
              {(debts||[]).length === 0 ? (
                <View style={{ padding: spacing.s16 }}>
                  <Text style={{ color: muted }}>No debts yet. Add your first debt to track due dates and payoff.</Text>
                </View>
              ) : (
                <FlatList
                  data={debts}
                  keyExtractor={(d)=> d.id}
                  contentContainerStyle={{ padding: spacing.s16 }}
                  renderItem={({item}) => (
                    <Pressable onPress={()=> nav.navigate('DebtDetail', { id: item.id })} style={{ paddingVertical: spacing.s12, borderBottomWidth: 1, borderBottomColor: border }}>
                      <Text style={{ color: text, fontWeight:'700' }}>{item.name}</Text>
                      <Text style={{ color: muted }}>
                        {item.type.toUpperCase()} • APR {item.apr ?? 0}% • Due {new Date(item.dueISO).toDateString()}
                      </Text>
                      <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: spacing.s8 }}>
                        <Text style={{ color: muted }}>Balance</Text>
                        <Text style={{ color: onSurface }}>{formatCurrency(item.balance)}</Text>
                      </View>
                      <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop: spacing.s4 }}>
                        <Text style={{ color: muted }}>Min due</Text>
                        <Text style={{ color: onSurface }}>{formatCurrency(item.minDue)}</Text>
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </Card>
          </View>
        )}
      </View>
    </Screen>
  );
};

export default Money;
