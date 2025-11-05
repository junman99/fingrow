/**
 * Transaction Confirmation Component
 * Shows extracted transaction data from AI and allows user to confirm or edit
 */

import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import Icon from '../Icon';
import * as Haptics from 'expo-haptics';

export type TransactionData = {
  amount?: number;
  merchant?: string;
  category?: string;
  date?: string;
  account?: string;
};

export type PortfolioTransactionData = {
  symbol?: string;
  amount?: number; // shares
  price?: number;
  date?: string;
  side?: 'buy' | 'sell';
};

type Account = {
  id: string;
  name: string;
  kind?: string;
};

type Props = {
  type: 'transaction' | 'portfolio_transaction';
  data: TransactionData | PortfolioTransactionData;
  onConfirm: (data: TransactionData | PortfolioTransactionData) => void;
  onCancel: () => void;
  onEdit?: () => void;
  suggestedAccounts?: Account[];
};

export default function TransactionConfirmation({ type, data, onConfirm, onCancel, onEdit, suggestedAccounts }: Props) {
  const { get } = useThemeTokens();
  const [editedData, setEditedData] = React.useState(data);
  // Use account name as the selected value (since transactions store account names, not IDs)
  // Auto-select first suggested account if no account specified
  const [selectedAccountName, setSelectedAccountName] = React.useState<string | undefined>(() => {
    if (type === 'transaction') {
      const txData = data as TransactionData;
      return txData.account || (suggestedAccounts && suggestedAccounts.length > 0 ? suggestedAccounts[0].name : undefined);
    }
    return undefined;
  });
  const [customAccountName, setCustomAccountName] = React.useState('');
  const [showCustomInput, setShowCustomInput] = React.useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = React.useState(false);
  const [dropdownLayout, setDropdownLayout] = React.useState({ y: 0, height: 0 });
  const accountRowRef = React.useRef<any>(null);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const accent = get('accent.primary') as string;
  const border = get('border.subtle') as string;
  const success = get('semantic.success') as string;
  const error = get('semantic.error') as string;

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Add selected account to the data
    const dataWithAccount = {
      ...editedData,
      account: selectedAccountName,
    };
    onConfirm(dataWithAccount);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  if (type === 'transaction') {
    const txData = editedData as TransactionData;

    // Format date to human-readable
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return 'Today';
      const date = new Date(dateStr);
      const month = date.toLocaleString('default', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
      return `${year} ${month} ${day}, ${hours}:${minutesStr} ${ampm}`;
    };

    return (
      <View
        style={{
          backgroundColor: surface1,
          borderRadius: radius.lg,
          padding: spacing.s16,
          marginTop: spacing.s12,
          borderWidth: 1,
          borderColor: border,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s12 }}>
          <View
            style={{
              backgroundColor: accent + '15',
              borderRadius: radius.md,
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="check-circle" size={18} colorToken="accent.primary" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: text, fontSize: 15, fontWeight: '700' }}>
              Confirm Transaction
            </Text>
            <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
              Review the details below
            </Text>
          </View>
        </View>

        {/* Transaction Details */}
        <View style={{ gap: spacing.s10 }}>
          {/* Amount */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: muted, fontSize: 13 }}>Amount</Text>
            <Text style={{ color: text, fontSize: 15, fontWeight: '700' }}>
              ${txData.amount?.toFixed(2) || '0.00'}
            </Text>
          </View>

          {/* Category */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: muted, fontSize: 13 }}>Category</Text>
            <Text style={{ color: text, fontSize: 14 }}>{txData.category || 'Food'}</Text>
          </View>

          {/* Description/Merchant */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: muted, fontSize: 13 }}>Description</Text>
            <Text style={{ color: text, fontSize: 14 }}>{txData.merchant || 'Added via AI'}</Text>
          </View>

          {/* Account - Tappable */}
          <View
            style={{ position: 'relative' }}
            ref={accountRowRef}
            onLayout={(event) => {
              accountRowRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                setDropdownLayout({ y, height });
              });
            }}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAccountDropdown(!showAccountDropdown);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: muted, fontSize: 13 }}>Account</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4 }}>
                <Text style={{ color: accent, fontSize: 14, fontWeight: '600' }}>
                  {selectedAccountName || 'Select account'}
                </Text>
                <Icon name="chevron-down" size={16} colorToken="accent.primary" />
              </View>
            </Pressable>

            {/* Floating Account Dropdown */}
            {showAccountDropdown && suggestedAccounts && suggestedAccounts.length > 0 && (() => {
              // Calculate if dropdown should appear above or below
              const screenHeight = 800; // Approximate screen height
              const dropdownHeight = Math.min(suggestedAccounts.length * 44 + 16, 200);
              const spaceBelow = screenHeight - (dropdownLayout.y + dropdownLayout.height);
              const showAbove = spaceBelow < dropdownHeight + 20 && dropdownLayout.y > dropdownHeight + 20;

              return (
                <View
                  style={{
                    position: 'absolute',
                    ...(showAbove ? { bottom: 28 } : { top: 28 }),
                    right: 0,
                    backgroundColor: surface1,
                    borderRadius: radius.lg,
                    padding: spacing.s6,
                    borderWidth: 1,
                    borderColor: border,
                    maxHeight: 200,
                    zIndex: 1000,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  {suggestedAccounts.map((account, index) => {
                    const isSelected = selectedAccountName === account.name;
                    return (
                      <Pressable
                        key={account.id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedAccountName(account.name);
                          setShowAccountDropdown(false);
                        }}
                        style={({ pressed }) => ({
                          backgroundColor: isSelected ? accent + '15' : 'transparent',
                          borderRadius: radius.md,
                          padding: spacing.s8,
                          paddingHorizontal: spacing.s12,
                          marginBottom: index < suggestedAccounts.length - 1 ? spacing.s2 : 0,
                          opacity: pressed ? 0.7 : 1,
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: spacing.s24,
                        })}
                      >
                        {/* Left: Account Type */}
                        <Text
                          style={{
                            color: muted,
                            fontSize: 11,
                            textTransform: 'capitalize',
                            fontWeight: '600',
                            minWidth: 60,
                          }}
                        >
                          {account.kind || 'Account'}
                        </Text>
                        {/* Right: Account Name */}
                        <Text
                          style={{
                            color: isSelected ? accent : text,
                            fontSize: 14,
                            fontWeight: isSelected ? '700' : '600',
                            flexShrink: 0,
                          }}
                        >
                          {account.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })()}
          </View>

          {/* Date */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: muted, fontSize: 13 }}>Date</Text>
            <Text style={{ color: text, fontSize: 14 }}>{formatDate(txData.date)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s16 }}>
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: 'transparent',
              borderRadius: radius.md,
              padding: spacing.s12,
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: error, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: success,
              borderRadius: radius.md,
              padding: spacing.s12,
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Confirm & Add</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Portfolio Transaction
  const portfolioData = editedData as PortfolioTransactionData;

  return (
    <View
      style={{
        backgroundColor: surface1,
        borderRadius: radius.lg,
        padding: spacing.s16,
        marginTop: spacing.s12,
        borderWidth: 1,
        borderColor: border,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s12 }}>
        <View
          style={{
            backgroundColor: accent + '15',
            borderRadius: radius.md,
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="trending-up" size={18} colorToken="accent.primary" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: text, fontSize: 15, fontWeight: '700' }}>
            Confirm {portfolioData.side === 'buy' ? 'Purchase' : 'Sale'}
          </Text>
          <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
            Review the trade details
          </Text>
        </View>
      </View>

      {/* Trade Details */}
      <View style={{ gap: spacing.s10 }}>
        {/* Symbol */}
        {portfolioData.symbol && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: muted, fontSize: 13 }}>Symbol</Text>
            <Text style={{ color: text, fontSize: 15, fontWeight: '700' }}>{portfolioData.symbol}</Text>
          </View>
        )}

        {/* Shares */}
        {portfolioData.amount && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: muted, fontSize: 13 }}>Shares</Text>
            <Text style={{ color: text, fontSize: 14 }}>{portfolioData.amount}</Text>
          </View>
        )}

        {/* Price */}
        {portfolioData.price && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: muted, fontSize: 13 }}>Price</Text>
            <Text style={{ color: text, fontSize: 14 }}>${portfolioData.price.toFixed(2)}</Text>
          </View>
        )}

        {/* Date */}
        {portfolioData.date && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: muted, fontSize: 13 }}>Date</Text>
            <Text style={{ color: text, fontSize: 14 }}>{portfolioData.date}</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', gap: spacing.s8, marginTop: spacing.s16 }}>
        <Pressable
          onPress={handleCancel}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: 'transparent',
            borderRadius: radius.md,
            padding: spacing.s12,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: error, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={handleConfirm}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: success,
            borderRadius: radius.md,
            padding: spacing.s12,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>Confirm & Add</Text>
        </Pressable>
      </View>
    </View>
  );
}
