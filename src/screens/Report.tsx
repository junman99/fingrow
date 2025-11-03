import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { useAccountsStore } from '../store/accounts';
import { useDebtsStore } from '../store/debts';
import { useInvestStore } from '../store/invest';
import Icon from '../components/Icon';

function withAlpha(hex: string, alpha: number) {
  if (!hex) return hex;
  const raw = hex.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function sameMonth(d: Date, y: number, m: number) {
  return d.getFullYear() === y && d.getMonth() === m;
}

type Tx = ReturnType<typeof useTxStore.getState>['transactions'][number];

export const Report: React.FC = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { get, isDark } = useThemeTokens();
  const { transactions } = useTxStore();
  const { accounts } = useAccountsStore();
  const { debts } = useDebtsStore();
  const investStore = useInvestStore();
  const holdings = investStore.holdings ? Object.values(investStore.holdings) : [];
  const quotes = investStore.quotes || {};

  const [includeCPF, setIncludeCPF] = useState(true);
  const [selectedDataPoint, setSelectedDataPoint] = useState<number | null>(null);

  const selectedMonth = route.params?.selectedMonth || new Date();
  const now = new Date();

  // Generate last 6 months data
  const monthsData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - i, 1);
      const Y = date.getFullYear();
      const M = date.getMonth();

      const monthTx = transactions.filter(t => sameMonth(new Date(t.date), Y, M));

      let income = 0, spending = 0;
      for (const t of monthTx) {
        if (t.type === 'expense') spending += Math.abs(Number(t.amount) || 0);
        else income += Math.abs(Number(t.amount) || 0);
      }

      // Calculate account balances at that time (simplified - using current for now)
      let cash = 0, cpf = 0, stocks = 0;

      if (Array.isArray(accounts)) {
        for (const acc of accounts) {
          // Skip accounts not included in net worth
          if (acc.includeInNetWorth === false) continue;

          const balance = Number(acc.balance) || 0;
          const isCPF = acc.name?.toLowerCase().includes('cpf');
          if (isCPF) {
            cpf += balance;
          } else {
            cash += balance;
          }
        }
      }

      if (Array.isArray(holdings)) {
        for (const holding of holdings) {
          // Skip archived holdings
          if (holding.archived) continue;

          // Calculate quantity from lots
          let qty = 0;
          for (const lot of holding.lots || []) {
            if (lot.side === 'buy') qty += Number(lot.qty) || 0;
            else qty -= Number(lot.qty) || 0;
          }
          // Get current price from quotes
          const quote = quotes[holding.symbol];
          const price = quote?.last || 0;
          const value = qty * price;
          stocks += value;
        }
      }

      const savings = income - spending;

      months.push({
        date,
        label: date.toLocaleString(undefined, { month: 'short' }),
        fullLabel: date.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
        income,
        spending,
        savings,
        cash,
        cpf,
        stocks,
        netWorth: cash + cpf + stocks,
        netWorthExCPF: cash + stocks
      });
    }
    return months;
  }, [transactions, accounts, holdings, quotes, selectedMonth]);

  const currentMonthData = monthsData[monthsData.length - 1];

  // Category breakdown for current month
  const categoryData = useMemo(() => {
    const Y = selectedMonth.getFullYear();
    const M = selectedMonth.getMonth();
    const monthTx = transactions.filter(t => sameMonth(new Date(t.date), Y, M) && t.type === 'expense');

    const categoryMap: Record<string, { total: number; transactions: Tx[] }> = {};

    for (const t of monthTx) {
      const cat = t.category || 'General';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { total: 0, transactions: [] };
      }
      categoryMap[cat].total += Math.abs(Number(t.amount) || 0);
      categoryMap[cat].transactions.push(t);
    }

    const categories = Object.entries(categoryMap)
      .map(([name, data]) => ({
        name,
        total: data.total,
        transactions: data.transactions.sort((a, b) => Math.abs(Number(b.amount) || 0) - Math.abs(Number(a.amount) || 0)).slice(0, 3)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return categories;
  }, [transactions, selectedMonth]);

  // Net worth with/without CPF
  const netWorthData = useMemo(() => {
    let cash = 0, cpf = 0, stocks = 0, debtsTotal = 0;

    if (Array.isArray(accounts)) {
      for (const acc of accounts) {
        // Skip accounts not included in net worth
        if (acc.includeInNetWorth === false) continue;

        const balance = Number(acc.balance) || 0;
        const isCPF = acc.name?.toLowerCase().includes('cpf');
        if (isCPF) {
          cpf += balance;
        } else {
          cash += balance;
        }
      }
    }

    if (Array.isArray(holdings)) {
      for (const holding of holdings) {
        // Skip archived holdings
        if (holding.archived) continue;

        // Calculate quantity from lots
        let qty = 0;
        for (const lot of holding.lots || []) {
          if (lot.side === 'buy') qty += Number(lot.qty) || 0;
          else qty -= Number(lot.qty) || 0;
        }

        // Get current price from quotes
        const quote = quotes[holding.symbol];
        const price = quote?.last || 0;
        const value = qty * price;

        // Check if it's in a CPF account (holdings don't have account property in this store)
        // For now, add to stocks
        stocks += value;
      }
    }

    if (Array.isArray(debts)) {
      for (const debt of debts) {
        debtsTotal += Number(debt.remaining) || 0;
      }
    }

    return {
      cash,
      cpf,
      stocks,
      debts: debtsTotal,
      withCPF: cash + cpf + stocks - debtsTotal,
      withoutCPF: cash + stocks - debtsTotal
    };
  }, [accounts, holdings, debts, quotes]);

  // Theme colors
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successColor = get('semantic.success') as string;
  const dangerColor = get('semantic.danger') as string;
  const warningColor = get('semantic.warning') as string;

  const maxIncome = Math.max(...monthsData.map(m => m.income), 1);
  const maxSpending = Math.max(...monthsData.map(m => m.spending), 1);
  const maxNetWorth = Math.max(...monthsData.map(m => includeCPF ? m.netWorth : m.netWorthExCPF), 1);

  const handleDownloadPDF = () => {
    Alert.alert(
      'Download PDF',
      'PDF download functionality will be implemented in a future update.',
      [{ text: 'OK' }]
    );
  };

  const bgColor = get('background.default') as string;

  return (
    <ScreenScroll inTab={true} style={{ backgroundColor: bgColor }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, paddingBottom: spacing.s32, gap: spacing.s20, backgroundColor: bgColor }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={({ pressed }) => ({
                padding: spacing.s8,
                marginLeft: -spacing.s8,
                borderRadius: radius.md,
                backgroundColor: pressed ? surface1 : 'transparent',
              })}
              hitSlop={8}
            >
              <Icon name="chevron-left" size={28} color={textPrimary} />
            </Pressable>
            <View>
              <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
                Financial Report
              </Text>
              <Text style={{ color: textMuted, fontSize: 14, marginTop: spacing.s2 }}>
                {selectedMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleDownloadPDF}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.s12,
              paddingVertical: spacing.s8,
              borderRadius: radius.lg,
              backgroundColor: accentPrimary,
              opacity: pressed ? 0.8 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.s6
            })}
            hitSlop={8}
          >
            <Icon name="download" size={18} color={get('text.onPrimary') as string} />
            <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 14 }}>
              PDF
            </Text>
          </Pressable>
        </View>

        {/* Executive Summary */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s16,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="bar-chart-2" size={16} color={accentPrimary} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18, letterSpacing: -0.3 }}>
              Executive Summary
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s6 }}>Income</Text>
              <Text style={{ color: successColor, fontSize: 24, fontWeight: '800' }}>
                ${currentMonthData.income.toFixed(2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s6 }}>Expenses</Text>
              <Text style={{ color: dangerColor, fontSize: 24, fontWeight: '800' }}>
                ${currentMonthData.spending.toFixed(2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s6 }}>Savings</Text>
              <Text style={{
                color: currentMonthData.savings >= 0 ? successColor : dangerColor,
                fontSize: 24,
                fontWeight: '800'
              }}>
                {currentMonthData.savings >= 0 ? '+' : ''}${currentMonthData.savings.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Net Worth Overview */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s16,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.15),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name="dollar-sign" size={16} color={successColor} />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18, letterSpacing: -0.3 }}>
                Net Worth Breakdown
              </Text>
            </View>

            <Pressable
              onPress={() => setIncludeCPF(!includeCPF)}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.s10,
                paddingVertical: spacing.s6,
                borderRadius: radius.pill,
                backgroundColor: includeCPF ? accentPrimary : surface2,
                opacity: pressed ? 0.8 : 1
              })}
            >
              <Text style={{
                color: includeCPF ? get('text.onPrimary') as string : textMuted,
                fontSize: 12,
                fontWeight: '700'
              }}>
                {includeCPF ? '✓ Inc CPF' : 'Exc CPF'}
              </Text>
            </Pressable>
          </View>

          <View>
            <Text style={{ color: textPrimary, fontSize: 42, fontWeight: '800', letterSpacing: -1.5 }}>
              ${(includeCPF ? netWorthData.withCPF : netWorthData.withoutCPF).toFixed(2)}
            </Text>
            <Text style={{ color: textMuted, fontSize: 14, marginTop: spacing.s4 }}>
              {includeCPF ? 'Including CPF' : 'Excluding CPF'}
            </Text>
          </View>

          {/* Breakdown */}
          <View style={{ gap: spacing.s8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: textMuted, fontSize: 14 }}>Cash & Savings</Text>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                ${netWorthData.cash.toFixed(2)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: textMuted, fontSize: 14 }}>CPF</Text>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                ${netWorthData.cpf.toFixed(2)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: textMuted, fontSize: 14 }}>Investments</Text>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                ${netWorthData.stocks.toFixed(2)}
              </Text>
            </View>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: spacing.s8,
              borderTopWidth: 1,
              borderTopColor: borderSubtle
            }}>
              <Text style={{ color: textMuted, fontSize: 14 }}>Liabilities</Text>
              <Text style={{ color: dangerColor, fontWeight: '700', fontSize: 16 }}>
                ${netWorthData.debts.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* 6-Month Trend Table */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s14,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: withAlpha(accentSecondary, isDark ? 0.2 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="calendar" size={16} color={accentSecondary} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18, letterSpacing: -0.3 }}>
              6-Month Financial Overview
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={{ minWidth: 800 }}>
              {/* Table Header */}
              <View style={{ flexDirection: 'row', paddingBottom: spacing.s8, borderBottomWidth: 2, borderBottomColor: borderSubtle }}>
                <Text style={{ width: 70, color: textMuted, fontSize: 11, fontWeight: '700' }}>Month</Text>
                <Text style={{ width: 80, color: textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>Income</Text>
                <Text style={{ width: 80, color: textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>Spent</Text>
                <Text style={{ width: 80, color: textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>Saved</Text>
                <Text style={{ width: 80, color: textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>Cash</Text>
                <Text style={{ width: 80, color: textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>CPF</Text>
                <Text style={{ width: 80, color: textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>Stocks</Text>
                <Text style={{ width: 100, color: textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>Net Worth</Text>
                <Text style={{ width: 80, color: textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' }}>Rate %</Text>
              </View>

              {/* Table Rows */}
              {monthsData.map((month, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedDataPoint(selectedDataPoint === idx ? null : idx)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    paddingVertical: spacing.s10,
                    backgroundColor: selectedDataPoint === idx ? withAlpha(accentPrimary, 0.1) : (pressed ? withAlpha(accentPrimary, 0.05) : 'transparent'),
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.s8,
                    marginHorizontal: -spacing.s8
                  })}
                >
                  <Text style={{ width: 70, color: textPrimary, fontSize: 13, fontWeight: '600' }}>{month.label}</Text>
                  <Text style={{ width: 80, color: successColor, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>
                    ${month.income.toFixed(2)}
                  </Text>
                  <Text style={{ width: 80, color: dangerColor, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>
                    ${month.spending.toFixed(2)}
                  </Text>
                  <Text style={{
                    width: 80,
                    color: month.savings >= 0 ? successColor : dangerColor,
                    fontSize: 13,
                    fontWeight: '600',
                    textAlign: 'right'
                  }}>
                    {month.savings >= 0 ? '+' : ''}${month.savings.toFixed(2)}
                  </Text>
                  <Text style={{ width: 80, color: textPrimary, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>
                    ${month.cash.toFixed(2)}
                  </Text>
                  <Text style={{ width: 80, color: textPrimary, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>
                    ${month.cpf.toFixed(2)}
                  </Text>
                  <Text style={{ width: 80, color: textPrimary, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>
                    ${month.stocks.toFixed(2)}
                  </Text>
                  <Text style={{ width: 100, color: accentPrimary, fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
                    ${(includeCPF ? month.netWorth : month.netWorthExCPF).toFixed(2)}
                  </Text>
                  <Text style={{ width: 80, color: textMuted, fontSize: 13, fontWeight: '600', textAlign: 'right' }}>
                    {month.income > 0 ? ((month.savings / month.income) * 100).toFixed(1) : '0'}%
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Tooltip */}
          {selectedDataPoint !== null && monthsData[selectedDataPoint] && (
            <View style={{
              backgroundColor: surface2,
              borderRadius: radius.lg,
              padding: spacing.s12,
              marginTop: spacing.s8,
              borderWidth: 1,
              borderColor: accentPrimary
            }}>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14, marginBottom: spacing.s8 }}>
                {monthsData[selectedDataPoint].fullLabel}
              </Text>
              <View style={{ gap: spacing.s6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: textMuted, fontSize: 12 }}>Net Worth ({includeCPF ? 'Inc' : 'Exc'} CPF):</Text>
                  <Text style={{ color: accentPrimary, fontSize: 12, fontWeight: '700' }}>
                    ${(includeCPF ? monthsData[selectedDataPoint].netWorth : monthsData[selectedDataPoint].netWorthExCPF).toFixed(2)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: textMuted, fontSize: 12 }}>Cash Balance:</Text>
                  <Text style={{ color: textPrimary, fontSize: 12, fontWeight: '600' }}>
                    ${monthsData[selectedDataPoint].cash.toFixed(2)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: textMuted, fontSize: 12 }}>CPF Balance:</Text>
                  <Text style={{ color: textPrimary, fontSize: 12, fontWeight: '600' }}>
                    ${monthsData[selectedDataPoint].cpf.toFixed(2)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: textMuted, fontSize: 12 }}>Stocks Value:</Text>
                  <Text style={{ color: textPrimary, fontSize: 12, fontWeight: '600' }}>
                    ${monthsData[selectedDataPoint].stocks.toFixed(2)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: textMuted, fontSize: 12 }}>Savings Rate:</Text>
                  <Text style={{ color: textPrimary, fontSize: 12, fontWeight: '600' }}>
                    {monthsData[selectedDataPoint].income > 0
                      ? ((monthsData[selectedDataPoint].savings / monthsData[selectedDataPoint].income) * 100).toFixed(1)
                      : 0}%
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Income vs Spending Chart */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s14,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="trending-up" size={16} color={accentPrimary} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18, letterSpacing: -0.3 }}>
              Income vs Spending Trend
            </Text>
          </View>

          <View style={{ height: 180, justifyContent: 'flex-end', gap: spacing.s8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: spacing.s6 }}>
              {monthsData.map((month, idx) => {
                const incomeHeight = (month.income / maxIncome) * 120;
                const spendingHeight = (month.spending / maxSpending) * 120;

                return (
                  <View key={idx} style={{ flex: 1, alignItems: 'center', gap: spacing.s4 }}>
                    <View style={{ flexDirection: 'row', gap: spacing.s2, height: 130, alignItems: 'flex-end' }}>
                      <View style={{
                        width: 8,
                        height: Math.max(incomeHeight, 4),
                        backgroundColor: successColor,
                        borderRadius: radius.sm
                      }} />
                      <View style={{
                        width: 8,
                        height: Math.max(spendingHeight, 4),
                        backgroundColor: dangerColor,
                        borderRadius: radius.sm
                      }} />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* X-axis labels */}
            <View style={{ flexDirection: 'row', gap: spacing.s6 }}>
              {monthsData.map((month, idx) => (
                <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: textMuted, fontSize: 10 }}>{month.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s16, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
              <View style={{ width: 12, height: 12, backgroundColor: successColor, borderRadius: 2 }} />
              <Text style={{ color: textMuted, fontSize: 12 }}>Income</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
              <View style={{ width: 12, height: 12, backgroundColor: dangerColor, borderRadius: 2 }} />
              <Text style={{ color: textMuted, fontSize: 12 }}>Spending</Text>
            </View>
          </View>
        </View>

        {/* Net Worth Growth Chart */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s14,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="arrow-up" size={16} color={successColor} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18, letterSpacing: -0.3 }}>
              Net Worth Growth
            </Text>
          </View>

          <View style={{ height: 160 }}>
            {/* Line Chart */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: spacing.s4 }}>
              {monthsData.map((month, idx) => {
                const netWorthValue = includeCPF ? month.netWorth : month.netWorthExCPF;
                const height = (netWorthValue / maxNetWorth) * 110;
                const isSelected = selectedDataPoint === idx;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedDataPoint(isSelected ? null : idx)}
                    style={{ flex: 1, height: 130, justifyContent: 'flex-end', alignItems: 'center' }}
                  >
                    <View style={{
                      width: '100%',
                      height: Math.max(height, 8),
                      backgroundColor: isSelected ? accentPrimary : withAlpha(accentPrimary, 0.6),
                      borderRadius: radius.sm
                    }} />
                  </Pressable>
                );
              })}
            </View>

            {/* X-axis labels */}
            <View style={{ flexDirection: 'row', gap: spacing.s4, marginTop: spacing.s8 }}>
              {monthsData.map((month, idx) => (
                <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: textMuted, fontSize: 10 }}>{month.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Top Spending Categories */}
        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s14,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: withAlpha(warningColor, isDark ? 0.2 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="pie-chart" size={16} color={warningColor} />
            </View>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18, letterSpacing: -0.3 }}>
              Top Spending Categories
            </Text>
          </View>

          {categoryData.length === 0 ? (
            <Text style={{ color: textMuted, textAlign: 'center', paddingVertical: spacing.s16 }}>
              No spending data for this month
            </Text>
          ) : (
            categoryData.map((cat, idx) => (
              <View key={idx} style={{ gap: spacing.s10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                    {cat.name}
                  </Text>
                  <Text style={{ color: warningColor, fontWeight: '800', fontSize: 18 }}>
                    ${cat.total.toFixed(2)}
                  </Text>
                </View>

                {/* Top transactions in this category */}
                <View style={{ gap: spacing.s6, paddingLeft: spacing.s12 }}>
                  {cat.transactions.map((tx, txIdx) => (
                    <View
                      key={tx.id || txIdx}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: spacing.s6,
                        paddingHorizontal: spacing.s10,
                        backgroundColor: surface2,
                        borderRadius: radius.md
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textPrimary, fontSize: 13, fontWeight: '600' }}>
                          {tx.note || 'Transaction'}
                        </Text>
                        <Text style={{ color: textMuted, fontSize: 11, marginTop: spacing.s2 }}>
                          {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>
                        ${Math.abs(Number(tx.amount) || 0).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>

                {idx < categoryData.length - 1 && (
                  <View style={{ height: 1, backgroundColor: borderSubtle, marginTop: spacing.s4 }} />
                )}
              </View>
            ))
          )}
        </View>

        {/* Debt Summary */}
        {Array.isArray(debts) && debts.length > 0 && (
          <View style={{
            backgroundColor: surface1,
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s14,
            borderWidth: 1,
            borderColor: borderSubtle
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: withAlpha(dangerColor, isDark ? 0.2 : 0.15),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name="alert-circle" size={16} color={dangerColor} />
              </View>
              <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 18, letterSpacing: -0.3 }}>
                Active Debts
              </Text>
            </View>

            {debts.map((debt, idx) => (
              <View
                key={debt.id || idx}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: spacing.s10,
                  paddingHorizontal: spacing.s12,
                  backgroundColor: surface2,
                  borderRadius: radius.md
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                    {debt.name || 'Debt'}
                  </Text>
                  <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s2 }}>
                    {debt.interestRate}% APR
                  </Text>
                </View>
                <Text style={{ color: dangerColor, fontWeight: '800', fontSize: 18 }}>
                  ${Number(debt.remaining || 0).toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={{
              paddingTop: spacing.s12,
              borderTopWidth: 1,
              borderTopColor: borderSubtle,
              flexDirection: 'row',
              justifyContent: 'space-between'
            }}>
              <Text style={{ color: textMuted, fontSize: 14, fontWeight: '600' }}>Total Liabilities</Text>
              <Text style={{ color: dangerColor, fontSize: 18, fontWeight: '800' }}>
                ${netWorthData.debts.toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </ScreenScroll>
  );
};

export default Report;
