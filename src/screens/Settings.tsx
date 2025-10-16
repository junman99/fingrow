import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  Animated,
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

type ThemeOption = { label: string; value: ThemeMode; icon: string; description: string };

const themeOptions: ThemeOption[] = [
  { label: 'Auto', value: 'system', icon: 'sparkles', description: 'Match device settings' },
  { label: 'Light', value: 'light', icon: 'sun', description: 'Cream & warm tones' },
  { label: 'Dark', value: 'dark', icon: 'moon', description: 'Espresso & mint' },
];

// Animated pressable component with scale effect
const AnimatedPressable: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}> = ({ onPress, children, style }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const SettingsSection: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: string;
}> = ({ title, description, children, icon }) => {
  const { get } = useThemeTokens();
  return (
    <View style={{ gap: spacing.s12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
        {icon && <Icon name={icon as any} size={20} color={get('accent.primary') as string} />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }}>
            {title}
          </Text>
          {description ? (
            <Text style={{ color: get('text.muted') as string, fontSize: 13, marginTop: spacing.s2 }}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ gap: spacing.s8 }}>
        {children}
      </View>
    </View>
  );
};

const SettingRow: React.FC<{
  title: string;
  subtitle?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  icon?: string;
}> = ({ title, subtitle, onPress, children, icon }) => {
  const { get } = useThemeTokens();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s12,
        paddingVertical: spacing.s12,
        paddingHorizontal: spacing.s16,
        backgroundColor: get('surface.level1') as string,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: get('border.subtle') as string,
      }}
    >
      {icon && (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: get('surface.level2') as string,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon as any} size={18} color={get('text.primary') as string} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '600', fontSize: 15 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: get('text.muted') as string, fontSize: 13, marginTop: spacing.s2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
      {onPress && <Icon name="chevron-right" size={18} color={get('text.muted') as string} />}
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress}>
        {content}
      </AnimatedPressable>
    );
  }

  return content;
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
    try { Haptics.selectionAsync(); } catch {}
  };

  const toggleAlert = (key: keyof typeof profile.alerts) => {
    const next = !profile.alerts?.[key];
    update({ alerts: { ...profile.alerts, [key]: next } });
    try { Haptics.selectionAsync(); } catch {}
  };

  const toggleAnalytics = (value: boolean) => {
    update({ analyticsOptIn: value });
    try { Haptics.selectionAsync(); } catch {}
  };

  const handleClearAll = async () => {
    await clearAllData();
    await clearInvestDemo();
    await clearAllLocalData();
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  return (
    <>
      <ScreenScroll
        inTab
        contentStyle={{ padding: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s24 }}
      >
        {/* Hero Profile Card */}
        <AnimatedPressable
          onPress={() => nav.navigate('ProfileModal')}
        >
          <View
            style={{
              backgroundColor: get('surface.level1') as string,
              borderRadius: radius.xl,
              borderWidth: 2,
              borderColor: get('border.subtle') as string,
              padding: spacing.s24,
              gap: spacing.s16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s16 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius.xl,
                  backgroundColor: get('accent.primary') as string,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: '800', color: get('text.onPrimary') as string }}>
                  {profile.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: get('text.primary') as string, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
                  {profile.name || 'User'}
                </Text>
                <Text style={{ color: get('text.muted') as string, fontSize: 14, marginTop: spacing.s2 }}>
                  {profile.email || 'No email set'}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={get('text.muted') as string} />
            </View>

            {/* Quick stats */}
            <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
              <View
                style={{
                  flex: 1,
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.lg,
                  backgroundColor: get('surface.level2') as string,
                  borderWidth: 1,
                  borderColor: get('border.subtle') as string,
                }}
              >
                <Text style={{ color: get('text.muted') as string, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                  CURRENCY
                </Text>
                <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 15, marginTop: spacing.s2 }}>
                  {selectedCurrency?.code || 'USD'}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.lg,
                  backgroundColor: get('surface.level2') as string,
                  borderWidth: 1,
                  borderColor: get('border.subtle') as string,
                }}
              >
                <Text style={{ color: get('text.muted') as string, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                  CYCLE DAY
                </Text>
                <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 15, marginTop: spacing.s2 }}>
                  {profile.budgetCycleDay}
                </Text>
              </View>
            </View>
          </View>
        </AnimatedPressable>

        {/* Quick Actions Grid */}
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16, letterSpacing: -0.3 }}>
            Quick actions
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <AnimatedPressable
              onPress={() => nav.navigate('ProfileEdit')}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  padding: spacing.s16,
                  borderRadius: radius.lg,
                  backgroundColor: get('surface.level1') as string,
                  borderWidth: 1,
                  borderColor: get('border.subtle') as string,
                  alignItems: 'center',
                  gap: spacing.s8,
                  minHeight: 100,
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: get('surface.level2') as string,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="edit" size={20} color={get('accent.primary') as string} />
                </View>
                <Text style={{ color: get('text.primary') as string, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                  Edit profile
                </Text>
              </View>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={() => nav.navigate('AddAccount')}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  padding: spacing.s16,
                  borderRadius: radius.lg,
                  backgroundColor: get('surface.level1') as string,
                  borderWidth: 1,
                  borderColor: get('border.subtle') as string,
                  alignItems: 'center',
                  gap: spacing.s8,
                  minHeight: 100,
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: get('surface.level2') as string,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="wallet" size={20} color={get('accent.secondary') as string} />
                </View>
                <Text style={{ color: get('text.primary') as string, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                  Accounts
                </Text>
              </View>
            </AnimatedPressable>

            <AnimatedPressable
              onPress={() => nav.navigate('Budgets')}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  padding: spacing.s16,
                  borderRadius: radius.lg,
                  backgroundColor: get('surface.level1') as string,
                  borderWidth: 1,
                  borderColor: get('border.subtle') as string,
                  alignItems: 'center',
                  gap: spacing.s8,
                  minHeight: 100,
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: get('surface.level2') as string,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="target" size={20} color={get('semantic.success') as string} />
                </View>
                <Text style={{ color: get('text.primary') as string, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                  Budgets
                </Text>
              </View>
            </AnimatedPressable>
          </View>
        </View>

        {/* Theme Selection */}
        <SettingsSection title="Appearance" description="Choose your visual vibe" icon="palette">
          <View style={{ gap: spacing.s8 }}>
            {themeOptions.map(option => {
              const selected = profile.themeMode === option.value;
              return (
                <AnimatedPressable
                  key={option.value}
                  onPress={() => handleThemeChange(option.value)}
                >
                  <View
                    style={{
                      borderRadius: radius.lg,
                      borderWidth: 2,
                      borderColor: selected ? (get('accent.primary') as string) : (get('border.subtle') as string),
                      padding: spacing.s16,
                      backgroundColor: selected
                        ? withAlpha(get('accent.primary') as string, 0.08)
                        : (get('surface.level1') as string),
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: radius.md,
                          backgroundColor: selected
                            ? (get('accent.primary') as string)
                            : (get('surface.level2') as string),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon
                          name={option.icon as any}
                          size={22}
                          color={selected ? (get('text.onPrimary') as string) : (get('text.primary') as string)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: get('text.primary') as string,
                            fontWeight: '700',
                            fontSize: 16,
                          }}
                        >
                          {option.label}
                        </Text>
                        <Text style={{ color: get('text.muted') as string, fontSize: 13, marginTop: spacing.s2 }}>
                          {option.description}
                        </Text>
                      </View>
                      {selected && (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: radius.pill,
                            backgroundColor: get('accent.primary') as string,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon name="check" size={14} color={get('text.onPrimary') as string} />
                        </View>
                      )}
                    </View>
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        </SettingsSection>

        {/* Money Preferences */}
        <SettingsSection title="Money settings" description="Currency and budget cycles" icon="dollar-sign">
          <SettingRow
            title="Primary currency"
            subtitle={`${selectedCurrency?.name || 'USD'} • ${selectedCurrency?.symbol || '$'}`}
            onPress={() => setCurrencySheet(true)}
            icon="banknote"
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.s12,
              paddingHorizontal: spacing.s16,
              backgroundColor: get('surface.level1') as string,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: get('border.subtle') as string,
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.s12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.md,
                    backgroundColor: get('surface.level2') as string,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="calendar" size={18} color={get('text.primary') as string} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: get('text.primary') as string, fontWeight: '600', fontSize: 15 }}>
                    Budget cycle day
                  </Text>
                  <Text style={{ color: get('text.muted') as string, fontSize: 13, marginTop: spacing.s2 }}>
                    Monthly reset on day {profile.budgetCycleDay}
                  </Text>
                </View>
              </View>
            </View>
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
                  padding: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: pressed ? get('surface.level1') : 'transparent',
                })}
              >
                <Icon name="minus" size={16} color={get('text.primary') as string} />
              </Pressable>
              <Text
                style={{
                  color: get('text.primary') as string,
                  fontWeight: '800',
                  minWidth: 24,
                  textAlign: 'center',
                  fontSize: 16,
                }}
              >
                {profile.budgetCycleDay}
              </Text>
              <Pressable
                onPress={() => adjustBudgetCycleDay(1)}
                style={({ pressed }) => ({
                  padding: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: pressed ? get('surface.level1') : 'transparent',
                })}
              >
                <Icon name="plus" size={16} color={get('text.primary') as string} />
              </Pressable>
            </View>
          </View>

          <SettingRow
            title="Refresh exchange rates"
            subtitle="Update currency conversions"
            onPress={async () => {
              try {
                await refreshFx();
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {
                try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
              }
            }}
            icon="refresh-cw"
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications" description="Stay informed about your money" icon="bell">
          <View
            style={{
              backgroundColor: get('surface.level1') as string,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: get('border.subtle') as string,
              overflow: 'hidden',
            }}
          >
            {[
              { key: 'budgetWarnings' as const, title: 'Budget alerts', subtitle: 'Warn when overspending', icon: 'alert-triangle' },
              { key: 'largeTx' as const, title: 'Large transactions', subtitle: 'Flag unusual spending', icon: 'trending-up' },
              { key: 'goalReminders' as const, title: 'Goal nudges', subtitle: 'Savings & debt reminders', icon: 'flag' },
            ].map((item, idx, arr) => (
              <View key={item.key}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.s12,
                    paddingHorizontal: spacing.s16,
                    gap: spacing.s12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      backgroundColor: get('surface.level2') as string,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={item.icon as any} size={18} color={get('text.primary') as string} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: get('text.primary') as string, fontWeight: '600', fontSize: 15 }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: get('text.muted') as string, fontSize: 13, marginTop: spacing.s2 }}>
                      {item.subtitle}
                    </Text>
                  </View>
                  <Switch
                    value={profile.alerts?.[item.key] ?? (item.key === 'goalReminders' ? false : true)}
                    onValueChange={() => toggleAlert(item.key)}
                  />
                </View>
                {idx < arr.length - 1 && (
                  <View
                    style={{
                      height: 1,
                      backgroundColor: get('border.subtle') as string,
                      marginLeft: 64,
                    }}
                  />
                )}
              </View>
            ))}
          </View>
        </SettingsSection>

        {/* Investments */}
        <SettingsSection title="Investments" description="Market data and portfolio tools" icon="trending-up">
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: get('text.muted') as string, fontSize: 13, fontWeight: '600' }}>
              Market data provider
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
              {(['auto', 'yahoo', 'stooq'] as const).map(key => {
                const active = quoteProvider === key;
                return (
                  <AnimatedPressable
                    key={key}
                    onPress={async () => {
                      try {
                        await setQuoteProvider(key);
                        await Haptics.selectionAsync();
                      } catch {}
                    }}
                  >
                    <View
                      style={{
                        paddingVertical: spacing.s10,
                        paddingHorizontal: spacing.s16,
                        borderRadius: radius.pill,
                        backgroundColor: active
                          ? (get('accent.primary') as string)
                          : (get('surface.level1') as string),
                        borderWidth: 1,
                        borderColor: active
                          ? (get('accent.primary') as string)
                          : (get('border.subtle') as string),
                      }}
                    >
                      <Text
                        style={{
                          color: active ? (get('text.onPrimary') as string) : (get('text.primary') as string),
                          fontWeight: '700',
                          fontSize: 14,
                        }}
                      >
                        {key.toUpperCase()}
                      </Text>
                    </View>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>

          <SettingRow
            title="Export portfolio"
            subtitle="Download as CSV file"
            onPress={async () => {
              if (!activePortfolioId) {
                Alert.alert('No portfolio', 'Select a portfolio in the Invest tab first.');
                return;
              }
              try {
                await exportPortfolioCsv(activePortfolioId);
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (err) {
                Alert.alert('Export failed', err instanceof Error ? err.message : 'Unknown error');
              }
            }}
            icon="download"
          />
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection title="Privacy" description="Control your data" icon="shield">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.s12,
              paddingHorizontal: spacing.s16,
              backgroundColor: get('surface.level1') as string,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: get('border.subtle') as string,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.md,
                  backgroundColor: get('surface.level2') as string,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="bar-chart-2" size={18} color={get('text.primary') as string} />
              </View>
              <View style={{ flex: 1, paddingRight: spacing.s12 }}>
                <Text style={{ color: get('text.primary') as string, fontWeight: '600', fontSize: 15 }}>
                  Anonymous analytics
                </Text>
                <Text style={{ color: get('text.muted') as string, fontSize: 13, marginTop: spacing.s2 }}>
                  Help improve FinGrow
                </Text>
              </View>
            </View>
            <Switch value={profile.analyticsOptIn} onValueChange={toggleAnalytics} />
          </View>
        </SettingsSection>

        {/* Account actions */}
        <SettingsSection title="Account" description="Session and data management" icon="user">
          <SettingRow
            title="Get support"
            subtitle="Help center and contact"
            onPress={() => nav.navigate('ProfileModal', { screen: 'Support' })}
            icon="help-circle"
          />

          <SettingRow
            title="Sign out"
            subtitle="End current session"
            onPress={() =>
              Alert.alert('Sign out?', 'You can sign back in anytime.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
              ])
            }
            icon="log-out"
          />
        </SettingsSection>

        {/* Developer tools - collapsible or hidden in production */}
        <View
          style={{
            padding: spacing.s16,
            borderRadius: radius.lg,
            backgroundColor: get('surface.level2') as string,
            borderWidth: 1,
            borderColor: get('border.subtle') as string,
            gap: spacing.s8,
          }}
        >
          <Text style={{ color: get('text.muted') as string, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
            DEVELOPER TOOLS
          </Text>
          <Button
            title="Seed demo spending (5 months)"
            variant="secondary"
            onPress={seedFiveMonths}
          />
          <Button
            title="Seed demo investing (6 months)"
            variant="secondary"
            onPress={seedInvestSixMonths}
          />
          <Button
            title="Clear all data"
            variant="secondary"
            onPress={() =>
              Alert.alert('Clear all data?', 'This will remove all transactions, accounts, and settings.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: handleClearAll },
              ])
            }
          />
        </View>

        {/* Footer */}
        <Text
          style={{
            color: get('text.muted') as string,
            fontSize: 12,
            textAlign: 'center',
            paddingVertical: spacing.s16,
          }}
        >
          FinGrow • Made with care for the next generation
        </Text>
      </ScreenScroll>

      {/* Currency Picker Bottom Sheet */}
      <BottomSheet
        visible={currencySheet}
        onClose={() => setCurrencySheet(false)}
        fullHeight
      >
        <View style={{ gap: spacing.s16, flex: 1 }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: get('text.primary') as string, letterSpacing: -0.5 }}>
              Choose currency
            </Text>
            <Text style={{ color: get('text.muted') as string, marginTop: spacing.s4 }}>
              Used for conversions and reports
            </Text>
          </View>

          <View
            style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: get('border.subtle') as string,
              paddingHorizontal: spacing.s12,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: get('surface.level1') as string,
            }}
          >
            <Icon name="search" size={18} color={get('text.muted') as string} />
            <TextInput
              value={currencyQuery}
              onChangeText={setCurrencyQuery}
              placeholder="Search currencies..."
              placeholderTextColor={get('text.muted') as string}
              style={{
                flex: 1,
                height: 48,
                color: get('text.primary') as string,
                paddingHorizontal: spacing.s12,
              }}
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.s16, gap: spacing.s6 }}
            showsVerticalScrollIndicator={false}
          >
            {filteredCurrencies.map(cur => {
              const active = profile.currency?.toUpperCase() === cur.code;
              return (
                <AnimatedPressable
                  key={cur.code}
                  onPress={() => handleCurrencyChange(cur.code)}
                >
                  <View
                    style={{
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s16,
                      borderRadius: radius.lg,
                      backgroundColor: active
                        ? withAlpha(get('accent.primary') as string, 0.12)
                        : (get('surface.level1') as string),
                      borderWidth: 1,
                      borderColor: active
                        ? (get('accent.primary') as string)
                        : (get('border.subtle') as string),
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.s12,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.md,
                        backgroundColor: get('surface.level2') as string,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: '700' }}>{cur.symbol}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 15 }}>
                        {cur.code} · {cur.name}
                      </Text>
                      <Text style={{ color: get('text.muted') as string, marginTop: spacing.s2, fontSize: 13 }}>
                        {cur.regions?.join(', ') || 'International'}
                      </Text>
                    </View>
                    {active && (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: radius.pill,
                          backgroundColor: get('accent.primary') as string,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="check" size={14} color={get('text.onPrimary') as string} />
                      </View>
                    )}
                  </View>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>
    </>
  );
};

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

export default Settings;
