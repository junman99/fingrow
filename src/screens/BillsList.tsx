import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import { Card } from '../components/Card';
import Button from '../components/Button';
import { useRecurringStore, computeNextDue } from '../store/recurring';
import { useTxStore } from '../store/transactions';
import { formatCurrency } from '../lib/format';

function withAlpha(color: string, alpha: number) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
    const int = parseInt(expanded, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

const AnimatedPressable: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}> = ({ onPress, children, style }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const BillsList: React.FC = () => {
  const nav = useNavigation<any>();
  const { get, isDark } = useThemeTokens();
  const { items: recurring, hydrate, update, skipOnce, snooze, remove } = useRecurringStore();
  const addTx = useTxStore(s => s.add);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const onSurface = get('text.onSurface') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const successColor = get('semantic.success') as string;
  const warningColor = get('semantic.warning') as string;
  const accentPrimary = get('accent.primary') as string;

  const now = new Date();

  // Enrich bills with next due date
  const enriched = useMemo(() => {
    return (recurring || []).map(item => ({ item, next: computeNextDue(item, now) }));
  }, [recurring, now]);

  const activeEntries = enriched.filter(entry => entry.item.active !== false);

  // Calculate upcoming bills (next 30 days)
  const cutoff30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const cutoff7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcoming30 = activeEntries.filter(entry => entry.next && entry.next <= cutoff30);
  const upcoming7 = activeEntries.filter(entry => entry.next && entry.next <= cutoff7);

  const total30 = upcoming30.reduce((sum, entry) => sum + (Number(entry.item.amount) || 0), 0);
  const total7 = upcoming7.reduce((sum, entry) => sum + (Number(entry.item.amount) || 0), 0);

  // Animations
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, { damping: 18, stiffness: 150 });
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  const getDaysUntil = (date: Date) => {
    const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return `${Math.abs(days)}d overdue`;
    return `${days}d`;
  };

  const handleMarkPaid = async (item: any, next: Date | null) => {
    await addTx({
      type: 'expense',
      amount: item.amount,
      category: item.category,
      note: item.label,
      date: new Date().toISOString()
    });
    const nextDue = computeNextDue(item, new Date(Date.now() + 1000));
    if (nextDue) {
      await update(item.id, { anchorISO: nextDue.toISOString() });
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert(
      'Delete bill',
      `Are you sure you want to delete "${item.label || item.category}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(item.id) }
      ]
    );
  };

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s20 }}
    >
      {/* Header */}
      <Animated.View style={[{ gap: spacing.s8 }, fadeStyle]}>
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
            <Icon name="chevron-left" size={28} color={text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: muted, fontSize: 14, fontWeight: '600' }}>
              Recurring Bills
            </Text>
            <Text style={{ color: text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: spacing.s2 }}>
              Bills Overview
            </Text>
            <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
              Track and manage recurring expenses
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Summary Card */}
      <Animated.View style={fadeStyle}>
        <Card
          style={{
            backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.14),
            padding: spacing.s20,
            borderWidth: 2,
            borderColor: withAlpha(successColor, 0.3),
          }}
        >
          <View style={{ gap: spacing.s16 }}>
            <View>
              <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}>Next 30 days</Text>
              <Text style={{ color: text, fontSize: 32, fontWeight: '800', marginTop: spacing.s6, letterSpacing: -0.8 }}>
                {formatCurrency(total30)}
              </Text>
              <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s6 }}>
                {upcoming30.length} bill{upcoming30.length === 1 ? '' : 's'} due • {activeEntries.length} total active
              </Text>
            </View>

            <View style={{ height: 1, backgroundColor: withAlpha(border, 0.3) }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: muted, fontSize: 12 }}>Next 7 days</Text>
                <Text style={{ color: onSurface, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                  {formatCurrency(total7)}
                </Text>
                <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                  {upcoming7.length} bill{upcoming7.length === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: muted, fontSize: 12 }}>All bills</Text>
                <Text style={{ color: onSurface, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                  {enriched.length}
                </Text>
                <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                  {enriched.length - activeEntries.length} paused
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* Quick Actions */}
      <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
        <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
          <Button
            title="Add bill"
            onPress={() => nav.navigate('BillEditor')}
            style={{ flex: 1 }}
            icon="plus"
          />
          <Button
            title="Advanced"
            onPress={() => nav.navigate('Bills')}
            variant="secondary"
            style={{ flex: 1 }}
            icon="settings"
          />
        </View>
      </Animated.View>

      {/* Bills List */}
      {activeEntries.length === 0 ? (
        <Animated.View style={fadeStyle}>
          <Card style={{ backgroundColor: cardBg, padding: spacing.s20 }}>
            <View style={{ gap: spacing.s16, alignItems: 'center' }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radius.xl,
                  backgroundColor: withAlpha(successColor, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="receipt" size={32} color={successColor} />
              </View>
              <View style={{ alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                  No active bills
                </Text>
                <Text style={{ color: muted, textAlign: 'center', lineHeight: 20 }}>
                  Add your first recurring bill to start tracking
                </Text>
              </View>
              <Button
                title="Add bill"
                onPress={() => nav.navigate('BillEditor')}
                style={{ width: '100%' }}
              />
            </View>
          </Card>
        </Animated.View>
      ) : (
        <>
          {/* Due This Week */}
          {upcoming7.length > 0 && (
            <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
                  Due This Week
                </Text>
                <View
                  style={{
                    paddingHorizontal: spacing.s10,
                    paddingVertical: spacing.s4,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(warningColor, 0.15),
                  }}
                >
                  <Text style={{ color: warningColor, fontSize: 12, fontWeight: '700' }}>
                    {upcoming7.length} urgent
                  </Text>
                </View>
              </View>
              <View style={{ gap: spacing.s10 }}>
                {upcoming7.map(({ item, next }) => {
                  const isExpanded = expandedId === item.id;
                  const daysUntil = next ? getDaysUntil(next) : null;
                  const isOverdue = next && next < now;

                  return (
                    <Card
                      key={item.id}
                      style={{
                        backgroundColor: cardBg,
                        padding: spacing.s16,
                        borderWidth: 1,
                        borderColor: isOverdue ? warningColor : border,
                      }}
                    >
                      <View style={{ gap: spacing.s12 }}>
                        <AnimatedPressable
                          onPress={() => setExpandedId(isExpanded ? null : item.id)}
                          style={{}}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
                              <View
                                style={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: radius.lg,
                                  backgroundColor: withAlpha(isOverdue ? warningColor : accentPrimary, isDark ? 0.2 : 0.15),
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Icon name={isOverdue ? "alert-circle" : "receipt"} size={24} color={isOverdue ? warningColor : accentPrimary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>{item.label || item.category}</Text>
                                <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                                  {item.freq} • {next ? next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'} {daysUntil && `• ${daysUntil}`}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ color: text, fontWeight: '800', fontSize: 20 }}>
                              {formatCurrency(item.amount)}
                            </Text>
                          </View>
                        </AnimatedPressable>

                        {isExpanded && (
                          <View style={{ gap: spacing.s8, marginTop: spacing.s4 }}>
                            <View style={{ flexDirection: 'row', gap: spacing.s8, flexWrap: 'wrap' }}>
                              <Button
                                title="Mark paid"
                                size="sm"
                                variant="primary"
                                onPress={() => handleMarkPaid(item, next)}
                              />
                              <Button
                                title="Edit"
                                size="sm"
                                variant="secondary"
                                onPress={() => nav.navigate('BillEditor', { id: item.id })}
                              />
                              <Button
                                title="Skip once"
                                size="sm"
                                variant="secondary"
                                onPress={() => skipOnce(item.id)}
                              />
                              <Button
                                title="Snooze 3d"
                                size="sm"
                                variant="secondary"
                                onPress={() => snooze(item.id, 3)}
                              />
                              <Button
                                title="Delete"
                                size="sm"
                                variant="secondary"
                                onPress={() => handleDelete(item)}
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    </Card>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* All Active Bills */}
          <Animated.View style={[{ gap: spacing.s12 }, fadeStyle]}>
            <Text style={{ color: text, fontSize: 18, fontWeight: '700' }}>
              All Active Bills ({activeEntries.length})
            </Text>
            <View style={{ gap: spacing.s10 }}>
              {activeEntries.map(({ item, next }) => {
                const isExpanded = expandedId === item.id;
                const daysUntil = next ? getDaysUntil(next) : null;
                const isDueThisWeek = upcoming7.some(e => e.item.id === item.id);

                // Skip if already shown in "Due This Week"
                if (isDueThisWeek) return null;

                return (
                  <Card
                    key={item.id}
                    style={{
                      backgroundColor: cardBg,
                      padding: spacing.s16,
                      borderWidth: 1,
                      borderColor: border,
                    }}
                  >
                    <View style={{ gap: spacing.s12 }}>
                      <AnimatedPressable
                        onPress={() => setExpandedId(isExpanded ? null : item.id)}
                        style={{}}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, flex: 1 }}>
                            <View
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: radius.lg,
                                backgroundColor: withAlpha(successColor, isDark ? 0.2 : 0.15),
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icon name="receipt" size={24} color={successColor} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: text, fontWeight: '700', fontSize: 16 }}>{item.label || item.category}</Text>
                              <Text style={{ color: muted, fontSize: 13, marginTop: 2 }}>
                                {item.freq} • {next ? next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'} {daysUntil && `• ${daysUntil}`}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: text, fontWeight: '800', fontSize: 20 }}>
                            {formatCurrency(item.amount)}
                          </Text>
                        </View>
                      </AnimatedPressable>

                      {isExpanded && (
                        <View style={{ gap: spacing.s8, marginTop: spacing.s4 }}>
                          <View style={{ flexDirection: 'row', gap: spacing.s8, flexWrap: 'wrap' }}>
                            <Button
                              title="Mark paid"
                              size="sm"
                              variant="primary"
                              onPress={() => handleMarkPaid(item, next)}
                            />
                            <Button
                              title="Edit"
                              size="sm"
                              variant="secondary"
                              onPress={() => nav.navigate('BillEditor', { id: item.id })}
                            />
                            <Button
                              title="Skip once"
                              size="sm"
                              variant="secondary"
                              onPress={() => skipOnce(item.id)}
                            />
                            <Button
                              title="Snooze 3d"
                              size="sm"
                              variant="secondary"
                              onPress={() => snooze(item.id, 3)}
                            />
                            <Button
                              title="Delete"
                              size="sm"
                              variant="secondary"
                              onPress={() => handleDelete(item)}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          </Animated.View>
        </>
      )}
    </ScreenScroll>
  );
};

export default BillsList;
