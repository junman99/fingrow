import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import AppHeader from '../components/AppHeader';
import { ScreenScroll } from '../components/ScreenScroll';
import Input from '../components/Input';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens, useTheme } from '../theme/ThemeProvider';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useProfileStore } from '../store/profile';
import { Image } from 'expo-image';

const ProfileEdit: React.FC = () => {
  const { get } = useThemeTokens();
  const { setMode } = useTheme();
  const { profile, hydrate, update, setAvatar } = useProfileStore();

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

  useEffect(() => { hydrate(); }, []);

  const askPick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow photo access to set your avatar.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.9 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const manip = null /* removed manipulator; using picker allowsEditing */;
    const dest = ((FileSystem as any)?.documentDirectory || '') + 'avatar.jpg';
    try {
      if (asset?.uri) {
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
      }
    } catch {}
    await setAvatar(dest);
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

  return (
    <ScreenScroll>
      <AppHeader title="Edit Profile" />
      <View style={{ alignItems: 'center', marginTop: spacing.s16 }}>
        <Pressable accessibilityRole="button" onPress={askPick}>
          <View style={{ width: 100, height: 100, borderRadius: 50, overflow: 'hidden', backgroundColor: get('surface.level2') as string, alignItems: 'center', justifyContent: 'center' }}>
            {profile.avatarUri ? <Image source={{ uri: profile.avatarUri }} style={{ width: 100, height: 100 }}  contentFit="cover" cachePolicy="memory-disk" /> :
              <Text style={{ color: get('text.muted') as string, fontWeight: '700' }}>Add Photo</Text>}
          </View>
        </Pressable>
        <Text style={{ color: get('text.muted') as string, marginTop: spacing.s8 }}>Tap to change</Text>
      </View>

      <View style={{ height: spacing.s16 }} />

      <View style={{ paddingHorizontal: spacing.s16, gap: spacing.s12 }}>
        <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
        <Input label="Handle (optional)" value={handle} onChangeText={setHandle} placeholder="@you" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      </View>

      <View style={{ height: spacing.s16 }} />

      <View style={{ paddingHorizontal: spacing.s16, gap: spacing.s12 }}>
        <Input label="Currency" value={currency} onChangeText={setCurrency} placeholder="SGD" />
        <Input label="Budget cycle day" value={budgetCycleDay} onChangeText={setBudgetCycleDay} keyboardType="number-pad" placeholder="1-31" />
        <Input label="Monthly budget" value={monthlyBudget} onChangeText={setMonthlyBudget} keyboardType="decimal-pad" placeholder="e.g. 2000" />
        <Input label="Monthly savings goal" value={monthlySavingsGoal} onChangeText={setMonthlySavingsGoal} keyboardType="decimal-pad" placeholder="e.g. 500" />
      </View>

      <View style={{ height: spacing.s16 }} />

      <View style={{ paddingHorizontal: spacing.s16, gap: spacing.s12 }}>
        <Input label="Theme (system | light | dark)" value={themeMode} onChangeText={(t)=>setThemeMode((t as any))} placeholder="system" />
        <Input label="Language" value={language} onChangeText={setLanguage} placeholder="en" />
        <View style={{ alignItems: 'flex-start', marginTop: spacing.s8 }}>
          <Pressable onPress={() => setAnalytics(!analytics)} hitSlop={8}>
            <Text style={{ color: get('text.primary') as string }}>
              {analytics ? '☑' : '☐'} Analytics opt-in
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ height: spacing.s16 }} />

      <View style={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s24 }}>
        <Pressable onPress={onSave} style={{ backgroundColor: get('accent.primary') as string, borderRadius: radius.lg, paddingVertical: spacing.s12, alignItems: 'center' }}>
          <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>
    </ScreenScroll>
  );
};

export default ProfileEdit;
