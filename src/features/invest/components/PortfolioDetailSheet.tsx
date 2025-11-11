import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BottomSheet from '../../../components/BottomSheet';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import { useInvestStore } from '../store';
import { useProfileStore } from '../../../store/profile';
import HoldingRow from './HoldingRow';
import WatchRow from './WatchRow';
import Icon, { type IconName } from '../../../components/Icon';
import PopoverMenu from '../../../components/PopoverMenu';
import { computePnL } from '../../../lib/positions';
import { formatCurrency } from '../../../lib/format';
import { convertCurrency } from '../../../lib/fx';
import { exportPortfolioCsv } from '../../../lib/export';
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
  defaultTab?: 'Holdings' | 'Watchlist' | 'Cash';
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

const TAB_ITEMS = ['Holdings', 'Watchlist', 'Cash'] as const;

console.log('🔍 [PortfolioDetailSheet] TAB_ITEMS:', TAB_ITEMS);

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
  defaultTab = 'Holdings',
}: Props) {
  console.log('📋 [PortfolioDetailSheet] Rendering with:', { portfolioId, visible, dimmed });

  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const { portfolios } = useInvestStore();
  const quotes = useInvestStore(s => s.quotes);
  const fxRates = useInvestStore(s => s.fxRates);
  const archivePortfolio = useInvestStore(s => (s as any).archivePortfolio);
  const { profile } = useProfileStore();

  const p = portfolioId ? portfolios[portfolioId] : null;

  console.log('📋 [PortfolioDetailSheet] Portfolio data:', p ? { id: p.id, name: p.name } : 'null');
  const [tab, setTab] = React.useState<(typeof TAB_ITEMS)[number]>('Holdings');
  const [showCashEditor, setShowCashEditor] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const menuBtnRef = React.useRef<View>(null);

  React.useEffect(() => {
    console.log('🎯 [PortfolioDetailSheet] menuVisible changed:', menuVisible);
    console.log('🎯 [PortfolioDetailSheet] menuAnchor:', menuAnchor);
    console.log('🎯 [PortfolioDetailSheet] menuItems count:', menuItems.length);
  }, [menuVisible, menuAnchor, menuItems]);

  React.useEffect(() => {
    if (!visible) {
      setMenuVisible(false);
      setShowCashEditor(false);
      return;
    }
    setTab(defaultTab);
  }, [visible, defaultTab]);

  const summary = React.useMemo<Summary | null>(() => {
    if (!p) return null;

    // Use portfolio's own currency
    const base = (p.baseCurrency || 'USD').toUpperCase();

    let holdingsValue = 0;
    let dayDelta = 0;
    let totalGain = 0;
    const openRows: Array<{ sym: string; value: number }> = [];
    Object.values(p.holdings || {}).forEach((h: any) => {
      if (!h) return;
      const lots = h.lots || [];
      const qty = lots.reduce((acc: number, lot: any) => acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
      if (qty <= 0) return;
      const sym = h.symbol;
      const q = quotes[sym];

      // Get ticker currency: use holding metadata, or infer from symbol
      let holdingCurrency = h.currency;
      if (!holdingCurrency) {
        // Infer from symbol pattern
        const s = sym.toUpperCase();
        if (s.includes('-USD') || s.includes('USD')) holdingCurrency = 'USD';
        else if (s.endsWith('.L')) holdingCurrency = 'GBP';
        else if (s.endsWith('.T')) holdingCurrency = 'JPY';
        else if (s.endsWith('.TO')) holdingCurrency = 'CAD';
        else if (s.endsWith('.AX')) holdingCurrency = 'AUD';
        else if (s.endsWith('.HK')) holdingCurrency = 'HKD';
        else if (s.endsWith('.PA') || s.endsWith('.DE')) holdingCurrency = 'EUR';
        else if (s.endsWith('.SW')) holdingCurrency = 'CHF';
        else holdingCurrency = 'USD'; // Default
      }
      holdingCurrency = String(holdingCurrency).toUpperCase();

      // Convert prices from ticker native currency to investment currency
      const lastNative = Number(q?.last || 0);
      const changeNative = Number(q?.change || 0);
      const last = convertCurrency(fxRates, lastNative, holdingCurrency, base);
      const change = convertCurrency(fxRates, changeNative, holdingCurrency, base);

      const positionValue = qty * last;
      holdingsValue += positionValue;
      dayDelta += change * qty;

      // Convert lot prices for P&L calculation
      const normalizedLots = lots.map((l: any) => ({
        ...l,
        price: convertCurrency(fxRates, l.price || 0, holdingCurrency, base),
        fee: convertCurrency(fxRates, (l.fee ?? l.fees) || 0, holdingCurrency, base)
      }));
      const pnl = computePnL(normalizedLots, last);
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
  }, [p, quotes, fxRates, profile.investCurrency, profile.currency]);

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
    console.log('🔘 [PortfolioDetailSheet] openMenu called');

    if (!menuBtnRef.current) {
      console.log('⚠️ [PortfolioDetailSheet] menuBtnRef.current is null');
      // Use fallback position
      setMenuAnchor({ x: 260, y: 160, w: 1, h: 1 });
      setMenuVisible(true);
      return;
    }
    const ref: any = menuBtnRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x: number, y: number, w: number, h: number) => {
        console.log('📍 [PortfolioDetailSheet] Button position:', { x, y, w, h });
        setMenuAnchor({ x, y, w, h });
        setMenuVisible(true);
      });
    } else {
      console.log('⚠️ [PortfolioDetailSheet] measureInWindow not available, using fallback');
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
        icon: 'edit',
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
                  onPress={() => {
                    console.log('🔘 [PortfolioDetailSheet] Button PRESSED!');
                    openMenu();
                  }}
                  onPressIn={() => console.log('👇 [PortfolioDetailSheet] Button press IN')}
                  onPressOut={() => console.log('👆 [PortfolioDetailSheet] Button press OUT')}
                  style={({ pressed }) => ({
                    padding: spacing.s8,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? get('surface.level2') as string : 'transparent',
                  })}
                  hitSlop={8}
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
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 }}>
                      {(summary?.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={{ color: textMuted, fontSize: 14, marginLeft: spacing.s6, fontWeight: '600' }}>
                      {summary?.base || 'USD'}
                    </Text>
                  </View>
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
                    Add Ticker
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
              <View>
                {holdingsSyms.length ? (
                  holdingsSyms.map((sym, index) => (
                    <React.Fragment key={sym}>
                      <HoldingRow
                        sym={sym}
                        portfolioId={p.id}
                        variant="list"
                        onPress={() => {
                          // Close the sheet before navigating
                          onClose();
                        }}
                      />
                      {index < holdingsSyms.length - 1 && (
                        <View style={{ height: 1, backgroundColor: get('border.subtle') as string }} />
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <EmptyState
                    title="No holdings yet"
                    body="Add your first position to track performance."
                    actionLabel={onAddHolding ? 'Add ticker' : undefined}
                    onPressAction={onAddHolding}
                  />
                )}
              </View>
            ) : tab === 'Watchlist' ? (
              <View>
                {watchlistSyms.length ? (
                  watchlistSyms.map((sym, index) => (
                    <React.Fragment key={sym}>
                      <WatchRow
                        sym={sym}
                        portfolioCurrency={summary?.base}
                        onPress={() => {
                          // Close the sheet before navigating
                          onClose();
                        }}
                      />
                      {index < watchlistSyms.length - 1 && (
                        <View style={{ height: 1, backgroundColor: get('border.subtle') as string }} />
                      )}
                    </React.Fragment>
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
            ) : (
              <View style={{ paddingVertical: spacing.s24, gap: spacing.s16 }}>
                <View style={{ alignItems: 'center', gap: spacing.s8 }}>
                  <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800' }}>
                    {formatCurrency(summary.cashValue, summary.base)}
                  </Text>
                  <Text style={{ color: textMuted, fontSize: 14 }}>Available Cash</Text>
                </View>
                <Pressable
                  onPress={() => setShowCashEditor(true)}
                  style={({ pressed }) => ({
                    backgroundColor: get('component.button.primary.bg') as string,
                    paddingVertical: spacing.s12,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 15 }}>
                    Adjust Cash
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        {/* Render PopoverMenu INSIDE BottomSheet */}
        {menuVisible && menuAnchor && (
          <View style={{
            position: 'absolute',
            top: menuAnchor.y + menuAnchor.h + 6,
            right: 16,
            zIndex: 9999,
            width: 240,
            backgroundColor: get('surface.level1') as string,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: get('border.subtle') as string,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}>
            {menuItems.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  setMenuVisible(false);
                  item.onPress();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.s12,
                  paddingHorizontal: spacing.s16,
                  paddingVertical: spacing.s12,
                  backgroundColor: pressed ? get('surface.level2') as string : 'transparent',
                })}
              >
                {item.icon && (
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.md,
                      backgroundColor: withAlpha(get(item.destructive ? 'semantic.danger' : 'accent.primary') as string, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={item.icon} size={18} colorToken={item.destructive ? 'semantic.danger' : 'accent.primary'} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: item.destructive ? get('semantic.danger') as string : textPrimary, fontWeight: '700', fontSize: 15 }}>
                    {item.label}
                  </Text>
                  {item.description && (
                    <Text style={{ color: item.destructive ? withAlpha(get('semantic.danger') as string, 0.8) : textMuted, fontSize: 12, marginTop: 2 }}>
                      {item.description}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
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
        console.log('🎨 Rendering tab:', tab);
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
              numberOfLines={1}
              style={{
                color: active ? get('text.onPrimary') as string : get('text.muted') as string,
                fontWeight: '700',
                fontSize: 13,
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
