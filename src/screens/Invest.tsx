import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useInvestStore } from '../store/invest';
import { formatCurrency } from '../lib/format';
import { useProfileStore } from '../store/profile';
import { useNavigation } from '@react-navigation/native';
import LineChart from '../components/LineChart';
import { computePnL } from '../lib/positions';
import PortfolioListCard from '../components/invest/PortfolioListCard';
import CreatePortfolioModal from '../components/invest/CreatePortfolioModal';
import PortfolioDetailSheet from '../components/invest/PortfolioDetailSheet';
import AddHoldingSheet from '../components/invest/AddHoldingSheet';
import PortfolioManagerModal from '../components/invest/PortfolioManagerModal';
import EditPortfolioModal from '../components/invest/EditPortfolioModal';
import HoldingsFilterSheet from '../components/invest/HoldingsFilterSheet';
import HoldingsSortSheet from '../components/invest/HoldingsSortSheet';
function withAlpha(hex: string, alpha: number) {
  if (!hex) return hex;
  const raw = hex.replace('#', '');
  const bigint = parseInt(raw.length === 3 ? raw.repeat(2) : raw, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}



export function Invest() {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const [pfTf, setPfTf] = React.useState<'1D'|'5D'|'1M'|'6M'|'YTD'|'1Y'|'ALL'>('6M');
  const [hideAmounts, setHideAmounts] = React.useState(false);
  const [showCreateSheet, setShowCreateSheet] = React.useState(false);
  const [showManager, setShowManager] = React.useState(false);
  const [showAddHolding, setShowAddHolding] = React.useState(false);
  const [addMode, setAddMode] = React.useState<'holdings'|'watchlist'>('holdings');
  const [editPortfolioId, setEditPortfolioId] = React.useState<string | null>(null);
    // Selection mode for deleting portfolios
  const [deleteMode, setDeleteMode] = React.useState(false);
  const [selectedPids, setSelectedPids] = React.useState<string[]>([]);
  const onToggleSelectPid = React.useCallback((pid: string) => {
    setSelectedPids(prev => prev.includes(pid) ? prev.filter(x => x!==pid) : [...prev, pid]);
  }, []);
  const deletePortfolio = useInvestStore(s => (s as any).deletePortfolio);
  const onDeleteSelected = React.useCallback(async () => {
    for (const pid of selectedPids) { try { await deletePortfolio(pid); } catch {} }
    setSelectedPids([]); setDeleteMode(false);
  }, [selectedPids, deletePortfolio]);
const onStartDeleteMode = React.useCallback(() => { setDeleteMode(true); setSelectedPids([]); }, []);
  const [currentPortfolioId, setCurrentPortfolioId] = React.useState<string|null>(null);
  const [modalPortfolioId, setModalPortfolioId] = React.useState<string|null>(null);
  const [showHoldingsFilter, setShowHoldingsFilter] = React.useState(false);
  const [showHoldingsSort, setShowHoldingsSort] = React.useState(false);
  const [qHold, setQHold] = React.useState('');
  const [minWeight, setMinWeight] = React.useState(0);
  const [sortKey, setSortKey] = React.useState<'mv'|'pnlAbs'|'pnlPct'|'ticker'>('mv');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('desc');

  const { portfolios, quotes, hydrate, refreshQuotes, refreshing, error, fxRates, refreshFx, allSymbols } = useInvestStore();
  const activePortfolioId = useInvestStore(state => state.activePortfolioId);
  const { profile } = useProfileStore();

  React.useEffect(() => { hydrate(); refreshFx(); /* auto-refresh quotes on mount */ const syms = allSymbols(); refreshQuotes(syms && syms.length ? syms : undefined); }, []);

  // Aggregate holdings across all portfolios for the overview chart
  const effectiveHoldings: Record<string, any> = React.useMemo(() => {
    const out: Record<string, any> = {};
    Object.values(portfolios || {}).forEach((p:any) => {
      if (!p || !p.holdings) return;
      Object.values(p.holdings || {}).forEach((h:any) => {
        const sym = h.symbol;
        if (!out[sym]) out[sym] = { ...h, lots: [] };
        out[sym].lots = out[sym].lots.concat(h.lots || []);
      });
    });
    return out;
  }, [portfolios]);

  const symbols = React.useMemo(()=> Object.keys(effectiveHoldings), [effectiveHoldings]);

  const totalUSD = React.useMemo(() => {
    return symbols.reduce((acc, sym) => {
      const last = quotes[sym]?.last || 0;
      const qty = (effectiveHoldings[sym]?.lots || []).reduce((s:any,l:any)=> s + (l.side==='buy'? l.qty : -l.qty), 0);
      return acc + last * qty;
    }, 0);
  }, [symbols, effectiveHoldings, quotes]);

  // Include portfolio cash balances (converted to USD baseline)
  const cashUSD = React.useMemo(() => {
    const rates = fxRates?.rates || {} as Record<string, number>;
    let sum = 0;
    Object.values(portfolios || {}).forEach((p: any) => {
      const cash = Number(p?.cash || 0);
      if (!cash) return;
      const cur = String(p?.baseCurrency || 'USD').toUpperCase();
      if (cur === 'USD') sum += cash;
      else {
        const r = Number(rates[cur] || 0);
        sum += r ? (cash / r) : cash; // fallback assume ~USD if missing
      }
    });
    return sum;
  }, [portfolios, fxRates]);

  const cur = ((profile?.currency) || 'USD').toUpperCase();
  const rate = fxRates?.rates?.[cur] || (cur==='USD'?1:undefined);
  const totalValue = rate ? (totalUSD + cashUSD) * rate : (totalUSD + cashUSD);

  const portfolioLine = React.useMemo(() => {
    const syms = Object.keys(effectiveHoldings);
    if (!syms.length) return [] as Array<{t:number; v:number}>;
    const priceMaps: Record<string, Record<string, number>> = {};
    const positionLots: Record<string, { side:'buy'|'sell'; qty:number; date:number }[]> = {};
    syms.forEach(sym => {
      const q = quotes[sym];
      const map: Record<string, number> = {};
      if (q?.bars && q.bars.length) {
        let lastC: number | undefined;
        q.bars.forEach(b => {
          const c = Number((b as any).c);
          if (!Number.isFinite(c) || c <= 0) return;
          if (lastC && (c > lastC * 5 || c < lastC / 5)) return;
          const key = new Date((b as any).t).toISOString().slice(0,10);
          map[key] = c;
          lastC = c;
        });
      } else if (q?.line && q.line.length) {
        const last = Number.isFinite((q as any).last) ? (q as any).last as number : undefined;
        (q.line as any[]).forEach(p => {
          const v = (p as any)?.v;
          if (Number.isFinite(v) && v > 0 && (!last || v < last * 5)) {
            const key = new Date((p as any).t).toISOString().slice(0,10);
            map[key] = v as number;
          }
        });
      }
      priceMaps[sym] = map;
      const lots = (effectiveHoldings[sym]?.lots || []).map((l:any) => ({ side: l.side, qty: l.qty, date: new Date(l.date).getTime() }));
      positionLots[sym] = lots.sort((a,b)=> a.date - b.date);
    });
    // date domain & forward-fill
    // Collect union of all dates present across symbols
    const allDates = new Set<string>();
    Object.values(priceMaps).forEach(m => Object.keys(m).forEach(d => allDates.add(d)));
    // Include cash event dates across portfolios (converted to USD later)
    const cashEventMapUSD: Record<string, number> = {};
    try {
      const rates = fxRates?.rates || {} as Record<string, number>;
      Object.values(portfolios || {}).forEach((p: any) => {
        const base = String(p?.baseCurrency || 'USD').toUpperCase();
        const r = Number(rates[base] || 0);
        const toUSD = (amt: number) => base==='USD' || !r ? amt : (amt / r);
        (p?.cashEvents || []).forEach((ev: any) => {
          const d = new Date(ev.date);
          const key = isNaN(d.getTime()) ? undefined : d.toISOString().slice(0,10);
          if (!key) return;
          cashEventMapUSD[key] = (cashEventMapUSD[key] || 0) + toUSD(Number(ev.amount || 0));
          allDates.add(key);
        });
      });
    } catch {}
    const dates = Array.from(allDates).sort(); // 'YYYY-MM-DD'

    // Build a forward-filled price map per symbol (no back-fill before first price)
    const ff: Record<string, Record<string, number>> = {};
    syms.forEach(sym => {
      const src = priceMaps[sym] || {};
      const dst: Record<string, number> = {};
      let lastKnown: number | undefined;
      for (const d of dates) {
        if (Object.prototype.hasOwnProperty.call(src, d)) {
          const val = src[d];
          if (lastKnown && (val > lastKnown * 5 || val < lastKnown / 5)) {
            // ignore absurd jump; keep lastKnown for this day
            dst[d] = lastKnown;
          } else {
            dst[d] = val;
            lastKnown = val;
          }
        } else if (lastKnown !== undefined) {
          dst[d] = lastKnown;
        }
      }
      ff[sym] = dst;
    });

    // Running cash balance in USD across all portfolios by date
    const cashByDateUSD: Record<string, number> = {};
    let run = 0;
    for (const d of dates) {
      if (Object.prototype.hasOwnProperty.call(cashEventMapUSD, d)) run += cashEventMapUSD[d];
      cashByDateUSD[d] = run;
    }

    const points: Array<{t:number; v:number}> = dates.map(d => {
      let total = 0;
      syms.forEach(sym => {
        const price = ff[sym]?.[d];
        if (price !== undefined) {
          const lots = positionLots[sym];
          const cutTs = new Date(d).getTime();
          const qty = lots.reduce((s,l) => s + (l.date <= cutTs ? (l.side==='buy' ? l.qty : -l.qty) : 0), 0);
          if (qty) total += qty * price;
        }
      });
      // add cash (USD baseline)
      total += cashByDateUSD[d] || 0;
      return { t: new Date(d).getTime(), v: (rate || 1) * total };
    });
    return points.slice(-520); // keep it light
  }, [effectiveHoldings, quotes, rate, portfolios, fxRates]);

// Always have something to render for the chart (placeholder if empty)
const displaySeries = React.useMemo(() => {
  if (portfolioLine && portfolioLine.length) return portfolioLine;
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  return Array.from({ length: 14 }, (_, i) => ({ t: now - (13 - i) * day, v: 0 }));
}, [portfolioLine]);

// Timeframe-filtered view
const visibleSeries = React.useMemo(() => {
  const s = portfolioLine || [];
  if (!s.length) return s;
  const endTs = s[s.length - 1].t;
  const end = new Date(endTs);
  const msDay = 24 * 3600 * 1000;

  const since = (() => {
    switch (pfTf) {
      case '1D': return endTs - 1 * msDay;
      case '5D': return endTs - 5 * msDay;
      case '1M': { const d = new Date(end); d.setMonth(d.getMonth() - 1); return d.getTime(); }
      case '6M': { const d = new Date(end); d.setMonth(d.getMonth() - 6); return d.getTime(); }
      case '1Y': { const d = new Date(end); d.setFullYear(d.getFullYear() - 1); return d.getTime(); }
      case 'YTD': { const d = new Date(end); d.setMonth(0,1); d.setHours(0,0,0,0); return d.getTime(); }
      default: return 0; // ALL
    }
  })();

  return pfTf === 'ALL' ? s : s.filter(p => p.t >= since);
}, [portfolioLine, pfTf]);

// Change labels
const todayInfo = React.useMemo(() => {
  const s = portfolioLine || [];
  if (!s || s.length < 2) return { color: get('text.muted') as string, text: '+0 (+0.0%) Today' };
  const last = s[s.length - 1].v;
  const prev = s[s.length - 2].v;
  const delta = last - prev;
  const pct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : 0;
  const color = delta > 0 ? (get('semantic.success') as string) : delta < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
  const sign = delta > 0 ? '+' : (delta < 0 ? '' : '+');
  const absDelta = Math.abs(delta);
  const text = `${sign}${absDelta.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${sign}${Math.abs(pct).toFixed(1)}%) Today`;
  return { color, text };
}, [portfolioLine, get]);

const rangeInfo = React.useMemo(() => {
  const s = (visibleSeries && visibleSeries.length >= 2) ? visibleSeries : displaySeries;
  if (!s || s.length < 2) return { color: get('text.muted') as string, text: '+0 (+0.0%)' };
  const first = s[0].v;
  const last = s[s.length - 1].v;
  const delta = last - first;
  const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;
  const color = delta > 0 ? (get('semantic.success') as string) : delta < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
  const sign = delta > 0 ? '+' : (delta < 0 ? '' : '+');
  const absDelta = Math.abs(delta);
  const text = `${sign}${absDelta.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${sign}${Math.abs(pct).toFixed(1)}%)`;
  return { color, text };
}, [visibleSeries, displaySeries, get]);
  const xTickStrategy = React.useMemo(() => {
    if (pfTf === '1D' || pfTf === '5D') {
      return { mode: 'day', every: 1 } as const; // every point
    }
    if (pfTf === '1M') {
      // About ~6 labels across 1M
      const len = (visibleSeries.length ? visibleSeries.length : displaySeries.length) || 0;
      const every = Math.max(1, Math.round(len / 6));
      return { mode: 'day', every } as const;
    }
    // Others: month labels
    return { mode: 'month' } as const;
  }, [pfTf, visibleSeries, displaySeries]);

  const investedValue = rate ? totalUSD * rate : totalUSD;
  const cashValue = rate ? cashUSD * rate : cashUSD;
  const portfolioCount = Object.keys(portfolios || {}).length;
  const holdingsCount = symbols.length;
  const watchlistCount = React.useMemo(() => {
    let n = 0;
    Object.values(portfolios || {}).forEach((p: any) => {
      n += (p?.watchlist || []).length;
    });
    return n;
  }, [portfolios]);

  const perfStats = React.useMemo(() => {
    const arr: Array<{ sym: string; totalReturn: number; pct: number }> = [];
    symbols.forEach(sym => {
      const lots = (effectiveHoldings[sym]?.lots || []) as any[];
      if (!lots.length) return;
      const last = Number(quotes[sym]?.last || 0);
      if (!Number.isFinite(last) || last <= 0) return;
      const pnl = computePnL(lots as any, last);
      if (!pnl.qty) return;
      const cost = pnl.qty * pnl.avgCost;
      const totalReturn = pnl.unrealized;
      if (cost <= 0 && Math.abs(totalReturn) < 1e-2) return;
      const pct = cost > 0 ? (totalReturn / cost) * 100 : 0;
      arr.push({ sym, totalReturn, pct });
    });
    if (!arr.length) return { best: null, worst: null } as const;
    arr.sort((a, b) => b.pct - a.pct);
    const best = arr[0];
    const worst = arr[arr.length - 1];
    return { best, worst } as const;
  }, [symbols, effectiveHoldings, quotes]);

  const heroGradient: [string, string] = isDark
    ? ['#10192f', '#1f2a45']
    : [get('accent.primary') as string, get('accent.secondary') as string];
  const heroText = isDark ? '#eef3ff' : (get('text.onPrimary') as string);
  const heroMuted = withAlpha(heroText, isDark ? 0.74 : 0.78);
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;

  const heroChips = React.useMemo(() => ([
    { label: 'Portfolios', value: String(portfolioCount) },
    { label: 'Holdings', value: String(holdingsCount) },
    { label: 'Watchlist', value: String(watchlistCount) }
  ]), [portfolioCount, holdingsCount, watchlistCount]);

  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;

  const highlightCards = React.useMemo(() => {
    const best = perfStats.best;
    return [
      {
        key: 'invested',
        label: 'Invested assets',
        value: hideAmounts ? '•••' : formatCurrency(Math.max(investedValue, 0), cur),
        caption: `${portfolioCount} portfolios • ${holdingsCount} holdings`
      },
      {
        key: 'cash',
        label: 'Cash cushion',
        value: hideAmounts ? '•••' : formatCurrency(Math.max(cashValue, 0), cur),
        caption: 'Ready to deploy'
      },
      {
        key: 'top',
        label: best ? `${best.sym} mover` : 'Top mover',
        value: best ? `${best.pct >= 0 ? '+' : ''}${best.pct.toFixed(1)}%` : '—',
        caption: best
          ? (hideAmounts ? 'Unrealised return' : `${best.totalReturn >= 0 ? '+' : ''}${formatCurrency(best.totalReturn, cur)} unrealised`)
          : 'Watch for opportunities'
      }
    ];
  }, [hideAmounts, investedValue, cur, portfolioCount, holdingsCount, cashValue, perfStats]);

  const topAllocations = React.useMemo(() => {
    try {
      const positions: Record<string, number> = {};
      Object.values(portfolios || {}).forEach((p: any) => {
        Object.values((p?.holdings || {}) as any).forEach((h: any) => {
          const qty = (h?.lots || []).reduce((s: number, l: any) => s + (l.side === 'buy' ? l.qty : -l.qty), 0);
          if (qty > 0) positions[h.symbol] = (positions[h.symbol] || 0) + qty;
        });
      });
      const syms = Object.keys(positions);
      let total = syms.reduce((acc, sym) => {
        const last = quotes[sym]?.last || 0;
        return acc + last * positions[sym];
      }, 0);
      let cashAll = 0;
      const rates = fxRates?.rates || {} as Record<string, number>;
      Object.values(portfolios || {}).forEach((p: any) => {
        const cash = Number(p?.cash || 0);
        if (!cash) return;
        const base = String(p?.baseCurrency || 'USD').toUpperCase();
        const r = Number(rates[base] || 0);
        cashAll += base === 'USD' || !r ? cash : (cash / r);
      });
      total += cashAll;
      const arr = [
        ...syms.map(sym => {
          const last = quotes[sym]?.last || 0;
          const val = last * positions[sym];
          return { sym, wt: total > 0 ? (val / total) : 0 };
        }),
        ...(cashAll ? [{ sym: 'CASH', wt: total > 0 ? (cashAll / total) : 0 }] : [])
      ].sort((a, b) => b.wt - a.wt).slice(0, 3);
      return arr;
    } catch {
      return [] as Array<{ sym: string; wt: number }>;
    }
  }, [portfolios, quotes, fxRates]);

  const handleAddHoldingQuick = React.useCallback(() => {
    setModalPortfolioId(activePortfolioId || null);
    setCurrentPortfolioId(null);
    setAddMode('holdings');
    setShowAddHolding(true);
  }, [activePortfolioId]);

  const quickActions = [
    {
      key: 'addHold',
      label: 'Add holding',
      onPress: handleAddHoldingQuick
    },
    {
      key: 'watch',
      label: 'Track watchlist',
      onPress: () => {
        setModalPortfolioId(activePortfolioId || null);
        setCurrentPortfolioId(null);
        setAddMode('watchlist');
        setShowAddHolding(true);
      }
    },
    {
      key: 'create',
      label: 'Create portfolio',
      onPress: () => setShowCreateSheet(true)
    },
    {
      key: 'manage',
      label: 'Manage portfolios',
      onPress: () => setShowManager(true)
    }
  ];

  return (
    <ScreenScroll
      refreshing={refreshing}
      onRefresh={async () => { try { await refreshFx(); const syms = allSymbols(); await refreshQuotes(syms && syms.length ? syms : undefined); } catch (e) {} }} inTab>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, gap: spacing.s16 }}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: radius.xl, padding: spacing.s16, gap: spacing.s12 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: spacing.s4 }}>
              <Text style={{ color: heroText, fontSize: 24, fontWeight: '800' }}>Invest studio</Text>
              <Text style={{ color: heroMuted }}>Your portfolio pulse across every account and market.</Text>
            </View>
            <Pressable
              onPress={() => setHideAmounts(v => !v)}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingVertical: spacing.s6,
                paddingHorizontal: spacing.s12,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: withAlpha(heroText, 0.4),
                opacity: pressed ? 0.85 : 1
              })}
            >
              <Text style={{ color: heroText, fontWeight: '600' }}>{hideAmounts ? 'Show amounts' : 'Hide amounts'}</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <Text style={{ color: heroText, fontSize: 34, fontWeight: '800' }}>{hideAmounts ? '•••' : formatCurrency(totalValue, cur)}</Text>
            <Text style={{ color: rangeInfo.color, fontWeight: '600' }}>{hideAmounts ? '•••' : rangeInfo.text}</Text>
          </View>
          <Text style={{ color: todayInfo.color }}>{hideAmounts ? '•••' : todayInfo.text}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
            {heroChips.map((chip, idx) => (
              <View
                key={idx}
                style={{
                  paddingHorizontal: spacing.s12,
                  paddingVertical: spacing.s6,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(heroText, isDark ? 0.18 : 0.24),
                  borderWidth: 1,
                  borderColor: withAlpha(heroText, isDark ? 0.38 : 0.28)
                }}
              >
                <Text style={{ color: heroText, fontWeight: '600' }}>{chip.label}: {chip.value}</Text>
              </View>
            ))}
          </View>

          <View style={{ backgroundColor: withAlpha('#000000', isDark ? 0.3 : 0.1), borderRadius: radius.lg, padding: spacing.s12, gap: spacing.s8 }}>
            <View style={{ marginHorizontal: -spacing.s4 }}>
              <LineChart
                data={visibleSeries.length ? visibleSeries : displaySeries}
                height={160}
                yAxisWidth={28}
                padding={{ left: 6, right: 10, bottom: 17, top: 8 }}
                xTickStrategy={xTickStrategy}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.s8, paddingVertical: spacing.s4 }}
            >
              {(['1D','5D','1M','6M','YTD','1Y','ALL'] as const).map(k => {
                const on = pfTf === k;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    onPress={() => setPfTf(k)}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing.s12,
                      paddingVertical: spacing.s6,
                      borderRadius: radius.pill,
                      backgroundColor: on ? withAlpha(heroText, isDark ? 0.32 : 0.4) : withAlpha('#ffffff', 0.12),
                      opacity: pressed ? 0.85 : 1
                    })}
                  >
                    <Text style={{ color: heroText, fontWeight: '700' }}>{k}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s12 }}>
          {highlightCards.map(card => (
            <View
              key={card.key}
              style={{
                width: 180,
                padding: spacing.s16,
                borderRadius: radius.xl,
                backgroundColor: surface1,
                borderWidth: 1,
                borderColor: borderSubtle,
                gap: spacing.s6
              }}
            >
              <Text style={{ color: textPrimary, fontWeight: '600' }}>{card.label}</Text>
              <Text style={{ color: textPrimary, fontSize: 20, fontWeight: '800' }}>{card.value}</Text>
              <Text style={{ color: textMuted }}>{card.caption}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={{ backgroundColor: surface1, borderRadius: radius.xl, padding: spacing.s16, gap: spacing.s12, borderWidth: 1, borderColor: borderSubtle }}>
          <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Quick actions</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s12 }}>
            {quickActions.map(action => (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                style={({ pressed }) => ({
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(accentPrimary, isDark ? 0.18 : 0.1),
                  borderWidth: 1,
                  borderColor: withAlpha(accentPrimary, isDark ? 0.3 : 0.2),
                  opacity: pressed ? 0.85 : 1
                })}
              >
                <Text style={{ color: accentPrimary, fontWeight: '600' }}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {topAllocations.length ? (
          <View style={{ backgroundColor: surface1, borderRadius: radius.xl, padding: spacing.s16, gap: spacing.s12, borderWidth: 1, borderColor: borderSubtle }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Top allocation</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
              {topAllocations.map(item => (
                <View
                  key={item.sym}
                  style={{
                    paddingHorizontal: spacing.s12,
                    paddingVertical: spacing.s6,
                    borderRadius: radius.pill,
                    backgroundColor: withAlpha(accentSecondary, isDark ? 0.18 : 0.12)
                  }}
                >
                  <Text style={{ color: textPrimary, fontWeight: '600' }}>{item.sym} {(item.wt * 100).toFixed(0)}%</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <PortfolioListCard
        selectionMode={deleteMode}
        selectedIds={selectedPids}
        onToggleSelect={onToggleSelectPid}
        onDeleteSelected={onDeleteSelected}
        onStartDeleteMode={onStartDeleteMode}
        onOpenManager={() => setShowManager(true)}
          onOpenPortfolio={(id) => setCurrentPortfolioId(id)}
          onCreate={() => setShowCreateSheet(true)}
        />
      </View>


      {/* Bottom sheet for adding a holding via symbol search (multi-add) */}
      <AddHoldingSheet
        visible={showAddHolding}
        onClose={() => {
          setShowAddHolding(false);
          if (modalPortfolioId) { setCurrentPortfolioId(modalPortfolioId); }
          setModalPortfolioId(null);
        }}
        portfolioId={modalPortfolioId}
        mode={addMode}
      />
{/* Sheets */}
      <PortfolioDetailSheet
        portfolioId={currentPortfolioId}
        visible={!!currentPortfolioId}
        dimmed={showAddHolding}
        onClose={() => {
          if (!showAddHolding) {
            setCurrentPortfolioId(null);
          }
        }}
        onEditWatchlist={() => { const id = currentPortfolioId; setCurrentPortfolioId(null); nav.navigate('EditWatchlist' as never, { portfolioId: id } as never); }}
        onFilterHoldings={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setShowHoldingsFilter(true); }}
        onSortHoldings={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setShowHoldingsSort(true); }}
        onAddHolding={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setAddMode('holdings'); setShowAddHolding(true); }}
      onOpenManager={() => setShowManager(true)}
      onAddWatchlist={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setAddMode('watchlist'); setShowAddHolding(true); }}
      />

      <HoldingsFilterSheet
        visible={showHoldingsFilter}
        onClose={() => { setShowHoldingsFilter(false); if (modalPortfolioId) { setCurrentPortfolioId(modalPortfolioId); setModalPortfolioId(null); } }}
        valueQuery={qHold}
        onChangeQuery={setQHold}
        valueMinWeight={minWeight}
        onChangeMinWeight={setMinWeight}
        onClear={() => { setQHold(''); setMinWeight(0); }}
      />

      <HoldingsSortSheet
        visible={showHoldingsSort}
        onClose={() => { setShowHoldingsSort(false); if (modalPortfolioId) { setCurrentPortfolioId(modalPortfolioId); setModalPortfolioId(null); } }}
        valueKey={sortKey}
        valueDir={sortDir}
        onChange={(k,d) => { setSortKey(k); setSortDir(d); }}
      />

      <PortfolioManagerModal
        visible={showManager}
        onClose={() => setShowManager(false)}
        onStartDelete={() => { setShowManager(false); onStartDeleteMode(); }}
        onRequestEdit={(id: string) => { setShowManager(false); setEditPortfolioId(id); }}
      />

      <EditPortfolioModal
        visible={!!editPortfolioId}
        onClose={() => setEditPortfolioId(null)}
        portfolioId={editPortfolioId}
      />

      <CreatePortfolioModal
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        defaultCurrency={(profile?.currency || 'SGD').toUpperCase()}
        onConfirm={async (name, currency, type, benchmark) => {
          const id = await (useInvestStore.getState() as any).createPortfolio(name, currency, { type, benchmark: benchmark === 'NONE' ? undefined : benchmark });
          await (useInvestStore.getState() as any).setActivePortfolio(id);
          setShowCreateSheet(false);
          setCurrentPortfolioId(id);
        }}
      />
    </ScreenScroll>
  );
}

export default Invest;
