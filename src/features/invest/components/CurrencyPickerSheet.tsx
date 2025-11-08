import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import BottomSheet from '../../../components/BottomSheet';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import Icon from '../../../components/Icon';
import { currencies, type CurrencyMeta } from '../../../lib/currencies';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (currency: CurrencyMeta) => void;
  selectedCode?: string;
};

export default function CurrencyPickerSheet({ visible, onClose, onSelect, selectedCode }: Props) {
  const { get } = useThemeTokens();
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const accent = get('accent.primary') as string;
  const surface = get('surface.level1') as string;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currencies.slice(0, 40);
    return currencies
      .filter(c =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.regions || []).some(r => r.toLowerCase().includes(q))
      )
      .slice(0, 60);
  }, [query]);

  const handleSelect = (meta: CurrencyMeta) => {
    onSelect(meta);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={520}>
      <View style={{ gap: spacing.s12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>Select currency</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close currency picker" onPress={onClose} style={{ padding: spacing.s6 }}>
            <Icon name="close" size={18} colorToken="icon.default" />
          </Pressable>
        </View>
        <TextInput
          placeholder="Search code, name, or region"
          placeholderTextColor={withAlpha(muted, 0.6)}
          value={query}
          onChangeText={setQuery}
          style={{
            color: text,
            borderWidth: 1,
            borderColor: withAlpha(border, 0.8),
            borderRadius: radius.md,
            paddingHorizontal: spacing.s12,
            paddingVertical: spacing.s8,
          }}
          accessibilityLabel="Currency search"
        />
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.s16 }}>
          {filtered.map(meta => {
            const active = selectedCode === meta.code;
            return (
              <Pressable
                key={meta.code}
                onPress={() => handleSelect(meta)}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${meta.name}`}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: active ? accent : withAlpha(border, pressed ? 1 : 0.7),
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s10,
                  marginBottom: spacing.s8,
                  backgroundColor: withAlpha(accent, active ? 0.15 : pressed ? 0.08 : 0),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: withAlpha(surface, 0.8),
                    borderWidth: 1,
                    borderColor: withAlpha(border, 0.6),
                  }}>
                    <Text style={{ color: text, fontWeight: '700' }}>{meta.code.slice(0, 1)}</Text>
                  </View>
                  <View>
                    <Text style={{ color: text, fontWeight: '700' }}>{meta.code} · {meta.name}</Text>
                    {meta.regions?.length ? (
                      <Text style={{ color: muted, fontSize: 12 }}>{meta.regions.slice(0, 2).join(', ')}</Text>
                    ) : null}
                  </View>
                </View>
                {active ? <Icon name="check" size={18} colorToken="accent.primary" /> : null}
              </Pressable>
            );
          })}
          {!filtered.length ? (
            <Text style={{ color: muted, textAlign: 'center', marginTop: spacing.s16 }}>
              No currencies match “{query}”.
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

function withAlpha(color: string, alpha: number): string {
  if (!color) return color;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw.padEnd(6, '0');
    const num = parseInt(hex.slice(0, 6), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const match = color.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([0-9.]+))?\)/i);
  if (match) {
    const [, r, g, b] = match;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
