import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Alert, Pressable, Animated } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Button from '../components/Button';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAccountsStore, type BankAccount } from '../store/accounts';
import { useTxStore } from '../store/transactions';
import { formatCurrency } from '../lib/format';
import Icon from '../components/Icon';
import * as Haptics from 'expo-haptics';

export default function PayCreditCard() {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const { creditCardId } = (route?.params ?? {}) as { creditCardId: string };

  const { accounts, payCredit } = useAccountsStore();
  const { add: addTx } = useTxStore();

  const creditCard = useMemo(
    () => accounts.find(a => a.id === creditCardId && a.kind === 'credit'),
    [accounts, creditCardId]
  );

  // Get all accounts that can be used to pay (checking, savings, cash, other credit cards)
  const paymentAccounts = useMemo(
    () => accounts.filter(a =>
      a.id !== creditCardId &&
      (a.kind === 'checking' || a.kind === 'savings' || a.kind === 'cash' || a.kind === 'credit')
    ),
    [accounts, creditCardId]
  );

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [useFullAmount, setUseFullAmount] = useState(true);

  const selectedAccount = useMemo(
    () => paymentAccounts.find(a => a.id === selectedAccountId),
    [paymentAccounts, selectedAccountId]
  );

  if (!creditCard) {
    return (
      <ScreenScroll>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>
            Pay Credit Card
          </Text>
          <Text style={{ color: get('text.muted') as string }}>Credit card not found.</Text>
        </View>
      </ScreenScroll>
    );
  }

  // Credit card balance is negative (debt), so we need absolute value
  const totalDebt = Math.abs(creditCard.balance);
  const paymentAmount = useFullAmount ? totalDebt : parseFloat(customAmount) || 0;

  const handlePayment = async () => {
    if (!selectedAccount) {
      Alert.alert('Select Account', 'Please select an account to pay from.');
      return;
    }

    if (paymentAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    if (paymentAmount > totalDebt) {
      Alert.alert('Amount Too Large', 'Payment amount cannot exceed the total debt.');
      return;
    }

    // Check if paying account has sufficient balance (except for credit cards)
    if (selectedAccount.kind !== 'credit' && selectedAccount.balance < paymentAmount) {
      Alert.alert(
        'Insufficient Funds',
        `${selectedAccount.name} only has ${formatCurrency(selectedAccount.balance)}. Do you want to proceed anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', onPress: () => executePayment() }
        ]
      );
      return;
    }

    await executePayment();
  };

  const executePayment = async () => {
    if (!selectedAccount) return;

    try {
      // Create transaction for the credit card payment
      await addTx({
        type: 'expense',
        amount: paymentAmount,
        category: 'Credit Card Payment',
        account: creditCard.name,
        date: new Date().toISOString(),
        note: `Payment from ${selectedAccount.name}`,
      });

      // Create transaction for the payment source
      await addTx({
        type: 'expense',
        amount: paymentAmount,
        category: 'Credit Card Payment',
        account: selectedAccount.name,
        date: new Date().toISOString(),
        note: `Payment to ${creditCard.name}`,
      });

      // Update both account balances
      await payCredit(creditCard.name, selectedAccount.name, paymentAmount);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Payment Successful',
        `Paid ${formatCurrency(paymentAmount)} from ${selectedAccount.name} to ${creditCard.name}`,
        [{ text: 'OK', onPress: () => nav.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to process payment. Please try again.');
      console.error('Payment error:', error);
    }
  };

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;
  const dangerColor = get('semantic.danger') as string;

  return (
    <ScreenScroll>
      <View style={{ padding: spacing.s16, gap: spacing.s20 }}>
        {/* Header */}
        <View>
          <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800', marginBottom: spacing.s8 }}>
            Pay Credit Card
          </Text>
          <Text style={{ color: textMuted, fontSize: 14 }}>
            Transfer money to pay off your credit card balance
          </Text>
        </View>

        {/* Credit Card Info with Floating Account Selector */}
        <View style={{ position: 'relative' }}>
          <View
            style={{
              backgroundColor: surface1,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: borderSubtle,
              overflow: 'hidden',
            }}
          >
            {/* Credit Card Section - Clickable */}
            <Pressable
              onPress={() => {
                setShowAccountDropdown(!showAccountDropdown);
                Haptics.selectionAsync();
              }}
              style={{ padding: spacing.s16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, marginBottom: spacing.s12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="credit-card" size={20} color={dangerColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s4 }}>
                    <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>
                      {creditCard.name}
                    </Text>
                    <Icon
                      name={showAccountDropdown ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={textMuted}
                    />
                  </View>
                  {selectedAccount ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                      <Text style={{ color: textMuted, fontSize: 13 }}>
                        Pay from {selectedAccount.name}
                      </Text>
                      {selectedAccount.kind === 'credit' && (
                        <View
                          style={{
                            backgroundColor: surface2,
                            paddingHorizontal: spacing.s6,
                            paddingVertical: spacing.s2,
                            borderRadius: radius.sm,
                          }}
                        >
                          <Text style={{ color: textMuted, fontSize: 10, fontWeight: '600' }}>
                            CREDIT
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={{ color: textMuted, fontSize: 13 }}>
                      Tap to select payment account
                    </Text>
                  )}
                </View>
              </View>
              <View style={{ paddingTop: spacing.s12, borderTopWidth: 1, borderTopColor: borderSubtle }}>
                <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s4 }}>
                  CURRENT BALANCE
                </Text>
                <Text style={{ color: dangerColor, fontSize: 28, fontWeight: '800' }}>
                  {formatCurrency(totalDebt)}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Account Dropdown List - Floating Overlay */}
          {showAccountDropdown && (
            <View
              style={{
                position: 'absolute',
                top: 80,
                left: 0,
                right: 0,
                backgroundColor: surface1,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: borderSubtle,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
                zIndex: 1000,
              }}
            >
              {paymentAccounts.map((account, index) => (
                <Pressable
                  key={account.id}
                  onPress={() => {
                    setSelectedAccountId(account.id);
                    setShowAccountDropdown(false);
                    Haptics.selectionAsync();
                  }}
                  style={({ pressed }) => ({
                    padding: spacing.s16,
                    backgroundColor: pressed ? surface2 : 'transparent',
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: borderSubtle,
                    borderTopLeftRadius: index === 0 ? radius.lg : 0,
                    borderTopRightRadius: index === 0 ? radius.lg : 0,
                    borderBottomLeftRadius: index === paymentAccounts.length - 1 ? radius.lg : 0,
                    borderBottomRightRadius: index === paymentAccounts.length - 1 ? radius.lg : 0,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: radius.md,
                        backgroundColor: surface2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon
                        name={account.kind === 'credit' ? 'credit-card' : 'wallet'}
                        size={16}
                        color={textPrimary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '600' }}>
                        {account.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginTop: spacing.s2 }}>
                        <Text style={{ color: textMuted, fontSize: 12 }}>
                          {formatCurrency(account.balance)}
                        </Text>
                        {account.kind === 'credit' && (
                          <View
                            style={{
                              backgroundColor: surface2,
                              paddingHorizontal: spacing.s6,
                              paddingVertical: spacing.s2,
                              borderRadius: radius.sm,
                            }}
                          >
                            <Text style={{ color: textMuted, fontSize: 10, fontWeight: '600' }}>
                              CREDIT
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {selectedAccountId === account.id && (
                      <Icon name="check" size={18} color={successColor} />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Payment Amount */}
        <View>
          <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700', marginBottom: spacing.s12 }}>
            Payment amount
          </Text>

          {/* Full Amount Button */}
          <Button
            variant={useFullAmount ? 'primary' : 'secondary'}
            title={`Pay Full Balance (${formatCurrency(totalDebt)})`}
            onPress={() => {
              setUseFullAmount(true);
              setCustomAmount('');
              Haptics.selectionAsync();
            }}
            style={{ marginBottom: spacing.s8 }}
          />

          {/* Custom Amount Button */}
          <Button
            variant={!useFullAmount ? 'primary' : 'secondary'}
            title="Pay Custom Amount"
            onPress={() => {
              setUseFullAmount(false);
              Haptics.selectionAsync();
            }}
          />

          {/* Custom Amount Input */}
          {!useFullAmount && (
            <View style={{ marginTop: spacing.s12 }}>
              <TextInput
                value={customAmount}
                onChangeText={setCustomAmount}
                placeholder="Enter amount"
                placeholderTextColor={textMuted}
                keyboardType="decimal-pad"
                style={{
                  height: 50,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: borderSubtle,
                  backgroundColor: surface1,
                  paddingHorizontal: spacing.s16,
                  color: textPrimary,
                  fontSize: 16,
                  fontWeight: '600',
                }}
              />
            </View>
          )}
        </View>

        {/* Summary */}
        {selectedAccount && paymentAmount > 0 && (
          <View
            style={{
              backgroundColor: surface2,
              borderRadius: radius.lg,
              padding: spacing.s16,
              borderWidth: 1,
              borderColor: borderSubtle,
            }}
          >
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s12 }}>
              PAYMENT SUMMARY
            </Text>
            <View style={{ gap: spacing.s8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: textPrimary, fontSize: 14 }}>From</Text>
                <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '600' }}>
                  {selectedAccount.name}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: textPrimary, fontSize: 14 }}>To</Text>
                <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '600' }}>
                  {creditCard.name}
                </Text>
              </View>
              <View
                style={{
                  height: 1,
                  backgroundColor: borderSubtle,
                  marginVertical: spacing.s4,
                }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Amount</Text>
                <Text style={{ color: successColor, fontSize: 18, fontWeight: '800' }}>
                  {formatCurrency(paymentAmount)}
                </Text>
              </View>
              {!useFullAmount && totalDebt - paymentAmount > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s4 }}>
                  <Text style={{ color: textMuted, fontSize: 13 }}>Remaining balance</Text>
                  <Text style={{ color: dangerColor, fontSize: 13, fontWeight: '600' }}>
                    {formatCurrency(totalDebt - paymentAmount)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', gap: spacing.s12, marginTop: spacing.s8 }}>
          <Button
            variant="secondary"
            title="Cancel"
            onPress={() => nav.goBack()}
            style={{ flex: 1 }}
          />
          <Button
            title="Confirm Payment"
            onPress={handlePayment}
            style={{ flex: 1 }}
            disabled={!selectedAccount || paymentAmount <= 0}
          />
        </View>
      </View>
    </ScreenScroll>
  );
}
