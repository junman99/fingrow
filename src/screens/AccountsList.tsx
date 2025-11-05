import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import { Card } from '../components/Card';
import Button from '../components/Button';
import { useAccountsStore } from '../store/accounts';
import { useTxStore } from '../store/transactions';
import { formatCurrency } from '../lib/format';

function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
    const int = parseInt(expanded, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

const AnimatedPressable: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}> = ({ onPress, children, style }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string;
  icon: string;
  count: number;
  total: number;
  color: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}> = ({ title, icon, count, total, color, children, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { get, isDark } = useThemeTokens();

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (count === 0) return null;

  return (
    <Card
      style={{
        backgroundColor: cardBg,
        padding: 0,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: border,
      }}
    >
      {/* Header - Always visible */}
      <View style={{ backgroundColor: withAlpha(color, isDark ? 0.15 : 0.1), overflow: 'hidden' }}>
        <AnimatedPressable onPress={toggleExpand}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: spacing.s16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(color, isDark ? 0.3 : 0.2),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={icon as any} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
                <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                  {count} account{count === 1 ? '' : 's'} • {formatCurrency(total)}
                </Text>
              </View>
            </View>
            <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={muted} />
          </View>
        </AnimatedPressable>
      </View>

      {/* Expandable Content - Account cards inside */}
      {isExpanded && (
        <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s4, paddingBottom: spacing.s8 }}>
          {children}
        </View>
      )}
    </Card>
  );
};

const AccountsList: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const { accounts, hydrate: hydrateAcc, updateAccount } = useAccountsStore();
  const { transactions } = useTxStore();

  useEffect(() => {
    hydrateAcc();
  }, [hydrateAcc]);

  // Migrate CPF accounts from 'savings' to 'retirement' on first load
  useEffect(() => {
    const migrateCPFAccounts = async () => {
      const cpfAccountNames = ['CPF Ordinary Account', 'CPF Special Account', 'CPF Medisave'];
      for (const account of accounts || []) {
        if (cpfAccountNames.includes(account.name) && account.kind === 'savings') {
          await updateAccount(account.id, { kind: 'retirement' });
        }
      }
    };
    migrateCPFAccounts();
  }, [accounts, updateAccount]);

  const accountsList = accounts || [];

  // Categorize accounts
  const categorizedAccounts = useMemo(() => {
    const cash = accountsList.filter(acc =>
      (acc.kind === 'checking' || acc.kind === 'savings' || acc.kind === 'cash' || !acc.kind) &&
      acc.includeInNetWorth !== false
    );
    const retirement = accountsList.filter(acc =>
      acc.kind === 'retirement' && acc.includeInNetWorth !== false
    );
    const investment = accountsList.filter(acc =>
      acc.kind === 'investment' && acc.includeInNetWorth !== false
    );
    const credit = accountsList.filter(acc =>
      acc.kind === 'credit' && acc.includeInNetWorth !== false
    );
    const loans = accountsList.filter(acc =>
      (acc.kind === 'loan' || acc.kind === 'mortgage') && acc.includeInNetWorth !== false
    );
    const other = accountsList.filter(acc =>
      acc.kind === 'other' && acc.includeInNetWorth !== false
    );

    return { cash, retirement, investment, credit, loans, other };
  }, [accountsList]);

  const totals = useMemo(() => ({
    cash: categorizedAccounts.cash.reduce((s, a) => s + (a.balance || 0), 0),
    retirement: categorizedAccounts.retirement.reduce((s, a) => s + (a.balance || 0), 0),
    investment: categorizedAccounts.investment.reduce((s, a) => s + (a.balance || 0), 0),
    credit: categorizedAccounts.credit.reduce((s, a) => s + Math.abs(a.balance || 0), 0),
    loans: categorizedAccounts.loans.reduce((s, a) => s + Math.abs(a.balance || 0), 0),
    other: categorizedAccounts.other.reduce((s, a) => s + (a.balance || 0), 0),
  }), [categorizedAccounts]);

  const includedAccounts = useMemo(
    () => accountsList.filter(acc => acc.includeInNetWorth !== false),
    [accountsList]
  );
  const excludedAccountCount = accountsList.length - includedAccounts.length;

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const warningColor = get('semantic.warning') as string;
  const successColor = get('semantic.success') as string;
  const errorColor = get('semantic.error') as string;

  const totalCash = totals.cash;

  // Calculate average daily spending
  const avgDaily = useMemo(() => {
    if (!transactions || transactions.length === 0) return 0;
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const spent = transactions
      .filter(t => t.type === 'expense' && new Date(t.date) >= cutoff)
      .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    return spent / 30;
  }, [transactions]);

  const runwayDays = avgDaily > 0 ? Math.floor(totalCash / avgDaily) : 0;
  const spendable = totalCash;

  // Animations
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 400 });
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const getAccountIcon = (kind?: string) => {
    switch (kind) {
      case 'checking': return 'building-2';
      case 'savings': return 'piggy-bank';
      case 'cash': return 'wallet';
      case 'credit': return 'credit-card';
      case 'investment': return 'trending-up';
      case 'retirement': return 'award';
      case 'loan': return 'file-text';
      case 'mortgage': return 'home';
      default: return 'wallet';
    }
  };

  const renderAccount = (account: any, accentColor: string, isLast: boolean) => {
    const excluded = account.includeInNetWorth === false;
    const isDebt = account.kind === 'credit' || account.kind === 'loan' || account.kind === 'mortgage';

    return (
      <React.Fragment key={account.id}>
        <AnimatedPressable
          onPress={() => nav.navigate('AccountDetail', { id: account.id })}
          style={{
            paddingVertical: spacing.s8,
            opacity: excluded ? 0.7 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(accentColor, isDark ? 0.2 : 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={getAccountIcon(account.kind) as any} size={20} color={accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>{account.name}</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                  {account.institution ? `${account.institution}` : ''}
                  {account.mask ? ` • ${account.mask}` : ''}
                  {excluded ? ' • Hidden' : ''}
                </Text>
              </View>
            </View>
            <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>
              {isDebt ? formatCurrency(Math.abs(account.balance)) : formatCurrency(account.balance)}
            </Text>
          </View>
        </AnimatedPressable>
        {!isLast && (
          <View
            style={{
              height: 1,
              backgroundColor: withAlpha(border, 0.3),
              marginLeft: 52,
            }}
          />
        )}
      </React.Fragment>
    );
  };

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
    >
      {/* Header */}
      <Animated.View style={[{ gap: spacing.s8 }, fadeStyle]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={28} color={text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 }}>
              Cash Overview
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Summary - Direct on Background */}
      <Animated.View style={fadeStyle}>
        <View style={{ gap: spacing.s16 }}>
          <View>
            <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Total cash</Text>
            <Text style={{ color: text, fontSize: 36, fontWeight: '800', marginTop: spacing.s6, letterSpacing: -0.8 }}>
              {formatCurrency(totalCash)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.s20 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, fontSize: 12 }}>Spendable</Text>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                {formatCurrency(spendable)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, fontSize: 12 }}>Runway</Text>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                {runwayDays} days
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: muted, fontSize: 12 }}>Daily avg</Text>
              <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                {formatCurrency(avgDaily)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* No Accounts */}
      {accountsList.length === 0 ? (
        <Animated.View style={fadeStyle}>
          <Card style={{ backgroundColor: cardBg, padding: spacing.s20 }}>
            <View style={{ gap: spacing.s16, alignItems: 'center' }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius.xl,
                  backgroundColor: withAlpha(accentPrimary, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="wallet" size={32} color={accentPrimary} />
              </View>
              <View style={{ alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                  No accounts yet
                </Text>
                <Text style={{ color: muted, textAlign: 'center', lineHeight: 20 }}>
                  Add your first account to start tracking your finances
                </Text>
              </View>
              <Button
                title="Add account"
                onPress={() => nav.navigate('AddAccount')}
                style={{ width: '100%' }}
              />
            </View>
          </Card>
        </Animated.View>
      ) : (
        <>
          {/* Accounts Section */}
          <Animated.View style={fadeStyle}>
            <Text style={{ color: text, fontSize: 16, fontWeight: '700', marginBottom: 6 }}>
              Accounts
            </Text>
          </Animated.View>

          {/* Collapsible Account Sections */}
          <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
            {/* Cash Accounts */}
            <CollapsibleSection
              title="Cash Accounts"
              icon="wallet"
              count={categorizedAccounts.cash.length}
              total={totals.cash}
              color={accentPrimary}
              defaultExpanded={true}
            >
              {categorizedAccounts.cash.map((account, index) =>
                renderAccount(account, accentPrimary, index === categorizedAccounts.cash.length - 1)
              )}
            </CollapsibleSection>

            {/* Investment Accounts */}
            <CollapsibleSection
              title="Investment Accounts"
              icon="trending-up"
              count={categorizedAccounts.investment.length}
              total={totals.investment}
              color={accentSecondary}
              defaultExpanded={false}
            >
              {categorizedAccounts.investment.map((account, index) =>
                renderAccount(account, accentSecondary, index === categorizedAccounts.investment.length - 1)
              )}
            </CollapsibleSection>

            {/* Credit Cards */}
            <CollapsibleSection
              title="Credit Cards"
              icon="credit-card"
              count={categorizedAccounts.credit.length}
              total={totals.credit}
              color={warningColor}
              defaultExpanded={false}
            >
              {categorizedAccounts.credit.map((account, index) =>
                renderAccount(account, warningColor, index === categorizedAccounts.credit.length - 1)
              )}
            </CollapsibleSection>

            {/* Loans & Mortgages */}
            <CollapsibleSection
              title="Loans & Mortgages"
              icon="home"
              count={categorizedAccounts.loans.length}
              total={totals.loans}
              color={errorColor}
              defaultExpanded={false}
            >
              {categorizedAccounts.loans.map((account, index) =>
                renderAccount(account, errorColor, index === categorizedAccounts.loans.length - 1)
              )}
            </CollapsibleSection>

            {/* Other Accounts */}
            <CollapsibleSection
              title="Other Accounts"
              icon="folder"
              count={categorizedAccounts.other.length}
              total={totals.other}
              color={muted}
              defaultExpanded={false}
            >
              {categorizedAccounts.other.map((account, index) =>
                renderAccount(account, muted, index === categorizedAccounts.other.length - 1)
              )}
            </CollapsibleSection>
          </Animated.View>
        </>
      )}

      {excludedAccountCount > 0 && (
        <Text style={{ color: muted, fontSize: 12, textAlign: 'center' }}>
          {excludedAccountCount} account{excludedAccountCount === 1 ? '' : 's'} hidden from net worth
        </Text>
      )}

      {/* Quick Actions */}
      <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
        <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>
          Quick access
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <Pressable
            onPress={() => nav.navigate('AddAccount')}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: cardBg,
              borderRadius: radius.xl,
              padding: spacing.s16,
              gap: spacing.s12,
              borderWidth: 1,
              borderColor: withAlpha(border, isDark ? 0.5 : 1),
              opacity: pressed ? 0.85 : 1
            })}
          >
            <View style={{
              width: 48,
              height: 48,
              borderRadius: radius.lg,
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="plus" size={24} color={accentPrimary} />
            </View>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Add account</Text>
            <Text style={{ color: muted, fontSize: 13 }}>Track a new account</Text>
          </Pressable>

          {accountsList.length > 0 && (
            <Pressable
              onPress={() => nav.navigate('AccountSettings')}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: cardBg,
                borderRadius: radius.xl,
                padding: spacing.s16,
                gap: spacing.s12,
                borderWidth: 1,
                borderColor: withAlpha(border, isDark ? 0.5 : 1),
                opacity: pressed ? 0.85 : 1
              })}
            >
              <View style={{
                width: 48,
                height: 48,
                borderRadius: radius.lg,
                backgroundColor: withAlpha(accentSecondary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon name="settings" size={24} color={accentSecondary} />
              </View>
              <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Account settings</Text>
              <Text style={{ color: muted, fontSize: 13 }}>Manage your accounts</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </ScreenScroll>
  );
};

export default AccountsList;
