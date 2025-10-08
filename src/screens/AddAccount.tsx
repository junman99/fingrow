import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen } from '../components/Screen';
import Input from '../components/Input';
import Button from '../components/Button';
import { spacing } from '../theme/tokens';
import { useAccountsStore } from '../store/accounts';
import { useNavigation } from '@react-navigation/native';

const AddAccount: React.FC = () => {
  const nav = useNavigation<any>();
  const { addAccount } = useAccountsStore();
  const [name, setName] = useState('Savings');
  const [institution, setInstitution] = useState('Manual');
  const [balance, setBalance] = useState('0');

  const canSave = name.trim().length > 0;
  async function onSave() {
    await addAccount({ name: name.trim(), institution: institution.trim() || 'Manual', mask: undefined, balance: parseFloat(balance || '0')||0 });
    nav.goBack();
  }

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>Add account</Text>
        <Input label="Account name" value={name} onChangeText={setName} />
        <Input label="Institution" value={institution} onChangeText={setInstitution} />
        <Input label="Starting balance" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
        <Button title="Save" onPress={onSave} disabled={!canSave} />
      </View>
    </Screen>
  );
};

export default AddAccount;
