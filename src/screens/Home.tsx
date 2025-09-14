import ProfileHero from '../components/ProfileHero';
import RoundAction from '../components/RoundAction';
import React, { useMemo, useEffect } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Button from '../components/Button';
import { spacing, radius, elevation } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useNavigation } from '@react-navigation/native';
import { useTxStore } from '../store/transactions';
import { useProfileStore } from '../store/profile';
import { useGroupsStore } from '../store/groups';
import { MonthCompareChart } from '../components/MonthCompareChart';
import { RecentTransactionsCard } from '../components/RecentTransactionsCard';

export const Home: React.FC = () => {
  const { profile, hydrate } = useProfileStore();
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { transactions, hydrate: hydrateTx } = useTxStore();
  const { groups, hydrate: hydrateGroups } = useGroupsStore();

  useEffect(() => { hydrate(); hydrateTx(); hydrateGroups(); }, []);

  const monthTotals = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7 = new Date(now.getFullYear(), now.getMonth(), now.getDate()-6);
    let mtd = 0, last = 0;
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (t.type === 'expense') {
        if (d >= start) mtd += t.amount;
        if (d >= last7) last += t.amount;
      }
    });
    return { mtd, last7: last };
  }, [transactions]);

  const SummaryCard = () => (
    <View style={{ backgroundColor: get('surface.level1') as string, borderColor: get('border.subtle') as string, borderWidth: 1, borderRadius: radius.lg, padding: spacing.s16, ...elevation.level1 }}>
      <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>This month</Text>
      <Text style={{ color: get('text.primary') as string, fontSize: 28, fontWeight: '800', marginTop: spacing.s8 }}>${monthTotals.mtd.toFixed(2)}</Text>
      <Text style={{ color: get('text.muted') as string, marginTop: spacing.s8 }}>Last 7 days: ${monthTotals.last7.toFixed(2)}</Text>
    </View>
  );


  const isSameDay = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  const fmtTime = (d: Date) => {
    let h = d.getHours(); const m = d.getMinutes().toString().padStart(2,'0');
    const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  };
  const fmtDay = (d: Date) => {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
    if (isSameDay(d, today)) return 'Today';
    if (isSameDay(d, yesterday)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

    const Recent = () => (
    <RecentTransactionsCard />
  );
  return (
    <ScreenScroll allowBounce allowBounce>
            <View style={{ flex: 1, padding: spacing.s16, gap: spacing.s16 }}>
        <Pressable onPress={() => nav.navigate('ProfileModal')}>
          <ProfileHero name={profile.name || "There"} email={profile.email} avatarUri={profile.avatarUri} />
        </Pressable>
                <MonthCompareChart />
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          <RoundAction iconName="plus-circle" label="Add" primary onPress={() => nav.navigate('Add')} />
          <RoundAction iconName="users-2" label="Groups" onPress={() => nav.navigate('Groups', { screen: 'GroupsRoot' })} />
          <RoundAction iconName="target" label="Goal" onPress={() => {}} />
          <RoundAction iconName="wallet" label="Budget" onPress={() => nav.navigate('BudgetModal')} />
          <RoundAction iconName="history" label="History" onPress={() => nav.navigate('TransactionsModal')} />
        </View>
        <Recent />
      </View>
    </ScreenScroll>
  );
};