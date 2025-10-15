import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/Button';
import Input from '../components/Input';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useRecurringStore, Recurring, Freq, computeNextDue } from '../store/recurring';
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

export default function BillEditor() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { items, hydrate, ready, add, update, remove } = useRecurringStore();

  const editingId: string | undefined = route.params?.id;
  const prefillAmount: number | undefined = route.params?.amount;
  const prefillCategory: string | undefined = route.params?.category;
  const prefillLabel: string | undefined = route.params?.label;

  const editing = items?.find(it => it.id === editingId);

  const [label, setLabel] = useState(editing?.label ?? (prefillLabel || ''));
  const [category, setCategory] = useState(editing?.category ?? (prefillCategory || 'bills'));
  const [amount, setAmount] = useState<string>((editing?.amount ?? prefillAmount ?? 0).toString());
  const [freq, setFreq] = useState<Freq>(editing?.freq ?? 'monthly');
  const [anchorISO, setAnchorISO] = useState<string>(editing?.anchorISO ?? new Date().toISOString());
  const [autoPost, setAutoPost] = useState<boolean>(editing?.autoPost ?? false);
  const [remind, setRemind] = useState<boolean>(editing?.remind ?? true);
  const [active, setActive] = useState<boolean>(editing?.active !== false);
  const [autoMatch, setAutoMatch] = useState<boolean>(editing?.autoMatch !== false);

  useEffect(() => { if (!ready) hydrate(); }, [ready]);

  const amountNumber = useMemo(() => Math.max(0, Math.round(Number(amount) || 0)), [amount]);
  const nextPreview = useMemo(() => {
    const sample: Recurring = {
      id: editing?.id || 'temp',
      label: label || category || 'Bill',
      category: category || 'bills',
      amount: amountNumber,
      freq,
      anchorISO,
      autoPost,
      remind,
      active,
      autoMatch
    };
    return computeNextDue(sample, new Date());
  }, [active, anchorISO, amountNumber, autoMatch, autoPost, category, editing?.id, freq, label, remind]);

  const heroGradient: [string, string] = isDark ? ['#10192f', '#1c2b49'] : [get('accent.primary') as string, get('accent.secondary') as string];
  const heroText = isDark ? '#eef3ff' : (get('text.onPrimary') as string);
  const heroMuted = withAlpha(heroText, isDark ? 0.74 : 0.78);

  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;

  const heroChips = [
    { label: editing ? 'Editing bill' : 'New bill', value: label || category || 'Untitled' },
    { label: 'Amount', value: formatCurrency(amountNumber || 0) },
    { label: 'Next due', value: nextPreview ? nextPreview.toDateString() : 'Not set' }
  ];

  const freqOptions: Array<{ key: Freq; label: string }> = [
    { key: 'weekly', label: 'Weekly' },
    { key: 'biweekly', label: 'Bi-weekly' },
    { key: 'monthly', label: 'Monthly' }
  ];

  const togglePills: Array<{ label: string; value: boolean; setter: (next: boolean) => void }> = [
    { label: autoPost ? 'Auto-post: ON' : 'Auto-post: OFF', value: autoPost, setter: setAutoPost },
    { label: remind ? 'Reminders: ON' : 'Reminders: OFF', value: remind, setter: setRemind },
    { label: active ? 'Active' : 'Paused', value: active, setter: setActive },
    { label: autoMatch ? 'Auto-match: ON' : 'Auto-match: OFF', value: autoMatch, setter: setAutoMatch }
  ];

  const onSave = useCallback(async () => {
    const payload = {
      label: label || category,
      category,
      amount: amountNumber,
      freq,
      anchorISO,
      autoPost,
      remind,
      active,
      autoMatch
    };
    if (editing) {
      await update(editing.id, payload);
    } else {
      await add(payload as any);
    }
    nav.goBack();
  }, [active, add, amountNumber, anchorISO, autoMatch, autoPost, category, editing, freq, label, nav, remind, update]);

  const onDelete = useCallback(() => {
    if (!editing) return;
    Alert.alert('Delete bill', 'Remove this recurring bill from your rhythm studio?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove(editing.id);
          nav.goBack();
        }
      }
    ]);
  }, [editing, nav, remove]);

  const renderFreqOption = (option: { key: Freq; label: string }) => {
    const on = freq === option.key;
    return (
      <Pressable
        key={option.key}
        accessibilityRole="button"
        onPress={() => setFreq(option.key)}
        style={({ pressed }) => ({
          paddingVertical: spacing.s8,
          paddingHorizontal: spacing.s12,
          borderRadius: radius.pill,
          backgroundColor: on ? accentPrimary : surface2,
          opacity: pressed ? 0.9 : 1
        })}
      >
        <Text style={{ color: on ? heroText : get('text.primary') as string, fontWeight: '700' }}>{option.label}</Text>
      </Pressable>
    );
  };

  const renderToggle = (item: { label: string; value: boolean; setter: (next: boolean) => void }, idx: number) => (
    <Pressable
      key={idx}
      accessibilityRole="button"
      onPress={() => item.setter(!item.value)}
      style={({ pressed }) => ({
        paddingVertical: spacing.s8,
        paddingHorizontal: spacing.s12,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: item.value ? accentPrimary : borderSubtle,
        backgroundColor: item.value ? withAlpha(accentPrimary, isDark ? 0.22 : 0.12) : surface2,
        opacity: pressed ? 0.9 : 1
      })}
    >
      <Text style={{ color: item.value ? accentPrimary : get('text.primary') as string, fontWeight: '600' }}>{item.label}</Text>
    </Pressable>
  );

  return (
    <ScreenScroll contentStyle={{ paddingBottom: spacing.s32 }}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s16 }}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.xl, padding: spacing.s16, gap: spacing.s12 }}
        >
          <View style={{ gap: spacing.s6 }}>
            <Text style={{ color: heroText, fontSize: 24, fontWeight: '800' }}>
              {editing ? 'Refresh bill groove' : 'Add a new bill vibe'}
            </Text>
            <Text style={{ color: heroMuted }}>
              Keep the cash flow smooth—name the bill, set a cadence, and let FinGrow handle the rhythm.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {heroChips.map((chip, idx) => (
              <View
                key={idx}
                style={{
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(heroText, isDark ? 0.18 : 0.26),
                  borderWidth: 1,
                  borderColor: withAlpha(heroText, isDark ? 0.38 : 0.3)
                }}
              >
                <Text style={{ color: heroText, fontWeight: '600' }}>{chip.label}: {chip.value}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16 }}>Bill basics</Text>
          <Input label="Label" placeholder="e.g., Rent, Spotify" value={label} onChangeText={setLabel} />
          <Input label="Category" placeholder="bills" value={category} onChangeText={setCategory} />
          <Input label="Amount (S$)" keyboardType="numeric" value={amount} onChangeText={setAmount} />
        </View>

        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16 }}>Cadence & anchor</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            {freqOptions.map(renderFreqOption)}
          </View>
          <Text style={{ color: get('text.muted') as string }}>Anchor date: {new Date(anchorISO).toDateString()}</Text>
          <Button title="Set anchor to today" variant="secondary" onPress={() => setAnchorISO(new Date().toISOString())} />
        </View>

        <View style={{
          backgroundColor: surface1,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s12,
          borderWidth: 1,
          borderColor: borderSubtle
        }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16 }}>Automation</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {togglePills.map(renderToggle)}
          </View>
          <View style={{
            marginTop: spacing.s12,
            padding: spacing.s12,
            borderRadius: radius.lg,
            backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08)
          }}>
            <Text style={{ color: accentPrimary, fontWeight: '700' }}>Preview</Text>
            <Text style={{ color: get('text.muted') as string, marginTop: spacing.s4 }}>
              The next payment {nextPreview ? `drops on ${nextPreview.toDateString()}` : 'will be scheduled once you set an anchor'}.
            </Text>
            <Text style={{ color: get('text.muted') as string }}>
              Estimated monthly impact: {formatCurrency(freq === 'monthly' ? amountNumber : freq === 'biweekly' ? Math.round(amountNumber * 26 / 12) : Math.round(amountNumber * 52 / 12))}
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.s12 }}>
          <Button title={editing ? 'Save changes' : 'Add bill'} variant="primary" onPress={onSave} />
          {editing ? (
            <Button title="Delete bill" variant="secondary" onPress={onDelete} />
          ) : null}
        </View>
      </View>
    </ScreenScroll>
  );
}
