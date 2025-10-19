import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore } from '../../store/invest';
import HoldingRow from './HoldingRow';
import WatchRow from './WatchRow';
import Icon, { type IconName } from '../Icon';
import PopoverMenu from '../PopoverMenu';
import { computePnL } from '../../lib/positions';
import { formatCurrency } from '../../lib/format';
import { exportPortfolioCsv } from '../../lib/export';
import CashEditorSheet from './CashEditorSheet';

type Props = {
  portfolioId: string | null;
  visible: boolean;
  onClose: () => void;
  onEditWatchlist?: () => void;
  onFilterHoldings?: () => void;
  onSortHoldings?: () => void;
  onAddHolding?: () => void;
  onAddWatchlist?: () => void;
  onOpenManager?: () => void;
  dimmed?: boolean;
};

type Summary = {
  base: string;
  totalValue: number;
  holdingsValue: number;
  cashValue: number;
  dayDelta: number;
  totalGain: number;
  positions: number;
  openHoldings: string[];
};

const TAB_ITEMS = ['Holdings', 'Watchlist'] as const;

export default function PortfolioDetailSheet({
  portfolioId,
  visible,
  onClose,
  onEditWatchlist,
  onFilterHoldings,
  onSortHoldings,
  onAddHolding,
  onAddWatchlist,
  onOpenManager,
  dimmed,
}: Props) {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { portfolios } = useInvestStore();
  const quotes = useInvestStore(s => s.quotes);
  const archivePortfolio = useInvestStore(s => (s as any).archivePortfolio);

  const p = portfolioId ? portfolios[portfolioId] : null;
  const [tab, setTab] = React.useState<(typeof TAB_ITEMS)[number]>('Holdings');
  const [showCashEditor, setShowCashEditor] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const menuBtnRef = React.useRef<View>(null);

  React.useEffect(() => {
    if (!visible) {
      setMenuVisible(false);
      setShowCashEditor(false);
      return;
    }
    setTab('Holdings');
  }, [visible]);

  const summary = React.useMemo<Summary | null>(() => {
    if (!p) return null;
    const base = String(p.baseCurrency || 'USD').toUpperCase();
    let holdingsValue = 0;
    let dayDelta = 0;
    let totalGain = 0;
    const openRows: Array<{ sym: string; value: number }> = [];
    Object.values(p.holdings || {}).forEach((h: any) => {
      if (!h) return;
      const lots = (h.lots || []) as Array<{ side: 'buy' | 'sell'; qty: number }>;
      const qty = lots.reduce((acc, lot) => acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
      if (qty <= 0) return;
      const sym = h.symbol;
      const q = quotes[sym] || {};
      const last = Number(q.last || 0);
      const change = Number(q.change || 0);
      const positionValue = qty * last;
      holdingsValue += positionValue;
      dayDelta += change * qty;
      const pnl = computePnL(lots, last);
      totalGain += (pnl.realized || 0) + (pnl.unrealized || 0);
      openRows.push({ sym, value: positionValue });
    });
    const cashValue = Number(p.cash || 0);
    const totalValue = holdingsValue + cashValue;
    const sorted = openRows.sort((a, b) => b.value - a.value);
    return {
      base,
      totalValue,
      holdingsValue,
      cashValue,
      dayDelta,
      totalGain,
      positions: sorted.length,
      openHoldings: sorted.map(row => row.sym),
    };
  }, [p, quotes]);

  const textPrimary = get('text.onSurface') as string;
  const textMuted = get('text.muted') as string;
  const holdingsSyms = React.useMemo(() => {
    if (!summary) return [] as string[];
    const syms = summary.openHoldings;
    const includeCash = summary.cashValue > 0.01 ? ['CASH'] : [];
    return [...syms, ...includeCash];
  }, [summary]);

  const watchlistSyms = React.useMemo(() => {
    if (!p || !Array.isArray(p.watchlist)) return [] as string[];
    return p.watchlist;
  }, [p]);

  const dayLabel = summary
    ? `${summary.dayDelta >= 0 ? '+' : '−'}${formatCurrency(Math.abs(summary.dayDelta), summary.base, {
        compact: true,
      })}`
    : '';

  const gainLabel = summary
    ? `${summary.totalGain >= 0 ? '+' : '−'}${formatCurrency(Math.abs(summary.totalGain), summary.base, {
        compact: true,
      })}`
    : '';

  const openMenu = React.useCallback(() => {
    if (!menuBtnRef.current) return;
    const ref: any = menuBtnRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x: number, y: number, w: number, h: number) => {
        setMenuAnchor({ x, y, w, h });
        setMenuVisible(true);
      });
    } else {
      setMenuAnchor({ x: 260, y: 160, w: 1, h: 1 });
      setMenuVisible(true);
    }
  }, []);


  const handleArchive = React.useCallback(() => {
    if (!p) return;
    Alert.alert('Archive portfolio?', `${p.name} will move to the archive. You can restore it later.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          try {
            archivePortfolio(p.id);
            setMenuVisible(false);
            onClose();
          } catch (e) {}
        },
      },
    ]);
  }, [archivePortfolio, onClose, p]);

  const menuItems = React.useMemo(() => {
    if (!p) return [];
    const items: Array<{
      key: string;
      label: string;
      description?: string;
      icon: IconName;
      onPress: () => void;
      destructive?: boolean;
    }> = [];
    if (onFilterHoldings) {
      items.push({
        key: 'filter',
        label: 'Filter holdings',
        description: 'Slice the list by performance',
        icon: 'filter',
        onPress: () => {
          setMenuVisible(false);
          onFilterHoldings();
        },
      });
    }
    if (onSortHoldings) {
      items.push({
        key: 'sort',
        label: 'Sort holdings',
        description: 'Change ordering or view',
        icon: 'layers',
        onPress: () => {
          setMenuVisible(false);
          onSortHoldings();
        },
      });
    }
    if (onEditWatchlist) {
      items.push({
        key: 'edit-watch',
        label: 'Edit watchlist',
        description: 'Curate symbols you are tracking',
        icon: 'edit-3',
        onPress: () => {
          setMenuVisible(false);
          onEditWatchlist();
        },
      });
    }
    if (onOpenManager) {
      items.push({
        key: 'manage',
        label: 'Portfolio settings',
        description: 'Rename, base currency, benchmark',
        icon: 'settings',
        onPress: () => {
          setMenuVisible(false);
          onOpenManager();
        },
      });
    }
    items.push({
      key: 'export',
      label: 'Export CSV',
      description: 'Download positions & trades',
      icon: 'download',
      onPress: () => {
        setMenuVisible(false);
        exportPortfolioCsv(p.id);
      },
    });
    items.push({
      key: 'archive',
      label: 'Archive portfolio',
      description: 'Hide from your active list',
      icon: 'archive',
      onPress: handleArchive,
      destructive: true,
    });
    return items;
  }, [handleArchive, onEditWatchlist, onFilterHoldings, onOpenManager, onSortHoldings, p]);

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} fullHeight dimmed={dimmed}>
        {!p ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: textMuted }}>Select a portfolio to view details.</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.s24, gap: spacing.s16 }}
          >
            {/* Header */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={{ color: textMuted, fontSize: 13, marginTop: spacing.s2 }}>
                    {summary?.positions ?? 0} positions · {(summary?.base || 'USD')}
                  </Text>
                </View>
                <Pressable
                  ref={menuBtnRef as any}
                  onPress={openMenu}
                  style={({ pressed }) => ({
                    padding: spacing.s8,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? get('surface.level2') as string : 'transparent',
                  })}
                >
                  <Icon name="more-horizontal" size={24} color={textPrimary} />
                </Pressable>
              </View>

              {/* Value */}
              <View
                style={{
                  backgroundColor: get('surface.level1') as string,
                  borderRadius: radius.lg,
                  padding: spacing.s16,
                  gap: spacing.s12,
                }}
              >
                <View>
                  <Text style={{ color: textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600', marginBottom: spacing.s4 }}>
                    Total Value
                  </Text>
                  <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800' }}>
                    {formatCurrency(summary?.totalValue || 0, summary?.base || 'USD')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s2 }}>Today</Text>
                    <Text style={{ color: summary && summary.dayDelta >= 0 ? get('semantic.success') as string : get('semantic.danger') as string, fontWeight: '700', fontSize: 14 }}>
                      {dayLabel}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s2 }}>All-time</Text>
                    <Text style={{ color: summary && summary.totalGain >= 0 ? get('semantic.success') as string : get('semantic.danger') as string, fontWeight: '700', fontSize: 14 }}>
                      {gainLabel}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s2 }}>Cash</Text>
                    <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>
                      {formatCurrency(summary?.cashValue || 0, summary?.base || 'USD', { compact: true })}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
              {onAddHolding && (
                <Pressable
                  onPress={() => {
                    const cash = Number(p?.cash || 0);
                    if (cash <= 0) {
                      Alert.alert(
                        'Top up cash first',
                        'You need to add cash to your portfolio before you can purchase holdings.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Add Cash',
                            onPress: () => {
                              onClose();
                              setTimeout(() => {
                                nav.navigate('CashManagement', { portfolioId: p.id });
                              }, 100);
                            },
                          },
                        ]
                      );
                    } else {
                      onAddHolding();
                    }
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.s6,
                    paddingVertical: spacing.s12,
                    borderRadius: radius.md,
                    backgroundColor: get('accent.primary') as string,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Icon name="plus" size={18} colorToken="text.onPrimary" />
                  <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 14 }}>
                    Add Holding
                  </Text>
                </Pressable>
              )}
              {summary && (
                <Pressable
                  onPress={() => {
                    onClose();
                    setTimeout(() => {
                      nav.navigate('CashManagement', { portfolioId: p.id });
                    }, 100);
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.s6,
                    paddingVertical: spacing.s12,
                    borderRadius: radius.md,
                    backgroundColor: get('surface.level1') as string,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Icon name="dollar-sign" size={18} color={textPrimary} />
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 14 }}>
                    Cash
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Tab Switcher */}
            <SegmentedControl value={tab} onChange={setTab} />

            {/* Content */}
            {tab === 'Holdings' ? (
              <View style={{ gap: spacing.s8 }}>
                {holdingsSyms.length ? (
                  holdingsSyms.map(sym => (
                    <HoldingRow
                      key={sym}
                      sym={sym}
                      portfolioId={p.id}
                      variant="card"
                      onPress={() => {
                        // Close the sheet before navigating
                        onClose();
                      }}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="No holdings yet"
                    body="Add your first position to track performance."
                    actionLabel={onAddHolding ? 'Add holding' : undefined}
                    onPressAction={onAddHolding}
                  />
                )}
              </View>
            ) : (
              <View style={{ gap: spacing.s8 }}>
                {watchlistSyms.length ? (
                  watchlistSyms.map(sym => (
                    <WatchRow
                      key={sym}
                      sym={sym}
                      onPress={() => {
                        // Close the sheet before navigating
                        onClose();
                      }}
                    />
                  ))
                ) : (
                  <EmptyState
                    title="Watchlist is empty"
                    body="Track symbols here before you invest."
                    actionLabel={onAddWatchlist ? 'Add symbol' : undefined}
                    onPressAction={onAddWatchlist}
                  />
                )}
              </View>
            )}
          </ScrollView>
        )}
      </BottomSheet>

      {p ? (
        <CashEditorSheet
          visible={showCashEditor}
          onClose={() => setShowCashEditor(false)}
          portfolioId={p.id}
          currency={(p.baseCurrency || 'USD').toUpperCase()}
        />
      ) : null}

      <PopoverMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        anchor={menuAnchor}
        items={menuItems}
      />
    </>
  );
}


function SegmentedControl({
  value,
  onChange,
}: {
  value: (typeof TAB_ITEMS)[number];
  onChange: (next: (typeof TAB_ITEMS)[number]) => void;
}) {
  const { get, isDark } = useThemeTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: withAlpha(get('surface.level2') as string, isDark ? 0.8 : 1),
        borderRadius: radius.pill,
        padding: 4,
      }}
    >
      {TAB_ITEMS.map(tab => {
        const active = tab === value;
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            style={{
              flex: 1,
              paddingVertical: spacing.s8,
              borderRadius: radius.pill,
              alignItems: 'center',
              backgroundColor: active ? get('accent.primary') : 'transparent',
            }}
          >
            <Text
              style={{
                color: active ? get('text.onPrimary') as string : get('text.muted') as string,
                fontWeight: '700',
              }}
            >
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onPressAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onPressAction?: () => void;
}) {
  const { get } = useThemeTokens();
  return (
    <View
      style={{
        gap: spacing.s8,
        padding: spacing.s16,
        backgroundColor: get('surface.level1') as string,
        borderRadius: radius.lg,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 15 }}>{title}</Text>
      <Text style={{ color: get('text.muted') as string, fontSize: 13, textAlign: 'center' }}>{body}</Text>
      {actionLabel && onPressAction ? (
        <Pressable
          onPress={onPressAction}
          style={({ pressed }) => ({
            marginTop: spacing.s4,
            paddingHorizontal: spacing.s16,
            paddingVertical: spacing.s10,
            borderRadius: radius.pill,
            backgroundColor: get('accent.primary') as string,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 14 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function withAlpha(color: string, alpha: number): string {
  if (!color) return color;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw.padEnd(6, '0');
    const num = parseInt(hex.slice(0, 6), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const match = color.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([0-9.]+))?\)/i);
  if (match) {
    const [, r, g, b] = match;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
