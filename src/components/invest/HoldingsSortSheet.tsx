import React from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import Button from '../Button';

type SortKey = 'mv'|'pnlAbs'|'pnlPct'|'ticker';
type Props = {
  visible: boolean;
  onClose: () => void;
  valueKey: SortKey;
  valueDir: 'asc'|'desc';
  onChange: (key: SortKey, dir: 'asc'|'desc') => void;
};

export default function HoldingsSortSheet({ visible, onClose, valueKey, valueDir, onChange }: Props) {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const surface2 = get('surface.level2') as string;

  const [key, setKey] = React.useState<SortKey>(valueKey);
  const [dir, setDir] = React.useState<'asc'|'desc'>(valueDir);

  React.useEffect(() => {
    if (visible) {
      setKey(valueKey);
      setDir(valueDir);
    }
  }, [visible, valueKey, valueDir]);

  const Pill = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, borderWidth: 1, borderColor: get('border.subtle') as string, backgroundColor: on ? (get('surface.level1') as string) : 'transparent' }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={{ color: text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} height={380}>
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>Sort holdings</Text>

        <View style={{ gap: spacing.s8, backgroundColor: surface2, borderRadius: radius.lg, padding: spacing.s12, borderWidth: 1, borderColor: border }}>
          <Text style={{ color: muted, marginBottom: spacing.s4 }}>Sort by</Text>
          <View style={{ flexDirection: 'row', flexWrap:'wrap', gap: spacing.s8 }}>
            <Pill label="Market value" on={key==='mv'} onPress={()=>setKey('mv')} />
            <Pill label="Unrealized P&L" on={key==='pnlAbs'} onPress={()=>setKey('pnlAbs')} />
            <Pill label="P&L %" on={key==='pnlPct'} onPress={()=>setKey('pnlPct')} />
            <Pill label="Ticker" on={key==='ticker'} onPress={()=>setKey('ticker')} />
          </View>

          <Text style={{ color: muted, marginVertical: spacing.s8 }}>Direction</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <Pill label="Desc" on={dir==='desc'} onPress={()=>setDir('desc')} />
            <Pill label="Asc" on={dir==='asc'} onPress={()=>setDir('asc')} />
          </View>
        </View>

        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" onPress={onClose} accessibilityLabel="Cancel sort">
              Cancel
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="primary"
              onPress={() => { onChange(key, dir); onClose(); }}
              accessibilityLabel="Apply sort"
            >
              Apply
            </Button>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
