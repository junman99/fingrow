import React, { useEffect } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import AppHeader from '../components/AppHeader';
import { spacing, radius, elevation } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useProfileStore } from '../store/profile';
import { useTxStore } from '../store/transactions';
import { useNavigation } from '@react-navigation/native';

const Avatar: React.FC<{ uri?: string; size?: number }> = ({ uri, size=64 }) => {
  const { get } = useThemeTokens();
  return (
    <View style={{ width: size, height: size, borderRadius: size/2, overflow: 'hidden', backgroundColor: get('surface.level2') as string, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} /> :
        <Text style={{ color: get('text.muted') as string, fontWeight: '700' }}>🙂</Text>}
    </View>
  );
};

const Profile: React.FC = () => {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { profile, hydrate } = useProfileStore();
  const { transactions } = useTxStore();

  useEffect(() => { hydrate(); }, []);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  let mtd = 0; const daysLogged = new Set<number>();
  transactions.forEach(t => {
    const d = new Date(t.date);
    if (t.type === 'expense' && d >= start) {
      mtd += Math.abs(t.amount);
      daysLogged.add(d.getDate());
    }
  });
  const avgPerDay = daysLogged.size ? (mtd / daysLogged.size) : 0;
  const streak = daysLogged.size;

  return (
    <ScreenScroll>
      <AppHeader title="My Profile" />
      <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.xl, padding: spacing.s16, margin: spacing.s16, ...(elevation as any).level1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
          <Avatar uri={profile.avatarUri} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }} numberOfLines={1}>{profile.name}</Text>
            <Text style={{ color: get('text.muted') as string }} numberOfLines={1}>{profile.email}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s8 }}>
              <View style={{ backgroundColor: get('surface.level2') as string, paddingVertical: 4, paddingHorizontal: spacing.s8, borderRadius: 999 }}>
                <Text style={{ color: get('text.muted') as string }}>{profile.tier}</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={() => nav.navigate('ProfileEdit')} hitSlop={12}>
            <Text style={{ color: get('accent.primary') as string, fontWeight: '700' }}>Edit profile →</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.s12, marginHorizontal: spacing.s16 }}>
        {[
          { label: 'MTD', value: `$${mtd.toFixed(0)}` },
          { label: 'Avg/day', value: `$${avgPerDay.toFixed(0)}` },
          { label: 'Budget left', value: profile.monthlyBudget ? `$${Math.max(0, (profile.monthlyBudget - mtd)).toFixed(0)}` : '—' },
          { label: 'Streak', value: `${streak}d` },
        ].map((x, idx) => (
          <View key={idx} style={{ flex: 1, backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12, alignItems: 'center', ...(elevation as any).level1 }}>
            <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>{x.label}</Text>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', marginTop: 4 }}>{x.value}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: spacing.s16 }} />

      <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, marginHorizontal: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Money & Goals</Text>
        <Text style={{ color: get('text.muted') as string }}>Currency: {profile.currency}</Text>
        <Text style={{ color: get('text.muted') as string }}>Budget cycle day: {profile.budgetCycleDay}</Text>
        <Text style={{ color: get('text.muted') as string }}>Monthly budget: {profile.monthlyBudget ? `$${profile.monthlyBudget}` : '—'}</Text>
        <Text style={{ color: get('text.muted') as string }}>Savings goal: {profile.monthlySavingsGoal ? `$${profile.monthlySavingsGoal}` : '—'}</Text>
      </View>

      <View style={{ height: spacing.s16 }} />

      <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, marginHorizontal: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Preferences</Text>
        <Text style={{ color: get('text.muted') as string }}>Theme: {profile.themeMode}</Text>
        <Text style={{ color: get('text.muted') as string }}>Language: {profile.language ?? 'en'}</Text>
      </View>

      <View style={{ height: spacing.s16 }} />

      <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, marginHorizontal: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>Data & Privacy</Text>
        <Text style={{ color: get('text.muted') as string }}>Analytics: {profile.analyticsOptIn ? 'On' : 'Off'}</Text>
      </View>

      <View style={{ height: spacing.s24 }} />
    </ScreenScroll>
  );
};

export default Profile;
