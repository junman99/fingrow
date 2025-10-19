import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, Switch, Image } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Input from '../components/Input';
import Button from '../components/Button';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens, useTheme } from '../theme/ThemeProvider';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useProfileStore, type ThemeMode } from '../store/profile';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';

const ProfileEdit: React.FC = () => {
  const { get } = useThemeTokens();
  const { setMode } = useTheme();
  const { profile, hydrate, update, setAvatar } = useProfileStore();
  const navigation = useNavigation<any>();

  const [name, setName] = useState(profile.name);
  const [handle, setHandle] = useState(profile.handle ?? '');
  const [email, setEmail] = useState(profile.email);
  const [currency, setCurrency] = useState(profile.currency);
  const [budgetCycleDay, setBudgetCycleDay] = useState(String(profile.budgetCycleDay));
  const [monthlyBudget, setMonthlyBudget] = useState(profile.monthlyBudget ? String(profile.monthlyBudget) : '');
  const [monthlySavingsGoal, setMonthlySavingsGoal] = useState(profile.monthlySavingsGoal ? String(profile.monthlySavingsGoal) : '');
  const [themeMode, setThemeMode] = useState(profile.themeMode);
  const [language, setLanguage] = useState(profile.language ?? 'en');
  const [analytics, setAnalytics] = useState(profile.analyticsOptIn);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    setName(profile.name);
    setHandle(profile.handle ?? '');
    setEmail(profile.email);
    setCurrency(profile.currency);
    setBudgetCycleDay(String(profile.budgetCycleDay));
    setMonthlyBudget(profile.monthlyBudget ? String(profile.monthlyBudget) : '');
    setMonthlySavingsGoal(profile.monthlySavingsGoal ? String(profile.monthlySavingsGoal) : '');
    setThemeMode(profile.themeMode);
    setLanguage(profile.language ?? 'en');
    setAnalytics(profile.analyticsOptIn);
  }, [profile]);

  const askPick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow photo access to set your avatar.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.9 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const dest = ((FileSystem as any)?.documentDirectory || '') + 'avatar.jpg';
    try {
      if (asset?.uri) {
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
      }
    } catch {}
    await setAvatar(dest);
  };

  const onRemoveAvatar = () => {
    Alert.alert('Remove photo?', 'We will switch back to your initials.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setAvatar(undefined) },
    ]);
  };

  const onSave = async () => {
    const patch: any = {
      name, handle: handle || undefined, email, currency,
      budgetCycleDay: Math.max(1, Math.min(31, Number(budgetCycleDay)||1)),
      monthlyBudget: monthlyBudget ? Number(monthlyBudget) : undefined,
      monthlySavingsGoal: monthlySavingsGoal ? Number(monthlySavingsGoal) : undefined,
      themeMode, language, analyticsOptIn: analytics,
    };
    update(patch);
    setMode(themeMode);
    Alert.alert('Saved', 'Your profile has been updated.');
  };

  const onReset = () => {
    setName(profile.name);
    setHandle(profile.handle ?? '');
    setEmail(profile.email);
    setCurrency(profile.currency);
    setBudgetCycleDay(String(profile.budgetCycleDay));
    setMonthlyBudget(profile.monthlyBudget ? String(profile.monthlyBudget) : '');
    setMonthlySavingsGoal(profile.monthlySavingsGoal ? String(profile.monthlySavingsGoal) : '');
    setThemeMode(profile.themeMode);
    setLanguage(profile.language ?? 'en');
    setAnalytics(profile.analyticsOptIn);
    Alert.alert('Changes reset', 'We restored your last saved profile details.');
  };

  const accentPrimary = get('accent.primary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const borderSubtle = get('border.subtle') as string;

  const avatarInitials = (() => {
    const n = name?.trim() || profile?.name?.trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
    return (parts[0][0] + parts[1][0]).toUpperCase();
  })();

  const themeOptions: { mode: ThemeMode; label: string; icon: 'smartphone' | 'sun' | 'moon' }[] = [
    { mode: 'system', label: 'System', icon: 'smartphone' },
    { mode: 'light', label: 'Light', icon: 'sun' },
    { mode: 'dark', label: 'Dark', icon: 'moon' },
  ];

  return (
    <ScreenScroll contentStyle={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s24 }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: textPrimary, letterSpacing: -0.5 }}>
          Edit Profile
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Icon name="x" size={24} color={textMuted} />
        </Pressable>
      </View>

      {/* Avatar Section */}
      <View
        style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s20,
          marginBottom: spacing.s16,
          alignItems: 'center',
        }}
      >
        <Pressable onPress={askPick}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              overflow: 'hidden',
              backgroundColor: accentPrimary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.s12,
            }}
          >
            {profile?.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={{ width: 96, height: 96 }} />
            ) : (
              <Text style={{ color: textOnPrimary, fontWeight: '800', fontSize: 38 }}>
                {avatarInitials}
              </Text>
            )}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: accentPrimary,
                borderWidth: 3,
                borderColor: surface1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="camera" size={16} color={textOnPrimary} />
            </View>
          </View>
        </Pressable>
        <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 14, marginBottom: spacing.s8 }}>
          Tap to change photo
        </Text>
        {profile.avatarUri && (
          <Pressable onPress={onRemoveAvatar}>
            <Text style={{ color: textMuted, fontSize: 13, textDecorationLine: 'underline' }}>
              Remove photo
            </Text>
          </Pressable>
        )}
      </View>

      {/* Basic Info */}
      <View style={{ marginBottom: spacing.s16 }}>
        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18, marginBottom: spacing.s12 }}>
          Basic Info
        </Text>
        <View style={{ backgroundColor: surface1, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
          <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
        </View>
      </View>

      {/* Financial Settings */}
      <View style={{ marginBottom: spacing.s16 }}>
        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18, marginBottom: spacing.s12 }}>
          Financial Settings
        </Text>
        <View style={{ backgroundColor: surface1, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s12 }}>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <Input label="Currency" value={currency} onChangeText={setCurrency} placeholder="USD" style={{ flex: 1 }} />
            <Input label="Budget day" value={budgetCycleDay} onChangeText={setBudgetCycleDay} keyboardType="number-pad" placeholder="1" style={{ flex: 1 }} />
          </View>
          <Input label="Monthly budget" value={monthlyBudget} onChangeText={setMonthlyBudget} keyboardType="decimal-pad" placeholder="2000" />
          <Input label="Savings goal" value={monthlySavingsGoal} onChangeText={setMonthlySavingsGoal} keyboardType="decimal-pad" placeholder="500" />
        </View>
      </View>

      {/* Theme */}
      <View style={{ marginBottom: spacing.s16 }}>
        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18, marginBottom: spacing.s12 }}>
          Appearance
        </Text>
        <View style={{ backgroundColor: surface1, borderRadius: radius.lg, padding: spacing.s16 }}>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            {themeOptions.map((option) => {
              const active = option.mode === themeMode;
              return (
                <Pressable
                  key={option.mode}
                  onPress={() => setThemeMode(option.mode)}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: spacing.s12,
                    paddingHorizontal: spacing.s8,
                    borderRadius: radius.md,
                    backgroundColor: active ? surface2 : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Icon name={option.icon} size={22} color={active ? accentPrimary : textMuted} />
                  <Text style={{ color: active ? accentPrimary : textMuted, fontWeight: active ? '700' : '600', fontSize: 12, marginTop: spacing.s4 }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Advanced */}
      <View style={{ marginBottom: spacing.s24 }}>
        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18, marginBottom: spacing.s12 }}>
          Advanced
        </Text>
        <View style={{ backgroundColor: surface1, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s16 }}>
          <Input label="Language" value={language} onChangeText={setLanguage} placeholder="en" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: spacing.s12 }}>
              <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 14 }}>Analytics</Text>
              <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s2 }}>Help improve the app</Text>
            </View>
            <Switch
              value={analytics}
              onValueChange={setAnalytics}
              trackColor={{ false: surface2, true: accentPrimary }}
              thumbColor={textOnPrimary}
            />
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={{ gap: spacing.s12 }}>
        <Button onPress={onSave}>
          Save Changes
        </Button>
        <Button variant="ghost" onPress={() => navigation.goBack()}>
          Cancel
        </Button>
      </View>
    </ScreenScroll>
  );
};

export default ProfileEdit;
