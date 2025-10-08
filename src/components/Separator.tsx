import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
export default function Separator() {
  const { get } = useThemeTokens();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: get('border.subtle') as string }} />;
}
