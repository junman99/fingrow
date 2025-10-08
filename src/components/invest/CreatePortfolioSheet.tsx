import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import Button from '../Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultCurrency?: string;
  onConfirm: (name: string, currency: string, type?: 'Live'|'Paper', benchmark?: string) => void;
};

export default function CreatePortfolioSheet({ visible, onClose, defaultCurrency = 'SGD', onConfirm }: Props) {
  const { get } = useThemeTokens();
  const [name, setName] = React.useState('');
  const [cur, setCur] = React.useState(defaultCurrency.toUpperCase());
  const [type, setType] = React.useState<'Live'|'Paper'>('Live');
  const [bench, setBench] = React.useState('SPY');

  React.useEffect(() => {
    if (visible) {
      setName('');
      setCur(defaultCurrency.toUpperCase());
      setType('Live');
      setBench('SPY');
    }
  }, [visible, defaultCurrency]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const surface = get('surface.level2') as string;
  const border = get('border.subtle') as string;

  const canCreate = name.trim().length > 0 && /^[A-Z]{3}$/.test(cur.toUpperCase());

  return (
    <BottomSheet visible={visible} onClose={onClose} height={520}>
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>New portfolio</Text>
        <View style={{ gap: spacing.s8, backgroundColor: surface, borderRadius: radius.lg, padding: spacing.s12, borderWidth: 1, borderColor: border }}>
          <View>
            <Text style={{ color: muted, marginBottom: spacing.s4 }}>Name</Text>
            <TextInput
              placeholder="e.g., Long-term"
              placeholderTextColor={get('text.muted') as string}
              value={name}
              onChangeText={setName}
              style={{ color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, padding: spacing.s12 }}
              accessibilityLabel="Portfolio name"
            />
          </View>

          <View>
            <Text style={{ color: muted, marginBottom: spacing.s4 }}>Currency</Text>
            <TextInput
              placeholder="SGD"
              placeholderTextColor={get('text.muted') as string}
              value={cur}
              onChangeText={t => setCur(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={3}
              style={{ color: text, borderWidth: 1, borderColor: border, borderRadius: radius.md, padding: spacing.s12 }}
              accessibilityLabel="Base currency (3 letters)"
            />
          </View>

          <View>
            <Text style={{ color: muted, marginBottom: spacing.s4 }}>Type</Text>
            <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Live portfolio type"
                onPress={() => setType('Live')}
                style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12, borderRadius: radius.pill, backgroundColor: type==='Live' ? (get('component.button.primary.bg') as string) : 'transparent', borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}
              >
                <Text style={{ color: type==='Live' ? (get('component.button.primary.text') as string) : (get('component.button.secondary.text') as string), fontWeight: '700' }}>Live</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Paper portfolio type"
                onPress={() => setType('Paper')}
                style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12, borderRadius: radius.pill, backgroundColor: type==='Paper' ? (get('component.button.primary.bg') as string) : 'transparent', borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}
              >
                <Text style={{ color: type==='Paper' ? (get('component.button.primary.text') as string) : (get('component.button.secondary.text') as string), fontWeight: '700' }}>Paper</Text>
              </Pressable>
            </View>
          </View>

          <View>
            <Text style={{ color: muted, marginBottom: spacing.s4 }}>Benchmark</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap: spacing.s8 }}>
              {['SPY','QQQ','STI','NONE'].map(b => (
                <Pressable
                  key={b}
                  onPress={() => setBench(b)}
                  style={{ paddingVertical: spacing.s6, paddingHorizontal: spacing.s12, borderWidth: 1, borderColor: border, borderRadius: radius.pill, backgroundColor: bench===b ? (get('surface.level1') as string) : 'transparent' }}
                  accessibilityRole="button"
                  accessibilityLabel={`Benchmark ${b}`}
                >
                  <Text style={{ color: text }}>{b}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              onPress={onClose}
              accessibilityLabel="Cancel create portfolio"
            >
              Cancel
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="primary"
              disabled={!canCreate}
              onPress={() => onConfirm(name.trim(), cur.toUpperCase(), type, bench)}
              accessibilityLabel="Create portfolio"
            >
              Create
            </Button>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
