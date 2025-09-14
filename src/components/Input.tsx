import React from 'react';
import { TextInput, View, Text } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

type Props = { label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean; style?: any };

const Input: React.FC<Props> = ({ label, value, onChangeText, placeholder, keyboardType, multiline, style }) => {
  const { get } = useThemeTokens();
  const bg = get('surface.level1') as string;
  const text = get('text.primary') as string;
  const ph = get('text.muted') as string;
  const border = get('border.subtle') as string;
  return (
    <View style={{ gap: spacing.s8, ...(style||{}) }}>
      {label ? <Text style={{ color: text, fontWeight: '600' }}>{label}</Text> : null}
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={ph} keyboardType={keyboardType} multiline={multiline}
        style={{ backgroundColor: bg, color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, paddingHorizontal: spacing.s12, paddingVertical: spacing.s12 }} />
    </View>
  );
};

export default Input;
