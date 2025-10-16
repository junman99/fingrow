import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Switch,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens, useTheme } from '../theme/ThemeProvider';
import { useProfileStore, type ThemeMode } from '../store/profile';
import { useInvestStore } from '../store/invest';
import { useNavigation } from '@react-navigation/native';
import ProfileHero from '../components/ProfileHero';
import Button from '../components/Button';
import { Card } from '../components/Card';
import BottomSheet from '../components/BottomSheet';
import Icon from '../components/Icon';
import { currencies, findCurrency } from '../lib/currencies';
import { seedFiveMonths, clearAllData } from '../lib/demo';
import { seedInvestSixMonths, clearInvestDemo } from '../lib/demo_invest';
import { exportPortfolioCsv } from '../lib/export';
import { useAuthStore } from '../store/auth';

type ThemeOption = { label: string; value: ThemeMode };

const themeOptions: ThemeOption[] = [
  { label: 'Use device setting', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const SettingsSection: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => {
  const { get } = useThemeTokens();
  return (
    <Card style={{ gap: spacing.s12 }}>
      <View style={{ gap: spacing.s4 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }}>
          {title}
        </Text>
        {description ? (
          <Text style={{ color: get('text.muted') as string, lineHeight: 18 }}>{description}</Text>
        ) : null}
      </View>
      {children}
    </Card>
  );
};

const Row: React.FC<{
  title: string;
  subtitle?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}> = ({ title, subtitle, onPress, children }) => {
  const { get } = useThemeTokens();
  const content = (
    <View style={{ flex: 1 }}>
      <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: get('text.muted') as string, marginTop: spacing.s2 }}>{subtitle}</Text>
      ) : null}
    </View>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.s12,
        paddingVertical: spacing.s12,
      }}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {content}
          <Icon name="chevron-right" size={18} />
        </Pressable>
      ) : (
        content
      )}
      {children}
    </View>
  );
};

export const Settings: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const { setMode } = useTheme();
  const { profile, update, clearAllLocalData } = useProfileStore();
  const { signOut } = useAuthStore();
  const { refreshFx, setQuoteProvider } = useInvestStore();
  const activePortfolioId = useInvestStore(state => state.activePortfolioId);
  const quoteProvider = useInvestStore(
    s => (s.profile?.quoteProvider ?? 'auto'),
  ) as 'auto' | 'yahoo' | 'stooq';

  const [currencySheet, setCurrencySheet] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');

  const heroGradient: [string, string] = [
    `${get('accent.primary') as string}`,
    `${get('accent.secondary') as string}`,
  ];
  const heroText = get('text.onPrimary') as string;
  const heroMuted = `rgba(255,255,255,${isDark ? 0.7 : 0.9})`;

  const selectedCurrency = useMemo(
    () => findCurrency(profile.currency || 'USD'),
    [profile.currency],
  );

  const filteredCurrencies = useMemo(() => {
    const q = currencyQuery.trim().toLowerCase();
    if (!q.length) return currencies;
    return currencies.filter(
      c =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.regions || []).some(r => r.toLowerCase().includes(q)),
    );
  }, [currencyQuery]);

  const handleThemeChange = async (value: ThemeMode) => {
    setMode(value);
    update({ themeMode: value });
    try {
      await Haptics.selectionAsync();
    } catch {}
  };

  const handleCurrencyChange = async (code: string) => {
    update({ currency: code.toUpperCase() });
    setCurrencySheet(false);
    setCurrencyQuery('');
    try {
      await Promise.all([
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        refreshFx(),
      ]);
    } catch {
      try { await refreshFx(); } catch {}
    }
  };

  const adjustBudgetCycleDay = (delta: number) => {
    const next = Math.max(1, Math.min(31, Number(profile.budgetCycleDay || 1) + delta));
    update({ budgetCycleDay: next });
  };

  const toggleAlert = (key: keyof typeof profile.alerts) => {
    const next = !profile.alerts?.[key];
    update({ alerts: { ...profile.alerts, [key]: next } });
  };

  const toggleAnalytics = (value: boolean) => {
    update({ analyticsOptIn: value });
  };

  const handleClearAll = async () => {
    await clearAllData();
    await clearInvestDemo();
    await clearAllLocalData();
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const quickActions = [
    {
      label: 'Edit profile',
      icon: 'edit' as const,
      onPress: () => nav.navigate('ProfileEdit'),
    },
    {
      label: 'Manage accounts',
      icon: 'wallet' as const,
      onPress: () => nav.navigate('AddAccount'),
    },
    {
      label: 'Review budgets',
      icon: 'target' as const,
      onPress: () => nav.navigate('Budgets'),
    },
    {
      label: 'Open support',
      icon: 'users-2' as const,
      onPress: () => nav.navigate('ProfileModal', { screen: 'Support' }),
    },
    {
      label: 'Log out',
      icon: 'arrow-bold-left' as const,
      onPress: async () => {
        Alert.alert('Sign out?', 'You can sign back in anytime with your email or social login.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
        ]);
      },
    },
  ];

  return (
    <>
      <ScreenScroll
        inTab
        contentStyle={{ padding: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s16 }}
      >
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.s16,
            paddingBottom: spacing.s24,
            gap: spacing.s12,
          }}
        >
          <Text style={{ color: heroMuted, fontWeight: '700', fontSize: 12, letterSpacing: 0.6 }}>
            SETTINGS HUB
          </Text>
          <Text style={{ color: heroText, fontSize: 28, fontWeight: '800' }}>
            Your FinGrow control room
          </Text>
          <Text style={{ color: heroMuted }}>
            Tune preferences, currencies, alerts, and data tools to keep FinGrow locked on your
            goals.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s6 }}>
            <View
              style={{
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <Text style={{ color: heroText, fontWeight: '700' }}>
                Currency • {selectedCurrency?.code || profile.currency}
              </Text>
            </View>
            <View
              style={{
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <Text style={{ color: heroText, fontWeight: '700' }}>
                Budget day • {profile.budgetCycleDay}
              </Text>
            </View>
            <View
              style={{
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <Text style={{ color: heroText, fontWeight: '700' }}>
                Theme • {profile.themeMode.toUpperCase()}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => nav.navigate('ProfileModal')}
        >
          <ProfileHero
            name={profile.name}
            email={profile.email}
            avatarUri={profile.avatarUri}
            variant="blend"
          />
        </Pressable>

        <SettingsSection title="Quick actions">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
            {quickActions.map(action => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.s8,
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.lg,
                  backgroundColor: get('surface.level2') as string,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Icon name={action.icon} size={18} />
                <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </SettingsSection>

        <SettingsSection title="Appearance" description="Personalise how FinGrow feels across light and dark surfaces.">
          <View style={{ gap: spacing.s8 }}>
            {themeOptions.map(option => {
              const selected = profile.themeMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleThemeChange(option.value)}
                  style={({ pressed }) => ({
                    borderRadius: radius.lg,
                    borderWidth: 1.5,
                    borderColor: selected ? (get('accent.primary') as string) : (get('border.subtle') as string),
                    paddingVertical: spacing.s10,
                    paddingHorizontal: spacing.s16,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: get('text.primary') as string,
                      fontWeight: '700',
                    }}
                  >
                    {option.label}
                  </Text>
                  <Text style={{ color: get('text.muted') as string, marginTop: spacing.s4 }}>
                    {selected ? 'Currently active' : 'Tap to switch'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SettingsSection>

        <SettingsSection
          title="Money preferences"
          description="Base currency drives reports and conversions. Budget day locks recurring tracking."
        >
          <Row
            title="Primary currency"
            subtitle={`Displayed across insights • ${selectedCurrency?.name || 'Set preferred currency'}`}
            onPress={() => setCurrencySheet(true)}
          />
          <Row
            title="Budget cycle start"
            subtitle={`Day ${profile.budgetCycleDay} • impacts envelopes and pacing`}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s8,
                backgroundColor: get('surface.level2') as string,
                borderRadius: radius.pill,
                paddingVertical: spacing.s4,
                paddingHorizontal: spacing.s8,
              }}
            >
              <Pressable
                onPress={() => adjustBudgetCycleDay(-1)}
                style={({ pressed }) => ({
                  padding: spacing.s8,
                  borderRadius: radius.pill,
                  backgroundColor: pressed ? get('surface.level1') : 'transparent',
                })}
              >
                <Icon name="chevron-left" size={18} />
              </Pressable>
              <Text style={{ color: get('text.primary') as string, fontWeight: '700', minWidth: 32, textAlign: 'center' }}>
                {profile.budgetCycleDay}
              </Text>
              <Pressable
                onPress={() => adjustBudgetCycleDay(1)}
                style={({ pressed }) => ({
                  padding: spacing.s8,
                  borderRadius: radius.pill,
                  backgroundColor: pressed ? get('surface.level1') : 'transparent',
                })}
              >
                <Icon name="chevron-right" size={18} />
              </Pressable>
            </View>
          </Row>
          <Row
            title="Refresh FX rates"
            subtitle="Pull latest USD cross rates for portfolio conversions"
            onPress={async () => {
              try {
                await refreshFx();
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {
                try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
              }
            }}
          />
        </SettingsSection>

        <SettingsSection
          title="Investments"
          description="Choose your market data source and manage watchlists faster."
        >
          <Text style={{ color: get('text.muted') as string }}>Market data source</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: spacing.s8, gap: spacing.s8 }}
          >
            {(['auto', 'yahoo', 'stooq'] as const).map(key => {
              const active = quoteProvider === key;
              return (
                <Pressable
                  key={key}
                  onPress={async () => {
                    try {
                      await setQuoteProvider(key);
                      await Haptics.selectionAsync();
                    } catch {}
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.s8,
                    paddingHorizontal: spacing.s16,
                    borderRadius: radius.pill,
                    backgroundColor: active
                      ? (get('accent.primary') as string)
                      : (get('surface.level2') as string),
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: active ? (get('text.onPrimary') as string) : (get('text.primary') as string),
                      fontWeight: '700',
                    }}
                  >
                    {key.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button
            title="Export active portfolio (.csv)"
            variant="secondary"
            onPress={async () => {
              if (!activePortfolioId) {
                Alert.alert('No portfolio selected', 'Set an active portfolio in Invest to export.');
                return;
              }
              try {
                await exportPortfolioCsv(activePortfolioId);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (err) {
                Alert.alert('Export failed', err instanceof Error ? err.message : 'Unknown error');
              }
            }}
          />
        </SettingsSection>

        <SettingsSection title="Notifications & alerts" description="Toggle reminders that keep budgets, debts, and goals on track.">
          <Row
            title="Budget pacing alerts"
            subtitle="Warn me when envelopes are trending over"
          >
            <Switch
              value={profile.alerts?.budgetWarnings ?? true}
              onValueChange={() => toggleAlert('budgetWarnings')}
            />
          </Row>
          <Row
            title="Large transaction ping"
            subtitle="Flag transactions above my comfort threshold"
          >
            <Switch
              value={profile.alerts?.largeTx ?? true}
              onValueChange={() => toggleAlert('largeTx')}
            />
          </Row>
          <Row
            title="Goal nudges"
            subtitle="Remind me to top up savings and pay down debt"
          >
            <Switch
              value={profile.alerts?.goalReminders ?? false}
              onValueChange={() => toggleAlert('goalReminders')}
            />
          </Row>
        </SettingsSection>

        <SettingsSection title="Privacy & analytics" description="Decide if anonymous product analytics help us improve FinGrow.">
          <Row
            title="Share anonymous analytics"
            subtitle="Help prioritise features that matter most"
          >
            <Switch value={profile.analyticsOptIn} onValueChange={toggleAnalytics} />
          </Row>
        </SettingsSection>

        <SettingsSection title="Account controls" description="Manage your active sessions and privacy.">
          <Row
            title="Log out of FinGrow"
            subtitle="End the current session on this device"
            onPress={() =>
              Alert.alert('Sign out?', 'You will need to sign in again to access your data.', [
                { text: 'Stay', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
              ])
            }
          />
        </SettingsSection>

        <SettingsSection title="Data & diagnostics">
          <Button
            title="Seed 5 months of demo transactions"
            variant="secondary"
            onPress={seedFiveMonths}
          />
          <Button
            title="Clear personal transactions"
            variant="secondary"
            onPress={clearAllData}
          />
          <Button
            title="Generate 6 months of demo investment activity"
            onPress={seedInvestSixMonths}
          />
          <Button
            title="Remove demo investment data"
            variant="secondary"
            onPress={clearInvestDemo}
          />
          <Button
            title="Factory reset (profile + demo)"
            variant="secondary"
            onPress={handleClearAll}
          />
        </SettingsSection>
      </ScreenScroll>

      <BottomSheet
        visible={currencySheet}
        onClose={() => setCurrencySheet(false)}
        fullHeight
      >
        <View style={{ gap: spacing.s12, flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: get('text.primary') as string }}>
            Choose primary currency
          </Text>
          <Text style={{ color: get('text.muted') as string }}>
            We convert US trades into your chosen currency using the latest FX rates.
          </Text>
          <View
            style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: get('border.subtle') as string,
              paddingHorizontal: spacing.s12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <TextInput
              value={currencyQuery}
              onChangeText={setCurrencyQuery}
              placeholder="Search currency or country..."
              placeholderTextColor={get('text.muted') as string}
              style={{
                flex: 1,
                height: 44,
                color: get('text.primary') as string,
              }}
            />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.s16 }}
            showsVerticalScrollIndicator={false}
          >
            {filteredCurrencies.map(cur => {
              const active = profile.currency?.toUpperCase() === cur.code;
              return (
                <Pressable
                  key={cur.code}
                  onPress={() => handleCurrencyChange(cur.code)}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.s10,
                    paddingHorizontal: spacing.s12,
                    borderRadius: radius.lg,
                    backgroundColor: active
                      ? withOverlay(get('accent.primary') as string, isDark ? 0.26 : 0.16)
                      : 'transparent',
                    marginBottom: spacing.s4,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>
                    {cur.code} · {cur.name}
                  </Text>
                  <Text style={{ color: get('text.muted') as string, marginTop: spacing.s2 }}>
                    {cur.symbol} {cur.regions?.join(', ') || ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>
    </>
  );
};

function withOverlay(color: string, alpha: number) {
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

export default Settings;
