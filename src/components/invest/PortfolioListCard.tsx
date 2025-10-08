import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '../Card';
import Button from '../Button';
import Icon from '../Icon';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore, type Portfolio } from '../../store/invest';
import { formatCurrency } from '../../lib/format';
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

function usePortfolioMetrics(p: Portfolio, quotes: any, currency: string) {
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
  syms.forEach(sym => {
    const q = quotes[sym];
    const last = Number(q?.last || 0);
    const chg = Number(q?.change || 0);
    const v = last * positions[sym];
    value += v;
    deltaToday += chg * positions[sym];
    valuesPerSym[sym] = v;
  });

  // Compute total gain (realized + unrealized) across holdings
  Object.values(p.holdings || {}).forEach((h: any) => {
    const lots = h?.lots || [];
    if (!lots.length) return;
    const last = Number((quotes[h.symbol]?.last) || 0);
    const pnl = computePnL(lots, last);
    totalGain += (pnl.realized + pnl.unrealized);
  });


  const total = value || 1;
  const top = Object.entries(valuesPerSym)
    .sort((a,b)=> b[1]-a[1])
    .slice(0,4)
    .map(([sym, v]) => ({ sym, w: v / total }));

  return { value, deltaToday, totalGain, top, hasHoldings: syms.length > 0 };
}

function DeltaBadge({ amount, currency, label }: { amount: number; currency: string; label?: string }) {
  const { get } = useThemeTokens();
  const up = amount >= 0;
  const chipBg = get('surface.level2') as string;
  const fg = up ? (get('semantic.success') as string) : (get('semantic.danger') as string);
  return (
    <View accessibilityRole="text" style={{ paddingHorizontal: 10, height: 26, borderRadius: 999, alignItems:'center', justifyContent:'center', backgroundColor: chipBg, borderWidth:1, borderColor: get('border.subtle') as string }}>
      <Text style={{ color: fg, fontWeight:'700', fontSize: 12 }}>
        {label ? `${label} ` : ''}{formatCurrency(amount, currency)}
      </Text>
    </View>
  );
}

function AllocationBar({ top, show }: { top: Array<{ sym: string; w: number }>, show: boolean }) {
  const { get } = useThemeTokens();
  if (!show || top.length === 0) return null;

  // Build up to 5 segments: top 4 and an "Others"
  const sorted = [...top].sort((a,b)=> b.w - a.w);
  const head = sorted.slice(0, 4);
  const othersW = Math.max(0, 1 - head.reduce((s, x) => s + x.w, 0));
  const segments: Array<{ label: string; pct: number; colorToken: string }> = head.map((s, i) => {
    const colors = ['accent.primary', 'semantic.success', 'semantic.warning', 'semantic.danger'] as const;
    return { label: `${s.sym} ${Math.round(s.w*100)}%`, pct: s.w*100, colorToken: colors[i] };
  });
  if (othersW > 0.003) { // >0.3%
    segments.push({ label: `Others ${Math.round(othersW*100)}%`, pct: othersW*100, colorToken: 'component.button.secondary.bg' });
  }

  const track = get('surface.level2') as string;
  return (
    <View style={{ marginTop: spacing.s8 }}>
      <View style={{ height: 12, borderRadius: radius.md, backgroundColor: track, overflow: 'hidden', flexDirection: 'row' }}>
        {segments.map((seg, i) => {
          const bg = get(seg.colorToken) as string;
          return (
            <View key={i} style={{ width: `${Math.max(seg.pct, 0)}%`, height: '100%', backgroundColor: bg, position: 'relative', justifyContent: 'center' }}>
              {/* Inline label only if wide enough (~14% of bar) */}
              {seg.pct >= 14 ? (
                <View style={{ position: 'absolute', left: 8, right: 8 }}>
                  <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: get('text.onPrimary') as string }}>{seg.label}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}


function AllocationChips({ top, show }: { top: Array<{ sym: string; w: number }>, show: boolean }) {
  const { get } = useThemeTokens();
  if (!show || top.length === 0) return null;
  return (
    <View style={{ flexDirection:'row', gap: 16, marginTop: spacing.s8, flexWrap:'wrap' }}>
      {top.map((s, i) => (
        <View key={i} style={{ flexDirection:'row', alignItems:'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: get(`chart.series${(i%4)+1}.line`) as string }} />
          <Text style={{ color: get('text.muted') as string, fontSize: 13 }}>{s.sym} {Math.round(s.w*100)}%</Text>
        </View>
      ))}
    </View>
  );
}

export default function PortfolioListCard({ selectionMode, selectedIds, onToggleSelect, onDeleteSelected, onOpenPortfolio, onCreate, onStartDeleteMode, onOpenManager }: Props) {
  const { get } = useThemeTokens();
  const portfolios = useInvestStore(s => s.portfolios);
  const order = useInvestStore(s => s.portfolioOrder);
  const quotes = useInvestStore(s => s.quotes);
  const setActive = useInvestStore(s => s.setActivePortfolio);

  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<{x:number;y:number;w:number;h:number}|null>(null);
  const menuBtnRef = React.useRef<View>(null);

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
    <Card style={{ padding: spacing.s16 }}>
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: spacing.s8 }}>
        <Text style={{ color: get('text.onSurface') as string, fontWeight:'800', fontSize: 18 }}>Portfolios</Text>
        <Pressable ref={menuBtnRef as any} accessibilityRole="button" accessibilityLabel="Open portfolio menu" onPress={openMenu} style={{ padding: 8, width: 40, height: 40, alignItems:'center', justifyContent:'center', borderRadius: 20 }}>
          <Icon name="more-horizontal" colorToken='icon.default' />
        </Pressable>
      </View>

      {items.map((p) => {
        const { value, deltaToday, totalGain, top, hasHoldings } = usePortfolioMetrics(p, quotes, p.baseCurrency || 'USD');
        const handlePress = () => {
          setActive(p.id);
          onOpenPortfolio && onOpenPortfolio(p.id);
        };
        const cur = (p.baseCurrency || 'USD').toUpperCase();
        return (
          <Pressable
            key={p.id}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={`Open ${p.name} portfolio`}
            style={({ pressed }) => ({
              marginBottom: spacing.s8,
              padding: spacing.s12,
              borderRadius: radius.lg,
              backgroundColor: get('surface.level1') as string,
              borderWidth: 1,
              borderColor: get('border.subtle') as string,
              opacity: pressed ? 0.96 : 1,
            })}
          >
            {/* Top row: avatar + name + subtitle, value on right */}
            <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap: spacing.s8, flex: 1, paddingRight: spacing.s8 }}>
                <PortfolioAvatar portfolio={p as any} quotes={quotes} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: get('text.onSurface') as string, fontWeight:'800', fontSize: 16 }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: get('text.muted') as string, fontSize: 12 }} numberOfLines={1}>
                    {(p.type || 'Live')} · {cur}{p.benchmark ? ` · vs ${p.benchmark}` : ''}{p.archived ? ' · Archived' : ''}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ color: get('text.onSurface') as string, fontWeight:'700', fontSize: 18 }}>
                  {formatCurrency(value, cur)}
                </Text>
                <View style={{ marginTop: 4 }}>
                  <DeltaBadge amount={deltaToday} currency={cur} label="Today" />
                </View>
              </View>
            </View>

            {/* Allocation chips */}
            <AllocationChips top={top} show={hasHoldings} />
          </Pressable>
        );
      })}

      <PopoverMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        anchor={menuAnchor}
        items={[
          { key: 'add', label: 'Add portfolio', onPress: () => { if (onCreate) onCreate(); } },
          { key: 'reorder', label: 'Reorder portfolios', onPress: () => { if (onOpenManager) onOpenManager(); } },
          { key: 'delete', label: 'Delete portfolios…', onPress: () => onStartDeleteMode && onStartDeleteMode(), destructive: false },
        ]}
      />
    </Card>
  );
}
