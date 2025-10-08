import React from 'react';
import { Platform, KeyboardAvoidingView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';
type Props = { children: React.ReactNode; style?: any; inTab?: boolean };

export const Screen: React.FC<Props> = ({ children, style, inTab }) => {
  const { get } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const bottomPad = inTab ? 0 : Math.max(insets.bottom, 16);

  return (
    <SafeAreaView edges={inTab ? ['top','left','right'] : ['top','left','right','bottom']} style={{ flex: 1, backgroundColor: get('background.default') as string }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[{ flex: 1, paddingBottom: bottomPad }, style]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
