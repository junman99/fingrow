import React from 'react';
import { View, Text, TextInput, Pressable, Keyboard, ScrollView } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore } from '../store';
import Icon from '../Icon';
import CurrencyPickerSheet from './CurrencyPickerSheet';
import DateTimeSheet from '../DateTimeSheet';
import { findCurrency, type CurrencyMeta } from '../../lib/currencies';
import { convertCurrency } from '../../lib/fx';

type Props = {
  visible: boolean;
  onClose: () => void;
  portfolioId: string | null;
  portfolioCurrency: string;
};

export default function CashEditorSheet({ visible, onClose, portfolioId, portfolioCurrency }: Props) {
  const { get, isDark } = useThemeTokens();
  const store = useInvestStore() as any;
  const fxRates = (store as any).fxRates;

  const [mode, setMode] = React.useState<'deposit'|'withdraw'>('deposit');
  const [amount, setAmount] = React.useState('');
  const [selectedCurrency, setSelectedCurrency] = React.useState<CurrencyMeta | null>(
    findCurrency(portfolioCurrency)
  );
  const [showCurrencyPicker, setShowCurrencyPicker] = React.useState(false);
  const [useCustomRate, setUseCustomRate] = React.useState(false);
  const [customRate, setCustomRate] = React.useState('');
  const [date, setDate] = React.useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      setMode('deposit');
      setAmount('');
      setSelectedCurrency(findCurrency(portfolioCurrency));
      setUseCustomRate(false);
      setCustomRate('');
      setDate(new Date());
    }
  }, [visible, portfolioCurrency]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const dangerColor = get('semantic.danger') as string;

  // Calculate converted amount
  const fromCurrency = (selectedCurrency?.code || portfolioCurrency).toUpperCase();
  const toCurrency = portfolioCurrency.toUpperCase();
  const amountNum = Number(amount || '0');

  let convertedAmount = amountNum;
  let exchangeRate = 1;

  if (fromCurrency !== toCurrency && amountNum > 0) {
    if (useCustomRate) {
      exchangeRate = Number(customRate || '1');
      convertedAmount = amountNum * exchangeRate;
    } else {
      convertedAmount = convertCurrency(fxRates, amountNum, fromCurrency, toCurrency);
      // Calculate the rate used
      if (amountNum > 0) {
        exchangeRate = convertedAmount / amountNum;
      }
    }
  }

  const onSave = async () => {
    try { Keyboard.dismiss(); } catch {}
    if (!portfolioId || !amountNum) { onClose(); return; }

    // The amount to add is the converted amount in portfolio currency
    const signed = mode === 'deposit' ? convertedAmount : -convertedAmount;
    try { await store.addCash(signed, { portfolioId, date: date.toISOString() }); } catch {}
    onClose();
  };

  const canSave = amountNum > 0 && (!useCustomRate || Number(customRate || '0') > 0);

  return (
    <>
      <BottomSheet visible={visible && !showCurrencyPicker && !showDatePicker} onClose={onClose} height={600}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: spacing.s20, gap: spacing.s20 }}
        >
          {/* Header */}
          <View style={{ gap: spacing.s4 }}>
            <Text style={{ color: text, fontWeight: '800', fontSize: 24, letterSpacing: -0.5 }}>
              {mode === 'deposit' ? 'Deposit cash' : 'Withdraw cash'}
            </Text>
            <Text style={{ color: muted, fontSize: 14 }}>
              Add funds to your portfolio
            </Text>
          </View>

          {/* Transaction Type */}
          <View style={{ gap: spacing.s12 }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Transaction type</Text>
            <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
              <Pressable
                onPress={() => setMode('deposit')}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.s8,
                  paddingVertical: spacing.s12,
                  borderRadius: radius.lg,
                  backgroundColor: mode === 'deposit' ? accentPrimary : cardBg,
                  borderWidth: 1,
                  borderColor: mode === 'deposit' ? accentPrimary : border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Icon name="trending-up" size={18} color={mode === 'deposit' ? '#FFFFFF' : text} />
                <Text style={{ color: mode === 'deposit' ? '#FFFFFF' : text, fontWeight: '700', fontSize: 15 }}>
                  Deposit
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('withdraw')}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.s8,
                  paddingVertical: spacing.s12,
                  borderRadius: radius.lg,
                  backgroundColor: mode === 'withdraw' ? dangerColor : cardBg,
                  borderWidth: 1,
                  borderColor: mode === 'withdraw' ? dangerColor : border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Icon name="trending-down" size={18} color={mode === 'withdraw' ? '#FFFFFF' : text} />
                <Text style={{ color: mode === 'withdraw' ? '#FFFFFF' : text, fontWeight: '700', fontSize: 15 }}>
                  Withdraw
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Currency Selector */}
          <View style={{ gap: spacing.s12 }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Currency</Text>
            <Pressable
              onPress={() => {
                console.log('Currency selector pressed');
                setShowCurrencyPicker(true);
              }}
              style={({ pressed }) => ({
                padding: spacing.s16,
                borderRadius: radius.lg,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '800' }}>
                    {selectedCurrency?.symbol || '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
                    {selectedCurrency ? selectedCurrency.code : 'Select'}
                  </Text>
                  <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s2 }}>
                    {selectedCurrency ? selectedCurrency.name : 'Tap to choose'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={muted} />
              </View>
            </Pressable>
          </View>

          {/* Amount Input */}
          <View style={{ gap: spacing.s12 }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
              Amount ({selectedCurrency?.code || portfolioCurrency})
            </Text>
            <TextInput
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={muted}
              style={{
                color: text,
                fontSize: 32,
                fontWeight: '800',
                backgroundColor: cardBg,
                borderColor: border,
                borderWidth: 1,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.s16,
                paddingVertical: spacing.s16,
              }}
            />
          </View>

          {/* Date Selector */}
          <View style={{ gap: spacing.s12 }}>
            <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Date</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={({ pressed }) => ({
                padding: spacing.s16,
                borderRadius: radius.lg,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                <Icon name="calendar" size={20} color={accentPrimary} />
                <Text style={{ color: text, fontWeight: '600', fontSize: 15, flex: 1 }}>
                  {date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
                <Icon name="chevron-right" size={20} color={muted} />
              </View>
            </Pressable>
          </View>

          {/* Exchange Rate (if different currency) */}
          {fromCurrency !== toCurrency && (
            <View style={{ gap: spacing.s12 }}>
              <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>Exchange rate</Text>

              {/* Toggle between auto and custom rate */}
              <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                <Pressable
                  onPress={() => setUseCustomRate(false)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: spacing.s10,
                    paddingHorizontal: spacing.s12,
                    borderRadius: radius.md,
                    backgroundColor: !useCustomRate ? accentPrimary : cardBg,
                    borderWidth: 1,
                    borderColor: !useCustomRate ? accentPrimary : border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: !useCustomRate ? '#FFFFFF' : text, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                    Use current rate
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setUseCustomRate(true)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: spacing.s10,
                    paddingHorizontal: spacing.s12,
                    borderRadius: radius.md,
                    backgroundColor: useCustomRate ? accentPrimary : cardBg,
                    borderWidth: 1,
                    borderColor: useCustomRate ? accentPrimary : border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: useCustomRate ? '#FFFFFF' : text, fontWeight: '600', fontSize: 13, textAlign: 'center' }}>
                    Custom rate
                  </Text>
                </Pressable>
              </View>

              {/* Custom rate input */}
              {useCustomRate ? (
                <TextInput
                  keyboardType="decimal-pad"
                  value={customRate}
                  onChangeText={setCustomRate}
                  placeholder="1.0"
                  placeholderTextColor={muted}
                  style={{
                    color: text,
                    backgroundColor: cardBg,
                    borderColor: border,
                    borderWidth: 1,
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.s12,
                    height: 44,
                  }}
                />
              ) : (
                <View style={{ padding: spacing.s12, backgroundColor: cardBg, borderRadius: radius.md }}>
                  <Text style={{ color: muted, fontSize: 13 }}>
                    1 {fromCurrency} = {exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {toCurrency}
                  </Text>
                </View>
              )}

              {/* Conversion preview */}
              {amountNum > 0 && (
                <View style={{
                  padding: spacing.s16,
                  backgroundColor: withAlpha(accentPrimary, 0.1),
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: withAlpha(accentPrimary, 0.3),
                }}>
                  <Text style={{ color: muted, fontSize: 13, marginBottom: spacing.s4 }}>
                    Converted to portfolio currency:
                  </Text>
                  <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>
                    {convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {toCurrency}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: spacing.s12, marginTop: spacing.s8 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: spacing.s14,
                borderRadius: radius.lg,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: border,
                opacity: pressed ? 0.8 : 1,
                alignItems: 'center',
              })}
            >
              <Text style={{ color: text, fontWeight: '700', fontSize: 15 }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={!canSave}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: spacing.s14,
                borderRadius: radius.lg,
                backgroundColor: canSave ? accentPrimary : cardBg,
                opacity: pressed ? 0.9 : !canSave ? 0.5 : 1,
                alignItems: 'center',
              })}
            >
              <Text style={{ color: canSave ? '#FFFFFF' : muted, fontWeight: '700', fontSize: 15 }}>
                {mode === 'deposit' ? 'Deposit' : 'Withdraw'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Currency Picker */}
      {visible && (
        <CurrencyPickerSheet
          visible={showCurrencyPicker}
          onClose={() => {
            console.log('Currency picker closed');
            setShowCurrencyPicker(false);
          }}
          selectedCode={selectedCurrency?.code}
          onSelect={(meta) => {
            console.log('Currency selected:', meta.code);
            setSelectedCurrency(meta);
            setShowCurrencyPicker(false);
          }}
        />
      )}

      {/* Date Picker */}
      <DateTimeSheet
        visible={showDatePicker}
        date={date}
        onCancel={() => setShowDatePicker(false)}
        onConfirm={(d) => {
          setDate(d);
          setShowDatePicker(false);
        }}
      />
    </>
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
