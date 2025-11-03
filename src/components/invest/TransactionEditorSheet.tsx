
import React from 'react';
import { View, Text, TextInput, Pressable, Keyboard, ScrollView, Platform, Image, Switch } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore } from '../../store/invest';
import { useProfileStore } from '../../store/profile';
import DateTimeSheet from '../DateTimeSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../Icon';
import { convertCurrency } from '../../lib/fx';

type Props = {
  mode?: 'add'|'edit';
  lotId?: string;
  initial?: { side?: 'buy'|'sell'; qty?: number; price?: number; fees?: number; date?: string; };
  visible: boolean;
  onClose: () => void;
  symbol: string;
  portfolioId: string | null;
};

const TransactionEditorSheet = React.memo(({ visible, onClose, symbol, portfolioId, mode='add', lotId, initial }: Props) => {
  const { get } = useThemeTokens();
  const store = useInvestStore() as any;
  const { profile } = useProfileStore();
  const insets = useSafeAreaInsets();

  // Compact height to fit content
  const sheetHeight = 420;

  // Get quote data and portfolio info
  const quotes = useInvestStore(s => s.quotes);
  const portfolios = useInvestStore(s => s.portfolios);
  const holdings = useInvestStore(s => s.holdings);
  const fxRates = useInvestStore(s => s.fxRates);
  const q: any = quotes[symbol] || {};
  const currentPrice = q?.last || 0;
  const fundamentals = q?.fundamentals;
  const logoUrl = fundamentals?.logo;
  const companyName = fundamentals?.companyName || symbol;

  const [imageError, setImageError] = React.useState(false);

  function getLogoColor(sym: string): string {
    const colors = [
      '#5B9A8B', '#D4735E', '#88AB8E', '#C85C3D', '#E8B86D',
      '#7FE7CC', '#FF9B71', '#A4BE7B', '#6366f1', '#8b5cf6',
    ];
    const index = sym.charCodeAt(0) % colors.length;
    return colors[index];
  }

  const logoColor = getLogoColor(symbol);
  const logoLetter = symbol.charAt(0).toUpperCase();
  const shouldShowImage = logoUrl && !imageError;

  const [side, setSide] = React.useState<'buy'|'sell'>(initial?.side || 'buy');
  const [qtyInput, setQtyInput] = React.useState(initial?.qty != null ? String(initial.qty) : '');
  const [priceInput, setPriceInput] = React.useState(initial?.price != null ? String(initial.price.toFixed(2)) : (currentPrice ? String(currentPrice.toFixed(2)) : ''));
  const [feesInput, setFeesInput] = React.useState(initial?.fees != null ? String(initial.fees) : '');
  const [date, setDate] = React.useState<Date>(initial?.date ? new Date(initial.date) : new Date());
  const [openDate, setOpenDate] = React.useState(false);
  const [affectCash, setAffectCash] = React.useState(mode !== 'edit');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      // Reset on close
      setSide('buy'); setQtyInput(''); setFeesInput(''); setDate(new Date()); setOpenDate(false);
      // Reset price to current price (2 decimals)
      setPriceInput(currentPrice ? String(currentPrice.toFixed(2)) : '');
    }
  }, [visible, currentPrice]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const onPrimary = get('text.onPrimary') as string;

  const onSave = React.useCallback(async () => {
    if (saving) return;

    const qty = Number(qtyInput || '0');
    const price = Number(priceInput || '0');
    const fees = feesInput ? Number(feesInput) : 0;

    // Use active portfolio if no portfolioId is provided
    const pid = portfolioId || store.activePortfolioId;

    if (!symbol || !qty || !price) {
      console.warn('[TransactionEditorSheet] Missing required fields:', { symbol, qty, price });
      onClose();
      return;
    }

    if (!pid) {
      console.error('[TransactionEditorSheet] No portfolio ID available');
      onClose();
      return;
    }

    // Close immediately for responsive feel
    setSaving(true);
    onClose();

    // Perform save operations in background
    // Get ticker's NATIVE currency (not profile currency!)
    const h = pid ? portfolios[pid]?.holdings?.[symbol] : holdings[symbol];
    let cur = 'USD'; // Default
    if (h?.currency) {
      cur = h.currency.toUpperCase();
    } else {
      // Infer from symbol pattern
      const s = symbol.toUpperCase();
      if (s.includes('-USD') || s.includes('USD')) cur = 'USD';
      else if (s.endsWith('.L')) cur = 'GBP';
      else if (s.endsWith('.T')) cur = 'JPY';
      else if (s.endsWith('.TO')) cur = 'CAD';
      else if (s.endsWith('.AX')) cur = 'AUD';
      else if (s.endsWith('.HK')) cur = 'HKD';
      else if (s.endsWith('.PA') || s.endsWith('.DE')) cur = 'EUR';
      else if (s.endsWith('.SW')) cur = 'CHF';
    }

    try {
      if (mode === 'edit' && lotId) {
        await store.updateLot(symbol, lotId, { side, qty, price, date: date.toISOString(), fees }, { portfolioId: pid });
        if (affectCash) {
          try {
            // Get portfolio currency for conversion
            const p = pid ? portfolios[pid] : null;
            const portfolioCurrency = (p?.baseCurrency || 'USD').toUpperCase();

            // Cash flow in ticker's native currency
            const gross = qty * price;
            const cfNative = side === 'buy' ? -(gross + fees) : (gross - fees);

            // Convert to portfolio currency before adjusting cash
            const cfPortfolio = convertCurrency(fxRates, cfNative, cur, portfolioCurrency);
            await (store as any).adjustCashBalance(cfPortfolio, { portfolioId: pid });
          } catch {}
        }
      } else {
        await store.addLot(symbol, { side, qty, price, date: date.toISOString(), fees }, { name: symbol, type: 'stock', currency: cur }, { portfolioId: pid });
        if (affectCash) {
          try {
            // Get portfolio currency for conversion
            const p = pid ? portfolios[pid] : null;
            const portfolioCurrency = (p?.baseCurrency || 'USD').toUpperCase();

            // Cash flow in ticker's native currency
            const gross = qty * price;
            const cfNative = side === 'buy' ? -(gross + fees) : (gross - fees);

            // Convert to portfolio currency before adjusting cash
            const cfPortfolio = convertCurrency(fxRates, cfNative, cur, portfolioCurrency);
            await (store as any).adjustCashBalance(cfPortfolio, { portfolioId: pid });
          } catch {}
        }
      }
      try { await store.refreshQuotes([symbol]); } catch {}
      setSaving(false);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  }, [saving, qtyInput, priceInput, feesInput, symbol, portfolioId, store, side, date, mode, lotId, affectCash, profile, onClose]);

  return (
    <BottomSheet visible={visible} onClose={onClose} height={sheetHeight}>
      <View style={{ flex: 1 }}>
        {/* Minimal Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
          {/* Logo and Info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: shouldShowImage ? 'transparent' : logoColor,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {shouldShowImage ? (
                <Image
                  source={{ uri: logoUrl }}
                  style={{ width: 44, height: 44 }}
                  onError={() => setImageError(true)}
                />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
                  {logoLetter}
                </Text>
              )}
            </View>
            <View>
              <Text style={{ color: text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>
                {symbol}
              </Text>
              <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                ${currentPrice.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: get('accent.primary') as string,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.5 : (pressed ? 0.7 : 1)
            })}
          >
            <Icon name="check" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.s8, paddingHorizontal: spacing.s2 }}
        >
          <View style={{ gap: spacing.s14 }}>
            {/* Buy/Sell Buttons + Cash Toggle */}
            <View style={{ flexDirection: 'row', gap: spacing.s12, alignItems: 'center' }}>
              <Pressable
                onPress={() => setSide('buy')}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s16,
                  paddingVertical: spacing.s8,
                  borderRadius: radius.pill,
                  backgroundColor: side === 'buy' ? (get('semantic.success') as string) : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: side === 'buy' ? 1.03 : 1 }]
                })}
              >
                <Text style={{
                  color: side === 'buy' ? '#FFFFFF' : muted,
                  fontWeight: '700',
                  fontSize: 13
                }}>
                  Buy
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSide('sell')}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.s16,
                  paddingVertical: spacing.s8,
                  borderRadius: radius.pill,
                  backgroundColor: side === 'sell' ? (get('semantic.danger') as string) : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: side === 'sell' ? 1.03 : 1 }]
                })}
              >
                <Text style={{
                  color: side === 'sell' ? '#FFFFFF' : muted,
                  fontWeight: '700',
                  fontSize: 13
                }}>
                  Sell
                </Text>
              </Pressable>

              {/* Cash Toggle - moved here */}
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.s8 }}>
                <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Adjust cash</Text>
                <Switch
                  value={affectCash}
                  onValueChange={setAffectCash}
                  trackColor={{ false: get('border.subtle') as string, true: get('accent.primary') as string }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={get('border.subtle') as string}
                />
              </View>
            </View>

            {/* Main Input Grid */}
            <View style={{ gap: spacing.s12 }}>
              {/* Shares and Price Row */}
              <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: spacing.s6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Shares</Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={muted}
                    value={qtyInput}
                    onChangeText={setQtyInput}
                    style={{
                      color: text,
                      backgroundColor: get('surface.level1') as string,
                      borderRadius: radius.lg,
                      paddingHorizontal: spacing.s16,
                      height: 56,
                      fontSize: 18,
                      fontWeight: '700',
                      borderWidth: 1,
                      borderColor: border
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: spacing.s6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Price</Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={muted}
                    value={priceInput}
                    onChangeText={setPriceInput}
                    style={{
                      color: text,
                      backgroundColor: get('surface.level1') as string,
                      borderRadius: radius.lg,
                      paddingHorizontal: spacing.s16,
                      height: 56,
                      fontSize: 18,
                      fontWeight: '700',
                      borderWidth: 1,
                      borderColor: border
                    }}
                  />
                </View>
              </View>

              {/* Date */}
              <View>
                <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: spacing.s6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</Text>
                <Pressable
                  onPress={() => setOpenDate(true)}
                  style={({ pressed }) => ({
                    backgroundColor: get('surface.level1') as string,
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.s16,
                    height: 56,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.s12,
                    borderWidth: 1,
                    borderColor: border,
                    opacity: pressed ? 0.7 : 1
                  })}
                >
                  <Icon name="calendar" size={22} colorToken="text.muted" />
                  <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>{date.toLocaleDateString()}</Text>
                </Pressable>
              </View>

              {/* Fees */}
              <View>
                <TextInput
                  keyboardType="decimal-pad"
                  placeholder="Fees (optional)"
                  placeholderTextColor={muted}
                  value={feesInput}
                  onChangeText={setFeesInput}
                  style={{
                    color: text,
                    backgroundColor: get('surface.level1') as string,
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.s16,
                    height: 44,
                    fontSize: 14,
                    fontWeight: '600',
                    borderWidth: 1,
                    borderColor: border
                  }}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <DateTimeSheet visible={openDate} date={date} onCancel={() => setOpenDate(false)} onConfirm={(d) => { setDate(d); setOpenDate(false); }} />
    </BottomSheet>
  );
});

export default TransactionEditorSheet;
