import React, { useMemo, useState } from 'react';
import { View, Text, Alert, Pressable, Switch, Modal, TouchableWithoutFeedback, ScrollView } from 'react-native';
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
  const { accounts, updateAccount, removeAccount, payCredit } = useAccountsStore();
  const acc = useMemo(() => (accounts || []).find(a => a.id === (route.params as RouteParams)?.id), [accounts, route.params]);

  const [name, setName] = useState(acc?.name || '');
  const [institution, setInstitution] = useState(acc?.institution || '');
  const [balance, setBalance] = useState(String(acc?.balance ?? 0));
  const [kind, setKind] = useState<AccountKind>(acc?.kind || 'checking');
  const [mask, setMask] = useState(acc?.mask || '');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(acc?.includeInNetWorth !== false);
  const [note, setNote] = useState(acc?.note || '');
  const [apr, setApr] = useState(String(acc?.apr ?? ''));
  const [creditLimit, setCreditLimit] = useState(String(acc?.creditLimit ?? ''));
  const [minPaymentPercent, setMinPaymentPercent] = useState(String(acc?.minPaymentPercent ?? '2.5'));
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<string>('');

  const balanceNumber = useMemo(() => {
    const parsed = parseFloat(balance || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [balance]);

  const debtAmount = useMemo(() => Math.abs(balanceNumber), [balanceNumber]);

  const minimumPayment = useMemo(() => {
    const minPercent = parseFloat(minPaymentPercent || '2.5');
    return Math.max(25, (debtAmount * minPercent) / 100); // Minimum $25 or percentage
  }, [debtAmount, minPaymentPercent]);

  const paymentAccounts = useMemo(() => {
    return (accounts || []).filter(a => a.kind !== 'credit' && a.id !== acc?.id);
  }, [accounts, acc]);

  if (!acc) {
    return (
      <ScreenScroll contentStyle={{ padding: spacing.s16 }}>
        <Text style={{ color: text }}>Account not found.</Text>
      </ScreenScroll>
    );
  }

  async function onSave() {
    const aprNum = parseFloat(apr || '0');
    const limitNum = parseFloat(creditLimit || '0');
    const minPayNum = parseFloat(minPaymentPercent || '2.5');

    await updateAccount(acc.id, {
      name: name.trim(),
      institution: institution.trim(),
      balance: balanceNumber,
      kind,
      mask: mask ? mask : undefined,
      includeInNetWorth,
      note: note.trim() ? note.trim() : undefined,
      apr: kind === 'credit' && aprNum > 0 ? aprNum : undefined,
      creditLimit: kind === 'credit' && limitNum > 0 ? limitNum : undefined,
      minPaymentPercent: kind === 'credit' && minPayNum > 0 ? minPayNum : undefined,
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

  async function onMakePayment() {
    const amount = parseFloat(paymentAmount || '0');
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }
    if (!selectedPaymentAccount) {
      Alert.alert('Select Account', 'Please select an account to pay from.');
      return;
    }
    if (amount > debtAmount) {
      Alert.alert('Amount Too High', `You can't pay more than you owe (${formatCurrency(debtAmount)}).`);
      return;
    }

    const fromAcc = paymentAccounts.find(a => a.name === selectedPaymentAccount);
    if (fromAcc && amount > fromAcc.balance) {
      Alert.alert('Insufficient Funds', `${fromAcc.name} has ${formatCurrency(fromAcc.balance)}. You're trying to pay ${formatCurrency(amount)}.`);
      return;
    }

    await payCredit(acc.name, selectedPaymentAccount, amount);
    setShowPaymentModal(false);
    setPaymentAmount('');
    setSelectedPaymentAccount('');
    Alert.alert('Payment Made', `${formatCurrency(amount)} paid to ${acc.name} from ${selectedPaymentAccount}.`);
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
        {kind === 'credit' && (
          <>
            <Input
              label="APR (%)"
              value={apr}
              onChangeText={setApr}
              keyboardType="decimal-pad"
              placeholder="e.g., 18.99"
            />
            <Input
              label="Credit Limit"
              value={creditLimit}
              onChangeText={setCreditLimit}
              keyboardType="decimal-pad"
              placeholder="e.g., 5000"
            />
            <Input
              label="Minimum Payment (%)"
              value={minPaymentPercent}
              onChangeText={setMinPaymentPercent}
              keyboardType="decimal-pad"
              placeholder="e.g., 2.5"
            />
          </>
        )}
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

      {kind === 'credit' && balanceNumber < 0 && (
        <View style={{ gap: spacing.s12 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>Payment</Text>
          <Button
            title={`Make Payment (${formatCurrency(Math.abs(balanceNumber))} owed)`}
            onPress={() => setShowPaymentModal(true)}
          />
        </View>
      )}

      <View style={{ gap: spacing.s12 }}>
        <Button title="Save changes" onPress={onSave} />
        <Button title="Delete" variant="secondary" onPress={onDelete} />
      </View>

      <Modal visible={showPaymentModal} transparent animationType="fade" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={{ flex: 1, backgroundColor: withAlpha('#000', 0.5), justifyContent: 'center', alignItems: 'center', padding: spacing.s16 }}>
          <TouchableWithoutFeedback onPress={() => setShowPaymentModal(false)}>
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
          </TouchableWithoutFeedback>
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              borderRadius: radius.xl,
              padding: spacing.s20,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: outline,
              gap: spacing.s16,
            }}
          >
            <View>
              <Text style={{ color: text, fontSize: 22, fontWeight: '800' }}>Make Payment</Text>
              <Text style={{ color: muted, marginTop: spacing.s4 }}>
                Pay down your {name} balance
              </Text>
            </View>

            <View
              style={{
                backgroundColor: withAlpha(accent, isDark ? 0.15 : 0.1),
                padding: spacing.s12,
                borderRadius: radius.lg,
              }}
            >
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Current Balance</Text>
              <Text style={{ color: text, fontSize: 24, fontWeight: '800', marginTop: spacing.s4 }}>
                {formatCurrency(debtAmount)} owed
              </Text>
              <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s8 }}>
                Minimum payment: {formatCurrency(minimumPayment)}
              </Text>
            </View>

            <Input
              label="Payment Amount"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />

            <View style={{ gap: spacing.s8 }}>
              <Pressable
                onPress={() => setPaymentAmount(minimumPayment.toFixed(2))}
                style={({ pressed }) => ({
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(accent, isDark ? 0.2 : 0.12),
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: accent, fontWeight: '700', textAlign: 'center' }}>
                  Pay Minimum ({formatCurrency(minimumPayment)})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPaymentAmount(debtAmount.toFixed(2))}
                style={({ pressed }) => ({
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.md,
                  backgroundColor: withAlpha(accent, isDark ? 0.2 : 0.12),
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: accent, fontWeight: '700', textAlign: 'center' }}>
                  Pay Full Balance ({formatCurrency(debtAmount)})
                </Text>
              </Pressable>
            </View>

            <View style={{ gap: spacing.s8 }}>
              <Text style={{ color: text, fontWeight: '700' }}>Pay from account</Text>
              {paymentAccounts.length === 0 ? (
                <Text style={{ color: muted }}>No payment accounts available. Add a checking or savings account first.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 200 }}>
                  {paymentAccounts.map(payAcc => {
                    const selected = selectedPaymentAccount === payAcc.name;
                    return (
                      <Pressable
                        key={payAcc.id}
                        onPress={() => setSelectedPaymentAccount(payAcc.name)}
                        style={({ pressed }) => ({
                          paddingVertical: spacing.s12,
                          paddingHorizontal: spacing.s12,
                          borderRadius: radius.md,
                          marginBottom: spacing.s6,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? accent : outline,
                          backgroundColor: selected ? withAlpha(accent, isDark ? 0.2 : 0.1) : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: text, fontWeight: selected ? '700' : '600' }}>{payAcc.name}</Text>
                          <Text style={{ color: muted, fontWeight: '600' }}>{formatCurrency(payAcc.balance)}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s8 }}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  setSelectedPaymentAccount('');
                }}
              />
              <Button title="Make Payment" onPress={onMakePayment} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScroll>
  );
}
