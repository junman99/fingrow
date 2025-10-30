import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, Pressable, Alert, Animated } from 'react-native';
import Icon from '../components/Icon';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import Input from '../components/Input';
import Button from '../components/Button';
import { useEnvelopesStore } from '../store/envelopes';
import { useNavigation } from '@react-navigation/native';
import { formatCurrency } from '../lib/format';

function withAlpha(hex: string, alpha: number) {
  if (!hex) return hex;
  const raw = hex.replace('#', '');
  const bigint = parseInt(raw.length === 3 ? raw.repeat(2) : raw, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function EnvelopesEditor() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { overrides, hydrate, ready, setOverride, resetAll, deleteEnvelope } = useEnvelopesStore();

  useEffect(() => { if (!ready) hydrate(); }, [ready]);

  // Match CategoryInsights animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Build category list based on history (last 90d)
  const txAll = require('../store/transactions').useTxStore.getState().transactions || [];
  const today = new Date();
  const historyStart = new Date(today.getTime() - 90*24*60*60*1000);
  const hist = txAll.filter((t:any)=> t.type==='expense' && new Date(t.date)>=historyStart && new Date(t.date)<=today);
  const byCat: Record<string, number> = {};
  hist.forEach((t:any)=>{ const c = t.category || 'Other'; byCat[c] = (byCat[c]||0) + (Number(t.amount)||0); });
  const historyCats = Object.keys(byCat).sort((a,b)=> (byCat[b]-byCat[a]));
  const manualOnlyCats = Object.keys(overrides || {}).filter(c => !historyCats.includes(c));
  const cats = [...historyCats, ...manualOnlyCats];

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successAccent = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;
  const dangerColor = get('semantic.danger') as string;

  const fmt = useCallback((val: number) => formatCurrency(val), []);

  const totalSpent = cats.reduce((sum, c) => sum + (byCat[c] || 0), 0);
  const manualCount = Object.values(overrides).filter(v => v !== null && v !== undefined).length;
  const autoCount = Math.max(0, cats.length - manualCount);

  const accentPalette = useMemo(() => ([
    {
      card: withAlpha(accentPrimary, isDark ? 0.14 : 0.12),
      border: withAlpha(accentPrimary, isDark ? 0.45 : 0.28),
      title: accentPrimary,
      muted: isDark ? withAlpha('#ffffff', 0.75) : textMuted,
      chipBg: withAlpha(accentPrimary, isDark ? 0.3 : 0.16),
      chipText: accentPrimary,
      progressFill: accentPrimary,
      progressTrack: withAlpha(accentPrimary, isDark ? 0.18 : 0.08)
    },
    {
      card: withAlpha(accentSecondary, isDark ? 0.14 : 0.12),
      border: withAlpha(accentSecondary, isDark ? 0.45 : 0.28),
      title: accentSecondary,
      muted: isDark ? withAlpha('#ffffff', 0.72) : textMuted,
      chipBg: withAlpha(accentSecondary, isDark ? 0.3 : 0.16),
      chipText: accentSecondary,
      progressFill: accentSecondary,
      progressTrack: withAlpha(accentSecondary, isDark ? 0.18 : 0.08)
    },
    {
      card: withAlpha(successAccent, isDark ? 0.14 : 0.12),
      border: withAlpha(successAccent, isDark ? 0.45 : 0.26),
      title: successAccent,
      muted: isDark ? withAlpha('#ffffff', 0.72) : textMuted,
      chipBg: withAlpha(successAccent, isDark ? 0.3 : 0.16),
      chipText: successAccent,
      progressFill: successAccent,
      progressTrack: withAlpha(successAccent, isDark ? 0.18 : 0.08)
    }
  ]), [accentPrimary, accentSecondary, isDark, successAccent, textMuted]);

  const suggestedCaps = useMemo(() => {
    const map: Record<string, number> = {};
    cats.forEach((c) => {
      const base = byCat[c] || 0;
      map[c] = base > 0 ? Math.round(base * 1.2) : 0;
    });
    return map;
  }, [byCat, cats]);

  const emptyCardStyle = useMemo(() => ({
    backgroundColor: withAlpha(isDark ? '#101625' : '#ffffff', isDark ? 0.88 : 1),
    borderRadius: radius.xl,
    padding: spacing.s16,
    borderWidth: 1,
    borderColor: withAlpha(textMuted, isDark ? 0.4 : 0.16)
  }), [isDark, textMuted]);

  const handleCapChange = useCallback((category: string, val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setOverride(category, null);
      return;
    }
    const num = Number(trimmed);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      setOverride(category, Math.max(0, Math.round(num)));
    }
  }, [setOverride]);

  const handleSuggest = useCallback((category: string) => {
    const idea = suggestedCaps[category];
    if (!idea) {
      Alert.alert('Hang tight', 'Need a bit more history to spark a suggestion for this category.');
      return;
    }
    setOverride(category, idea);
  }, [setOverride, suggestedCaps]);

  const handlePeek = useCallback((category: string) => {
    const spent = byCat[category] || 0;
    const share = totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;
    Alert.alert(
      category,
      share
        ? `You spent ${fmt(spent)} here over the past 90 days · ${share}% of tracked spend.`
        : `You spent ${fmt(spent)} here over the past 90 days.`
    );
  }, [byCat, fmt, totalSpent]);

  const handleDeleteEnvelope = useCallback(async (category: string) => {
    Alert.alert('Delete envelope', `Remove ${category} from your manual envelopes?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEnvelope(category) }
    ]);
  }, [deleteEnvelope]);

  return (
    <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s32 }}>
      <Animated.View style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        paddingHorizontal: spacing.s16,
        paddingTop: spacing.s12,
        gap: spacing.s20
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
              Envelopes
            </Text>
            <Text style={{ color: textMuted, fontSize: 14, marginTop: spacing.s4 }}>
              Set spending caps or let the app learn
            </Text>
          </View>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginRight: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? surface1 : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="x" size={24} color={textPrimary} />
          </Pressable>
        </View>

        {/* Summary Stats */}
        <View style={{ flexDirection: 'row', gap: spacing.s10 }}>
          <View style={{ flex: 1, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08), borderWidth: 1, borderColor: withAlpha(accentPrimary, 0.25) }}>
            <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>Categories</Text>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 20 }}>{cats.length}</Text>
          </View>
          <View style={{ flex: 1, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: withAlpha(successAccent, isDark ? 0.15 : 0.08), borderWidth: 1, borderColor: withAlpha(successAccent, 0.25) }}>
            <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>Manual</Text>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 20 }}>{manualCount}</Text>
          </View>
          <View style={{ flex: 1, padding: spacing.s12, borderRadius: radius.lg, backgroundColor: withAlpha(warningColor, isDark ? 0.15 : 0.08), borderWidth: 1, borderColor: withAlpha(warningColor, 0.25) }}>
            <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>90d Total</Text>
            <Text style={{ color: textPrimary, fontWeight: '800', fontSize: 16 }}>{fmt(totalSpent)}</Text>
          </View>
        </View>

        {manualCount > 0 && (
          <Button title="Reset all to Auto" variant="secondary" onPress={resetAll} />
        )}

        {cats.length === 0 ? (
          <View style={emptyCardStyle}>
            <Text style={{ color: textMuted }}>
              No history yet. Start tracking expenses to see envelopes.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.s16 }}>
            {cats.map((c, idx) => {
              const manualCap = overrides[c];
              const spent = byCat[c] || 0;
              const cap = manualCap ?? suggestedCaps[c] ?? 0;
              const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
              const barColor = pct >= 100 ? dangerColor : pct >= 80 ? warningColor : successAccent;
              const isManualOnly = manualOnlyCats.includes(c);

              return (
                <View
                  key={c}
                  style={{
                    padding: spacing.s16,
                    gap: spacing.s14,
                    backgroundColor: surface1,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: withAlpha(textMuted, isDark ? 0.2 : 0.1)
                  }}
                >
                  {/* Category Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: textPrimary, fontSize: 17, fontWeight: '800' }}>{c}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <View style={{
                        paddingHorizontal: spacing.s10,
                        paddingVertical: spacing.s4,
                        borderRadius: radius.pill,
                        backgroundColor: withAlpha(manualCap !== undefined ? accentPrimary : textMuted, isDark ? 0.2 : 0.12),
                        borderWidth: 1,
                        borderColor: withAlpha(manualCap !== undefined ? accentPrimary : textMuted, 0.3)
                      }}>
                        <Text style={{
                          color: manualCap !== undefined ? accentPrimary : textMuted,
                          fontWeight: '700',
                          fontSize: 11
                        }}>
                          {manualCap !== undefined ? 'MANUAL' : 'AUTO'}
                        </Text>
                      </View>
                      <Pressable onPress={() => handlePeek(c)} hitSlop={8}>
                        <Icon name="info" size={18} color={textMuted} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Stats Row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: textMuted, fontSize: 14 }}>
                      Spent: <Text style={{ color: textPrimary, fontWeight: '700' }}>{fmt(spent)}</Text>
                    </Text>
                    {cap > 0 && (
                      <Text style={{ color: textMuted, fontSize: 14 }}>
                        Cap: <Text style={{ color: textPrimary, fontWeight: '700' }}>{fmt(cap)}</Text>
                      </Text>
                    )}
                  </View>

                  {/* Progress Bar */}
                  {cap > 0 && (
                    <View style={{ gap: spacing.s6 }}>
                      <View style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: withAlpha(barColor, isDark ? 0.15 : 0.1),
                        overflow: 'hidden'
                      }}>
                        <View style={{
                          height: '100%',
                          width: `${pct}%`,
                          backgroundColor: barColor,
                          borderRadius: 3
                        }} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: textMuted, fontSize: 12 }}>
                          {pct >= 100 ? `Over by ${fmt(spent - cap)}` : `${fmt(cap - spent)} remaining`}
                        </Text>
                        <Text style={{ color: barColor, fontSize: 13, fontWeight: '700' }}>{pct}%</Text>
                      </View>
                    </View>
                  )}

                  {/* Manual Cap Input */}
                  <Input
                    label="Set manual cap"
                    keyboardType="numeric"
                    value={manualCap !== undefined ? String(manualCap) : ''}
                    placeholder="Auto"
                    onChangeText={(val: string) => handleCapChange(c, val)}
                  />

                  {/* Action Buttons */}
                  <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                    {manualCap !== undefined && (
                      <Button
                        title="Clear"
                        size="sm"
                        variant="secondary"
                        onPress={() => setOverride(c, null)}
                      />
                    )}
                    <Button
                      title="Suggest"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleSuggest(c)}
                    />
                    {isManualOnly && (
                      <Button
                        title="Delete"
                        size="sm"
                        variant="secondary"
                        onPress={() => handleDeleteEnvelope(c)}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>
    </ScreenScroll>
  );
}
