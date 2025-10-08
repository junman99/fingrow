import React from 'react';
import { View, Text, TextInput } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import Button from '../Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  valueQuery: string;
  onChangeQuery: (q: string) => void;
  valueMinWeight: number;
  onChangeMinWeight: (n: number) => void;
  onClear: () => void;
};

export default function HoldingsFilterSheet({
  visible, onClose, valueQuery, onChangeQuery, valueMinWeight, onChangeMinWeight, onClear
}: Props) {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const surface2 = get('surface.level2') as string;

  const [q, setQ] = React.useState(valueQuery);
  const [minW, setMinW] = React.useState(String(valueMinWeight || 0));

  React.useEffect(() => {
    if (visible) {
      setQ(valueQuery);
      setMinW(String(valueMinWeight || 0));
    }
  }, [visible, valueQuery, valueMinWeight]);

  const validNum = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={360}>
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>Filter holdings</Text>

        <View style={{ gap: spacing.s8, backgroundColor: surface2, borderRadius: radius.lg, padding: spacing.s12, borderWidth: 1, borderColor: border }}>
          <View>
            <Text style={{ color: muted, marginBottom: spacing.s4 }}>Search (symbol or name)</Text>
            <TextInput
              placeholder="e.g., AAPL or Apple"
              placeholderTextColor={muted}
              value={q}
              onChangeText={setQ}
              style={{ color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, padding: spacing.s12 }}
              accessibilityLabel="Search holdings by symbol or name"
            />
          </View>

          <View>
            <Text style={{ color: muted, marginBottom: spacing.s4 }}>Minimum weight (%)</Text>
            <TextInput
              placeholder="0"
              placeholderTextColor={muted}
              keyboardType="numeric"
              value={minW}
              onChangeText={setMinW}
              style={{ color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, padding: spacing.s12 }}
              accessibilityLabel="Minimum position weight percent"
            />
            <Text style={{ color: muted, marginTop: spacing.s4, fontSize: 12 }}>Only show positions at or above this portfolio weight.</Text>
          </View>
        </View>

        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" onPress={() => { onClear(); onClose(); }} accessibilityLabel="Clear filters">
              Clear
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="primary"
              onPress={() => {
                onChangeQuery(q);
                onChangeMinWeight(validNum(minW) ? Number(minW) : 0);
                onClose();
              }}
              accessibilityLabel="Apply filters"
            >
              Apply
            </Button>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
