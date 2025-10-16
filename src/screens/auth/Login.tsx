import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { FontAwesome } from '@expo/vector-icons';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useAuthStore } from '../../store/auth';
import FingrowLogo from '../../components/FingrowLogo';

type SocialProvider = 'apple' | 'google';

const SocialButton: React.FC<{
  provider: SocialProvider;
  onPress: () => void;
}> = ({ provider, onPress }) => {
  const { get } = useThemeTokens();
  const label = provider === 'apple' ? 'Continue with Apple' : 'Continue with Google';
  const colors: [string, string] =
    provider === 'apple'
      ? [get('text.primary') as string, get('text.primary') as string]
      : [get('accent.primary') as string, get('accent.secondary') as string];

  const iconName = provider === 'apple' ? 'apple' : 'google';
  const IconComponent = FontAwesome;
  const iconColor = provider === 'apple'
    ? (get('text.onPrimary') as string)
    : (get('text.onPrimary') as string);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: radius.lg,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.s8,
          paddingVertical: spacing.s12,
        }}
      >
        <IconComponent
          name={iconName as any}
          size={18}
          color={provider === 'apple' ? get('text.onPrimary') as string : iconColor}
        />
        <Text
          style={{
            color: get('text.onPrimary') as string,
            fontWeight: '700',
          }}
        >
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
};

const FeatureChip: React.FC<{ label: string }> = ({ label }) => {
  const { get } = useThemeTokens();
  return (
    <View
      style={{
        paddingVertical: spacing.s4,
        paddingHorizontal: spacing.s10,
        borderRadius: radius.pill,
        backgroundColor: get('surface.level1') as string,
      }}
    >
      <Text style={{ color: get('text.primary') as string, fontWeight: '600', fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
};

export default function Login() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuthStore();
  const formAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(formAnim, {
      toValue: 1,
      damping: 12,
      stiffness: 120,
      useNativeDriver: true,
    }).start();
  }, [formAnim]);

  const validEmail = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const validPw = useMemo(() => (password?.length || 0) >= 8, [password]);
  const canSubmit = validEmail && validPw && !loading;

  const handleEmailSignIn = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(async () => {
        setLoading(false);
        await signIn();
      }, 500);
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Sign-in failed', e?.message || 'Please try again.');
    }
  };

  const handleSocial = async (provider: SocialProvider) => {
    await Haptics.selectionAsync();
    Alert.alert(`${provider === 'apple' ? 'Apple' : 'Google'} login`, 'This is a demo hook. Wire real OAuth to continue.');
    await signIn();
  };

  const heroMuted = get('text.muted') as string;
  const primaryText = get('text.primary') as string;
  const accent = get('accent.primary') as string;
  const surface = get('surface.level1') as string;
  const border = get('border.subtle') as string;

  return (
    <ScreenScroll
      contentStyle={{ flexGrow: 1, padding: spacing.s16 }}
      allowBounce={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Animated.View
          style={{
            flex: 1,
            transform: [
              {
                translateY: formAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
            opacity: formAnim,
          }}
        >
          <LinearGradient
            colors={[`${accent}33`, `${accent}11`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius.xl,
              padding: spacing.s16,
              paddingBottom: spacing.s24,
              alignItems: 'center',
              gap: spacing.s12,
            }}
          >
            <FingrowLogo size={100} showWordmark />
            <Text
              style={{
                color: primaryText,
                fontSize: 24,
                fontWeight: '800',
                textAlign: 'center',
              }}
            >
              Money confidence starts here
            </Text>
            <Text
              style={{
                color: heroMuted,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              Track budgets, debts, and investments in one playful financial HQ.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.s6, flexWrap: 'wrap' }}>
              <FeatureChip label="Multi-currency ready" />
              <FeatureChip label="Auto FX for US stocks" />
              <FeatureChip label="Budget pacing alerts" />
            </View>
          </LinearGradient>

          <View
            style={{
              backgroundColor: surface,
              borderRadius: radius.xl,
              padding: spacing.s16,
              marginTop: spacing.s16,
              gap: spacing.s16,
            }}
          >
            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: primaryText, fontWeight: '700' }}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholderTextColor={heroMuted}
                style={{
                  backgroundColor: surface,
                  color: primaryText,
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s12,
                }}
              />
            </View>

            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: primaryText, fontWeight: '700' }}>Password</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  secureTextEntry={!showPw}
                  textContentType="password"
                  placeholderTextColor={heroMuted}
                  style={{
                    backgroundColor: surface,
                    color: primaryText,
                    borderWidth: 1,
                    borderColor: border,
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s12,
                    paddingRight: spacing.s32,
                  }}
                />
                <Pressable
                  onPress={() => setShowPw(prev => !prev)}
                  style={{
                    position: 'absolute',
                    right: spacing.s12,
                    top: 12,
                    padding: spacing.s4,
                  }}
                >
                  <Text style={{ color: accent, fontWeight: '600' }}>
                    {showPw ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Button
              title={loading ? 'Signing in…' : 'Continue'}
              onPress={handleEmailSignIn}
              disabled={!canSubmit}
              loading={loading}
            />

            <Text
              style={{
                color: heroMuted,
                textAlign: 'center',
                fontSize: 13,
              }}
            >
              Or sign in instantly
            </Text>

            <SocialButton provider="apple" onPress={() => handleSocial('apple')} />
            <SocialButton provider="google" onPress={() => handleSocial('google')} />

            <Button
              title="Email me a magic link"
              variant="ghost"
              onPress={() => Alert.alert('Magic link', 'We will email you a magic link in the live product.')}
            />
          </View>

          <View
            style={{
              marginTop: spacing.s16,
              gap: spacing.s12,
              paddingBottom: Math.max(insets.bottom, spacing.s16),
              alignItems: 'center',
            }}
          >
            <Pressable onPress={() => nav.navigate('Forgot')}>
              <Text style={{ color: accent, fontWeight: '600' }}>Forgot password?</Text>
            </Pressable>
            <Pressable onPress={() => nav.navigate('Signup')}>
              <Text style={{ color: accent, fontWeight: '600' }}>Create a new account</Text>
            </Pressable>
            <Pressable onPress={() => signIn()}>
              <Text style={{ color: heroMuted, fontSize: 12 }}>Skip for now (demo)</Text>
            </Pressable>
            <Text
              style={{
                color: heroMuted,
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              By continuing, you agree to our Terms & Privacy.
            </Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </ScreenScroll>
  );
}
