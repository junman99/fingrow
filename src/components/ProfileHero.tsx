import React from 'react';
import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
const rgbToRgba = (rgbStr: string, alpha: number) => {
  const m = rgbStr.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d\.]+))?\)/);
  if (!m) return rgbStr;
  const r = m[1], g = m[2], b = m[3];
  return `rgba(${r},${g},${b},${alpha})`;
};


type Props = { name?: string; email?: string; avatarUri?: string; variant?: 'card' | 'blend' };

const initials = (s?: string) => {
  if (!s) return '👋';
  const parts = s.trim().split(/\s+/).slice(0,2);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '👤';
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const ProfileHero: React.FC<Props> = ({ name='There', email, avatarUri, variant = 'blend' }) => {
  const { get } = useThemeTokens();
  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
      <LinearGradient
        colors={[get('surface.level2') as string, get('surface.level1') as string]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ padding: spacing.s16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
            {/* Avatar */}
            <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: get('surface.level2') as string, alignItems: 'center', justifyContent: 'center' }}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: 48, height: 48 }} />
              ) : (
                <Text style={{ color: get('text.onSurface') as string, fontWeight: '700' }}>{initials(name)}</Text>
              )}
            </View>
            {/* Texts */}
            <View style={{ maxWidth: '70%' }}>
              <Text style={{ color: get('text.onSurface') as string, fontWeight: '700', fontSize: 18 }} numberOfLines={1}>Hi, {name}!</Text>
              {email ? <Text style={{ color: get('text.onSurface') as string, opacity: 0.8 }} numberOfLines={1}>{email}</Text> : null}
            </View>
          </View>
        </View>

        <Text style={{ color: get('text.onSurface') as string, marginTop: spacing.s12 }}>Track your financial goals</Text>
      </LinearGradient>
    </View>
  );
};

export default ProfileHero;
