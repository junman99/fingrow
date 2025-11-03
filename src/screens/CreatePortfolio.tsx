import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Input from '../components/Input';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { spacing, radius } from '../theme/tokens';
import { useInvestStore } from '../store/invest';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useProfileStore } from '../store/profile';
import CurrencyPickerSheet from '../components/invest/CurrencyPickerSheet';
import { findCurrency, type CurrencyMeta } from '../lib/currencies';

function withAlpha(color: string, alpha: number) {
  if (!color) return color;
  if (color.startsWith('rgba')) {
    const parts = color.slice(5, -1).split(',').map(part => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (color.startsWith('rgb')) {
    const parts = color.slice(4, -1).split(',').map(part => part.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const raw = color.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const CreatePortfolio: React.FC = () => {
  const nav = useNavigation<any>();
  const route = nav.getState()?.routes?.[nav.getState()?.index || 0];
  const params = route?.params as any;

  const { createPortfolio, setActivePortfolio, updatePortfolio, portfolios } = useInvestStore() as any;
  const { profile } = useProfileStore();
  const { get, isDark } = useThemeTokens();

  // Check if we're in edit mode
  const editMode = !!params?.portfolioId;
  const portfolio = editMode ? portfolios[params.portfolioId] : null;

  const [name, setName] = useState(portfolio?.name || '');
  const [type, setType] = useState<'Live' | 'Paper'>(portfolio?.type || 'Live');
  const [benchmark, setBenchmark] = useState(portfolio?.benchmark || 'NONE');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyMeta | null>(
    findCurrency(portfolio?.baseCurrency || profile?.currency || 'SGD')
  );
  const [showCurrencySheet, setShowCurrencySheet] = useState(false);

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;

  const canSave = name.trim().length > 0 && !!selectedCurrency;

  async function onSave() {
    if (!canSave || !selectedCurrency) return;

    if (editMode && params?.portfolioId) {
      // Update existing portfolio
      await updatePortfolio(params.portfolioId, {
        name: name.trim(),
        baseCurrency: selectedCurrency.code,
        type,
        benchmark: benchmark === 'NONE' ? undefined : benchmark
      });
    } else {
      // Create new portfolio
      const id = await createPortfolio(
        name.trim(),
        selectedCurrency.code,
        { type, benchmark: benchmark === 'NONE' ? undefined : benchmark }
      );
      await setActivePortfolio(id);
    }
    nav.goBack();
  }

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
      allowBounce={false}
    >
      {/* Header */}
      <View style={{ gap: spacing.s8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={28} color={textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 }}>
              {editMode ? 'Edit portfolio' : 'New portfolio'}
            </Text>
          </View>
        </View>
        <Text style={{ color: muted, fontSize: 15, lineHeight: 22 }}>
          {editMode ? 'Update your portfolio settings' : 'Track your investments with a dedicated portfolio'}
        </Text>
      </View>

      {/* Portfolio Name */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Portfolio name</Text>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="e.g. Long-term growth"
          autoFocus
        />
      </View>

      {/* Currency Selector */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Portfolio currency</Text>
        <Text style={{ color: muted, fontSize: 14, marginTop: -spacing.s8 }}>
          Default currency for this portfolio. Tickers auto-detect their native currency.
        </Text>
        <Pressable
          onPress={() => setShowCurrencySheet(true)}
          style={({ pressed }) => ({
            padding: spacing.s16,
            borderRadius: radius.xl,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: border,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: '800' }}>
                {selectedCurrency?.symbol || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>
                {selectedCurrency ? selectedCurrency.code : 'Select currency'}
              </Text>
              <Text style={{ color: muted, fontSize: 14, marginTop: spacing.s2 }}>
                {selectedCurrency ? selectedCurrency.name : 'Tap to choose'}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={muted} />
          </View>
        </Pressable>
      </View>

      {/* Portfolio Type */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Portfolio type</Text>
        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
          {(['Live', 'Paper'] as const).map((t) => {
            const active = type === t;
            return (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: spacing.s16,
                  borderRadius: radius.xl,
                  backgroundColor: active ? accentPrimary : cardBg,
                  borderWidth: 1,
                  borderColor: active ? accentPrimary : border,
                  opacity: pressed ? 0.8 : 1,
                  alignItems: 'center',
                })}
              >
                <Text style={{ color: active ? '#FFFFFF' : textPrimary, fontWeight: '700', fontSize: 16 }}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: muted, fontSize: 14 }}>
          Live tracks real holdings, Paper for experiments
        </Text>
      </View>

      {/* Benchmark (Optional) */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>
          Benchmark <Text style={{ color: muted, fontWeight: '400' }}>(optional)</Text>
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
          {['SPY', 'QQQ', 'STI', 'NONE'].map((b) => {
            const active = benchmark === b;
            return (
              <Pressable
                key={b}
                onPress={() => setBenchmark(b)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.s12,
                  paddingHorizontal: spacing.s16,
                  borderRadius: radius.pill,
                  backgroundColor: active ? accentSecondary : cardBg,
                  borderWidth: 1,
                  borderColor: active ? accentSecondary : border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: active ? '#FFFFFF' : textPrimary, fontWeight: '700', fontSize: 14 }}>
                  {b === 'NONE' ? 'None' : b}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={{ marginTop: spacing.s8 }}>
        <Button variant="primary" disabled={!canSave} onPress={onSave}>
          {editMode ? 'Save changes' : 'Create portfolio'}
        </Button>
      </View>

      {/* Currency Picker Sheet */}
      <CurrencyPickerSheet
        visible={showCurrencySheet}
        onClose={() => setShowCurrencySheet(false)}
        selectedCode={selectedCurrency?.code}
        onSelect={(meta) => {
          setSelectedCurrency(meta);
          setShowCurrencySheet(false);
        }}
      />
    </ScreenScroll>
  );
};

export default CreatePortfolio;
