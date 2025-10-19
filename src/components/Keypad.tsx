import React, { ReactNode } from 'react';
import { View, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius, elevation } from '../theme/tokens';

export type KeypadProps = {
  onKey: (k: string) => void;
  onBackspace: () => void;
  onDone: () => void;
  onOk?: () => void;
  onEvaluate: () => void;
  header?: ReactNode;
};

type KeyVariant = 'digit' | 'operator' | 'backspace';

const Key: React.FC<{
  label: string;
  onPress: () => void;
  variant?: KeyVariant;
}> = ({ label, onPress, variant = 'digit' }) => {
  const { get, isDark } = useThemeTokens();
  const accent = get('accent.primary') as string;
  const secondary = get('accent.secondary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const textPrimary = get('text.primary') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;

  const isOperator = variant === 'operator';
  const isBackspace = variant === 'backspace';

  const backgroundColor = isBackspace
    ? secondary
    : isOperator
    ? 'transparent'
    : surface2;

  const borderColor = isOperator ? borderSubtle : 'transparent';
  const textColor = isBackspace ? textOnPrimary : isOperator ? accent : textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
        opacity: pressed ? 0.9 : 1,
        borderWidth: isOperator ? 1 : 0,
        borderColor,
      })}
    >
      <Text
        style={{
          color: textColor,
          fontWeight: '700',
          fontSize: 18,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const ActionButton: React.FC<{
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}> = ({ label, onPress, variant = 'primary', disabled }) => {
  const { get } = useThemeTokens();
  const accent = get('accent.primary') as string;
  const surface2 = get('surface.level2') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const textPrimary = get('text.primary') as string;
  const borderSubtle = get('border.subtle') as string;

  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isPrimary ? accent : surface2,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: isPrimary ? 'transparent' : borderSubtle,
        opacity: pressed ? 0.9 : disabled ? 0.5 : 1,
      })}
    >
      <Text
        style={{
          color: isPrimary ? textOnPrimary : textPrimary,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ flexDirection: 'row', gap: spacing.s10 }}>{children}</View>
);

const Keypad: React.FC<KeypadProps> = ({ onKey, onBackspace, onDone, onOk, onEvaluate, header }) => {
  const { get, isDark } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const padBottom = Math.max(insets.bottom + spacing.s2, spacing.s8);
  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;
  const textMuted = get('text.muted') as string;

  return (
    <View
      style={{
        paddingHorizontal: spacing.s16,
        paddingTop: spacing.s6,
        paddingBottom: padBottom,
        gap: spacing.s8,
        backgroundColor: surface1,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        borderTopWidth: 1,
        borderTopColor: borderSubtle,
        ...(elevation.level1 as any),
      }}
    >
      <View style={{ alignItems: 'center', paddingBottom: spacing.s2 }}>
        <View
          style={{
            width: 38,
            height: 4,
            borderRadius: 999,
            backgroundColor: `${textMuted}66`,
          }}
        />
      </View>
      {header ? (
        <View style={{ paddingBottom: spacing.s2 }}>{header}</View>
      ) : null}
      <Row>
        <Key label="7" onPress={() => onKey('7')} />
        <Key label="8" onPress={() => onKey('8')} />
        <Key label="9" onPress={() => onKey('9')} />
        <Key label="+" onPress={() => onKey('+')} variant="operator" />
      </Row>
      <Row>
        <Key label="4" onPress={() => onKey('4')} />
        <Key label="5" onPress={() => onKey('5')} />
        <Key label="6" onPress={() => onKey('6')} />
        <Key label="−" onPress={() => onKey('-')} variant="operator" />
      </Row>
      <Row>
        <Key label="1" onPress={() => onKey('1')} />
        <Key label="2" onPress={() => onKey('2')} />
        <Key label="3" onPress={() => onKey('3')} />
        <Key label="×" onPress={() => onKey('×')} variant="operator" />
      </Row>
      <Row>
        <Key label="." onPress={() => onKey('.')} />
        <Key label="0" onPress={() => onKey('0')} />
        <Key label="⌫" onPress={onBackspace} variant="backspace" />
        <Key label="÷" onPress={() => onKey('÷')} variant="operator" />
      </Row>
      <Row>
        {onOk ? (
          <View style={{ flex: 1.5 }}>
            <ActionButton label="Add & stay" onPress={onOk} variant="secondary" />
          </View>
        ) : (
          <View style={{ flex: 1.5 }} />
        )}
        <View style={{ flex: 1.5 }}>
          <ActionButton label="Save & close" onPress={onDone} />
        </View>
        <View style={{ flex: 1 }}>
          <Key label="=" onPress={onEvaluate} variant="operator" />
        </View>
      </Row>
    </View>
  );
};

export default Keypad;
