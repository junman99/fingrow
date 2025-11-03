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
      <ScrollView contentContainerStyle={{ padding: spacing.s20, gap: spacing.s20 }}>
        <View style={{ gap: spacing.s8 }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 28, letterSpacing: -0.5 }}>New Portfolio</Text>
          <Text style={{ color: muted, fontSize: 15 }}>
            Create a new portfolio to track your investments
          </Text>
        </View>

        <View style={{ gap: spacing.s16 }}>
          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>Portfolio name</Text>
            <TextInput
              placeholder="e.g. Long-term growth"
              placeholderTextColor={withAlpha(muted, 0.6)}
              value={name}
              onChangeText={setName}
              style={{
                color: text,
                borderWidth: 1,
                borderColor: border,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.s16,
                paddingVertical: spacing.s14,
                fontSize: 16,
                backgroundColor: surface1,
              }}
              accessibilityLabel="Portfolio name"
              autoFocus
            />
          </View>

          <View style={{ gap: spacing.s8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>Base currency</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open currency picker"
                onPress={() => setShowCurrencySheet(true)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: pressed ? withAlpha(accentPrimary, 0.2) : 'transparent',
                })}
              >
                <Text style={{ color: accentPrimary, fontWeight: '700', fontSize: 13 }}>View all</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
              {recommendedCurrencies.map((meta) => {
                const active = selectedCurrency?.code === meta.code;
                return (
                  <Pressable
                    key={meta.code}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${meta.name}`}
                    onPress={() => handleQuickSelect(meta.code)}
                    style={({ pressed }) => ({
                      flex: 1,
                      minWidth: '30%',
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s12,
                      borderRadius: radius.lg,
                      backgroundColor: active ? accentPrimary : surface1,
                      borderWidth: 1,
                      borderColor: active ? accentPrimary : border,
                      opacity: pressed ? 0.8 : 1,
                      alignItems: 'center',
                      gap: spacing.s4,
                    })}
                  >
                    <Text style={{ color: active ? onPrimary : text, fontSize: 18, fontWeight: '800' }}>
                      {meta.symbol}
                    </Text>
                    <Text style={{ color: active ? onPrimary : text, fontSize: 13, fontWeight: '700' }}>
                      {meta.code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>Portfolio type</Text>
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
                      paddingVertical: spacing.s14,
                      borderRadius: radius.lg,
                      alignItems: 'center',
                      backgroundColor: active ? accentPrimary : surface1,
                      borderWidth: 1,
                      borderColor: active ? accentPrimary : border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: active ? onPrimary : text, fontWeight: '700', fontSize: 15 }}>{k}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: muted, fontSize: 13 }}>
              Live tracks real holdings, Paper for experiments
            </Text>
          </View>

          <View style={{ gap: spacing.s8 }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 14 }}>Benchmark <Text style={{ color: muted, fontWeight: '400' }}>(optional)</Text></Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
              {['SPY', 'QQQ', 'STI', 'NONE'].map((b) => {
                const active = bench === b;
                return (
                  <Pressable
                    key={b}
                    onPress={() => setBench(b)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select benchmark ${b}`}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s10,
                      paddingHorizontal: spacing.s16,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: active ? accentPrimary : border,
                      backgroundColor: active ? accentPrimary : surface1,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: active ? onPrimary : text, fontWeight: '700', fontSize: 14 }}>
                      {b === 'NONE' ? 'None' : b}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.s12, marginTop: spacing.s8 }}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel create portfolio"
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing.s16,
              borderRadius: radius.lg,
              alignItems: 'center',
              backgroundColor: surface1,
              borderWidth: 1,
              borderColor: border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={!canCreate}
            accessibilityRole="button"
            accessibilityLabel="Create portfolio"
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing.s16,
              borderRadius: radius.lg,
              alignItems: 'center',
              backgroundColor: canCreate ? accentPrimary : withAlpha(accentPrimary, 0.3),
              opacity: pressed && canCreate ? 0.9 : 1,
            })}
          >
            <Text style={{ color: onPrimary, fontWeight: '700', fontSize: 16 }}>Create Portfolio</Text>
          </Pressable>
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
