import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, Switch } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Input from '../components/Input';
import Button from '../components/Button';
import { Card } from '../components/Card';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens, useTheme } from '../theme/ThemeProvider';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useProfileStore, type ThemeMode } from '../store/profile';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

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

  const heroAccentPrimary = get('accent.primary') as string;
  const heroAccentSecondary = get('accent.secondary') as string;
  const heroText = get('text.onPrimary') as string;

  const createdLabel = useMemo(() => {
    try {
      return new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  }, [profile.createdAt]);

  const monthlyBudgetNumber = monthlyBudget ? Number(monthlyBudget) : undefined;
  const monthlySavingsNumber = monthlySavingsGoal ? Number(monthlySavingsGoal) : undefined;

  const heroChips = useMemo(() => ([
    { label: 'Member since', value: createdLabel },
    { label: 'Currency', value: currency || 'Add currency' },
    { label: 'Monthly budget', value: monthlyBudgetNumber ? `${currency || ''} ${monthlyBudgetNumber.toLocaleString()}`.trim() : 'Add budget target' },
  ]), [createdLabel, currency, monthlyBudgetNumber]);

  const themeOptions: { mode: ThemeMode; label: string; description: string; icon: FeatherName }[] = [
    { mode: 'system', label: 'System', description: 'Keep in sync with your device', icon: 'smartphone' },
    { mode: 'light', label: 'Light', description: 'Bright and focused for daytime', icon: 'sun' },
    { mode: 'dark', label: 'Dark', description: 'Comfortable for low-light moments', icon: 'moon' },
  ];

  return (
    <ScreenScroll contentStyle={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: spacing.s12 }}>
        <View style={{ flex: 1, paddingRight: spacing.s12 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: get('text.primary') as string }}>Edit profile</Text>
          <Text style={{ color: get('text.muted') as string, marginTop: spacing.s4 }}>Refresh your details to keep insights tailored.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close editor"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: spacing.s6 })}
        >
          <Feather name="x" size={22} color={get('text.muted') as string} />
        </Pressable>
      </View>

      <LinearGradient
        colors={[heroAccentPrimary, heroAccentSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.xl, padding: spacing.s16, marginTop: spacing.s16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s16 }}>
          <Pressable accessibilityRole="button" onPress={askPick}>
            <View style={{ width: 108, height: 108, borderRadius: 54, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              {profile.avatarUri
                ? <Image source={{ uri: profile.avatarUri }} style={{ width: 108, height: 108 }} contentFit="cover" cachePolicy="memory-disk" />
                : <Text style={{ color: heroText, fontWeight: '700' }}>Add photo</Text>}
              <View style={{ position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(0,0,0,0.35)', paddingVertical: 6, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4 }}>
                  <Feather name="camera" size={16} color={heroText} />
                  <Text style={{ color: heroText, fontSize: 12, fontWeight: '600' }}>Update</Text>
                </View>
              </View>
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: spacing.s6 }}>
            <Text style={{ color: heroText, fontSize: 22, fontWeight: '800' }}>{name || 'Add your name'}</Text>
            {handle ? <Text style={{ color: heroText, opacity: 0.85 }}>{handle.startsWith('@') ? handle : `@${handle}`}</Text> : null}
            <Text style={{ color: heroText, opacity: 0.85 }}>{email || 'Add your email'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s6, marginTop: spacing.s6 }}>
              {heroChips.map((chip) => (
                <View key={chip.label} style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingVertical: spacing.s4, paddingHorizontal: spacing.s8, borderRadius: radius.pill }}>
                  <Text style={{ color: heroText, fontSize: 12, fontWeight: '600' }}>{chip.label}: {chip.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <Pressable onPress={askPick} style={{ marginTop: spacing.s12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Feather name="upload-cloud" size={18} color={heroText} />
            <Text style={{ color: heroText, fontWeight: '700' }}>Upload new photo</Text>
          </View>
        </Pressable>
        {profile.avatarUri ? (
          <Pressable onPress={onRemoveAvatar} style={{ marginTop: spacing.s8 }}>
            <Text style={{ color: heroText, opacity: 0.8, textDecorationLine: 'underline' }}>Remove current photo</Text>
          </Pressable>
        ) : null}
      </LinearGradient>

      <Card style={{ marginTop: spacing.s16 }}>
        <View style={{ gap: spacing.s12 }}>
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }}>Profile essentials</Text>
            <Text style={{ color: get('text.muted') as string }}>This is how FinGrow will greet collaborators and tailor tips for you.</Text>
          </View>
          <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
          <Input label="Handle (optional)" value={handle} onChangeText={setHandle} placeholder="@you" />
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.s16 }}>
        <View style={{ gap: spacing.s12 }}>
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }}>Money rhythm</Text>
            <Text style={{ color: get('text.muted') as string }}>Help us pace your budgets and savings nudges around the moments that matter.</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <Input label="Currency" value={currency} onChangeText={setCurrency} placeholder="SGD" style={{ flex: 1 }} />
            <Input label="Budget cycle day" value={budgetCycleDay} onChangeText={setBudgetCycleDay} keyboardType="number-pad" placeholder="1-31" style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <Input label="Monthly budget" value={monthlyBudget} onChangeText={setMonthlyBudget} keyboardType="decimal-pad" placeholder="e.g. 2000" style={{ flex: 1 }} />
            <Input label="Monthly savings goal" value={monthlySavingsGoal} onChangeText={setMonthlySavingsGoal} keyboardType="decimal-pad" placeholder="e.g. 500" style={{ flex: 1 }} />
          </View>
          {monthlySavingsNumber && monthlyBudgetNumber ? (
            <View style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.md, padding: spacing.s12 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>You&apos;re aiming to save {(monthlySavingsNumber / monthlyBudgetNumber * 100).toFixed(0)}% of your spending plan.</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.s16 }}>
        <View style={{ gap: spacing.s12 }}>
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }}>App experience</Text>
            <Text style={{ color: get('text.muted') as string }}>Tune the theme, language and privacy so FinGrow feels like home.</Text>
          </View>
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>Theme</Text>
            <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
              {themeOptions.map((option) => {
                const active = option.mode === themeMode;
                return (
                  <Pressable
                    key={option.mode}
                    onPress={() => setThemeMode(option.mode)}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        borderRadius: radius.lg,
                        paddingVertical: spacing.s12,
                        paddingHorizontal: spacing.s12,
                        borderWidth: 1,
                        borderColor: active ? get('accent.primary') as string : get('border.subtle') as string,
                        backgroundColor: active ? (get('surface.level2') as string) : get('surface.level1') as string,
                        opacity: pressed ? 0.9 : 1,
                      }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <Feather name={option.icon} size={18} color={active ? (get('accent.primary') as string) : (get('text.muted') as string)} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: active ? get('accent.primary') as string : get('text.primary') as string, fontWeight: '700' }}>{option.label}</Text>
                        <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>{option.description}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Input label="Language" value={language} onChangeText={setLanguage} placeholder="en" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.s8 }}>
            <View style={{ flex: 1, paddingRight: spacing.s12 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '600' }}>Analytics & insights</Text>
              <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>Share anonymous usage data to improve predictions and budgeting nudges.</Text>
            </View>
            <Switch
              value={analytics}
              onValueChange={setAnalytics}
              trackColor={{ false: get('surface.level2') as string, true: get('accent.primary') as string }}
              thumbColor={analytics ? get('text.onPrimary') as string : (get('surface.level1') as string)}
            />
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.s16 }}>
        <View style={{ gap: spacing.s12 }}>
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }}>Quick actions</Text>
            <Text style={{ color: get('text.muted') as string }}>Hop to your profile or clear out any edits if you change your mind.</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
            <Button variant="secondary" size="sm" onPress={() => navigation.navigate('ProfileModal')} style={{ flex: 1 }}>
              View profile
            </Button>
            <Button variant="ghost" size="sm" onPress={onReset} style={{ flex: 1 }}>
              Reset changes
            </Button>
          </View>
        </View>
      </Card>

      <View style={{ marginTop: spacing.s24, gap: spacing.s12 }}>
        <Button onPress={onSave}>
          Save changes
        </Button>
        <Button variant="ghost" onPress={() => navigation.goBack()}>
          Cancel
        </Button>
      </View>
    </ScreenScroll>
  );
};

export default ProfileEdit;
