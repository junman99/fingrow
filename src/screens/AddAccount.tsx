import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import Input from '../components/Input';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { spacing, radius } from '../theme/tokens';
import { useAccountsStore } from '../store/accounts';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { formatCurrency } from '../lib/format';

type AccountKind = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';

const kinds: { key: AccountKind; title: string; caption: string; icon: string }[] = [
  { key: 'checking', title: 'Daily spend', caption: 'Salary, current, multi-use funds', icon: 'building-2' },
  { key: 'savings', title: 'Savings', caption: 'Emergency, reserves, fixed deposits', icon: 'piggy-bank' },
  { key: 'cash', title: 'Cash & wallets', caption: 'Physical cash, GrabPay, prepaid', icon: 'wallet' },
  { key: 'credit', title: 'Credit & charge', caption: 'Cards that need monthly payoff', icon: 'credit-card' },
  { key: 'investment', title: 'Investment cash', caption: 'Brokerage or robo cash buckets', icon: 'trending-up' },
];

const quickBalances = ['0', '250', '500', '1000', '5000'];

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
  const { addAccount } = useAccountsStore();
  const { get, isDark } = useThemeTokens();
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('Manual');
  const [balance, setBalance] = useState('0');
  const [kind, setKind] = useState<AccountKind>('checking');
  const [mask, setMask] = useState('');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [note, setNote] = useState('');

  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const textPrimary = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;

  const balanceNumber = useMemo(() => {
    const parsed = parseFloat(balance || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [balance]);

  const canSave = name.trim().length > 0 && Number.isFinite(balanceNumber);

  async function onSave() {
    if (!canSave) return;
    const payloadBalance = Number.isFinite(balanceNumber) ? balanceNumber : 0;
    const sanitizedMask = mask.replace(/\D/g, '').slice(0, 6);
    await addAccount({
      name: name.trim(),
      institution: institution.trim() || 'Manual',
      mask: sanitizedMask ? sanitizedMask : undefined,
      balance: payloadBalance,
      kind,
      includeInNetWorth,
      note: note.trim() ? note.trim() : undefined,
    });
    nav.goBack();
  }

  const selectedKind = kinds.find(k => k.key === kind);

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
      allowBounce={false}
    >
      {/* Header */}
      <View style={{ gap: spacing.s8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={28} color={textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.8 }}>
              Add account
            </Text>
          </View>
        </View>
        <Text style={{ color: muted, fontSize: 15, lineHeight: 22 }}>
          Track your cash, investments, and credit in one place
        </Text>
      </View>

      {/* Account Type Selector */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Account type</Text>
        <Pressable
          onPress={() => nav.navigate('SelectAccountType', {
            currentType: kind,
            onSelect: (selected: AccountKind) => setKind(selected),
          })}
          style={({ pressed }) => ({
            padding: spacing.s16,
            borderRadius: radius.xl,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: border,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.md,
                backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={selectedKind?.icon as any} size={24} color={accentPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>
                {selectedKind?.title || 'Select type'}
              </Text>
              <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                {selectedKind?.caption || ''}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={muted} />
          </View>
        </Pressable>
      </View>

      {/* Account Details */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Account details</Text>

        <Input
          label="Account name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. DBS Multiplier"
        />

        {/* Institution Selector */}
        <View style={{ gap: spacing.s8 }}>
          <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '600' }}>Institution</Text>
          <Pressable
            onPress={() => nav.navigate('SelectInstitution', {
              currentInstitution: institution,
              onSelect: (selected: string) => setInstitution(selected),
            })}
            style={({ pressed }) => ({
              paddingVertical: spacing.s14,
              paddingHorizontal: spacing.s16,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderColor: withAlpha(border, isDark ? 1 : 0.5),
              backgroundColor: cardBg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: textPrimary, fontSize: 16, fontWeight: institution === 'Manual' ? '400' : '600' }}>
              {institution || 'Select institution'}
            </Text>
            <Icon name="chevron-right" size={20} color={muted} />
          </Pressable>
        </View>

        <Input
          label="Account hint (last 4-6 digits)"
          value={mask}
          onChangeText={value => setMask(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="Optional"
        />
      </View>

      {/* Balance */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Starting balance</Text>

        <Input
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
                paddingVertical: spacing.s8,
                paddingHorizontal: spacing.s14,
                borderRadius: radius.pill,
                backgroundColor: balance === amount
                  ? withAlpha(accentPrimary, isDark ? 0.3 : 0.15)
                  : withAlpha(textPrimary, isDark ? 0.1 : 0.05),
                borderWidth: balance === amount ? 1.5 : 0,
                borderColor: balance === amount ? withAlpha(accentPrimary, 0.5) : 'transparent',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{
                color: balance === amount ? accentPrimary : textPrimary,
                fontWeight: balance === amount ? '700' : '600',
                fontSize: 14,
              }}>
                {formatCurrency(Number(amount))}
              </Text>
            </Pressable>
          ))}
        </View>

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
      </View>

      {/* Additional Options */}
      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>Additional options</Text>

        <Input
          label="Notes (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="e.g. When to top up, goals, reminders"
        />

        <View
          style={{
            padding: spacing.s16,
            borderRadius: radius.lg,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: spacing.s12 }}>
              <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
                Include in net worth
              </Text>
              <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                Affects your total net worth and runway calculations
              </Text>
            </View>
            <Switch value={includeInNetWorth} onValueChange={setIncludeInNetWorth} />
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={{ gap: spacing.s10, marginTop: spacing.s8 }}>
        <Button title="Save account" onPress={onSave} disabled={!canSave} />
        <Button title="Cancel" variant="secondary" onPress={() => nav.goBack()} />
      </View>
    </ScreenScroll>
  );
};

export default AddAccount;
