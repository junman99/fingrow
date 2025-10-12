import React, { useEffect } from 'react';
import { View, Text, Pressable, FlatList, Alert } from 'react-native';
import { Screen } from '../components/Screen';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import Button from '../components/Button';
import { useNavigation } from '@react-navigation/native';
import { useRecurringStore, computeNextDue, Recurring } from '../store/recurring';
import { useTxStore } from '../store/transactions';

export default function BillsList() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { items, hydrate, ready, update, skipOnce, snooze, remove } = useRecurringStore();
  const addTx = useTxStore(s => s.add);

  useEffect(() => { if (!ready) hydrate(); }, [ready]);

  const renderItem = ({ item }: { item: Recurring }) => {
    const next = computeNextDue(item, new Date());
    return (
      <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16, gap: spacing.s8 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>{item.label || item.category}</Text>
          <Text style={{ color: get('text.muted') as string }}>{item.freq}</Text>
        </View>
        <Text style={{ color: get('text.onSurface') as string }}>{`S$${Number(item.amount||0).toFixed(0)} • ${item.category}`}</Text>
        <Text style={{ color: get('text.muted') as string }}>{next ? `Next: ${next.toDateString()}` : 'Finished / inactive'}</Text>

        <View style={{ flexDirection:'row', gap: spacing.s8, marginTop: spacing.s8 }}>
          <Button title="Edit" variant="secondary" onPress={() => nav.navigate('BillEditor', { id: item.id })} />
          <Button title={item.active === false ? 'Enable' : 'Disable'} variant="secondary" onPress={() => update(item.id, { active: !(item.active !== false) })} />
          <Button title="Skip once" variant="secondary" onPress={() => skipOnce(item.id)} />
          <Button title="Snooze +3d" variant="secondary" onPress={() => snooze(item.id, 3)} />
          <Button title="Snooze +7d" variant="secondary" onPress={() => snooze(item.id, 7)} />
          <Button title={item.autoMatch === false ? "Auto-match: OFF" : "Auto-match: ON"} variant="secondary" onPress={() => update(item.id, { autoMatch: !(item.autoMatch !== false) })} />
          <Button title="Mark paid" variant="primary" onPress={async () => {
            await addTx({ type: 'expense', amount: item.amount, category: item.category, note: item.label });
            // Advance anchor to next due
            const nextDue = computeNextDue(item, new Date(Date.now()+1000)); // +1s forward
            if (nextDue) await update(item.id, { anchorISO: nextDue.toISOString() });
          }} />
        
          <Button title="Delete" variant="secondary" onPress={() => {
            Alert.alert('Delete bill', 'Are you sure you want to delete this recurring item?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => remove(item.id) }
            ]);
          }} />
</View>
      </View>
    );
  };

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
        <Text style={{ color: get('text.primary') as string, fontSize: 24, fontWeight: '800', marginTop: spacing.s12, marginBottom: spacing.s12 }}>Bills</Text>
        <Button title="Add bill" variant="primary" onPress={() => nav.navigate('BillEditor')} />
        {(!items || items.length === 0) ? (
          <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16 }}>
            <Text style={{ color: get('text.muted') as string }}>No bills yet. Tap “Add bill” to create your first recurring item.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: spacing.s12 }} />}
            contentContainerStyle={{ paddingBottom: spacing.s24 }}
          />
        )}
      </View>
    </Screen>
  );
}
