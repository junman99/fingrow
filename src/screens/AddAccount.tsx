import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../components/ScreenScroll';
import Input from '../components/Input';
import Button from '../components/Button';
import { spacing, radius } from '../theme/tokens';
import { useAccountsStore } from '../store/accounts';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { formatCurrency } from '../lib/format';

type AccountKind = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';

const kinds: { key: AccountKind; title: string; caption: string }[] = [
  { key: 'checking', title: 'Daily spend', caption: 'Salary, current, multi-use funds' },
  { key: 'savings', title: 'Savings', caption: 'Emergency, reserves, fixed deposits' },
  { key: 'cash', title: 'Cash & wallets', caption: 'Physical cash, GrabPay, prepaid' },
  { key: 'credit', title: 'Credit & charge', caption: 'Cards that need monthly payoff' },
  { key: 'investment', title: 'Investment cash', caption: 'Brokerage or robo cash buckets' },
];

const quickInstitutions = ['Manual', 'DBS', 'OCBC', 'UOB', 'HSBC', 'Maybank', 'Standard Chartered'];
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
  const [name, setName] = useState('Everyday account');
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
  const heroColors: [string, string] = isDark
    ? [withAlpha(accentPrimary, 0.38), withAlpha(accentSecondary, 0.50)]
    : [accentPrimary, accentSecondary];
  const heroText = isDark ? textPrimary : (get('text.onPrimary') as string);
  const heroMuted = withAlpha(heroText, isDark ? 0.72 : 0.82);
  const heroChipBg = withAlpha(heroText, isDark ? 0.22 : 0.28);

  const balanceNumber = useMemo(() => {
    const parsed = parseFloat(balance || '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }, [balance]);

  const canSave = name.trim().length > 0 && Number.isFinite(balanceNumber);
  const previewImpact = balanceNumber >= 0 ? 'adds to' : 'reduces';

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

  return (
    <ScreenScroll
      contentStyle={{ padding: spacing.s16, gap: spacing.s16 }}
      allowBounce={false}
    >
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
          NEW ACCOUNT
        </Text>
        <Text style={{ color: heroText, fontSize: 26, fontWeight: '800' }}>
          Bring your cash into Money HQ
        </Text>
        <Text style={{ color: heroMuted }}>
          Track balances, runway, and net worth in one place. You can always edit or remove it later.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
          <View
            style={{
              paddingVertical: spacing.s6,
              paddingHorizontal: spacing.s12,
              borderRadius: radius.pill,
              backgroundColor: heroChipBg,
            }}
          >
            <Text style={{ color: heroText, fontWeight: '700' }}>{kind.toUpperCase()}</Text>
          </View>
          <View
            style={{
              paddingVertical: spacing.s6,
              paddingHorizontal: spacing.s12,
              borderRadius: radius.pill,
              backgroundColor: heroChipBg,
            }}
          >
            <Text style={{ color: heroText, fontWeight: '700' }}>
              {balanceNumber >= 0 ? '+' : '-'}
              {formatCurrency(Math.abs(balanceNumber))}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>Account basics</Text>
        <Input label="Account name" value={name} onChangeText={setName} placeholder="e.g. DBS Multiplier" />
        <Input label="Institution" value={institution} onChangeText={setInstitution} placeholder="Who holds this account?" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
          {quickInstitutions.map(inst => (
            <Pressable
              key={inst}
              onPress={() => setInstitution(inst)}
              style={({ pressed }) => ({
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: institution === inst ? withAlpha(accentPrimary, 0.20) : withAlpha(textPrimary, 0.06),
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: textPrimary, fontWeight: '600' }}>{inst}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>Account type</Text>
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
                  borderColor: active ? accentPrimary : withAlpha(textPrimary, 0.12),
                  backgroundColor: active ? withAlpha(accentPrimary, isDark ? 0.24 : 0.12) : withAlpha(textPrimary, 0.02),
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: textPrimary, fontWeight: '700' }}>{option.title}</Text>
                <Text style={{ color: muted, marginTop: spacing.s4 }}>{option.caption}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: spacing.s12 }}>
        <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700' }}>Balance & details</Text>
        <Input
          label="Starting balance"
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
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: textPrimary, fontWeight: '600' }}>
                {formatCurrency(Number(amount))}
              </Text>
            </Pressable>
          ))}
        </View>
        <Input
          label="Account hint (last 4-6 digits)"
          value={mask}
          onChangeText={value => setMask(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="1234"
        />
        <Input
          label="Notes"
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Optional: e.g. When to top up, goals, reminders"
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing.s8,
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.s12 }}>
            <Text style={{ color: textPrimary, fontWeight: '600' }}>Include in net worth & runway</Text>
            <Text style={{ color: muted }}>Turn off if this account shouldn&apos;t affect totals.</Text>
          </View>
          <Switch value={includeInNetWorth} onValueChange={setIncludeInNetWorth} />
        </View>
      </View>

      <View
        style={{
          padding: spacing.s16,
          borderRadius: radius.lg,
          backgroundColor: withAlpha(textPrimary, isDark ? 0.22 : 0.06),
          gap: spacing.s8,
        }}
      >
        <Text style={{ color: textPrimary, fontWeight: '700' }}>Preview</Text>
        <Text style={{ color: muted }}>
          {name.trim() || 'This account'} {previewImpact} your totals by {formatCurrency(Math.abs(balanceNumber))}.
        </Text>
        <Text style={{ color: muted }}>
          You can edit the balance any time from the account detail screen.
        </Text>
      </View>

      <View style={{ gap: spacing.s10 }}>
        <Button title="Save account" onPress={onSave} disabled={!canSave} />
        <Button title="Cancel" variant="secondary" onPress={() => nav.goBack()} />
        <Text style={{ color: muted, textAlign: 'center', marginTop: spacing.s4 }}>
          Fingrow keeps everything offline-first. No bank connection is made when you add a manual account.
        </Text>
      </View>
    </ScreenScroll>
  );
};

export default AddAccount;
