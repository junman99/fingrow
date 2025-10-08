import React, { useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Screen } from '../components/Screen';
import Input from '../components/Input';
import Button from '../components/Button';
import { spacing } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useAccountsStore } from '../store/accounts';
import { useRoute, useNavigation } from '@react-navigation/native';

type RouteParams = { id: string };

export default function AccountDetail() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const { accounts, updateAccount, removeAccount } = useAccountsStore();
  const acc = useMemo(()=> (accounts||[]).find(a=> a.id === (route.params as RouteParams)?.id), [accounts, route.params]);

  const [name, setName] = useState(acc?.name || '');
  const [institution, setInstitution] = useState(acc?.institution || '');
  const [balance, setBalance] = useState(String(acc?.balance ?? 0));

  if (!acc) {
    return (
      <Screen>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: text }}>Account not found.</Text>
        </View>
      </Screen>
    );
  }

  async function onSave() {
    await updateAccount(acc.id, { name: name.trim(), institution: institution.trim(), balance: parseFloat(balance||'0')||0 });
    nav.goBack();
  }
  async function onDelete() {
    Alert.alert('Delete account?', 'This will remove the account from Money. This does not affect your bank.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async ()=> { await removeAccount(acc.id); nav.goBack(); } }
    ]);
  }

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>Edit account</Text>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Institution" value={institution} onChangeText={setInstitution} />
        <Input label="Balance" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
        <View style={{ height: spacing.s8 }} />
        <Button title="Save" onPress={onSave} />
        <Button title="Delete" variant="secondary" onPress={onDelete} />
      </View>
    </Screen>
  );
}
