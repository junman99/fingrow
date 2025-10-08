import React, { useEffect } from 'react';
import { Modal, Pressable, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/tokens';
import { elevation } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
};

export default function CenterModal({ visible, onClose, children, maxWidth = 420 }: Props) {
  const { get } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const overlay = get('component.modal.bg') as string; // match popover translucency
  const panelBg = get('component.card.bg') as string;
  const border = get('component.card.border') as string;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex:1, justifyContent:'center' }}>
        <Pressable onPress={onClose} style={{ position:'absolute', left:0, right:0, top:0, bottom:0, backgroundColor: overlay }} />
        <View
          style={[
            {
              marginHorizontal: spacing.s16,
              alignSelf:'center',
              width: '90%',
              maxWidth,
              borderRadius: radius.lg,
              backgroundColor: panelBg,
              borderWidth: 1,
              borderColor: border,
              padding: spacing.s16,
              opacity: 1,
            },
            elevation.level2,
          ]}
        >
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
