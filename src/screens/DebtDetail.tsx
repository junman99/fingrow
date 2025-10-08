import React, { useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Screen } from '../components/Screen';
import Input from '../components/Input';
import Button from '../components/Button';
import { spacing } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useDebtsStore, DebtType } from '../store/debts';
import { useRoute, useNavigation } from '@react-navigation/native';

type RouteParams = { id: string };

export default function DebtDetail() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const { items, update, remove } = useDebtsStore();
  const d = useMemo(()=> (items||[]).find(x=> x.id === (route.params as RouteParams)?.id), [items, route.params]);

  const [name, setName] = useState(d?.name || '');
  const [type, setType] = useState<DebtType>((d?.type as DebtType) || 'credit');
  const [apr, setApr] = useState(String(d?.apr ?? 0));
  const [balance, setBalance] = useState(String(d?.balance ?? 0));
  const [minDue, setMinDue] = useState(String(d?.minDue ?? 0));
  const [dueISO, setDueISO] = useState((d?.dueISO || new Date().toISOString()).slice(0,10));

  if (!d) {
    return (
      <Screen>
        <View style={{ padding: spacing.s16 }}>
          <Text style={{ color: text }}>Debt not found.</Text>
        </View>
      </Screen>
    );
  }

  async function onSave() {
    await update(d.id, { name: name.trim(), type, apr: parseFloat(apr||'0')||0, balance: parseFloat(balance||'0')||0, minDue: parseFloat(minDue||'0')||0, dueISO: new Date(dueISO).toISOString() });
    nav.goBack();
  }
  async function onDelete() {
    Alert.alert('Delete debt?', 'This will remove the debt from Money.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async ()=> { await remove(d.id); nav.goBack(); } }
    ]);
  }

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>Edit debt</Text>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Type (credit/loan/bnpl)" value={type} onChangeText={(t)=> setType((t as any) as DebtType)} />
        <Input label="APR (%)" value={apr} onChangeText={setApr} keyboardType="decimal-pad" />
        <Input label="Balance" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
        <Input label="Minimum due" value={minDue} onChangeText={setMinDue} keyboardType="decimal-pad" />
        <Input label="Next due date (YYYY-MM-DD)" value={dueISO} onChangeText={setDueISO} />
        <View style={{ height: spacing.s8 }} />
        <Button title="Save" onPress={onSave} />
        <Button title="Delete" variant="secondary" onPress={onDelete} />
      </View>
    </Screen>
  );
}
