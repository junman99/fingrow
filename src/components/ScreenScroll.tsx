import React from 'react';
import { ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';

type Props = { children: React.ReactNode; style?: any; contentStyle?: any; allowBounce?: boolean; };

export const ScreenScroll: React.FC<Props> = ({ children, style, contentStyle, allowBounce = false }) => {
  const { get } = useThemeTokens();
  const bg = get('background.default') as string;
  return (
    <SafeAreaView edges={['top','left','right']} style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        bounces={Platform.OS === 'ios' && allowBounce}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        alwaysBounceVertical={Platform.OS === 'ios' && allowBounce}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        style={[{ flex: 1 }, style]}
>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};
