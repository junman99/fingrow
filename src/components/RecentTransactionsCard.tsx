
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius, elevation } from '../theme/tokens';
import Icon from '../components/Icon';
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

  // Sort all transactions by date first (newest first), then take the first 8
  const sortedAll = [...transactions].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return db - da;
  });
  const items = sortedAll.slice(0, 8);

  // Already sorted, no need to sort again
  const sorted = items;

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
        <View style={{
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: get('surface.level1') as string,
      ...elevation.level1 as any
    }}>
      <Pressable
        onPress={() => nav.navigate('TransactionsModal')}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.s16,
          paddingTop: spacing.s16,
          paddingBottom: spacing.s12,
          backgroundColor: get('surface.level1') as string,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed ? 0.7 : 1
        })}
      >
        <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16 }}>Recent Activity</Text>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: get('surface.level2') as string,
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon name="arrow-bold-right" size={18} colorToken="icon.muted" />
        </View>
      </Pressable>

      {items.length === 0 ? (
        <Text style={{ color: get('text.muted') as string, padding: spacing.s16 }}>No transactions yet.</Text>
      ) : (
        <View style={{ paddingHorizontal: spacing.s16, paddingBottom: spacing.s16 }}>
          
          {groups.map((group, gIdx) => (
            <View key={group.key}>
              {/* Date header */}
              <Text style={{ color: get('text.muted') as string, fontSize: 12, marginTop: spacing.s10 }}>
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
                    {/* left icon */}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.md,
                        backgroundColor: isIncome ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        marginRight: spacing.s12,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Text style={{ color: isIncome ? (get('semantic.success') as string) : (get('semantic.danger') as string), fontWeight: '700' }}>
                        {item.category.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>

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
