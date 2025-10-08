import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen } from '../components/Screen';
import Input from '../components/Input';
import Button from '../components/Button';
import { spacing } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useDebtsStore, DebtType } from '../store/debts';
import { useNavigation } from '@react-navigation/native';

export default function AddDebt() {
  const nav = useNavigation<any>();
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const { add } = useDebtsStore();

  const [name, setName] = useState('Credit card');
  const [type, setType] = useState<DebtType>('credit');
  const [apr, setApr] = useState('25');
  const [balance, setBalance] = useState('0');
  const [minDue, setMinDue] = useState('0');
  const [dueISO, setDueISO] = useState(new Date(Date.now()+7*24*60*60*1000).toISOString().slice(0,10));

  const canSave = name.trim().length > 0 && parseFloat(balance||'0') >= 0 && parseFloat(minDue||'0') >= 0;

  async function onSave() {
    await add({
      name: name.trim(),
      type,
      apr: parseFloat(apr||'0') || 0,
      balance: parseFloat(balance||'0')||0,
      minDue: parseFloat(minDue||'0')||0,
      dueISO: new Date(dueISO).toISOString(),
    });
    nav.goBack();
  }

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: text, fontSize: 20, fontWeight: '800' }}>Add debt</Text>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Type (credit/loan/bnpl)" value={type} onChangeText={(t)=>setType((t as any) as DebtType)} />
        <Input label="APR (%)" value={apr} onChangeText={setApr} keyboardType="decimal-pad" />
        <Input label="Balance" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
        <Input label="Minimum due" value={minDue} onChangeText={setMinDue} keyboardType="decimal-pad" />
        <Input label="Next due date (YYYY-MM-DD)" value={dueISO} onChangeText={setDueISO} />
        <Text style={{ color: muted }}>Tip: enter the next upcoming due date; we’ll track 30-day obligations.</Text>
        <Button title="Save" onPress={onSave} disabled={!canSave} />
      </View>
    </Screen>
  );
}
