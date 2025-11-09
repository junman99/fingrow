import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, Alert, Switch, Pressable, Animated, PanResponder, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../../../components/ScreenScroll';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import { useGroupsStore } from '../store';
import { useProfileStore } from '../../../store/profile';
import BottomSheet from '../../../components/BottomSheet';
import { currencies, findCurrency } from '../../../lib/currencies';
import { getExchangeRate } from '../../../lib/fx-yahoo';
import { setMembersUpdateCallback } from './ManageMembersCreate';
import { CurrencyFlag } from '../../../components/flags/CurrencyFlag';

type Row = { name: string; contact?: string };

const KEY_INCLUDE_ME = 'fingrow/ui/createGroup/includeMeDefault';

const SwipeableMemberCard: React.FC<{
  row: Row;
  index: number;
  isMeRow: boolean;
  canDelete: boolean;
  onUpdate: (i: number, patch: Partial<Row>) => void;
  onRemove: (i: number) => void;
  inputStyle: any;
  placeholder: string;
  accentPrimary: string;
  textPrimary: string;
  textMuted: string;
  cardBg: string;
  borderSubtle: string;
  isDark: boolean;
}> = ({ row, index, isMeRow, canDelete, onUpdate, onRemove, inputStyle, placeholder, accentPrimary, textPrimary, textMuted, cardBg, borderSubtle, isDark }) => {
  const pan = React.useRef(new Animated.ValueXY()).current;
  const [isDeleting, setIsDeleting] = useState(false);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return canDelete && Math.abs(gestureState.dx) > 10;
    },
    onPanResponderMove: (_, gestureState) => {
      if (canDelete && gestureState.dx < 0) {
        pan.x.setValue(Math.max(gestureState.dx, -100));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -60) {
        setIsDeleting(true);
        Animated.timing(pan.x, {
          toValue: -300,
          duration: 200,
          useNativeDriver: false,
        }).start(() => {
          onRemove(index);
          pan.x.setValue(0);
          setIsDeleting(false);
        });
      } else {
        Animated.spring(pan.x, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      }
    },
  }), [canDelete, index, onRemove, pan.x]);

  if (isDeleting) return null;

  return (
    <View style={{ position: 'relative' }}>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          backgroundColor: '#EF4444',
          borderRadius: radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="trash-2" size={20} color="#FFFFFF" />
      </View>
      <Animated.View
        style={{
          transform: [{ translateX: pan.x }],
          backgroundColor: cardBg,
          borderRadius: radius.lg,
          padding: spacing.s14,
          gap: spacing.s10,
        }}
        {...(canDelete ? panResponder.panHandlers : {})}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.25 : 0.15),
              }}
            >
              {isMeRow ? (
                <Icon name="user" size={16} colorToken="accent.primary" />
              ) : (
                <Text style={{ color: accentPrimary, fontWeight: '700', fontSize: 13 }}>{index + 1}</Text>
              )}
            </View>
            <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
              {isMeRow ? 'You' : `Member ${index + 1}`}
            </Text>
          </View>
          {canDelete && (
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '500' }}>
              Swipe left to delete
            </Text>
          )}
        </View>

        <TextInput
          value={row.name}
          onChangeText={t => onUpdate(index, { name: t })}
          placeholder={isMeRow ? row.name : 'Enter name'}
          editable={!isMeRow}
          placeholderTextColor={placeholder}
          style={[inputStyle, !isMeRow ? null : { opacity: 0.6 }]}
          autoCapitalize="words"
        />
        <TextInput
          value={row.contact}
          onChangeText={t => onUpdate(index, { contact: t })}
          placeholder="Email or phone (optional)"
          placeholderTextColor={placeholder}
          style={inputStyle}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Animated.View>
    </View>
  );
};

export default function CreateGroup() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { createGroup } = useGroupsStore();
  const { profile } = useProfileStore();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  // Default group currency to USD (or profile currency as fallback)
  const [currency, setCurrency] = useState(() => {
    const profileCurrency = profile?.currency || 'USD';
    // If profile is already USD, default to SGD to show an exchange rate example
    return profileCurrency === 'USD' ? 'SGD' : 'USD';
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [includeMe, setIncludeMe] = useState(true);
  const [trackSpending, setTrackSpending] = useState(false);
  const [currencySheet, setCurrencySheet] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const nameInputRef = useRef<TextInput>(null);

  const myName = profile?.name || 'Me';

  useEffect(() => {
    AsyncStorage.getItem(KEY_INCLUDE_ME).then(v => {
      if (v === 'true') setIncludeMe(true);
      if (v === 'false') setIncludeMe(false);
    });

    // Delay keyboard opening until after navigation animation completes (typically 300-350ms)
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 500);

    // Set up callback for ManageMembersCreate to update state
    setMembersUpdateCallback((updatedRows: Row[]) => {
      setRows(updatedRows);
    });

    return () => {
      clearTimeout(timer);
      setMembersUpdateCallback(() => {});
    };
  }, []);

  useEffect(() => {
    setRows(r => {
      const hasMe = r.some(x => x.name === myName);
      if (includeMe && !hasMe) return [{ name: myName, contact: profile?.email || '' }, ...r.length ? r : [{ name: '', contact: '' }]];
      if (!includeMe && hasMe) {
        const withoutMe = r.filter(x => x.name !== myName);
        return withoutMe.length ? withoutMe : [{ name: '', contact: '' }];
      }
      return r.length ? r : [{ name: '', contact: '' }];
    });
  }, [includeMe, myName, profile?.email]);

  const addRow = () => setRows(r => [...r, { name: '', contact: '' }]);
  const updateRow = (i: number, patch: Partial<Row>) => setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));

  const selectedCurrency = useMemo(
    () => findCurrency(currency || 'USD'),
    [currency]
  );

  const filteredCurrencies = useMemo(() => {
    const q = currencyQuery.trim().toLowerCase();
    if (!q.length) return currencies;
    return currencies.filter(
      c =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.regions || []).some(r => r.toLowerCase().includes(q)),
    );
  }, [currencyQuery]);

  // Fetch exchange rates on mount - Yahoo Finance with 1-hour cache
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const baseCurrency = profile?.currency || 'USD';

        console.log(`💱 [CreateGroup] Fetching rates for base: ${baseCurrency}...`);

        const rates: Record<string, number> = {};

        // Only fetch major currencies to avoid 404s (Yahoo doesn't support all pairs)
        const majorCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'CNY', 'INR', 'MYR', 'THB', 'PHP', 'IDR', 'KRW', 'TWD', 'ZAR', 'BRL', 'MXN', 'RUB', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY', 'AED', 'SAR', 'ILS'];

        // Fetch rates for major currencies only
        for (const cur of currencies.slice(0, 50)) {
          const targetCurrency = cur.code.toUpperCase();

          if (baseCurrency === targetCurrency) {
            rates[targetCurrency] = 1;
            continue;
          }

          // Skip if not a major currency (Yahoo might not have the pair)
          if (!majorCurrencies.includes(targetCurrency) && !majorCurrencies.includes(baseCurrency)) {
            rates[targetCurrency] = 1; // Default to 1:1 for unsupported pairs
            continue;
          }

          try {
            // Fetch from Yahoo Finance (cached for 1 hour)
            const rate = await getExchangeRate(baseCurrency, targetCurrency);
            if (rate && rate > 0) {
              rates[targetCurrency] = rate;
            } else {
              rates[targetCurrency] = 1;
            }
          } catch (error) {
            // Silently fail for unsupported pairs
            rates[targetCurrency] = 1;
          }
        }

        console.log(`💱 [CreateGroup] ✅ Loaded ${Object.keys(rates).length} rates. Sample: USD=${rates['USD']?.toFixed(4)}, EUR=${rates['EUR']?.toFixed(4)}, GBP=${rates['GBP']?.toFixed(4)}`);

        setExchangeRates(rates);
      } catch (error) {
        console.error('💱 [CreateGroup] Error fetching rates:', error);
      }
    };

    fetchRates();
  }, [profile?.currency]);

  const handleCurrencyChange = (code: string) => {
    setCurrency(code.toUpperCase());
    setCurrencySheet(false);
    setCurrencyQuery('');
  };

  const onSave = async () => {
    if (!name.trim()) { Alert.alert('Enter a group name'); return; }
    const members = rows
      .map(r => ({ name: r.name.trim(), contact: r.contact?.trim() || undefined }))
      .filter(r => r.name.length > 0);
    const id = await createGroup({ name: name.trim(), note: note.trim() || undefined, members, currency, trackSpending });
    nav.replace('GroupDetail', { groupId: id });
  };

  const accentPrimary = get('accent.primary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const cardBg = get('surface.level1') as string;

  const inputStyle = useMemo(() => ({
    borderRadius: radius.md,
    paddingVertical: spacing.s12,
    paddingHorizontal: spacing.s14,
    color: textPrimary,
    backgroundColor: surface2,
    fontSize: 15,
  }), [textPrimary, surface2]);

  const placeholder = get('text.muted') as string;
  const bgDefault = get('background.default') as string;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: bgDefault }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16, paddingBottom: spacing.s24 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.s12 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              position: 'absolute',
              left: -spacing.s8,
              padding: spacing.s8,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={28} color={textPrimary} />
          </Pressable>
          <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>
            Create group
          </Text>
        </View>

        {/* Group Details Card */}
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: radius.lg,
            padding: spacing.s16,
            gap: spacing.s16,
          }}
        >
          {/* Group Name Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
              Group name
            </Text>
            <TextInput
              ref={nameInputRef}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Roommates, Weekend Trip"
              placeholderTextColor={placeholder}
              style={{ flex: 1, color: textPrimary, fontSize: 15, textAlign: 'right', marginLeft: spacing.s12 }}
            />
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          {/* Note Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
              Note
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a description or purpose"
              placeholderTextColor={placeholder}
              style={{ flex: 1, color: textPrimary, fontSize: 15, textAlign: 'right', marginLeft: spacing.s12 }}
              multiline={false}
            />
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          {/* Include Me Toggle Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Include me in this group</Text>
            <Switch value={includeMe} onValueChange={setIncludeMe} />
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          {/* Track in Spending Toggle Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Track in Spending</Text>
            <Switch value={trackSpending} onValueChange={setTrackSpending} />
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: borderSubtle }} />

          {/* Currency Selection Row */}
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setTimeout(() => setCurrencySheet(true), 150);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>Currency</Text>
            <View style={{ alignItems: 'flex-end', flex: 1, marginLeft: spacing.s12, marginRight: spacing.s8 }}>
              <Text style={{ color: textPrimary, fontSize: 15, textAlign: 'right' }}>
                {selectedCurrency?.code || 'USD'}
              </Text>
              <Text style={{ color: textMuted, fontSize: 13, marginTop: 2, textAlign: 'right' }}>
                {(() => {
                  const baseCurrency = profile?.currency || 'USD';
                  const targetCurrency = selectedCurrency?.code || 'USD';

                  if (baseCurrency === targetCurrency) {
                    return `1 ${baseCurrency} = 1.00 ${targetCurrency}`;
                  }
                  const rate = exchangeRates[targetCurrency];
                  if (rate && rate > 0 && rate !== 1) {
                    return `1 ${baseCurrency} ≈ ${rate.toFixed(2)} ${targetCurrency}`;
                  }
                  if (rate === 1) {
                    return `1 ${baseCurrency} = 1.00 ${targetCurrency}`;
                  }
                  return 'Loading...';
                })()}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={textMuted} />
          </Pressable>
        </View>

        {/* Members Card */}
        <Pressable
          onPress={() => {
            nav.navigate('ManageMembersCreate', {
              rows: JSON.parse(JSON.stringify(rows)),
              includeMe,
              myName,
            });
          }}
          style={({ pressed }) => ({
            backgroundColor: cardBg,
            borderRadius: radius.lg,
            padding: spacing.s16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
            <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
              Members
            </Text>
            <Text
              style={{ color: textMuted, fontSize: 15, flex: 1, textAlign: 'right' }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {rows.filter(r => r.name.trim().length > 0).map(r => r.name).join(', ') || 'Add members'}
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={textMuted} />
        </Pressable>

        {/* Action Buttons */}
        <View style={{ marginTop: spacing.s8 }}>
          <Button title="Create group" onPress={onSave} />
        </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Currency Picker Bottom Sheet */}
      <BottomSheet
        visible={currencySheet}
        onClose={() => setCurrencySheet(false)}
      >
        <View style={{ height: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s16 }}>
            Choose currency
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingBottom: spacing.s8,
              borderBottomWidth: 1,
              borderBottomColor: borderSubtle,
            }}
          >
            <Icon name="search" size={18} color={textMuted} />
            <TextInput
              value={currencyQuery}
              onChangeText={setCurrencyQuery}
              placeholder="Search currencies..."
              placeholderTextColor={textMuted}
              style={{
                flex: 1,
                height: 36,
                color: textPrimary,
                paddingHorizontal: spacing.s12,
                fontSize: 15,
              }}
            />
          </View>

          <ScrollView
            style={{ flex: 1, marginHorizontal: -spacing.s16 }}
            contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={true}
            bounces={true}
          >
            {filteredCurrencies.map((cur, idx) => {
              const active = currency?.toUpperCase() === cur.code;
              const primaryCurrency = profile?.currency || 'USD';
              const rate = exchangeRates[cur.code];
              const exchangeRate = cur.code === primaryCurrency ? '1.00' : (rate && rate > 0 ? rate.toFixed(2) : '...');

              return (
                <View key={cur.code}>
                  <Pressable
                    onPress={() => handleCurrencyChange(cur.code)}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s4,
                      opacity: pressed ? 0.6 : 1,
                      backgroundColor: active ? withAlpha(accentPrimary, isDark ? 0.15 : 0.08) : 'transparent',
                      marginHorizontal: -spacing.s16,
                      paddingHorizontal: spacing.s16,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                      <CurrencyFlag currencyCode={cur.code} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                          {cur.name}
                        </Text>
                        <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                          {cur.code} · {cur.symbol}
                        </Text>
                      </View>
                      <Text style={{ color: textMuted, fontSize: 13, fontWeight: '600' }}>
                        1 {primaryCurrency} ≈ {exchangeRate}
                      </Text>
                    </View>
                  </Pressable>
                  {idx < filteredCurrencies.length - 1 && (
                    <View style={{ height: 1, backgroundColor: borderSubtle }} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function withAlpha(hex: string, alpha: number) {
  if (!hex || typeof hex !== 'string') return hex;
  if (hex.startsWith('#')) {
    const clean = hex.slice(1, 7);
    const padded = clean.length === 6 ? clean : clean.padEnd(6, '0');
    const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
    return `#${padded}${a}`;
  }
  if (hex.startsWith('rgba')) {
    return hex.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
      const parts = inner.split(',').map(p => p.trim());
      if (parts.length < 3) return hex;
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }
  return hex;
}
