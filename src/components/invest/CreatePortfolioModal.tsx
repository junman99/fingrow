import React from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import CenterModal from '../CenterModal';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import Button from '../Button';
import Icon from '../Icon';
import { currencies, findCurrency, type CurrencyMeta } from '../../lib/currencies';
import CurrencyPickerSheet from './CurrencyPickerSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultCurrency?: string;
  onConfirm: (name: string, currency: string, type?: 'Live'|'Paper', benchmark?: string) => void;
};

export default function CreatePortfolioModal({ visible, onClose, defaultCurrency = 'SGD', onConfirm }: Props) {
  const { get, isDark } = useThemeTokens();
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<'Live'|'Paper'>('Live');
  const [bench, setBench] = React.useState('NONE');
  const [selectedCurrency, setSelectedCurrency] = React.useState<CurrencyMeta | null>(findCurrency(defaultCurrency));
  const [showCurrencySheet, setShowCurrencySheet] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setName('');
      setType('Live');
      setBench('NONE');
      const fallback = findCurrency(defaultCurrency) || findCurrency('USD') || findCurrency('SGD') || currencies[0];
      setSelectedCurrency(fallback || null);
      setShowCurrencySheet(false);
    }
  }, [visible, defaultCurrency]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const onPrimary = get('text.onPrimary') as string;
  const surface1 = get('surface.level1') as string;
  const sectionStyle = React.useMemo(() => ({
    backgroundColor: withAlpha(surface1, isDark ? 0.6 : 0.98),
    borderRadius: radius.lg,
    padding: spacing.s16,
    borderWidth: 1,
    borderColor: withAlpha(border, isDark ? 0.4 : 0.6),
    gap: spacing.s12,
  }), [surface1, border, isDark]);

  const recommendedCurrencies = React.useMemo(() => {
    const base = [
      defaultCurrency.toUpperCase(),
      'USD',
      'SGD',
      'EUR',
      'GBP',
      'JPY',
      'AUD',
      'CAD',
    ];
    const seen = new Set<string>();
    const list: CurrencyMeta[] = [];
    base.forEach(code => {
      const meta = findCurrency(code);
      if (meta && !seen.has(meta.code)) {
        seen.add(meta.code);
        list.push(meta);
      }
    });
    return list.length ? list : currencies.slice(0, 6);
  }, [defaultCurrency]);

  const canCreate = name.trim().length > 0 && !!selectedCurrency;

  const handleConfirm = () => {
    if (!selectedCurrency) return;
    onConfirm(name.trim(), selectedCurrency.code, type, bench);
  };

  const handleQuickSelect = (code: string) => {
    const meta = findCurrency(code);
    if (meta) setSelectedCurrency(meta);
  };

  return (
    <CenterModal visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={{ padding: spacing.s16, gap: spacing.s16 }}>
        <View
          style={{
            backgroundColor: withAlpha(accentPrimary, 0.12),
            borderRadius: radius.lg,
            padding: spacing.s16,
            borderWidth: 1,
            borderColor: withAlpha(accentPrimary, 0.3),
            gap: spacing.s4,
          }}
        >
          <Text style={{ color: text, fontWeight: '800', fontSize: 20 }}>New portfolio</Text>
          <Text style={{ color: withAlpha(text, 0.74) }}>
            Name it, pick a base currency, and you’ll be ready to add positions.
          </Text>
        </View>

        <View style={{ gap: spacing.s12 }}>
          <View style={sectionStyle}>
            <Text style={{ color: muted, fontWeight: '700' }}>Portfolio name</Text>
            <TextInput
              placeholder="e.g. Long-term growth"
              placeholderTextColor={withAlpha(muted, 0.7)}
              value={name}
              onChangeText={setName}
              style={{
                color: text,
                borderWidth: 1,
                borderColor: withAlpha(border, 0.7),
                borderRadius: radius.md,
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s10,
                fontSize: 16,
              }}
              accessibilityLabel="Portfolio name"
            />
          </View>

          <View style={sectionStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: muted, fontWeight: '700' }}>Base currency</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open currency picker"
                onPress={() => setShowCurrencySheet(true)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s10,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(accentPrimary, pressed ? 0.28 : 0.18),
                })}
              >
                <Text style={{ color: onPrimary, fontWeight: '700', fontSize: 12 }}>Browse all</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open currency picker"
              onPress={() => setShowCurrencySheet(true)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s10,
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s10,
                borderRadius: radius.md,
                backgroundColor: withAlpha(surface1, pressed ? 0.9 : 0.7),
              })}
            >
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: withAlpha(accentPrimary, 0.22),
              }}>
                <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>
                  {selectedCurrency?.symbol || selectedCurrency?.code.slice(0, 1) || '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>
                  {selectedCurrency ? selectedCurrency.code : 'Select currency'}
                </Text>
                <Text style={{ color: withAlpha(muted, 0.85), fontSize: 12 }}>
                  {selectedCurrency ? selectedCurrency.name : 'Quick picks below or browse all'}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} colorToken="icon.default" />
            </Pressable>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s6 }}>
              {recommendedCurrencies.slice(0, 6).map((meta) => {
                const active = selectedCurrency?.code === meta.code;
                return (
                  <Pressable
                    key={meta.code}
                    accessibilityRole="button"
                    accessibilityLabel={`Quick select ${meta.name}`}
                    onPress={() => handleQuickSelect(meta.code)}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s6,
                      paddingHorizontal: spacing.s10,
                      borderRadius: radius.pill,
                      backgroundColor: active ? withAlpha(accentSecondary, 0.28) : withAlpha(accentPrimary, pressed ? 0.22 : 0.12),
                      borderWidth: 1,
                      borderColor: active ? withAlpha(accentSecondary, 0.7) : withAlpha(accentPrimary, 0.5),
                    })}
                  >
                    <Text style={{ color: active ? onPrimary : text, fontSize: 12, fontWeight: '700' }}>{meta.code}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={sectionStyle}>
            <Text style={{ color: muted, fontWeight: '700' }}>Portfolio type</Text>
            <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
              {(['Live', 'Paper'] as const).map((k) => {
                const active = type === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setType(k)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${k} portfolio`}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: spacing.s8,
                      borderRadius: radius.pill,
                      alignItems: 'center',
                      backgroundColor: active ? accentPrimary : withAlpha(surface1, pressed ? 0.6 : 0.4),
                      borderWidth: 1,
                      borderColor: active ? accentPrimary : withAlpha(border, 0.6),
                    })}
                  >
                    <Text style={{ color: active ? onPrimary : text, fontWeight: '700' }}>{k}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: withAlpha(muted, 0.85), fontSize: 12 }}>
              Live tracks real holdings; Paper is for ideas or experiments.
            </Text>
          </View>

          <View style={sectionStyle}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: muted, fontWeight: '700' }}>Benchmark <Text style={{ color: withAlpha(muted, 0.6) }}>(optional)</Text></Text>
              <Text style={{ color: withAlpha(muted, 0.65), fontSize: 12 }}>
                {bench === 'NONE' ? 'Off' : bench}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s6 }}>
              {['SPY', 'QQQ', 'STI', 'NONE'].map((b) => {
                const active = bench === b;
                return (
                  <Pressable
                    key={b}
                    onPress={() => setBench(b)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select benchmark ${b}`}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s6,
                      paddingHorizontal: spacing.s10,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: active ? withAlpha(accentSecondary, 0.7) : withAlpha(border, pressed ? 0.9 : 0.6),
                      backgroundColor: active ? withAlpha(accentSecondary, 0.22) : withAlpha(surface1, pressed ? 0.5 : 0.2),
                    })}
                  >
                    <Text style={{ color: text, fontWeight: '700' }}>{b === 'NONE' ? 'No benchmark' : b}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: withAlpha(muted, 0.85), fontSize: 12 }}>
              Compare against an index, or leave it off for a clean slate.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" onPress={onClose} accessibilityLabel="Cancel create portfolio">
              Cancel
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="primary" disabled={!canCreate} onPress={handleConfirm} accessibilityLabel="Create portfolio">
              Create
            </Button>
          </View>
        </View>
      </ScrollView>
      <CurrencyPickerSheet
        visible={showCurrencySheet}
        onClose={() => setShowCurrencySheet(false)}
        selectedCode={selectedCurrency?.code}
        onSelect={(meta) => { setSelectedCurrency(meta); setShowCurrencySheet(false); }}
      />
    </CenterModal>
  );
}

function withAlpha(color: string, alpha: number): string {
  if (!color) return color;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw.padEnd(6, '0');
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
