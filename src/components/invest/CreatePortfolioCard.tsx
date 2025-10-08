import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import Button from '../Button';
import { useInvestStore } from '../../store/invest';

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultCurrency: string;
};

export default function CreatePortfolioCard({ visible, onClose, defaultCurrency }: Props) {
  const { get } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [cur, setCur] = useState(defaultCurrency || 'USD');
  const [type, setType] = useState<'Live'|'Paper'>('Live');
  const [benchmark, setBenchmark] = useState<string>('SPY');
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const surface = get('component.modal.bg') as string;
  const border = get('border.subtle') as string;

  useEffect(() => {
    if (visible) {
      setName(''); setCur((defaultCurrency||'USD').toUpperCase()); setType('Live'); setBenchmark('SPY');
    }
  }, [visible, defaultCurrency]);

  const canCreate = name.trim().length > 0 && cur.trim().length >= 3;

  const onCreate = async () => {
    try {
      const id = await (useInvestStore.getState() as any).createPortfolio(name.trim(), cur.toUpperCase(), { type, benchmark });
      // focus the new portfolio if store has API
      if ((useInvestStore.getState() as any).setActivePortfolio) {
        await (useInvestStore.getState() as any).setActivePortfolio(id);
      }
      onClose();
    } catch (e) {
      console.warn('Create portfolio failed', e);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', justifyContent:'center', alignItems:'center', padding: spacing.s16 }]}>
        <View style={{ width: '100%', maxWidth: 420, backgroundColor: surface, borderRadius: radius.xl, padding: spacing.s16, borderWidth: 1, borderColor: border }}>
          <Text style={{ color: text, fontSize: 20, fontWeight:'800', marginBottom: spacing.s12 }}>New portfolio</Text>

          <Text style={{ color: muted, marginBottom: spacing.s4 }}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Eg. US stocks"
            placeholderTextColor={muted}
            style={{ color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, padding: spacing.s12, marginBottom: spacing.s12 }}
          />

          <Text style={{ color: muted, marginBottom: spacing.s4 }}>Base currency</Text>
          <TextInput
            value={cur}
            onChangeText={(t)=> setCur(t.toUpperCase())}
            placeholder="USD"
            autoCapitalize="characters"
            placeholderTextColor={muted}
            style={{ color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, padding: spacing.s12, marginBottom: spacing.s12 }}
          />

          <Text style={{ color: muted, marginBottom: spacing.s4 }}>Type</Text>
          <View style={{ flexDirection:'row', gap: spacing.s8, marginBottom: spacing.s12 }}>
            {(['Live','Paper'] as const).map(k => {
              const on = type === k;
              return (
                <Pressable accessibilityRole="button" key={k} onPress={()=> setType(k)} style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12, borderRadius: radius.pill, backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string) }}>
                  <Text style={{ color: on ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight:'700' }}>{k}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: muted, marginBottom: spacing.s4 }}>Benchmark (optional)</Text>
          <View style={{ flexDirection:'row', gap: spacing.s8, marginBottom: spacing.s16, flexWrap:'wrap' }}>
            {['NONE','SPY','QQQ','^GSPC','BTC-USD'].map(k => {
              const on = benchmark === k;
              return (
                <Pressable key={k} onPress={()=> setBenchmark(k)} style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12, borderRadius: radius.pill, backgroundColor: on ? (get('surface.level2') as string) : 'transparent', borderWidth: 1, borderColor: get('border.subtle') as string }}>
                  <Text style={{ color: text, fontWeight:'700' }}>{k}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection:'row', justifyContent:'flex-end', gap: spacing.s12 }}>
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Button title="Create" variant="primary" onPress={onCreate} disabled={!canCreate} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
