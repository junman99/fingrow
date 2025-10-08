import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius, elevation } from '../theme/tokens';
import { ScreenScroll } from '../components/ScreenScroll';
import ProfileHero from '../components/ProfileHero';
import RoundAction from '../components/RoundAction';
import { MonthCompareChart } from '../components/MonthCompareChart';
import { RecentTransactionsCard } from '../components/RecentTransactionsCard';
import Icon from '../components/Icon';
import { useTxStore } from '../store/transactions';
import { useProfileStore } from '../store/profile';
import { useGroupsStore } from '../store/groups';

export const Home: React.FC = () => {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { get } = useThemeTokens();

  // stores
  const { transactions, hydrate: hydrateTx } = useTxStore();
  const { profile, hydrate: hydrateProfile } = useProfileStore();
  const { hydrate: hydrateGroups } = useGroupsStore();

  useEffect(() => { hydrateProfile(); hydrateTx(); hydrateGroups(); }, []);

  const fabOpacity = useRef(new Animated.Value(0)).current;
  // scroll state for inline->floating Add
  const [showFab, setShowFab] = useState(false);
  const onHomeScroll = useCallback((e:any) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    setShowFab(y > 96); // threshold; tune if needed
  }, []);

  useEffect(() => {
    Animated.timing(fabOpacity, { toValue: showFab ? 1 : 0, duration: 140, useNativeDriver: true }).start();
  }, [showFab]);

  const monthTotals = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    let mtd = 0, last = 0;
    (transactions || []).forEach((t:any) => {
      const d = new Date(t.date);
      if (t.type === 'expense') {
        if (d >= start) mtd += t.amount;
        if (d >= last7) last += t.amount;
      }
    });
    return { mtd, last7: last };
  }, [transactions]);

  const SummaryCard = () => (
    <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, ...elevation.level1 as any }}>
      <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>This month</Text>
      <Text style={{ color: get('text.muted') as string, marginTop: spacing.s8 }}>You spent ${(monthTotals.mtd || 0).toFixed(0)}</Text>
    </View>
  );

  const Recent = () => (
    <View style={{ marginTop: spacing.s16 }}>
      <RecentTransactionsCard />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll inTab onScroll={onHomeScroll} scrollEventThrottle={16} contentStyle={{ padding: spacing.s16 }}>
        {/* Top pinned header area content lives visually first in the scroll, but we keep only ONE profile hero */}
        <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => nav.navigate('ProfileEdit')} style={{ marginBottom: spacing.s16 }}>
          <ProfileHero name={profile?.name || 'There'} email={profile?.email} avatarUri={profile?.avatarUri} variant="blend" />
        </Pressable>

        <MonthCompareChart />

        {/* Quick actions row */}
        <View style={{ flexDirection: 'row', columnGap: spacing.s12, rowGap: spacing.s12, marginTop: spacing.s12 }}>
          <RoundAction iconName="plus-circle" label="Add" primary onPress={() => nav.navigate('Add')} />
          <RoundAction iconName="users-2" label="Groups" onPress={() => nav.navigate('Groups', { screen: 'GroupsRoot' })} />
          <RoundAction iconName="target" label="Goal" onPress={() => nav.navigate('Goals', { screen: 'GoalsRoot' })} />
          <RoundAction iconName="wallet" label="Budget" onPress={() => nav.navigate('BudgetModal')} />
          <RoundAction iconName="history" label="History" onPress={() => nav.navigate('TransactionsModal')} />
        </View>

        

        
        <Recent />
      </ScreenScroll>

      {/* Floating Add button at bottom-left when scrolled */}
      <Animated.View pointerEvents={showFab ? 'auto' : 'none'} style={{ opacity: fabOpacity }}>
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Add transaction"
    onPress={() => nav.navigate('Add')}
    style={({ pressed }) => ({
      position: 'absolute',
      left: 16,
      bottom: Math.max(insets.bottom, 12) + 12,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: get('accent.primary') as string,
      opacity: pressed ? 0.9 : 1,
      ...(elevation.level2 as any),
    })}
  >
    {/* Same look/feel as RoundAction's icon-only circle */}
    {/* We reuse the same Feather icon mapping via Icon component */}
    {/** Using plus-circle to match existing visuals */}
    {/* If you prefer a plain plus, we can add it to Icon.tsx map */}
    <Icon name={'plus-circle'} size={24} colorToken={'text.onPrimary'} />
  </Pressable>
</Animated.View>
    </View>
  );
};

export default Home;