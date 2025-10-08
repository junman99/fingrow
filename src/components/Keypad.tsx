import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

export type KeypadProps = {
  onKey: (k: string) => void;
  onBackspace: () => void;
  onDone: () => void; // Done (add & close)
  onOk?: () => void;  // Multiple (add & stay)
};

const Key: React.FC<{ label: string; onPress: () => void; onLongPress?: () => void; primary?: boolean; wide?: boolean }> = ({ label, onPress, onLongPress, primary, wide }) => {
  const { get } = useThemeTokens();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => ({
      height: 56,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: primary ? (get('accent.primary') as string) : (get('surface.level2') as string),
      opacity: pressed ? 0.9 : 1,
      flex: wide ? 1.6 : 1,
    })}>
      <Text style={{ color: primary ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight: '600', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
};

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
    {children}
  </View>
);

const Keypad: React.FC<KeypadProps> = ({ onKey, onBackspace, onDone, onOk }) => {
  const { get } = useThemeTokens();
  return (
    <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s4, paddingBottom: spacing.s16, gap: spacing.s12, backgroundColor: get('background.default') as string }}>
      <Row>
        <Key label="1" onPress={() => onKey('1')} />
        <Key label="2" onPress={() => onKey('2')} />
        <Key label="3" onPress={() => onKey('3')} />
        <Key label="+" onPress={() => onKey('+')} />
      </Row>
      <Row>
        <Key label="4" onPress={() => onKey('4')} />
        <Key label="5" onPress={() => onKey('5')} />
        <Key label="6" onPress={() => onKey('6')} />
        <Key label="−" onPress={() => onKey('-')} />
      </Row>
      <Row>
        <Key label="7" onPress={() => onKey('7')} />
        <Key label="8" onPress={() => onKey('8')} />
        <Key label="9" onPress={() => onKey('9')} />
        <Key label="÷" onPress={() => onKey('÷')} />
      </Row>
      <Row>
        <Key label="." onPress={() => onKey('.')} />
        <Key label="0" onPress={() => onKey('0')} />
        <Key label="×" onPress={() => onKey('×')} />
        <Key label="Done" onPress={onDone} primary />
      </Row>
    </View>
  );
};

export default Keypad;
