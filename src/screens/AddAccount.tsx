import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Switch, TextInput, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import Icon, { IconName } from '../components/Icon';
import BottomSheet from '../components/BottomSheet';
import { spacing, radius } from '../theme/tokens';
import { useAccountsStore } from '../store/accounts';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { formatCurrency } from '../lib/format';

type AccountKind = 'checking' | 'savings' | 'cash' | 'credit' | 'investment' | 'loan' | 'mortgage' | 'student' | 'bnpl';

const kinds: { key: AccountKind; category: 'asset' | 'debt'; title: string; caption: string; icon: string }[] = [
  // Assets
  { key: 'checking', category: 'asset', title: 'Daily spend', caption: 'Salary, current, multi-use funds', icon: 'building-2' },
  { key: 'savings', category: 'asset', title: 'Savings', caption: 'Emergency, reserves, fixed deposits', icon: 'piggy-bank' },
  { key: 'cash', category: 'asset', title: 'Cash & wallets', caption: 'Physical cash, GrabPay, prepaid', icon: 'wallet' },
  { key: 'investment', category: 'asset', title: 'Investment cash', caption: 'Brokerage or robo cash buckets', icon: 'trending-up' },

  // Debts
  { key: 'credit', category: 'debt', title: 'Credit card', caption: 'Revolving credit with monthly payments', icon: 'credit-card' },
  { key: 'loan', category: 'debt', title: 'Personal / Auto loan', caption: 'Fixed installment loans', icon: 'circle-dollar-sign' },
  { key: 'mortgage', category: 'debt', title: 'Mortgage', caption: 'Home loans with property value', icon: 'home' },
  { key: 'student', category: 'debt', title: 'Student loan', caption: 'Education loans with deferment', icon: 'graduation-cap' },
  { key: 'bnpl', category: 'debt', title: 'Buy Now Pay Later', caption: 'Short-term installment plans', icon: 'calendar' },
];

const quickBalances = ['0', '250', '500', '1000', '5000'];

const bnplProviders: string[] = [
  'Afterpay',
  'Klarna',
  'Affirm',
  'Zip',
  'PayPal Pay in 4',
  'Apple Pay Later',
  'Sezzle',
  'Quadpay',
  'Other',
];

const loanTypes: string[] = ['Federal', 'Private'];

const defermentStatuses: string[] = ['In Repayment', 'Deferred', 'Grace Period', 'Forbearance'];

const paymentFrequencies: string[] = ['Weekly', 'Biweekly', 'Monthly'];

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

const AddAccount: React.FC = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const context = route.params?.context as 'asset' | 'debt' | undefined;

  const { addAccount } = useAccountsStore();
  const { get, isDark } = useThemeTokens();
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('DBS Bank');
  const [balance, setBalance] = useState('0');
  const [kind, setKind] = useState<AccountKind>(context === 'debt' ? 'credit' : 'checking');
  const [mask, setMask] = useState('');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [note, setNote] = useState('');
  const [accountTypeSheet, setAccountTypeSheet] = useState(false);
  const [institutionSheet, setInstitutionSheet] = useState(false);
  const [institutionQuery, setInstitutionQuery] = useState('');

  // Credit card specific
  const [apr, setApr] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [paymentDueDay, setPaymentDueDay] = useState('');
  const [minPaymentPercent, setMinPaymentPercent] = useState('2.5');

  // Loan specific
  const [originalAmount, setOriginalAmount] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [loanTerm, setLoanTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [payoffDate, setPayoffDate] = useState('');

  // Mortgage specific
  const [propertyValue, setPropertyValue] = useState('');

  // Student loan specific
  const [loanType, setLoanType] = useState('Federal');
  const [defermentStatus, setDefermentStatus] = useState('In Repayment');
  const [loanTypeSheet, setLoanTypeSheet] = useState(false);
  const [defermentSheet, setDefermentSheet] = useState(false);

  // BNPL specific
  const [bnplProvider, setBnplProvider] = useState('Afterpay');
  const [totalAmount, setTotalAmount] = useState('');
  const [installments, setInstallments] = useState('4');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState('Biweekly');
  const [bnplProviderSheet, setBnplProviderSheet] = useState(false);
  const [frequencySheet, setFrequencySheet] = useState(false);

  const accentPrimary = get('accent.primary') as string;
  const textPrimary = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;
  const bgDefault = get('background.default') as string;
  const surface2 = get('surface.level2') as string;

  const balanceNumber = useMemo(() => {
    const parsed = parseFloat(balance || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [balance]);

  const filteredInstitutions = useMemo(() => {
    if (!institutionQuery.trim()) return institutions;
    const q = institutionQuery.toLowerCase();
    return institutions.filter((inst) => inst.name.toLowerCase().includes(q));
  }, [institutionQuery]);

  const filteredKinds = useMemo(() => {
    console.log('AddAccount context:', context);
    if (!context) return kinds;
    const filtered = kinds.filter(k => k.category === context);
    console.log('Filtered kinds:', filtered.length, 'of', kinds.length);
    return filtered;
  }, [context]);

  const screenTitle = context === 'debt' ? 'Add debt' : context === 'asset' ? 'Add account' : 'Add account';

  const canSave = name.trim().length > 0 && Number.isFinite(balanceNumber);

  async function onSave() {
    if (!canSave) return;
    const payloadBalance = Number.isFinite(balanceNumber) ? balanceNumber : 0;
    const sanitizedMask = mask.replace(/\D/g, '').slice(0, 6);

    const basePayload: any = {
      name: name.trim(),
      institution: institution.trim() || 'Manual',
      mask: sanitizedMask ? sanitizedMask : undefined,
      balance: payloadBalance,
      kind,
      includeInNetWorth,
      note: note.trim() ? note.trim() : undefined,
    };

    // Add credit card specific fields
    if (kind === 'credit') {
      const aprNum = parseFloat(apr || '0');
      const limitNum = parseFloat(creditLimit || '0');
      const minPayNum = parseFloat(minPaymentPercent || '2.5');
      const statementDayNum = parseInt(statementDay || '0');
      const paymentDayNum = parseInt(paymentDueDay || '0');

      basePayload.apr = aprNum > 0 ? aprNum : undefined;
      basePayload.creditLimit = limitNum > 0 ? limitNum : undefined;
      basePayload.minPaymentPercent = minPayNum > 0 ? minPayNum : undefined;
      basePayload.statementDay = statementDayNum > 0 ? statementDayNum : undefined;
      basePayload.paymentDueDay = paymentDayNum > 0 ? paymentDayNum : undefined;
    }

    // Add loan/mortgage specific fields
    if (kind === 'loan' || kind === 'mortgage') {
      const originalNum = parseFloat(originalAmount || '0');
      const aprNum = parseFloat(apr || '0');
      const monthlyPayNum = parseFloat(monthlyPayment || '0');
      const loanTermNum = parseInt(loanTerm || '0');
      const paymentDayNum = parseInt(paymentDueDay || '0');

      basePayload.originalAmount = originalNum > 0 ? originalNum : undefined;
      basePayload.apr = aprNum > 0 ? aprNum : undefined;
      basePayload.monthlyPayment = monthlyPayNum > 0 ? monthlyPayNum : undefined;
      basePayload.loanTerm = loanTermNum > 0 ? loanTermNum : undefined;
      basePayload.startDate = startDate ? startDate : undefined;
      basePayload.payoffDate = payoffDate ? payoffDate : undefined;
      basePayload.paymentDueDay = paymentDayNum > 0 ? paymentDayNum : undefined;

      if (kind === 'mortgage') {
        const propertyNum = parseFloat(propertyValue || '0');
        basePayload.propertyValue = propertyNum > 0 ? propertyNum : undefined;
      }
    }

    // Add student loan specific fields
    if (kind === 'student') {
      const originalNum = parseFloat(originalAmount || '0');
      const aprNum = parseFloat(apr || '0');
      const monthlyPayNum = parseFloat(monthlyPayment || '0');
      const paymentDayNum = parseInt(paymentDueDay || '0');

      basePayload.originalAmount = originalNum > 0 ? originalNum : undefined;
      basePayload.apr = aprNum > 0 ? aprNum : undefined;
      basePayload.monthlyPayment = monthlyPayNum > 0 ? monthlyPayNum : undefined;
      basePayload.paymentDueDay = paymentDayNum > 0 ? paymentDayNum : undefined;
      basePayload.loanType = loanType;
      basePayload.defermentStatus = defermentStatus;
    }

    // Add BNPL specific fields
    if (kind === 'bnpl') {
      const totalNum = parseFloat(totalAmount || '0');
      const installmentsNum = parseInt(installments || '4');
      const installmentAmountNum = parseFloat(installmentAmount || '0');
      const aprNum = parseFloat(apr || '0');

      basePayload.bnplProvider = bnplProvider;
      basePayload.totalAmount = totalNum > 0 ? totalNum : undefined;
      basePayload.installments = installmentsNum > 0 ? installmentsNum : undefined;
      basePayload.installmentAmount = installmentAmountNum > 0 ? installmentAmountNum : undefined;
      basePayload.nextPaymentDate = nextPaymentDate ? nextPaymentDate : undefined;
      basePayload.paymentFrequency = paymentFrequency;
      basePayload.apr = aprNum >= 0 ? aprNum : undefined;
    }

    await addAccount(basePayload);
    nav.goBack();
  }

  const selectedKind = kinds.find(k => k.key === kind);

  const inputStyle = useMemo(() => ({
    flex: 1,
    color: textPrimary,
    fontSize: 15,
    textAlign: 'right' as const,
    marginLeft: spacing.s12,
  }), [textPrimary]);

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
                {screenTitle}
              </Text>
            </View>

            {/* Account Details Card */}
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
                onPress={() => setAccountTypeSheet(true)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Account type
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                  <Text style={{ color: textPrimary, fontSize: 15 }}>
                    {selectedKind?.title || 'Select'}
                  </Text>
                  <Icon name="chevron-right" size={20} color={muted} />
                </View>
              </Pressable>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: borderSubtle }} />

              {/* Account Name Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
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
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Institution
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                  <Text style={{ color: institution === 'Manual' ? muted : textPrimary, fontSize: 15 }}>
                    {institution}
                  </Text>
                  <Icon name="chevron-right" size={20} color={muted} />
                </View>
              </Pressable>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: borderSubtle }} />

              {/* Account Hint Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
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

              {/* Starting Balance Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                  Starting balance
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

            {/* Credit Card Specific Fields */}
            {kind === 'credit' && (
              <View
                style={{
                  backgroundColor: cardBg,
                  borderRadius: radius.lg,
                  padding: spacing.s16,
                  gap: spacing.s16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
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

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
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

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Statement day
                  </Text>
                  <TextInput
                    value={statementDay}
                    onChangeText={value => setStatementDay(value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="15"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Payment due day
                  </Text>
                  <TextInput
                    value={paymentDueDay}
                    onChangeText={value => setPaymentDueDay(value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="5"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
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

            {/* Loan / Mortgage Specific Fields */}
            {(kind === 'loan' || kind === 'mortgage') && (
              <View
                style={{
                  backgroundColor: cardBg,
                  borderRadius: radius.lg,
                  padding: spacing.s16,
                  gap: spacing.s16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Original amount
                  </Text>
                  <TextInput
                    value={originalAmount}
                    onChangeText={setOriginalAmount}
                    placeholder="50000"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    APR (%)
                  </Text>
                  <TextInput
                    value={apr}
                    onChangeText={setApr}
                    placeholder="5.5"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Monthly payment
                  </Text>
                  <TextInput
                    value={monthlyPayment}
                    onChangeText={setMonthlyPayment}
                    placeholder="850"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Payment due day
                  </Text>
                  <TextInput
                    value={paymentDueDay}
                    onChangeText={value => setPaymentDueDay(value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="1"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Loan term (months)
                  </Text>
                  <TextInput
                    value={loanTerm}
                    onChangeText={setLoanTerm}
                    placeholder="60"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Start date
                  </Text>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="2024-01-01"
                    placeholderTextColor={muted}
                    style={inputStyle}
                  />
                </View>

                {kind === 'mortgage' && (
                  <>
                    <View style={{ height: 1, backgroundColor: borderSubtle }} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                        Property value
                      </Text>
                      <TextInput
                        value={propertyValue}
                        onChangeText={setPropertyValue}
                        placeholder="450000"
                        placeholderTextColor={muted}
                        style={inputStyle}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Student Loan Specific Fields */}
            {kind === 'student' && (
              <View
                style={{
                  backgroundColor: cardBg,
                  borderRadius: radius.lg,
                  padding: spacing.s16,
                  gap: spacing.s16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Original amount
                  </Text>
                  <TextInput
                    value={originalAmount}
                    onChangeText={setOriginalAmount}
                    placeholder="40000"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    APR (%)
                  </Text>
                  <TextInput
                    value={apr}
                    onChangeText={setApr}
                    placeholder="4.5"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Monthly payment
                  </Text>
                  <TextInput
                    value={monthlyPayment}
                    onChangeText={setMonthlyPayment}
                    placeholder="350"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Payment due day
                  </Text>
                  <TextInput
                    value={paymentDueDay}
                    onChangeText={value => setPaymentDueDay(value.replace(/\D/g, '').slice(0, 2))}
                    placeholder="15"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <Pressable
                  onPress={() => setLoanTypeSheet(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Loan type
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                    <Text style={{ color: textPrimary, fontSize: 15 }}>
                      {loanType}
                    </Text>
                    <Icon name="chevron-right" size={20} color={muted} />
                  </View>
                </Pressable>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <Pressable
                  onPress={() => setDefermentSheet(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Status
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                    <Text style={{ color: textPrimary, fontSize: 15 }}>
                      {defermentStatus}
                    </Text>
                    <Icon name="chevron-right" size={20} color={muted} />
                  </View>
                </Pressable>
              </View>
            )}

            {/* BNPL Specific Fields */}
            {kind === 'bnpl' && (
              <View
                style={{
                  backgroundColor: cardBg,
                  borderRadius: radius.lg,
                  padding: spacing.s16,
                  gap: spacing.s16,
                }}
              >
                <Pressable
                  onPress={() => setBnplProviderSheet(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Provider
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                    <Text style={{ color: textPrimary, fontSize: 15 }}>
                      {bnplProvider}
                    </Text>
                    <Icon name="chevron-right" size={20} color={muted} />
                  </View>
                </Pressable>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Total amount
                  </Text>
                  <TextInput
                    value={totalAmount}
                    onChangeText={setTotalAmount}
                    placeholder="1000"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Installments
                  </Text>
                  <TextInput
                    value={installments}
                    onChangeText={setInstallments}
                    placeholder="4"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Installment amount
                  </Text>
                  <TextInput
                    value={installmentAmount}
                    onChangeText={setInstallmentAmount}
                    placeholder="250"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Next payment date
                  </Text>
                  <TextInput
                    value={nextPaymentDate}
                    onChangeText={setNextPaymentDate}
                    placeholder="2025-02-15"
                    placeholderTextColor={muted}
                    style={inputStyle}
                  />
                </View>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <Pressable
                  onPress={() => setFrequencySheet(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Payment frequency
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                    <Text style={{ color: textPrimary, fontSize: 15 }}>
                      {paymentFrequency}
                    </Text>
                    <Icon name="chevron-right" size={20} color={muted} />
                  </View>
                </Pressable>

                <View style={{ height: 1, backgroundColor: borderSubtle }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                    APR (%)
                  </Text>
                  <TextInput
                    value={apr}
                    onChangeText={setApr}
                    placeholder="0"
                    placeholderTextColor={muted}
                    style={inputStyle}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            )}

            {/* Balance Info */}
            {balanceNumber !== 0 && (
              <View
                style={{
                  padding: spacing.s12,
                  borderRadius: radius.lg,
                  backgroundColor: withAlpha(accentPrimary, isDark ? 0.15 : 0.08),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.s10,
                }}
              >
                <Icon name="info" size={18} color={accentPrimary} />
                <Text style={{ color: muted, fontSize: 13, flex: 1 }}>
                  This will {balanceNumber >= 0 ? 'add' : 'subtract'} {formatCurrency(Math.abs(balanceNumber))} {balanceNumber >= 0 ? 'to' : 'from'} your net worth
                </Text>
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
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                  Include in net worth
                </Text>
                <Switch value={includeInNetWorth} onValueChange={setIncludeInNetWorth} />
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
                  placeholder="Optional"
                  placeholderTextColor={muted}
                  style={inputStyle}
                  multiline={false}
                />
              </View>
            </View>

            {/* Actions */}
            <View style={{ marginTop: spacing.s8 }}>
              <Button title="Save account" onPress={onSave} disabled={!canSave} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Account Type Bottom Sheet */}
      <BottomSheet
        visible={accountTypeSheet}
        onClose={() => setAccountTypeSheet(false)}
      >
        <View style={{ height: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s16 }}>
            Choose account type
          </Text>

          <ScrollView
            style={{ flex: 1, marginHorizontal: -spacing.s16 }}
            contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {filteredKinds.map((type, idx) => {
              const isSelected = type.key === kind;
              return (
                <View key={type.key}>
                  <Pressable
                    onPress={() => {
                      setKind(type.key);
                      setAccountTypeSheet(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s4,
                      opacity: pressed ? 0.6 : 1,
                      backgroundColor: isSelected ? withAlpha(accentPrimary, isDark ? 0.15 : 0.08) : 'transparent',
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
                          backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name={type.icon as IconName} size={20} color={accentPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                          {type.title}
                        </Text>
                        <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                          {type.caption}
                        </Text>
                      </View>
                      {isSelected && (
                        <Icon name="check" size={20} color={accentPrimary} />
                      )}
                    </View>
                  </Pressable>
                  {idx < filteredKinds.length - 1 && (
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
          <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s16 }}>
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
                      backgroundColor: isSelected ? withAlpha(accentPrimary, isDark ? 0.15 : 0.08) : 'transparent',
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
                      <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15, flex: 1 }}>
                        {inst.name}
                      </Text>
                      {isSelected && (
                        <Icon name="check" size={20} color={accentPrimary} />
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

      {/* BNPL Provider Bottom Sheet */}
      <BottomSheet
        visible={bnplProviderSheet}
        onClose={() => setBnplProviderSheet(false)}
      >
        <View style={{ height: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s16 }}>
            Choose provider
          </Text>

          <ScrollView
            style={{ flex: 1, marginHorizontal: -spacing.s16 }}
            contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {bnplProviders.map((provider, idx) => {
              const isSelected = bnplProvider === provider;
              return (
                <View key={provider}>
                  <Pressable
                    onPress={() => {
                      setBnplProvider(provider);
                      setBnplProviderSheet(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s16,
                      opacity: pressed ? 0.6 : 1,
                      backgroundColor: isSelected ? withAlpha(accentPrimary, isDark ? 0.15 : 0.08) : 'transparent',
                      marginHorizontal: -spacing.s16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    })}
                  >
                    <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                      {provider}
                    </Text>
                    {isSelected && (
                      <Icon name="check" size={20} color={accentPrimary} />
                    )}
                  </Pressable>
                  {idx < bnplProviders.length - 1 && (
                    <View style={{ height: 1, backgroundColor: borderSubtle }} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>

      {/* Loan Type Bottom Sheet */}
      <BottomSheet
        visible={loanTypeSheet}
        onClose={() => setLoanTypeSheet(false)}
      >
        <View style={{ height: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s16 }}>
            Choose loan type
          </Text>

          <ScrollView
            style={{ flex: 1, marginHorizontal: -spacing.s16 }}
            contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {loanTypes.map((type, idx) => {
              const isSelected = loanType === type;
              return (
                <View key={type}>
                  <Pressable
                    onPress={() => {
                      setLoanType(type);
                      setLoanTypeSheet(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s16,
                      opacity: pressed ? 0.6 : 1,
                      backgroundColor: isSelected ? withAlpha(accentPrimary, isDark ? 0.15 : 0.08) : 'transparent',
                      marginHorizontal: -spacing.s16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    })}
                  >
                    <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                      {type}
                    </Text>
                    {isSelected && (
                      <Icon name="check" size={20} color={accentPrimary} />
                    )}
                  </Pressable>
                  {idx < loanTypes.length - 1 && (
                    <View style={{ height: 1, backgroundColor: borderSubtle }} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>

      {/* Deferment Status Bottom Sheet */}
      <BottomSheet
        visible={defermentSheet}
        onClose={() => setDefermentSheet(false)}
      >
        <View style={{ height: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s16 }}>
            Choose status
          </Text>

          <ScrollView
            style={{ flex: 1, marginHorizontal: -spacing.s16 }}
            contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {defermentStatuses.map((status, idx) => {
              const isSelected = defermentStatus === status;
              return (
                <View key={status}>
                  <Pressable
                    onPress={() => {
                      setDefermentStatus(status);
                      setDefermentSheet(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s16,
                      opacity: pressed ? 0.6 : 1,
                      backgroundColor: isSelected ? withAlpha(accentPrimary, isDark ? 0.15 : 0.08) : 'transparent',
                      marginHorizontal: -spacing.s16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    })}
                  >
                    <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                      {status}
                    </Text>
                    {isSelected && (
                      <Icon name="check" size={20} color={accentPrimary} />
                    )}
                  </Pressable>
                  {idx < defermentStatuses.length - 1 && (
                    <View style={{ height: 1, backgroundColor: borderSubtle }} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheet>

      {/* Payment Frequency Bottom Sheet */}
      <BottomSheet
        visible={frequencySheet}
        onClose={() => setFrequencySheet(false)}
      >
        <View style={{ height: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary, textAlign: 'center', marginBottom: spacing.s16 }}>
            Payment frequency
          </Text>

          <ScrollView
            style={{ flex: 1, marginHorizontal: -spacing.s16 }}
            contentContainerStyle={{ paddingHorizontal: spacing.s16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {paymentFrequencies.map((freq, idx) => {
              const isSelected = paymentFrequency === freq;
              return (
                <View key={freq}>
                  <Pressable
                    onPress={() => {
                      setPaymentFrequency(freq);
                      setFrequencySheet(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.s12,
                      paddingHorizontal: spacing.s16,
                      opacity: pressed ? 0.6 : 1,
                      backgroundColor: isSelected ? withAlpha(accentPrimary, isDark ? 0.15 : 0.08) : 'transparent',
                      marginHorizontal: -spacing.s16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    })}
                  >
                    <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                      {freq}
                    </Text>
                    {isSelected && (
                      <Icon name="check" size={20} color={accentPrimary} />
                    )}
                  </Pressable>
                  {idx < paymentFrequencies.length - 1 && (
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
};

export default AddAccount;
