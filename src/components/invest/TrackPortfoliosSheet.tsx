import React from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore } from '../../store/invest';
import Icon from '../Icon';

type Props = {
  visible: boolean;
  onClose: () => void;
  value: string[] | 'all';
  onChange: (ids: string[] | 'all') => void;
};

export default function TrackPortfoliosSheet({ visible, onClose, value, onChange }: Props) {
  const { get } = useThemeTokens();
  const portfolios = useInvestStore(s => s.portfolios);
  const order = useInvestStore(s => s.portfolioOrder);
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;

  const [selected, setSelected] = React.useState<string[] | 'all'>(value);
  React.useEffect(()=>{ if (visible) setSelected(value); }, [visible, value]);

  const ids = order && order.length ? order : Object.keys(portfolios || {});

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev === 'all') return [id];
      const set = new Set(prev);
      if (set.has(id)) { set.delete(id); } else { set.add(id); }
      return Array.from(set);
    });
  };

  const allOn = selected === 'all';

  return (
    <BottomSheet visible={visible} onClose={onClose} height={440}>
      <View style={{ gap: spacing.s12 }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ color: text, fontWeight:'800', fontSize: 18 }}>Track portfolios</Text>
          <Pressable accessibilityRole="button" onPress={() => { setSelected('all'); }} style={({ pressed }) => ({ paddingHorizontal: spacing.s12, height: 36, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
            <Text style={{ color: text, fontWeight:'700' }}>Select all</Text>
          </Pressable>
        </View>

        <ScrollView alwaysBounceVertical={Platform.OS==='ios'} style={{ maxHeight: 300 }} contentContainerStyle={{ gap: spacing.s4 }}>
          {ids.map(id => {
            const p: any = (portfolios as any)[id];
            const on = selected==='all' ? true : (selected as string[]).includes(id);
            return (
              <Pressable key={id} onPress={() => toggle(id)} accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical: spacing.s8, paddingHorizontal: spacing.s8, borderRadius: radius.lg, backgroundColor: pressed ? (get('surface.level2') as string) : 'transparent' })}
              >
                <View>
                  <Text style={{ color: text, fontWeight:'700' }}>{p?.name || 'Portfolio'}</Text>
                  <Text style={{ color: muted, fontSize: 12 }}>{(p?.baseCurrency || 'USD').toUpperCase()}</Text>
                </View>
                <View style={{ width: 36, height: 36, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: on ? (get('component.button.primary.bg') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}>
                  <Icon name="check" size={18} colorToken={on ? 'text.onPrimary' : 'text.primary'} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable accessibilityRole="button" onPress={() => { onChange(selected); onClose(); }}
          style={{ backgroundColor: get('component.button.primary.bg') as string, height: 44, borderRadius: radius.lg, alignItems:'center', justifyContent:'center' }}
        >
          <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Apply</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

