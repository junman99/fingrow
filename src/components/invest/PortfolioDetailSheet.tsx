import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
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
  topHoldings: Array<{ sym: string; weight: number }>;
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
    const topHoldings = sorted.slice(0, 4).map(row => ({
      sym: row.sym,
      weight: totalValue > 0 ? row.value / totalValue : 0,
    }));
    return {
      base,
      totalValue,
      holdingsValue,
      cashValue,
      dayDelta,
      totalGain,
      positions: sorted.length,
      topHoldings,
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

  const topHoldings = summary?.topHoldings || [];

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

  const quickActions = React.useMemo(() => {
    const items: Array<{ key: string; label: string; icon: IconName; onPress: () => void }> = [];
    if (onAddHolding) {
      items.push({
        key: 'add-holding',
        label: 'Add holding',
        icon: 'plus',
        onPress: onAddHolding,
      });
    }
    if (summary && summary.cashValue !== undefined) {
      items.push({
        key: 'edit-cash',
        label: 'Adjust cash',
        icon: 'dollar-sign',
        onPress: () => setShowCashEditor(true),
      });
    }
    if (onAddWatchlist) {
      items.push({
        key: 'add-watch',
        label: 'Add to watchlist',
        icon: 'star',
        onPress: onAddWatchlist,
      });
    }
    items.push({
      key: 'more',
      label: 'More',
      icon: 'more-horizontal',
      onPress: openMenu,
    });
    return items;
  }, [onAddHolding, summary, onAddWatchlist, openMenu]);

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
            <View
              style={{
                backgroundColor: withAlpha(get('accent.primary') as string, isDark ? 0.28 : 0.12),
                borderRadius: radius.lg,
                padding: spacing.s12,
                borderWidth: 1,
                borderColor: withAlpha(get('accent.primary') as string, isDark ? 0.44 : 0.26),
                gap: spacing.s10,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.s10 }}>
                <View style={{ flex: 1, gap: spacing.s2 }}>
                  <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: withAlpha(textPrimary, 0.72), fontSize: 12, fontWeight: '600' }}>
                    {(p.type || 'Portfolio')} · {(summary?.base || 'USD')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: spacing.s2 }}>
                  <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800' }}>
                    {formatCurrency(summary?.totalValue || 0, summary?.base || 'USD')}
                  </Text>
                  <Text style={{ color: withAlpha(textPrimary, 0.7), fontSize: 12, fontWeight: '600' }}>
                    Today {dayLabel}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                <SummaryMetric label="All-time" value={gainLabel} />
                <SummaryMetric label="Positions" value={summary?.positions ?? 0} />
                <SummaryMetric
                  label="Cash"
                  value={formatCurrency(summary?.cashValue || 0, summary?.base || 'USD', { compact: true })}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
              {quickActions.map(action => (
                <QuickActionButton
                  key={action.key}
                  icon={action.icon}
                  label={action.label}
                  onPress={action.onPress}
                  ref={action.key === 'more' ? menuBtnRef : undefined}
                />
              ))}
            </View>

            {topHoldings.length ? (
              <View style={{ gap: spacing.s8 }}>
                <Text style={{ color: textPrimary, fontWeight: '700' }}>Top holdings</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.s8 }}>
                  {topHoldings.map((item, index) => (
                    <TopHoldingPill
                      key={`${item.sym}-${index}`}
                      sym={item.sym}
                      weight={item.weight}
                      accentIndex={index}
                      isLast={index === topHoldings.length - 1}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <SegmentedControl value={tab} onChange={setTab} />

            {tab === 'Holdings' ? (
              <View style={{ gap: spacing.s8 }}>
                {holdingsSyms.length ? (
                  holdingsSyms.map(sym => (
                    <HoldingRow key={sym} sym={sym} portfolioId={p.id} variant="card" />
                  ))
                ) : (
                  <EmptyState
                    title="No holdings yet"
                    body="Add your first position to light up performance."
                    actionLabel={onAddHolding ? 'Add holding' : undefined}
                    onPressAction={onAddHolding}
                  />
                )}
              </View>
            ) : (
              <View style={{ gap: spacing.s8 }}>
                {watchlistSyms.length ? (
                  watchlistSyms.map(sym => <WatchRow key={sym} sym={sym} />)
                ) : (
                  <EmptyState
                    title="Watchlist is quiet"
                    body="Track tickers here before you invest."
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

const accentPalette = ['accent.primary', 'semantic.success', 'semantic.info', 'semantic.warning', 'semantic.danger'] as const;

function TopHoldingPill({ sym, weight, accentIndex, isLast }: { sym: string; weight: number; accentIndex: number; isLast: boolean }) {
  const { get, isDark } = useThemeTokens();
  const tone = get(accentPalette[accentIndex % accentPalette.length]) as string;
  const bg = withAlpha(tone, isDark ? 0.28 : 0.14);
  const border = withAlpha(tone, isDark ? 0.4 : 0.24);
  const pct = Math.max(0, Math.min(100, Math.round(weight * 1000) / 10));
  const label = pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s6,
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.s12,
        paddingVertical: spacing.s6,
        borderWidth: 1,
        borderColor: border,
        marginRight: isLast ? 0 : spacing.s8,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
      <Text style={{ color: get('text.onSurface') as string, fontWeight: '700' }}>{sym}</Text>
      <Text style={{ color: get('text.muted') as string, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const QuickActionButton = React.forwardRef<View, { icon: IconName; label: string; onPress: () => void }>(
  ({ icon, label, onPress }, ref) => {
    const { get, isDark } = useThemeTokens();
    const accent = get('accent.primary') as string;
    const fg = get('text.onPrimary') as string;
    return (
      <Pressable
        ref={ref as any}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? withAlpha(accent, isDark ? 0.34 : 0.24) : withAlpha(accent, isDark ? 0.26 : 0.18),
        })}
      >
        <Icon name={icon} colorToken="text.onPrimary" size={18} />
      </Pressable>
    );
  }
);

QuickActionButton.displayName = 'QuickActionButton';

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  const { get } = useThemeTokens();
  return (
    <View style={{ paddingHorizontal: spacing.s10, paddingVertical: spacing.s6, borderRadius: radius.md, backgroundColor: withAlpha(get('surface.level1') as string, 0.52) }}>
      <Text style={{ color: withAlpha(get('text.onSurface') as string, 0.7), fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: get('text.onSurface') as string, fontWeight: '700' }}>{value}</Text>
    </View>
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
        gap: spacing.s6,
        padding: spacing.s16,
        backgroundColor: withAlpha(get('surface.level2') as string, 0.8),
        borderRadius: radius.lg,
      }}
    >
      <Text style={{ color: get('text.onSurface') as string, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: get('text.muted') as string }}>{body}</Text>
      {actionLabel && onPressAction ? (
        <Pressable
          onPress={onPressAction}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingHorizontal: spacing.s12,
            paddingVertical: spacing.s6,
            borderRadius: radius.pill,
            backgroundColor: withAlpha(get('accent.primary') as string, pressed ? 0.28 : 0.2),
          })}
        >
          <Text style={{ color: get('accent.primary') as string, fontWeight: '700' }}>{actionLabel}</Text>
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
