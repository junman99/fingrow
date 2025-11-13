import React, { useMemo, useState } from 'react';
import { View, Text, Alert, Pressable, Switch, Modal, TouchableWithoutFeedback, ScrollView, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Input from '../components/Input';
import Icon from '../components/Icon';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useAccountsStore } from '../store/accounts';
import { useRoute, useNavigation } from '@react-navigation/native';
import { formatCurrency } from '../lib/format';
import BottomSheet from '../components/BottomSheet';

type RouteParams = { id: string };
type AccountKind = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';

const kinds: { key: AccountKind; title: string; caption: string; icon: string }[] = [
  { key: 'checking', title: 'Daily spend', caption: 'Current / salary accounts', icon: 'credit-card' },
  { key: 'savings', title: 'Savings', caption: 'Emergency funds, reserves', icon: 'piggy-bank' },
  { key: 'cash', title: 'Cash & wallets', caption: 'Physical cash, prepaid, e-wallets', icon: 'wallet' },
  { key: 'credit', title: 'Credit & charge', caption: 'Cards that require monthly payment', icon: 'credit-card' },
  { key: 'investment', title: 'Investment cash', caption: 'Brokerage cash, robo wallets', icon: 'trending-up' },
];

const institutions: { name: string; domain?: string }[] = [
  { name: 'DBS Bank', domain: 'dbs.com' },
  { name: 'OCBC Bank', domain: 'ocbc.com' },
  { name: 'UOB', domain: 'uob.com.sg' },
  { name: 'Citibank', domain: 'citibank.com' },
  { name: 'HSBC', domain: 'hsbc.com' },
  { name: 'Standard Chartered', domain: 'sc.com' },
  { name: 'Maybank', domain: 'maybank.com' },
  { name: 'Chase', domain: 'chase.com' },
  { name: 'Bank of America', domain: 'bankofamerica.com' },
  { name: 'Wells Fargo', domain: 'wellsfargo.com' },
  { name: 'Capital One', domain: 'capitalone.com' },
  { name: 'American Express', domain: 'americanexpress.com' },
  { name: 'Discover', domain: 'discover.com' },
  { name: 'Fidelity', domain: 'fidelity.com' },
  { name: 'Charles Schwab', domain: 'schwab.com' },
  { name: 'Vanguard', domain: 'vanguard.com' },
  { name: 'Robinhood', domain: 'robinhood.com' },
  { name: 'Coinbase', domain: 'coinbase.com' },
  { name: 'Binance', domain: 'binance.com' },
  { name: 'PayPal', domain: 'paypal.com' },
  { name: 'Venmo', domain: 'venmo.com' },
  { name: 'Cash App', domain: 'cash.app' },
  { name: 'Revolut', domain: 'revolut.com' },
  { name: 'Wise', domain: 'wise.com' },
  { name: 'Other' },
];

function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
    const int = parseInt(expanded, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

export default function AccountSettings() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const accent = get('accent.primary') as string;
  const cardBg = get('surface.level1') as string;
  const cardBg2 = get('surface.level2') as string;
  const outline = get('border.subtle') as string;
  const warningColor = get('semantic.warning') as string;
  const errorColor = get('semantic.error') as string;

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
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [institutionSheet, setInstitutionSheet] = useState(false);
  const [institutionQuery, setInstitutionQuery] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState<string>('');

  const balanceNumber = useMemo(() => {
    const parsed = parseFloat(balance || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [balance]);

  const debtAmount = useMemo(() => Math.abs(balanceNumber), [balanceNumber]);

  const minimumPayment = useMemo(() => {
    const minPercent = parseFloat(minPaymentPercent || '2.5');
    return Math.max(25, (debtAmount * minPercent) / 100);
  }, [debtAmount, minPaymentPercent]);

  const paymentAccounts = useMemo(() => {
    return (accounts || []).filter(a => a.kind !== 'credit' && a.id !== acc?.id);
  }, [accounts, acc]);

  const filteredInstitutions = useMemo(() => {
    if (!institutionQuery.trim()) return institutions;
    const q = institutionQuery.toLowerCase();
    return institutions.filter((inst) => inst.name.toLowerCase().includes(q));
  }, [institutionQuery]);

  const bgDefault = get('background.default') as string;
  const borderSubtle = get('border.subtle') as string;

  if (!acc) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: bgDefault }}>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: text }}>Account not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const inputStyle = {
    color: text,
    fontSize: 15,
    textAlign: 'right' as const,
    flex: 1,
    paddingVertical: 0,
  };

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
            nav.navigate('MoneyHome');
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

  const selectedKind = kinds.find(k => k.key === kind);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: bgDefault }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Centered Header */}
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
              <Icon name="chevron-left" size={28} color={text} />
            </Pressable>
            <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>
              Account Settings
            </Text>
          </View>

          {/* Main Details Card */}
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: radius.lg,
              padding: spacing.s16,
              gap: spacing.s16,
            }}
          >
            {/* Account Type Row */}
            <Pressable
              onPress={() => setShowTypeSelector(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                Account type
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: text, fontSize: 15 }}>
                  {selectedKind?.title || 'Select'}
                </Text>
                <Icon name="chevron-right" size={20} color={muted} />
              </View>
            </Pressable>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: borderSubtle }} />

            {/* Account Name Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                Account name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. DBS Multiplier"
                placeholderTextColor={muted}
                style={inputStyle}
                autoCapitalize="words"
              />
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: borderSubtle }} />

            {/* Institution Row */}
            <Pressable
              onPress={() => setInstitutionSheet(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                Institution
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: institution === 'Manual' ? muted : text, fontSize: 15 }}>
                  {institution || 'Select'}
                </Text>
                <Icon name="chevron-right" size={20} color={muted} />
              </View>
            </Pressable>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: borderSubtle }} />

            {/* Account Hint Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                Account hint
              </Text>
              <TextInput
                value={mask}
                onChangeText={value => setMask(value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Last 4-6 digits"
                placeholderTextColor={muted}
                style={inputStyle}
                keyboardType="number-pad"
              />
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: borderSubtle }} />

            {/* Current Balance Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                Current balance
              </Text>
              <TextInput
                value={balance}
                onChangeText={setBalance}
                placeholder="0"
                placeholderTextColor={muted}
                style={inputStyle}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Credit Card Settings */}
          {kind === 'credit' && (
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                padding: spacing.s16,
                gap: spacing.s16,
              }}
            >
              {/* APR Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                  APR (%)
                </Text>
                <TextInput
                  value={apr}
                  onChangeText={setApr}
                  placeholder="18.99"
                  placeholderTextColor={muted}
                  style={inputStyle}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: borderSubtle }} />

              {/* Credit Limit Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                  Credit limit
                </Text>
                <TextInput
                  value={creditLimit}
                  onChangeText={setCreditLimit}
                  placeholder="5000"
                  placeholderTextColor={muted}
                  style={inputStyle}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: borderSubtle }} />

              {/* Minimum Payment Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                  Min payment (%)
                </Text>
                <TextInput
                  value={minPaymentPercent}
                  onChangeText={setMinPaymentPercent}
                  placeholder="2.5"
                  placeholderTextColor={muted}
                  style={inputStyle}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          )}

          {/* Settings Card */}
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: radius.lg,
              padding: spacing.s16,
              gap: spacing.s16,
            }}
          >
            {/* Include in Net Worth Toggle Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: text, fontWeight: '600', fontSize: 15 }}>
                Include in net worth
              </Text>
              <Switch value={includeInNetWorth} onValueChange={setIncludeInNetWorth} />
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: borderSubtle }} />

            {/* Note Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>
                Note
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Optional"
                placeholderTextColor={muted}
                style={inputStyle}
                multiline={false}
              />
            </View>
          </View>

          {/* Payment for Credit Cards */}
          {kind === 'credit' && balanceNumber < 0 && (
            <Button
              title={`Make Payment (${formatCurrency(Math.abs(balanceNumber))} owed)`}
              onPress={() => setShowPaymentModal(true)}
              icon="credit-card"
            />
          )}

          {/* Actions */}
          <Button title="Save changes" onPress={onSave} />

          {/* Danger Zone */}
          <View
            style={{
              backgroundColor: cardBg,
              borderRadius: radius.lg,
              padding: spacing.s16,
              borderWidth: 1,
              borderColor: errorColor,
            }}
          >
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: errorColor, fontWeight: '600', fontSize: 15, textAlign: 'center' }}>
                Delete Account
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Account Type Bottom Sheet */}
      <BottomSheet
        visible={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
      >
        <View style={{ height: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: text, textAlign: 'center', marginBottom: spacing.s16 }}>
            Choose account type
          </Text>

          <ScrollView
            style={{ flex: 1, marginHorizontal: -spacing.s16 }}
            contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {kinds.map((type, idx) => {
              const isSelected = type.key === kind;
              return (
                <View key={type.key}>
                  <Pressable
                    onPress={() => {
                      setKind(type.key);
                      setShowTypeSelector(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s4,
                      opacity: pressed ? 0.6 : 1,
                      backgroundColor: isSelected ? withAlpha(accent, isDark ? 0.15 : 0.08) : 'transparent',
                      marginHorizontal: -spacing.s16,
                      paddingLeft: spacing.s16,
                      paddingRight: spacing.s16,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radius.md,
                          backgroundColor: withAlpha(accent, isDark ? 0.2 : 0.15),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name={type.icon as any} size={20} color={accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: text, fontWeight: '600', fontSize: 15 }}>
                          {type.title}
                        </Text>
                        <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                          {type.caption}
                        </Text>
                      </View>
                      {isSelected && (
                        <Icon name="check" size={20} color={accent} />
                      )}
                    </View>
                  </Pressable>
                  {idx < kinds.length - 1 && (
                    <View style={{ height: 1, backgroundColor: borderSubtle }} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>

      {/* Institution Bottom Sheet */}
      <BottomSheet
        visible={institutionSheet}
        onClose={() => {
          setInstitutionSheet(false);
          setInstitutionQuery('');
        }}
      >
        <View style={{ height: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: text, textAlign: 'center', marginBottom: spacing.s16 }}>
            Choose institution
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
            <Icon name="search" size={18} color={muted} />
            <TextInput
              value={institutionQuery}
              onChangeText={setInstitutionQuery}
              placeholder="Search institutions..."
              placeholderTextColor={muted}
              style={{
                flex: 1,
                height: 36,
                color: text,
                paddingHorizontal: spacing.s12,
                fontSize: 15,
              }}
            />
          </View>

          <ScrollView
            style={{ flex: 1, marginHorizontal: -spacing.s16 }}
            contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {filteredInstitutions.map((inst, idx) => {
              const isSelected = institution === inst.name;
              return (
                <View key={inst.name}>
                  <Pressable
                    onPress={() => {
                      setInstitution(inst.name);
                      setInstitutionSheet(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s4,
                      opacity: pressed ? 0.6 : 1,
                      backgroundColor: isSelected ? withAlpha(accent, isDark ? 0.15 : 0.08) : 'transparent',
                      marginHorizontal: -spacing.s16,
                      paddingLeft: spacing.s16,
                      paddingRight: spacing.s16,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                      {inst.domain ? (
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: radius.md,
                            backgroundColor: isDark ? '#FFFFFF' : '#F3F4F6',
                            padding: 6,
                          }}
                        >
                          <Image
                            source={{ uri: `https://www.google.com/s2/favicons?domain=${inst.domain}&sz=128` }}
                            style={{
                              width: '100%',
                              height: '100%',
                            }}
                            resizeMode="contain"
                          />
                        </View>
                      ) : (
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: radius.md,
                            backgroundColor: withAlpha(muted, 0.2),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon name="building-2" size={20} color={muted} />
                        </View>
                      )}
                      <Text style={{ color: text, fontWeight: '600', fontSize: 15, flex: 1 }}>
                        {inst.name}
                      </Text>
                      {isSelected && (
                        <Icon name="check" size={20} color={accent} />
                      )}
                    </View>
                  </Pressable>
                  {idx < filteredInstitutions.length - 1 && (
                    <View style={{ height: 1, backgroundColor: borderSubtle }} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>

      {/* Payment Modal */}
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
                backgroundColor: withAlpha(warningColor, isDark ? 0.15 : 0.1),
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
    </SafeAreaView>
  );
}
