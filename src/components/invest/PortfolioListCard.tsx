import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore, type Portfolio } from '../../store/invest';
import { formatCurrency } from '../../lib/format';
import { convertCurrency, type FxRates } from '../../lib/fx';
import { computePnL } from '../../lib/positions';
import PopoverMenu from '../PopoverMenu';
import PortfolioAvatar from './PortfolioAvatar';

/**
 * PortfolioListCard (clean, dark-mode correct)
 *  - Title row + Delta badge (Today $)
 *  - Value line
 *  - Allocation legend chips (no progress bar)
 *  - Quick actions + header '...' menu to Add portfolio / Edit, etc.
 */

type Props = {
  selectionMode?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onDeleteSelected?: () => void;
  onOpenPortfolio?: (id: string) => void;
  onCreate?: () => void;
  onStartDeleteMode?: () => void;
  onOpenManager?: () => void;
};

type AccentTheme = {
  chip: string;
  stroke: string;
  shadow: string;
};

function withAlpha(color: string, alpha: number): string {
  if (!color) return color;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw.padEnd(6, '0');
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

function usePortfolioMetrics(p: Portfolio, quotes: any, currency: string, fxRates: FxRates | undefined) {
  const positions: Record<string, number> = {};
  Object.values(p.holdings || {}).forEach((h: any) => {
    const qty = (h?.lots || []).reduce((s: number, l: any) => s + (l.side === 'buy' ? l.qty : -l.qty), 0);
    if (qty) positions[h.symbol] = (positions[h.symbol] || 0) + qty;
  });

  let value = 0;
  let deltaToday = 0;
  let totalGain = 0;
  const valuesPerSym: Record<string, number> = {};
  const syms = Object.keys(positions);
  const base = (currency || 'USD').toUpperCase();
  syms.forEach(sym => {
    const q = quotes[sym];
    const last = Number(q?.last || 0);
    const chg = Number(q?.change || 0);
    const holdingCurrency = String(p?.holdings?.[sym]?.currency || 'USD').toUpperCase();
    const rawPositionValue = last * positions[sym];
    const rawChange = chg * positions[sym];
    const baseValue = convertCurrency(fxRates, rawPositionValue, holdingCurrency, base);
    value += baseValue;
    deltaToday += convertCurrency(fxRates, rawChange, holdingCurrency, base);
    valuesPerSym[sym] = baseValue;
  });

  // Compute total gain (realized + unrealized) across holdings
  Object.values(p.holdings || {}).forEach((h: any) => {
    const lots = h?.lots || [];
    if (!lots.length) return;
    const last = Number((quotes[h.symbol]?.last) || 0);
    const pnl = computePnL(lots, last);
    const holdingCurrency = String(h?.currency || 'USD').toUpperCase();
    totalGain += convertCurrency(fxRates, (pnl.realized + pnl.unrealized), holdingCurrency, base);
  });


  const total = value || 1;
  const top = Object.entries(valuesPerSym)
    .sort((a,b)=> b[1]-a[1])
    .slice(0,4)
    .map(([sym, v]) => ({ sym, w: v / total, value: v }));

  return { value, deltaToday, totalGain, top, hasHoldings: syms.length > 0 };
}

function DeltaBadge({ amount, currency, label, gradient }: { amount: number; currency: string; label?: string; gradient: [string, string] }) {
  const { get } = useThemeTokens();
  const up = amount >= 0;
  const danger = get('semantic.danger') as string;
  const success = get('semantic.success') as string;
  const onPrimary = get('text.onPrimary') as string;
  const base0 = gradient?.[0] || success;
  const base1 = gradient?.[1] || success;
  const colors = up
    ? [withAlpha(base0, 0.92), withAlpha(base1, 0.78)]
    : [withAlpha(danger, 0.92), withAlpha(base0, 0.7)];
  return (
    <LinearGradient
      accessibilityRole="text"
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingHorizontal: spacing.s8,
        height: 26,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 84,
      }}
    >
      <Text style={{ color: onPrimary, fontWeight: '700', fontSize: 12 }}>
        {label ? `${label} ` : ''}{formatCurrency(amount, currency)}
      </Text>
    </LinearGradient>
  );
}

function AllocationChips({ top, show, tint }: { top: Array<{ sym: string; w: number; value: number }>, show: boolean; tint: string }) {
  const { get, isDark } = useThemeTokens();
  if (!show || top.length === 0) return null;
  const textMuted = get('text.muted') as string;
  const textOnSurface = get('text.onSurface') as string;
  return (
    <View style={{ gap: spacing.s6 }}>
      <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>TOP HOLDINGS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: spacing.s12 }}
      >
        {top.map((s, i) => {
          const accent = i === 0 ? tint : (get(`chart.series${(i % 4) + 1}.line`) as string);
          const pct = Math.round(s.w * 1000) / 10;
          return (
            <View
              key={`${s.sym}-${i}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(accent, isDark ? 0.36 : 0.18),
                borderWidth: 1,
                borderColor: withAlpha(accent, isDark ? 0.52 : 0.26),
                marginRight: i === top.length - 1 ? 0 : spacing.s8,
                gap: spacing.s6,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
              <Text style={{ color: textOnSurface, fontWeight: '700' }}>{s.sym}</Text>
              <Text style={{ color: textMuted, fontWeight: '600' }}>
                {pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const PortfolioListCard = React.memo(({ selectionMode, selectedIds, onToggleSelect, onDeleteSelected, onOpenPortfolio, onCreate, onStartDeleteMode, onOpenManager }: Props) => {
  const { get, isDark } = useThemeTokens();
  const portfolios = useInvestStore(s => s.portfolios);
  const order = useInvestStore(s => s.portfolioOrder);
  const quotes = useInvestStore(s => s.quotes);
  const setActive = useInvestStore(s => s.setActivePortfolio);
  const activePortfolioId = useInvestStore(s => s.activePortfolioId);
  const fxRates = useInvestStore(s => s.fxRates);

  const safeToken = React.useCallback((token: string, fallback: string) => {
    try {
      const val = get(token);
      if (typeof val === 'string') return val as string;
    } catch {}
    return fallback;
  }, [get]);

  const accentPalette = React.useMemo<AccentTheme[]>(() => {
    const accentPrimary = safeToken('accent.primary', '#4f46e5');
    const accentSecondary = safeToken('accent.secondary', '#6366f1');
    const success = safeToken('semantic.success', '#22c55e');
    const info = safeToken('semantic.info', accentSecondary);
    const warning = safeToken('semantic.warning', '#f59e0b');
    const danger = safeToken('semantic.danger', '#ef4444');
    return [
      { chip: accentPrimary, stroke: accentPrimary, shadow: accentPrimary },
      { chip: success, stroke: success, shadow: success },
      { chip: info, stroke: info, shadow: info },
      { chip: warning, stroke: warning, shadow: warning },
      { chip: danger, stroke: danger, shadow: danger },
    ];
  }, [safeToken]);

  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<{x:number;y:number;w:number;h:number}|null>(null);
  const menuBtnRef = React.useRef<View>(null);

  const successColor = safeToken('semantic.success', '#22c55e');
  const dangerColor = safeToken('semantic.danger', '#ef4444');
  const selectedCount = selectedIds?.length || 0;

  React.useEffect(() => {
    if (selectionMode) setMenuVisible(false);
  }, [selectionMode]);

  const items = order.map(id => portfolios[id]).filter(Boolean);

  const openMenu = () => {
    const ref: any = menuBtnRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x:number,y:number,w:number,h:number) => {
        setMenuAnchor({ x, y, w, h }); setMenuVisible(true);
      });
    } else {
      setMenuAnchor({ x: 280, y: 120, w: 1, h: 1 }); setMenuVisible(true);
    }
  };

  return (
    <View style={{ gap: spacing.s12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: spacing.s4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <Text style={{ color: get('text.onSurface') as string, fontWeight: '800', fontSize: 18 }}>Portfolios</Text>
            <View
              style={{
                paddingHorizontal: spacing.s8,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(accentPalette[0]?.chip || get('accent.primary') as string, 0.1),
              }}
            >
              <Text style={{ color: get('accent.primary') as string, fontWeight: '700', fontSize: 12 }}>{items.length}</Text>
            </View>
          </View>
          <Text style={{ color: get('text.muted') as string, fontSize: 12 }}>
            {selectionMode
              ? (selectedCount ? `${selectedCount} selected` : 'Tap a card to select portfolios to delete.')
              : 'Keep your invest space as sleek as your budget studio.'}
          </Text>
        </View>
        {selectionMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete selected portfolios"
            onPress={() => { if (selectedCount && onDeleteSelected) onDeleteSelected(); }}
            disabled={!selectedCount}
            style={({ pressed }) => ({
              opacity: selectedCount ? 1 : 0.6,
              paddingHorizontal: spacing.s12,
              paddingVertical: spacing.s6,
              borderRadius: radius.pill,
              backgroundColor: withAlpha(dangerColor, pressed && selectedCount ? 0.9 : 0.8),
            })}
          >
            <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700', fontSize: 12 }}>Delete</Text>
          </Pressable>
        ) : (
          <Pressable
            ref={menuBtnRef as any}
            accessibilityRole="button"
            accessibilityLabel="Open portfolio menu"
            onPress={openMenu}
            style={{ borderRadius: radius.lg }}
          >
            {({ pressed }) => (
              <LinearGradient
                colors={[
                  withAlpha(accentPalette[0]?.chip || get('accent.primary') as string, pressed ? 0.88 : 0.72),
                  withAlpha(accentPalette[1]?.chip || get('accent.secondary') as string, pressed ? 0.74 : 0.52),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="more-horizontal" colorToken="text.onPrimary" />
              </LinearGradient>
            )}
          </Pressable>
        )}
      </View>

      <View style={{ gap: spacing.s12 }}>
        {!items.length ? (
          <View
            style={{
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: withAlpha(get('border.subtle') as string, 0.6),
              padding: spacing.s12,
              backgroundColor: withAlpha(get('surface.level1') as string, 0.6),
              gap: spacing.s8,
            }}
          >
            <Text style={{ color: get('text.onSurface') as string, fontWeight: '700' }}>No portfolios yet</Text>
            <Text style={{ color: get('text.muted') as string }}>
              Create your first portfolio to mirror the polish of your budget studio.
            </Text>
            {onCreate ? (
              <Pressable
                onPress={onCreate}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(accentPalette[0]?.chip || get('accent.primary') as string, pressed ? 0.26 : 0.2),
                })}
              >
                <Text style={{ color: get('accent.primary') as string, fontWeight: '700' }}>Add portfolio</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {items.map((p, index) => {
          const accent = accentPalette[index % accentPalette.length];
          const { value, deltaToday, totalGain, top, hasHoldings } = usePortfolioMetrics(p, quotes, p.baseCurrency || 'USD', fxRates);
          const cur = (p.baseCurrency || 'USD').toUpperCase();
          const textPrimary = get('text.onSurface') as string;
          const textMuted = get('text.muted') as string;
          const isActive = activePortfolioId === p.id;
          const isSelected = !!selectedIds?.includes(p.id);
          const holdingsCount = Object.values(p?.holdings || {}).filter((h: any) => {
            const qty = (h?.lots || []).reduce((sum: number, l: any) => sum + (l.side === 'buy' ? l.qty : -l.qty), 0);
            return qty > 0;
          }).length;
          const totalGainValue = totalGain === 0
            ? formatCurrency(0, cur, { compact: true })
            : `${totalGain >= 0 ? '+' : '−'}${formatCurrency(Math.abs(totalGain), cur, { compact: true })}`;
          const baseTint = withAlpha(accent.chip, isDark ? 0.44 : 0.2);
          const tileBg = isSelected
            ? withAlpha(accent.chip, isDark ? 0.68 : 0.28)
            : baseTint;
          const cardBorderColor = isSelected
            ? withAlpha(accent.stroke, isDark ? 0.78 : 0.42)
            : 'transparent';
          const cardBorderWidth = isSelected ? 2 : 0;
          const annotation = selectionMode
            ? (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: withAlpha(accent.chip, isSelected ? 0.8 : 0.32),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? withAlpha(accent.chip, isDark ? 0.5 : 0.22) : withAlpha(accent.chip, 0.08),
                }}
              >
                {isSelected ? <Icon name="check" size={18} colorToken="text.onPrimary" /> : null}
              </View>
            )
            : isActive ? (
              <View
                style={{
                  paddingHorizontal: spacing.s10,
                  paddingVertical: spacing.s4,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(accent.chip, isDark ? 0.5 : 0.2),
                  borderWidth: 1,
                  borderColor: withAlpha(accent.chip, isDark ? 0.6 : 0.3),
                }}
              >
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 11, letterSpacing: 0.4 }}>ACTIVE</Text>
              </View>
            ) : null;
          const metaLine = `${(p.type || 'Live')} · ${cur}${p.benchmark ? ` · vs ${p.benchmark}` : ''}${p.archived ? ' · Archived' : ''}`;
          const positionsLabel = holdingsCount === 1 ? '1 position' : `${holdingsCount} positions`;
          const gainColor = totalGain >= 0 ? successColor : dangerColor;

          const handlePress = () => {
            if (selectionMode) {
              onToggleSelect && onToggleSelect(p.id);
            } else {
              setActive(p.id);
              onOpenPortfolio && onOpenPortfolio(p.id);
            }
          };

          return (
            <Pressable
              key={p.id}
              onPress={handlePress}
              accessibilityRole="button"
              accessibilityLabel={`${selectionMode ? 'Select' : 'Open'} ${p.name} portfolio`}
            >
              {({ pressed }) => (
                <View
                  style={{
                    borderRadius: radius.lg,
                    backgroundColor: get('surface.level1') as string,
                    padding: spacing.s16,
                    gap: spacing.s12,
                    opacity: pressed ? 0.8 : 1,
                  }}
                >
                  {/* Header Row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, gap: spacing.s2 }}>
                      <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{p.name}</Text>
                      <Text style={{ color: textMuted, fontSize: 12 }} numberOfLines={1}>{positionsLabel} • {cur}</Text>
                    </View>
                    {annotation}
                  </View>

                  {/* Value & Today's Change */}
                  <View>
                    <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800' }}>
                      {formatCurrency(value, cur)}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginTop: spacing.s4 }}>
                      <Text style={{ color: deltaToday >= 0 ? successColor : dangerColor, fontWeight: '600', fontSize: 13 }}>
                        Today: {deltaToday >= 0 ? '+' : ''}{formatCurrency(deltaToday, cur)}
                      </Text>
                      <Text style={{ color: textMuted, fontSize: 13 }}>•</Text>
                      <Text style={{ color: gainColor, fontWeight: '600', fontSize: 13 }}>
                        All-time {totalGainValue}
                      </Text>
                    </View>
                  </View>

                  {/* Top Holdings - Compact */}
                  {hasHoldings && top.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s6 }}>
                      {top.slice(0, 3).map((s, i) => {
                        const pct = Math.round(s.w * 100);
                        return (
                          <View
                            key={`${s.sym}-${i}`}
                            style={{
                              paddingHorizontal: spacing.s10,
                              paddingVertical: spacing.s4,
                              borderRadius: radius.pill,
                              backgroundColor: get('surface.level2') as string,
                            }}
                          >
                            <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 12 }}>
                              {s.sym} {pct}%
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <PopoverMenu
        visible={!selectionMode && menuVisible}
        onClose={() => setMenuVisible(false)}
        anchor={menuAnchor}
        items={[
          {
            key: 'add',
            label: 'Add portfolio',
            description: 'Create a fresh collection with its own base currency',
            icon: 'plus-circle',
            iconToken: 'accent.primary',
            onPress: () => { if (onCreate) onCreate(); },
          },
          {
            key: 'reorder',
            label: 'Reorder portfolios',
            description: 'Drag & drop to match your daily workflow',
            icon: 'sort',
            iconToken: 'accent.secondary',
            onPress: () => { if (onOpenManager) onOpenManager(); },
          },
          {
            key: 'delete',
            label: 'Delete portfolios…',
            description: 'Archive or remove the sets you no longer need',
            icon: 'trash',
            iconToken: 'semantic.danger',
            onPress: () => onStartDeleteMode && onStartDeleteMode(),
            destructive: false,
          },
        ]}
      />
    </View>
  );
});

PortfolioListCard.displayName = 'PortfolioListCard';

export default PortfolioListCard;
