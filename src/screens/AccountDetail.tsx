import React, { useMemo, useState } from 'react';
import { View, Text, Alert, Pressable, Switch } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Input from '../components/Input';
import Button from '../components/Button';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useAccountsStore } from '../store/accounts';
import { useRoute, useNavigation } from '@react-navigation/native';
import { formatCurrency } from '../lib/format';

type RouteParams = { id: string };
type AccountKind = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';

const kinds: { key: AccountKind; title: string; caption: string }[] = [
  { key: 'checking', title: 'Daily spend', caption: 'Current / salary accounts' },
  { key: 'savings', title: 'Savings', caption: 'Emergency funds, reserves' },
  { key: 'cash', title: 'Cash & wallets', caption: 'Physical cash, prepaid, e-wallets' },
  { key: 'credit', title: 'Credit & charge', caption: 'Cards that require monthly payment' },
  { key: 'investment', title: 'Investment cash', caption: 'Brokerage cash, robo wallets' },
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

export default function AccountDetail() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const accent = get('accent.primary') as string;
  const cardBg = get('surface.level1') as string;
  const outline = get('border.subtle') as string;
  const { accounts, updateAccount, removeAccount } = useAccountsStore();
  const acc = useMemo(() => (accounts || []).find(a => a.id === (route.params as RouteParams)?.id), [accounts, route.params]);

  const [name, setName] = useState(acc?.name || '');
  const [institution, setInstitution] = useState(acc?.institution || '');
  const [balance, setBalance] = useState(String(acc?.balance ?? 0));
  const [kind, setKind] = useState<AccountKind>(acc?.kind || 'checking');
  const [mask, setMask] = useState(acc?.mask || '');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(acc?.includeInNetWorth !== false);
  const [note, setNote] = useState(acc?.note || '');

  const balanceNumber = useMemo(() => {
    const parsed = parseFloat(balance || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [balance]);

  if (!acc) {
    return (
      <ScreenScroll contentStyle={{ padding: spacing.s16 }}>
        <Text style={{ color: text }}>Account not found.</Text>
      </ScreenScroll>
    );
  }

  async function onSave() {
    await updateAccount(acc.id, {
      name: name.trim(),
      institution: institution.trim(),
      balance: balanceNumber,
      kind,
      mask: mask ? mask : undefined,
      includeInNetWorth,
      note: note.trim() ? note.trim() : undefined,
    });
    nav.goBack();
  }

  async function onDelete() {
    Alert.alert(
      'Delete account?',
      'This will remove the account from Money. This does not affect your bank.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeAccount(acc.id);
            nav.goBack();
          },
        },
      ],
    );
  }

  const balanceTrend = balanceNumber >= 0 ? 'adds to' : 'reduces';

  return (
    <ScreenScroll contentStyle={{ padding: spacing.s16, gap: spacing.s16 }}>
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: radius.xl,
          padding: spacing.s16,
          gap: spacing.s8,
          borderWidth: 1,
          borderColor: outline,
        }}
      >
        <Text style={{ color: muted, fontWeight: '600' }}>ACCOUNT</Text>
        <Text style={{ color: text, fontSize: 24, fontWeight: '800' }}>{name || 'Untitled account'}</Text>
        <Text style={{ color: muted }}>
          {(institution || 'Manual').trim()} • {kind.toUpperCase()}
          {mask ? ` • • • ${mask}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: spacing.s12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: muted, fontWeight: '600' }}>Balance</Text>
            <Text style={{ color: text, fontSize: 20, fontWeight: '700' }}>{formatCurrency(balanceNumber)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: muted, fontWeight: '600' }}>Net worth impact</Text>
            <Text style={{ color: text, fontWeight: '700' }}>
              {includeInNetWorth ? balanceTrend : 'Excluded'}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Account settings</Text>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Institution" value={institution} onChangeText={setInstitution} />
        <Input label="Balance" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
        <Input
          label="Account hint (last 4-6 digits)"
          value={mask}
          onChangeText={value => setMask(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
        />
      </View>

      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Type</Text>
        <View style={{ gap: spacing.s8 }}>
          {kinds.map(option => {
            const active = option.key === kind;
            return (
              <Pressable
                key={option.key}
                onPress={() => setKind(option.key)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.s12,
                  paddingHorizontal: spacing.s16,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: active ? accent : outline,
                  backgroundColor: active ? withAlpha(accent, isDark ? 0.24 : 0.12) : withAlpha(text, 0.02),
                  opacity: pressed ? 0.86 : 1,
                })}
              >
                <Text style={{ color: text, fontWeight: '700' }}>{option.title}</Text>
                <Text style={{ color: muted, marginTop: spacing.s4 }}>{option.caption}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.s12,
          borderRadius: radius.lg,
          backgroundColor: withAlpha(text, isDark ? 0.12 : 0.06),
        }}
      >
        <View style={{ flex: 1, paddingRight: spacing.s12 }}>
          <Text style={{ color: text, fontWeight: '700' }}>Include in net worth & runway</Text>
          <Text style={{ color: muted }}>
            Turn off if this account shouldn&apos;t count toward totals.
          </Text>
        </View>
        <Switch value={includeInNetWorth} onValueChange={setIncludeInNetWorth} />
      </View>

      <Input
        label="Notes"
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="Optional: planning notes, reminders, or context"
      />

      <View style={{ gap: spacing.s12 }}>
        <Button title="Save changes" onPress={onSave} />
        <Button title="Delete" variant="secondary" onPress={onDelete} />
      </View>
    </ScreenScroll>
  );
}
