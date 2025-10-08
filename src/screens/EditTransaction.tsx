
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { ScreenScroll } from '../components/ScreenScroll';

export default function EditTransaction() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id;

  const { transactions, updateTransaction, deleteTransaction } = useTxStore();
  const tx = useMemo(() => transactions.find(t => t.id === id), [transactions, id]);

  const [title, setTitle] = useState(tx?.title || '');
  const [amount, setAmount] = useState(String(tx?.amount ?? ''));
  const [date, setDate] = useState(tx?.date || '');
  const [type, setType] = useState(tx?.type || 'expense');
  const [category, setCategory] = useState(tx?.category || '');

  const save = () => {
    updateTransaction(id, {
      title,
      amount: Number(amount),
      date,
      type,
      category,
    });
    nav.goBack();
  };

  if (!tx) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Transaction not found.</Text>
      </View>
    );
  }

  return (
    <ScreenScroll style={{ flex: 1, padding: spacing.s16 }}>
      <Text style={{ color: get('text.primary') as string, fontSize: 18, fontWeight: '700', marginBottom: spacing.s12 }}>
        Edit Transaction
      </Text>

      <Text style={{ color: get('text.muted') as string, marginTop: spacing.s8 }}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={get('text.muted') as string}
        style={{ color: get('text.primary') as string, borderWidth: 1, borderColor: get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s10 }}
      />

      <Text style={{ color: get('text.muted') as string, marginTop: spacing.s8 }}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={get('text.muted') as string}
        style={{ color: get('text.primary') as string, borderWidth: 1, borderColor: get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s10 }}
      />

      <Text style={{ color: get('text.muted') as string, marginTop: spacing.s8 }}>Date</Text>
      <TextInput
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DDTHH:mm:ss"
        placeholderTextColor={get('text.muted') as string}
        style={{ color: get('text.primary') as string, borderWidth: 1, borderColor: get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s10 }}
      />

      <Text style={{ color: get('text.muted') as string, marginTop: spacing.s8 }}>Type</Text>
      <TextInput
        value={type}
        onChangeText={(text) => setType(text as any)}
        placeholder="expense | income"
        placeholderTextColor={get('text.muted') as string}
        style={{ color: get('text.primary') as string, borderWidth: 1, borderColor: get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s10 }}
      />

      <Text style={{ color: get('text.muted') as string, marginTop: spacing.s8 }}>Category</Text>
      <TextInput
        value={category}
        onChangeText={setCategory}
        placeholder="Category"
        placeholderTextColor={get('text.muted') as string}
        style={{ color: get('text.primary') as string, borderWidth: 1, borderColor: get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s10 }}
      />

      <View style={{ flexDirection: 'row', marginTop: spacing.s16, gap: spacing.s12 }}>
        <Pressable accessibilityRole="button" onPress={save} style={{ paddingVertical: spacing.s12, paddingHorizontal: spacing.s16, borderRadius: radius.lg, backgroundColor: get('accent.primary') as string }}>
          <Text style={{ color: get('text.onAccent') as string, fontWeight: '700' }}>Save</Text>
        </Pressable>
        <Pressable onPress={() => { deleteTransaction(id); nav.goBack(); }} style={{ paddingVertical: spacing.s12, paddingHorizontal: spacing.s16, borderRadius: radius.lg, backgroundColor: get('semantic.dangerSoft') as string }}>
          <Text style={{ color: get('semantic.danger') as string, fontWeight: '700' }}>Delete</Text>
        </Pressable>
      </View>
    </ScreenScroll>
  );
}
