import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const successAccent = get('semantic.success') as string;

  const heroGradient: [string, string] = isDark ? ['#141a2c', '#1f2640'] : [accentPrimary, accentSecondary];
  const heroText = isDark ? '#eef3ff' : (get('text.onPrimary') as string);
  const heroMuted = withAlpha(heroText, isDark ? 0.74 : 0.78);

  const fmt = useCallback((val: number) => formatCurrency(val), []);

  const totalSpent = cats.reduce((sum, c) => sum + (byCat[c] || 0), 0);
  const manualCount = Object.values(overrides).filter(v => v !== null && v !== undefined).length;
  const autoCount = Math.max(0, cats.length - manualCount);

  const pulseBubbles = useMemo(() => ([
    {
      label: `${cats.length} categories`,
      bg: withAlpha(heroText, isDark ? 0.16 : 0.22),
      border: withAlpha(heroText, isDark ? 0.38 : 0.3),
      text: heroText
    },
    {
      label: `${manualCount} manual · ${autoCount} auto`,
      bg: withAlpha('#ffffff', isDark ? 0.12 : 0.24),
      border: withAlpha('#ffffff', isDark ? 0.3 : 0.26),
      text: heroText
    },
    {
      label: `90d spend ${fmt(totalSpent)}`,
      bg: withAlpha('#000000', isDark ? 0.26 : 0.1),
      border: withAlpha('#000000', isDark ? 0.42 : 0.16),
      text: heroText
    }
  ]), [autoCount, cats.length, fmt, heroText, isDark, manualCount, totalSpent]);

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
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s16 }}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.s16,
            gap: spacing.s12
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: spacing.s4 }}>
              <Text style={{ color: heroText, fontSize: 24, fontWeight: '800' }}>Envelope playground</Text>
              <Text style={{ color: heroMuted }}>Shape your spending guardrails with a little personality.</Text>
            </View>
            <Pressable onPress={() => nav.goBack()} hitSlop={8}>
              <Text style={{ color: heroMuted, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {pulseBubbles.map((bubble, idx) => (
              <View
                key={idx}
                style={{
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: bubble.bg,
                  borderWidth: 1,
                  borderColor: bubble.border
                }}
              >
                <Text style={{ color: bubble.text, fontWeight: '600' }}>{bubble.label}</Text>
              </View>
            ))}
          </View>
          <Button title="Reset all to Auto" variant="secondary" onPress={resetAll} />
        </LinearGradient>

        {cats.length === 0 ? (
          <View style={emptyCardStyle}>
            <Text style={{ color: textMuted }}>
              No history yet. Grab a latte, log a few expenses, and watch envelopes bloom.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.s12 }}>
            {cats.map((c, idx) => {
              const manualCap = overrides[c];
              const accent = accentPalette[idx % accentPalette.length];
              const spent = byCat[c] || 0;
              const cap = manualCap ?? suggestedCaps[c] ?? 0;
              const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
              const remaining = cap > 0 ? Math.max(0, cap - spent) : null;
              const share = totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;
              const isManualOnly = manualOnlyCats.includes(c);

              return (
                <View
                  key={c}
                  style={{
                    borderRadius: radius.xl,
                    padding: spacing.s16,
                    gap: spacing.s12,
                    backgroundColor: accent.card,
                    borderWidth: 1,
                    borderColor: accent.border
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: accent.title, fontSize: 18, fontWeight: '800' }}>{c}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <View style={{ paddingHorizontal: spacing.s10, paddingVertical: spacing.s4, borderRadius: radius.pill, backgroundColor: accent.chipBg }}>
                        <Text style={{ color: accent.chipText, fontWeight: '600' }}>{manualCap !== undefined ? 'Manual' : 'Auto'}</Text>
                      </View>
                      <Pressable onPress={() => handlePeek(c)}>
                        <Text style={{ color: accent.title, fontWeight: '600' }}>Peek history</Text>
                      </Pressable>
                    </View>
                  </View>

                  <Text style={{ color: accent.muted }}>
                    {cap > 0
                      ? `${fmt(spent)} spent · ${pct}% of ${manualCap !== undefined ? 'your cap' : 'auto cap'}${share ? ` · ${share}% of tracked spend` : ''}`
                      : `We’re still learning how you spend on ${c}.`}
                  </Text>

                  <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: accent.progressTrack }}>
                    <View style={{ height: '100%', width: `${pct}%`, backgroundColor: accent.progressFill }} />
                  </View>

                  {remaining !== null ? (
                    <Text style={{ color: accent.muted }}>{fmt(remaining)} safe to deploy this cycle.</Text>
                  ) : null}

                  <Input
                    label="Manual cap (S$)"
                    keyboardType="numeric"
                    value={manualCap !== undefined ? String(manualCap) : ''}
                    placeholder="Leave blank for Auto"
                    onChangeText={(val: string) => handleCapChange(c, val)}
                    style={{ marginTop: spacing.s4 }}
                  />

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                    <Button
                      title="Reset to Auto"
                      size="sm"
                      variant="secondary"
                      onPress={() => setOverride(c, null)}
                      disabled={manualCap === undefined}
                    />
                    <Button
                      title="Spark idea"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleSuggest(c)}
                    />
                    {isManualOnly ? (
                      <Button
                        title="Delete envelope"
                        size="sm"
                        variant="secondary"
                        onPress={() => handleDeleteEnvelope(c)}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScreenScroll>
  );
}
