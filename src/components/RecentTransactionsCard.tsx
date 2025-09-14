
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { useNavigation } from '@react-navigation/native';

const fmtTime = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = ((h % 12) || 12).toString();
  const mm = m.toString().padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hh}:${mm} ${ampm}`;
};
const fmtDate = (d: Date) => {
  try {
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

export const RecentTransactionsCard: React.FC = () => {
  const { get } = useThemeTokens();
  const { transactions } = useTxStore();
  const nav = useNavigation<any>();

  const items = transactions.slice(0, 8);

  // Group items by calendar day (newest first)
  const sorted = [...items].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return db - da;
  });

  const groups: { key: string; label: string; items: typeof items }[] = [];
  const byKey = new Map<string, { key: string; label: string; items: typeof items }>();
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayStart = startOf(today).getTime();

  for (const it of sorted) {
    const d = new Date(it.date);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let bucket = byKey.get(key);
    if (!bucket) {
      const dd = startOf(d).getTime();
      let label = '';
      const diffDays = Math.round((dd - todayStart) / (24 * 60 * 60 * 1000));
      if (diffDays === 0) label = 'Today';
      else if (diffDays === -1) label = 'Yesterday';
      else label = fmtDate(d);
      bucket = { key, label, items: [] as any };
      byKey.set(key, bucket);
      groups.push(bucket);
    }
    bucket.items.push(it as any);
  }


  return (
    <View style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s16,  }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s8 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }}>Recent Transactions</Text>
        <Text onPress={() => nav.navigate('TransactionsModal')} style={{ color: get('accent.primary') as string, fontWeight: '600' }}>See all</Text>
      </View>

      {items.length === 0 ? (
        <Text style={{ color: get('text.muted') as string }}>No transactions yet.</Text>
      ) : (
        <View>
          
          {groups.map((group, gIdx) => (
            <View key={group.key}>
              {/* Date header */}
              <Text style={{ color: get('text.muted') as string, fontSize: 12, marginTop: spacing.s12 }}>
                {group.label}
              </Text>

              {/* Items in this day */}
              {group.items.map((item, index) => {
                const d = new Date(item.date);
                const isIncome = item.type === 'income';
                const amountText = `${isIncome ? '+' : '-'}$${Math.abs(item.amount).toFixed(2)}`;
                const isLastInCard = (gIdx === groups.length - 1) && (index === group.items.length - 1);
                return (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: spacing.s12,
                      borderBottomWidth: isLastInCard ? 0 : StyleSheet.hairlineWidth,
                      borderBottomColor: get('border.subtle') as string
                    }}
                  >
                    {/* left color bar */}
                    <View
                      style={{
                        width: 3,
                        height: 18,
                        borderRadius: radius.pill,
                        backgroundColor: isIncome ? (get('semantic.success') as string) : (get('semantic.danger') as string),
                        marginRight: spacing.s12
                      }}
                    />

                    {/* middle */}
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: get('text.primary') as string, fontWeight: '700' }}>
                        {item.note || item.category}
                      </Text>
                      <Text numberOfLines={1} style={{ color: get('text.muted') as string, marginTop: 2 }}>
                        {fmtTime(d)} • {item.category}
                      </Text>
                    </View>

                    {/* right amount */}
                    <Text style={{ color: isIncome ? (get('semantic.success') as string) : (get('semantic.danger') as string), fontWeight: '700' }}>
                      {amountText}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}

        </View>
      )}
    </View>
  );
};