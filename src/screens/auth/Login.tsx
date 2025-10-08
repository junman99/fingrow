import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenScroll } from '../../components/ScreenScroll';
import Button from '../../components/Button';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius, elevation } from '../../theme/tokens';
import { useAuthStore } from '../../store/auth';

export default function Login() {
  const { get } = useThemeTokens();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuthStore();

  const validEmail = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const validPw = useMemo(() => (password?.length || 0) >= 8, [password]);
  const canSubmit = validEmail && validPw && !loading;

  const onContinue = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      setTimeout(async () => {
        setLoading(false);
        await signIn();
      }, 600);
    } catch (e:any) {
      setLoading(false);
      Alert.alert('Sign-in failed', e?.message || 'Please try again.');
    }
  };

  const Card: React.FC<{children: any, style?: any}> = ({ children, style }) => (
    <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, ...(elevation.level1 as any), ...(style||{}) }}>
      {children}
    </View>
  );

  const muted = get('text.muted') as string;
  const text = get('text.primary') as string;
  const ph = get('text.muted') as string;
  const inputBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;

  return (
    <ScreenScroll contentStyle={{ flexGrow: 1, padding: spacing.s16 }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.s24 }}>

        {/* Brand lockup */}
        <View style={{ alignItems: 'center', gap: spacing.s8 }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 28 }}>FinGrow</Text>
          <Text style={{ color: muted }}>Money smart starts now.</Text>
        </View>

        {/* Form card */}
        <Card>
          <View style={{ gap: spacing.s12 }}>
            {/* Email */}
            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: text, fontWeight: '600' }}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholderTextColor={ph}
                style={{ backgroundColor: inputBg, color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, paddingHorizontal: spacing.s12, paddingVertical: spacing.s12 }}
              />
              <Text style={{ color: muted, fontSize: 13 }}>We’ll send a magic link if you prefer.</Text>
            </View>

            {/* Password */}
            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: text, fontWeight: '600' }}>Password</Text>
              <View style={{ position:'relative' }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  secureTextEntry={!showPw}
                  textContentType="password"
                  placeholderTextColor={ph}
                  style={{ backgroundColor: inputBg, color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, paddingHorizontal: spacing.s12, paddingVertical: spacing.s12, paddingRight: 64 }}
                />
                <Pressable accessibilityRole="button" onPress={() => setShowPw(v => !v)} style={{ position:'absolute', right: spacing.s12, top: 12, padding: 8 }}>
                  <Text style={{ color: get('accent.primary') as string }}>{showPw ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </View>

            {/* Primary CTA */}
            <Button title={loading ? 'Signing in…' : 'Continue'} onPress={onContinue} disabled={!canSubmit} loading={loading} />

            {/* Secondary CTAs */}
            <Button title="Continue with Apple" variant="secondary" onPress={() => {}} />
            <Button title="Continue with Google" variant="secondary" onPress={() => {}} />
            <Button title="Use magic link instead" variant="ghost" onPress={() => {}} />
            {/* Testing helper */}
            <Button title="Skip for now" variant="ghost" onPress={async () => { await signIn(); }} />

            {/* Inline links */}
            <View style={{ flexDirection:'row', justifyContent:'center', gap: spacing.s16 }}>
              <Pressable onPress={() => {}}><Text style={{ color: get('accent.primary') as string }}>Forgot password?</Text></Pressable>
              <Pressable onPress={() => {}}><Text style={{ color: get('accent.primary') as string }}>Create account</Text></Pressable>
            </View>
          </View>
        </Card>

        {/* Footer */}
        <View style={{ alignItems:'center', paddingBottom: Math.max(insets.bottom, 16) }}>
          <Text style={{ color: muted, fontSize: 12, textAlign:'center' }}>
            By continuing, you agree to our Terms & Privacy.
          </Text>
        </View>
      </View>
    </ScreenScroll>
  );
}