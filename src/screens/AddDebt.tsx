import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../components/ScreenScroll';
import Input from '../components/Input';
import Button from '../components/Button';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useDebtsStore, DebtType } from '../store/debts';
import { useNavigation } from '@react-navigation/native';
import { formatCurrency } from '../lib/format';

const typeOptions: { key: DebtType; title: string; caption: string }[] = [
  { key: 'credit', title: 'Credit & charge card', caption: 'Revolving balances & monthly minimums' },
  { key: 'loan', title: 'Loan or mortgage', caption: 'Installment loans, student loans, personal loans' },
  { key: 'bnpl', title: 'Buy now, pay later', caption: 'Short-term instalments or deferred pay' },
];

const quickBalances = ['500', '1000', '2500', '5000', '10000'];
const quickMinDue = ['50', '100', '250', '500'];

const dueShortcuts: { label: string; calc: () => Date }[] = [
  { label: 'In 7 days', calc: () => new Date(Date.now() + 7 * 86400000) },
  { label: 'In 14 days', calc: () => new Date(Date.now() + 14 * 86400000) },
  { label: 'Next month', calc: () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) },
  { label: 'Month end', calc: () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0) },
];

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

const AddDebt: React.FC = () => {
  const nav = useNavigation<any>();
  const { add } = useDebtsStore();
  const { get, isDark } = useThemeTokens();

  const [name, setName] = useState('Credit card');
  const [type, setType] = useState<DebtType>('credit');
  const [apr, setApr] = useState('24');
  const [balance, setBalance] = useState('1000');
  const [minDue, setMinDue] = useState('50');
  const [dueISO, setDueISO] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const heroColors: [string, string] = isDark
    ? [withAlpha(accentPrimary, 0.36), withAlpha(accentSecondary, 0.48)]
    : [accentPrimary, accentSecondary];
  const heroText = isDark ? textPrimary : (get('text.onPrimary') as string);
  const heroMuted = withAlpha(heroText, isDark ? 0.7 : 0.82);
  const heroChipBg = withAlpha(heroText, isDark ? 0.22 : 0.26);

  const aprNumber = useMemo(() => {
    const parsed = parseFloat(apr || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [apr]);

  const balanceNumber = useMemo(() => {
    const parsed = parseFloat(balance || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [balance]);

  const minDueNumber = useMemo(() => {
    const parsed = parseFloat(minDue || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [minDue]);

  const monthlyInterest = useMemo(() => (balanceNumber * aprNumber) / 1200, [balanceNumber, aprNumber]);

  const recommendedMinDue = useMemo(() => {
    if (balanceNumber <= 0) return 0;
    if (type === 'credit') {
      return Math.max(50, balanceNumber * 0.03);
    }
    if (type === 'loan') {
      return Math.max(0, balanceNumber * 0.02);
    }
    // bnpl
    return Math.max(0, balanceNumber / 4);
  }, [balanceNumber, type]);

  const payoffMonthsEstimate = useMemo(() => {
    if (balanceNumber <= 0 || minDueNumber <= 0) return null;
    const monthlyRate = aprNumber / 1200;
    if (monthlyRate === 0) {
      return Math.ceil(balanceNumber / minDueNumber);
    }
    const numerator = Math.log(minDueNumber) - Math.log(minDueNumber - monthlyRate * balanceNumber);
    const denominator = Math.log(1 + monthlyRate);
    if (!isFinite(numerator) || !isFinite(denominator) || denominator === 0) return null;
    const months = numerator / denominator;
    if (!isFinite(months) || months < 0) return null;
    return Math.ceil(months);
  }, [balanceNumber, minDueNumber, aprNumber]);

  const dueDateLabel = useMemo(() => {
    const date = new Date(dueISO);
    if (isNaN(date.getTime())) return 'Set a due date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [dueISO]);

  const validDate = useMemo(() => {
    const date = new Date(dueISO);
    return !isNaN(date.getTime());
  }, [dueISO]);

  const canSave =
    name.trim().length > 0 &&
    balanceNumber >= 0 &&
    minDueNumber >= 0 &&
    validDate;

  const handleSave = async () => {
    if (!canSave) return;
    const parsedDate = new Date(dueISO);
    await add({
      name: name.trim(),
      type,
      apr: aprNumber,
      balance: balanceNumber,
      minDue: minDueNumber,
      dueISO: parsedDate.toISOString(),
    });
    nav.goBack();
  };

  return (
    <ScreenScroll contentStyle={{ padding: spacing.s16, gap: spacing.s16 }} allowBounce={false}>
      <LinearGradient
        colors={heroColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: radius.xl,
          padding: spacing.s16,
          paddingBottom: spacing.s24,
          gap: spacing.s12,
        }}
      >
        <Text style={{ color: heroMuted, fontWeight: '700', fontSize: 12, letterSpacing: 0.6 }}>
          NEW DEBT
        </Text>
        <Text style={{ color: heroText, fontSize: 26, fontWeight: '800' }}>
          Track a balance and stay on top of due dates
        </Text>
        <Text style={{ color: heroMuted }}>
          Add monthly obligations so Spendable and runway stay accurate. We will remind you when the
          next minimum is coming up.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
          <View
            style={{
              paddingVertical: spacing.s6,
              paddingHorizontal: spacing.s12,
              borderRadius: radius.pill,
              backgroundColor: heroChipBg,
            }}
          >
            <Text style={{ color: heroText, fontWeight: '700' }}>{type.toUpperCase()}</Text>
          </View>
          <View
            style={{
              paddingVertical: spacing.s6,
              paddingHorizontal: spacing.s12,
              borderRadius: radius.pill,
              backgroundColor: heroChipBg,
            }}
          >
            <Text style={{ color: heroText, fontWeight: '700' }}>{formatCurrency(balanceNumber)}</Text>
          </View>
          <View
            style={{
              paddingVertical: spacing.s6,
              paddingHorizontal: spacing.s12,
              borderRadius: radius.pill,
              backgroundColor: heroChipBg,
            }}
          >
            <Text style={{ color: heroText, fontWeight: '700' }}>Due {dueDateLabel}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>Debt basics</Text>
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Citi Rewards card" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
          {typeOptions.map(option => {
            const active = option.key === type;
            return (
              <Pressable
                key={option.key}
                onPress={() => setType(option.key)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.s12,
                  paddingHorizontal: spacing.s16,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: active ? accentPrimary : withAlpha(textPrimary, 0.12),
                  backgroundColor: active ? withAlpha(accentPrimary, isDark ? 0.26 : 0.12) : withAlpha(textPrimary, 0.04),
                  opacity: pressed ? 0.85 : 1,
                  flex: 1,
                  minWidth: '48%',
                })}
              >
                <Text style={{ color: textPrimary, fontWeight: '700' }}>{option.title}</Text>
                <Text style={{ color: textMuted, marginTop: spacing.s4 }}>{option.caption}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>Balance & APR</Text>
        <Input
          label="Outstanding balance"
          value={balance}
          onChangeText={setBalance}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
          {quickBalances.map(amount => (
            <Pressable
              key={amount}
              onPress={() => setBalance(amount)}
              style={({ pressed }) => ({
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(textPrimary, 0.05),
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text style={{ color: textPrimary, fontWeight: '600' }}>{formatCurrency(Number(amount))}</Text>
            </Pressable>
          ))}
        </View>
        <Input
          label="APR (%)"
          value={apr}
          onChangeText={setApr}
          keyboardType="decimal-pad"
          placeholder="e.g. 24"
        />
      </View>

      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>Minimum due</Text>
        <Input
          label="Minimum due this cycle"
          value={minDue}
          onChangeText={setMinDue}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
          {quickMinDue.map(amount => (
            <Pressable
              key={amount}
              onPress={() => setMinDue(amount)}
              style={({ pressed }) => ({
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(textPrimary, 0.05),
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text style={{ color: textPrimary, fontWeight: '600' }}>{formatCurrency(Number(amount))}</Text>
            </Pressable>
          ))}
          {recommendedMinDue > 0 ? (
            <Pressable
              onPress={() => setMinDue(String(Math.round(recommendedMinDue)))}
              style={({ pressed }) => ({
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.3 : 0.15),
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text style={{ color: textPrimary, fontWeight: '700' }}>Use recommended</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>Next due date</Text>
        <Input
          label="Due date (YYYY-MM-DD)"
          value={dueISO}
          onChangeText={setDueISO}
          placeholder="2025-01-15"
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
          {dueShortcuts.map(shortcut => (
            <Pressable
              key={shortcut.label}
              onPress={() => setDueISO(shortcut.calc().toISOString().slice(0, 10))}
              style={({ pressed }) => ({
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(textPrimary, 0.05),
                opacity: pressed ? 0.82 : 1,
              })}
            >
              <Text style={{ color: textPrimary, fontWeight: '600' }}>{shortcut.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View
        style={{
          padding: spacing.s16,
          borderRadius: radius.lg,
          backgroundColor: withAlpha(textPrimary, isDark ? 0.16 : 0.08),
          gap: spacing.s8,
        }}
      >
        <Text style={{ color: textPrimary, fontWeight: '700' }}>Payment preview</Text>
        <Text style={{ color: textMuted }}>
          At {formatCurrency(minDueNumber)} per cycle, estimated payoff timeline is{' '}
          {payoffMonthsEstimate ? `${payoffMonthsEstimate} month${payoffMonthsEstimate === 1 ? '' : 's'}` : '—'}.
        </Text>
        <Text style={{ color: textMuted }}>
          Approximate monthly interest: {formatCurrency(monthlyInterest)} at {aprNumber.toFixed(1)}% APR.
        </Text>
        {recommendedMinDue > 0 ? (
          <Text style={{ color: textMuted }}>
            Suggested minimum for {type} is about {formatCurrency(recommendedMinDue)} — aim above it to accelerate payoff.
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.s10 }}>
        <Button title="Save debt" onPress={handleSave} disabled={!canSave} />
        <Button title="Cancel" variant="secondary" onPress={() => nav.goBack()} />
        <Text style={{ color: textMuted, textAlign: 'center', marginTop: spacing.s4 }}>
          Fingrow updates Spendable and runway instantly after you save.
        </Text>
      </View>
    </ScreenScroll>
  );
};

export default AddDebt;
