import React from 'react';
import { Platform, KeyboardAvoidingView, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';

type Props = { children: React.ReactNode; style?: any };

export const Screen: React.FC<Props> = ({ children, style }) => {
  const { get } = useThemeTokens();
  const bg = get('background.default') as string;
  return (
    <SafeAreaView edges={['top','left','right']} style={{ flex: 1, backgroundColor: bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[{ flex: 1 }, style]}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};


type ScrollProps = { children: React.ReactNode; style?: any; contentStyle?: any };

export const ScreenScroll: React.FC<ScrollProps> = ({ children, style, contentStyle }) => {
  const { get } = useThemeTokens();
  const bg = get('background.default') as string;
  return (
    <SafeAreaView edges={['top','left','right']} style={{ flex: 1, backgroundColor: bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[{ flex: 1 }, style]}>
          <ScrollView
            contentContainerStyle={[{ flexGrow: 1, paddingBottom: 0 }, contentStyle]}
            contentInsetAdjustmentBehavior="never"
            bounces={true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
