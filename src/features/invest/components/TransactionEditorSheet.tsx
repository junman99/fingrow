
import React from 'react';
import { View, Text, TextInput, Pressable, Keyboard, ScrollView, Platform, Image, Switch, Modal, TouchableWithoutFeedback } from 'react-native';
import BottomSheet from '../../../components/BottomSheet';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import { useInvestStore } from '../store';
import { useProfileStore } from '../../../store/profile';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../../components/Icon';
import { convertCurrency } from '../../../lib/fx';
import { formatPrice } from '../../../lib/formatPrice';

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
  const { get, isDark } = useThemeTokens();
  const store = useInvestStore() as any;
  const { profile } = useProfileStore();
  const insets = useSafeAreaInsets();

  // Helper function to get dynamic precision for price input
  const getPriceDecimals = (price: number) => {
    const absPrice = Math.abs(price);
    if (absPrice >= 1) return 2;
    if (absPrice >= 0.01) return 4;
    if (absPrice >= 0.0001) return 6;
    return 8;
  };

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
  const [priceInput, setPriceInput] = React.useState(
    initial?.price != null
      ? String(Number(initial.price).toFixed(getPriceDecimals(initial.price)))
      : (currentPrice ? String(Number(currentPrice).toFixed(getPriceDecimals(currentPrice))) : '')
  );
  const [feesInput, setFeesInput] = React.useState(initial?.fees != null ? String(initial.fees) : '');
  const [date, setDate] = React.useState<Date>(initial?.date ? new Date(initial.date) : new Date());
  const [showDateTimePicker, setShowDateTimePicker] = React.useState(false);
  const [showTimeOverlay, setShowTimeOverlay] = React.useState(false);
  const [affectCash, setAffectCash] = React.useState(mode !== 'edit');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      // Reset on close
      setSide('buy'); setQtyInput(''); setFeesInput(''); setDate(new Date()); setShowDateTimePicker(false); setShowTimeOverlay(false);
      // Reset price to current price with dynamic precision
      setPriceInput(currentPrice ? String(Number(currentPrice).toFixed(getPriceDecimals(currentPrice))) : '');
    }
  }, [visible, currentPrice]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const onPrimary = get('text.onPrimary') as string;
  const accentPrimary = get('accent.primary') as string;

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
    <BottomSheet visible={visible} onClose={onClose} fullHeight>
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
                {formatPrice(currentPrice, 'USD')}
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
                  onPress={() => setShowDateTimePicker(true)}
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

      {/* Date & Time Picker Modal */}
      <Modal
        visible={showDateTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDateTimePicker(false);
          setShowTimeOverlay(false);
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.s16,
        }}>
          <TouchableWithoutFeedback onPress={() => {
            setShowDateTimePicker(false);
            setShowTimeOverlay(false);
          }}>
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
          </TouchableWithoutFeedback>

          <View style={{
            width: '100%',
            maxWidth: 400,
            backgroundColor: get('background.default') as string,
            borderRadius: 20,
            paddingHorizontal: spacing.s8,
            paddingTop: spacing.s8,
            paddingBottom: spacing.s8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 24,
            elevation: 12,
            position: 'relative',
          }}>
            {/* Date Picker */}
            <View style={{ alignItems: 'center' }}>
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setDate(selectedDate);
                  }
                }}
                themeVariant={isDark ? 'dark' : 'light'}
              />
            </View>

            {/* Time Selector Button - Bottom Right */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginTop: spacing.s4,
              gap: spacing.s12,
              paddingHorizontal: spacing.s4,
            }}>
              <Pressable
                onPress={() => setShowTimeOverlay(!showTimeOverlay)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.s8,
                  backgroundColor: get('surface.level1') as string,
                  paddingHorizontal: spacing.s16,
                  paddingVertical: spacing.s10,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Icon name="clock" size={18} color={accentPrimary} />
                <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setShowDateTimePicker(false);
                  setShowTimeOverlay(false);
                }}
                style={({ pressed }) => ({
                  backgroundColor: accentPrimary,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.s20,
                  paddingVertical: spacing.s10,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                  Done
                </Text>
              </Pressable>
            </View>

            {/* Time Picker Overlay - Compact Modal */}
            {showTimeOverlay && (
              <View style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: [{ translateX: -140 }, { translateY: -125 }],
                width: 280,
                backgroundColor: get('background.default') as string,
                borderRadius: 16,
                padding: spacing.s16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 10,
              }}>
                <TouchableWithoutFeedback>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ height: 180, justifyContent: 'center', width: '100%' }}>
                      <DateTimePicker
                        value={date}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            setDate(selectedDate);
                          }
                        }}
                        themeVariant={isDark ? 'dark' : 'light'}
                      />
                    </View>

                    {/* Buttons */}
                    <View style={{
                      flexDirection: 'row',
                      gap: spacing.s10,
                      marginTop: spacing.s12,
                      width: '100%',
                    }}>
                      {/* Now button */}
                      <Pressable
                        onPress={() => {
                          const now = new Date();
                          setDate(now);
                          setShowTimeOverlay(false);
                        }}
                        style={({ pressed }) => ({
                          flex: 1,
                          backgroundColor: get('surface.level1') as string,
                          borderRadius: radius.lg,
                          paddingVertical: spacing.s8,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ color: text, fontSize: 14, fontWeight: '600' }}>
                          Now
                        </Text>
                      </Pressable>

                      {/* Done button */}
                      <Pressable
                        onPress={() => setShowTimeOverlay(false)}
                        style={({ pressed }) => ({
                          flex: 1,
                          backgroundColor: accentPrimary,
                          borderRadius: radius.lg,
                          paddingVertical: spacing.s8,
                          alignItems: 'center',
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                          Done
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </BottomSheet>
  );
});

export default TransactionEditorSheet;
