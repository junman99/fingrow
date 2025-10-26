import React, { memo } from 'react';
import { Pressable, Text, ActivityIndicator, ViewStyle, View } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon, { IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  title?: string;
  children?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  style?: ViewStyle;
  accessibilityLabel?: string;
  icon?: IconName;
};

const Button: React.FC<Props> = ({ title, children, onPress, disabled, loading, variant='primary', size='md', style, accessibilityLabel, icon }) => {
  const { get } = useThemeTokens();
  const label = children || title || '';
  const stylesByVariant: any = {
    primary: { bg: get('component.button.primary.bg'), text: get('component.button.primary.text') },
    secondary: { bg: get('component.button.secondary.bg'), text: get('component.button.secondary.text'), border: get('component.button.secondary.border') },
    ghost: { bg: 'transparent', text: get('component.button.ghost.text') }
  };
  const pad = size === 'sm' ? spacing.s8 : size === 'lg' ? spacing.s16 : spacing.s12;
  const rounded = radius.lg;
  const s = stylesByVariant[variant];
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        { paddingVertical: pad, paddingHorizontal: spacing.s16, borderRadius: rounded, alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
          backgroundColor: s.bg, borderWidth: s.border ? 1 : 0, borderColor: s.border || 'transparent', opacity: (disabled||loading) ? 0.6 : (pressed ? 0.9 : 1) },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          {icon && (
            <View style={{ marginRight: label ? spacing.s8 : 0 }}>
              <Icon name={icon} size={iconSize} color={s.text as string} />
            </View>
          )}
          {label ? <Text style={{ color: s.text, fontWeight: '700' }}>{label}</Text> : null}
        </>
      )}
    </Pressable>
  );
};

export default memo(Button);
