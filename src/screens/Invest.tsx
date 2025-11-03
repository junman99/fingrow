import React from 'react';
import { Pressable, ScrollView, Text, View, Animated } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useInvestStore } from '../store/invest';
import { formatCurrency } from '../lib/format';
import { useProfileStore } from '../store/profile';
import { useNavigation } from '@react-navigation/native';
import LineChart from '../components/LineChart';
import { computePnL } from '../lib/positions';
import { convertCurrency } from '../lib/fx';
import PortfolioListCard from '../components/invest/PortfolioListCard';
// CreatePortfolioModal removed - now using CreatePortfolio screen
import PortfolioDetailSheet from '../components/invest/PortfolioDetailSheet';
import AddHoldingSheet from '../components/invest/AddHoldingSheet';
import PortfolioManagerModal from '../components/invest/PortfolioManagerModal';
import EditPortfolioModal from '../components/invest/EditPortfolioModal';
import HoldingsFilterSheet from '../components/invest/HoldingsFilterSheet';
import HoldingsSortSheet from '../components/invest/HoldingsSortSheet';
import Icon from '../components/Icon';
import { GlobalIndicesTicker } from '../components/GlobalIndicesTicker';

function withAlpha(hex: string, alpha: number) {
  if (!hex) return hex;
  const raw = hex.replace('#', '');
  const bigint = parseInt(raw.length === 3 ? raw.repeat(2) : raw, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Animated pressable component
const AnimatedPressable: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
}> = ({ onPress, children, style }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export const Invest = React.memo(() => {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const [pfTf, setPfTf] = React.useState<'1D'|'5D'|'1M'|'6M'|'YTD'|'1Y'|'ALL'>('6M');
  const [hideAmounts, setHideAmounts] = React.useState(false);
  const [showChart, setShowChart] = React.useState(true);
  // Removed showCreateSheet state - now using navigation
  const [showManager, setShowManager] = React.useState(false);
  const [showAddHolding, setShowAddHolding] = React.useState(false);
  const [addMode, setAddMode] = React.useState<'holdings'|'watchlist'>('holdings');
  const [portfolioDefaultTab, setPortfolioDefaultTab] = React.useState<'Holdings'|'Watchlist'|'Cash'>('Holdings');
  const [editPortfolioId, setEditPortfolioId] = React.useState<string | null>(null);
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

  // Debug currentPortfolioId changes
  React.useEffect(() => {
    console.log('🔵 [Invest] currentPortfolioId changed:', currentPortfolioId);
  }, [currentPortfolioId]);

  // Close portfolio detail sheet when navigating away from Invest screen
  React.useEffect(() => {
    const unsubscribe = nav.addListener('blur', () => {
      setCurrentPortfolioId(null);
    });
    return unsubscribe;
  }, [nav]);

  const [modalPortfolioId, setModalPortfolioId] = React.useState<string|null>(null);
  const [showHoldingsFilter, setShowHoldingsFilter] = React.useState(false);
  const [showHoldingsSort, setShowHoldingsSort] = React.useState(false);
  const [qHold, setQHold] = React.useState('');
  const [minWeight, setMinWeight] = React.useState(0);
  const [sortKey, setSortKey] = React.useState<'mv'|'pnlAbs'|'pnlPct'|'ticker'>('mv');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('desc');

  const { portfolios, quotes, hydrate, refreshQuotes, refreshing, error, fxRates, refreshFx, allSymbols, lastUpdated } = useInvestStore();
  const activePortfolioId = useInvestStore(state => state.activePortfolioId);
  const { profile } = useProfileStore();

  // Get invest currency from profile (fallback to primary currency)
  const investCurrency = (profile.investCurrency || profile.currency || 'USD').toUpperCase();

  React.useEffect(() => { hydrate(); refreshFx(); const syms = allSymbols(); refreshQuotes(syms && syms.length ? syms : undefined); }, []);

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

  // Calculate total value by summing all portfolios (each converted to investment currency)
  const { totalValue, holdingsValue } = React.useMemo(() => {
    let totalHoldings = 0;
    let totalCash = 0;

    Object.values(portfolios || {}).forEach((p: any) => {
      if (!p) return;

      // Calculate holdings value for this portfolio (converted to investment currency)
      let portfolioHoldingsValue = 0;
      Object.values(p.holdings || {}).forEach((h: any) => {
        const lots = h?.lots || [];
        const qty = lots.reduce((s: number, l: any) => s + (l.side === 'buy' ? l.qty : -l.qty), 0);
        if (qty <= 0) return;

        const q = quotes[h.symbol];
        const lastNative = Number(q?.last || 0);

        // Get ticker currency
        let tickerCurrency = h.currency;
        if (!tickerCurrency) {
          const s = h.symbol.toUpperCase();
          if (s.includes('-USD') || s.includes('USD')) tickerCurrency = 'USD';
          else if (s.endsWith('.L')) tickerCurrency = 'GBP';
          else if (s.endsWith('.T')) tickerCurrency = 'JPY';
          else if (s.endsWith('.TO')) tickerCurrency = 'CAD';
          else if (s.endsWith('.AX')) tickerCurrency = 'AUD';
          else if (s.endsWith('.HK')) tickerCurrency = 'HKD';
          else if (s.endsWith('.PA') || s.endsWith('.DE')) tickerCurrency = 'EUR';
          else if (s.endsWith('.SW')) tickerCurrency = 'CHF';
          else tickerCurrency = 'USD';
        }
        tickerCurrency = String(tickerCurrency).toUpperCase();

        // Convert ticker price to investment currency
        const last = convertCurrency(fxRates, lastNative, tickerCurrency, investCurrency);
        portfolioHoldingsValue += qty * last;
      });

      // Convert cash from portfolio currency to investment currency
      const portfolioBaseCurrency = String(p.baseCurrency || 'USD').toUpperCase();
      const cash = Number(p.cash || 0);
      const portfolioCashValue = convertCurrency(fxRates, cash, portfolioBaseCurrency, investCurrency);

      totalHoldings += portfolioHoldingsValue;
      totalCash += portfolioCashValue;
    });

    return {
      holdingsValue: totalHoldings,
      totalValue: totalHoldings + totalCash
    };
  }, [portfolios, quotes, fxRates, investCurrency]);

  const cur = investCurrency;
  const cashValue = totalValue - holdingsValue;

  // For portfolioLine chart calculation compatibility
  const rate = 1; // Chart calculation will be updated later to handle multi-currency properly

  const portfolioLine = React.useMemo(() => {
    // Skip expensive calculation if chart is hidden
    if (!showChart) return [] as Array<{t:number; v:number}>;

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
    const allDates = new Set<string>();
    Object.values(priceMaps).forEach(m => Object.keys(m).forEach(d => allDates.add(d)));
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
    const dates = Array.from(allDates).sort();

    const ff: Record<string, Record<string, number>> = {};
    syms.forEach(sym => {
      const src = priceMaps[sym] || {};
      const dst: Record<string, number> = {};
      let lastKnown: number | undefined;
      for (const d of dates) {
        if (Object.prototype.hasOwnProperty.call(src, d)) {
          const val = src[d];
          if (lastKnown && (val > lastKnown * 5 || val < lastKnown / 5)) {
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
      // Exclude cash from chart - only track holdings performance
      // total += cashByDateUSD[d] || 0;
      return { t: new Date(d).getTime(), v: (rate || 1) * total };
    });
    return points.slice(-520);
  }, [showChart, effectiveHoldings, quotes, rate, portfolios, fxRates]);

  const displaySeries = React.useMemo(() => {
    if (portfolioLine && portfolioLine.length) return portfolioLine;
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    return Array.from({ length: 14 }, (_, i) => ({ t: now - (13 - i) * day, v: 0 }));
  }, [portfolioLine]);

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
        default: return 0;
      }
    })();

    return pfTf === 'ALL' ? s : s.filter(p => p.t >= since);
  }, [portfolioLine, pfTf]);

  const todayInfo = React.useMemo(() => {
    const s = portfolioLine || [];
    if (!s || s.length < 2) return { color: get('text.muted') as string, text: `+${formatCurrency(0, cur)} (+0.0%)` };
    const last = s[s.length - 1].v;
    const prev = s[s.length - 2].v;
    const delta = last - prev;
    const pct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : 0;
    const color = delta > 0 ? (get('semantic.success') as string) : delta < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
    const sign = delta > 0 ? '+' : '';
    const text = `${sign}${formatCurrency(Math.abs(delta), cur)} (${sign}${Math.abs(pct).toFixed(2)}%)`;
    return { color, text };
  }, [portfolioLine, get, cur]);

  const rangeInfo = React.useMemo(() => {
    const s = (visibleSeries && visibleSeries.length >= 2) ? visibleSeries : displaySeries;
    if (!s || s.length < 2) return { color: get('text.muted') as string, text: `+${formatCurrency(0, cur)} (+0.0%)`, label: 'All-Time Gain/Loss' };
    const first = s[0].v;
    const last = s[s.length - 1].v;
    const delta = last - first;
    const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;
    const color = delta > 0 ? (get('semantic.success') as string) : delta < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
    const sign = delta > 0 ? '+' : '';
    const text = `${sign}${formatCurrency(Math.abs(delta), cur)} (${sign}${Math.abs(pct).toFixed(2)}%)`;

    const labels: Record<typeof pfTf, string> = {
      '1D': '1 Day Gain/Loss',
      '5D': '5 Day Gain/Loss',
      '1M': '1 Month Gain/Loss',
      '6M': '6 Month Gain/Loss',
      'YTD': 'YTD Gain/Loss',
      '1Y': '1 Year Gain/Loss',
      'ALL': 'All-Time Gain/Loss',
    };

    return { color, text, label: labels[pfTf] };
  }, [visibleSeries, displaySeries, get, cur, pfTf]);

  const xTickStrategy = React.useMemo(() => {
    if (pfTf === '1D' || pfTf === '5D') {
      return { mode: 'day', every: 1 } as const;
    }
    if (pfTf === '1M') {
      const len = (visibleSeries.length ? visibleSeries.length : displaySeries.length) || 0;
      const every = Math.max(1, Math.round(len / 6));
      return { mode: 'day', every } as const;
    }
    return { mode: 'month' } as const;
  }, [pfTf, visibleSeries, displaySeries]);

  const lastRefreshedText = React.useMemo(() => {
    if (!lastUpdated) return 'Never refreshed';
    const now = Date.now();
    const diff = now - lastUpdated;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(lastUpdated).toLocaleDateString();
  }, [lastUpdated]);

  const investedValue = holdingsValue;
  // cashValue is already defined above as totalValue - holdingsValue
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

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
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
        caption: `${portfolioCount} portfolios • ${holdingsCount} holdings`,
        icon: 'trending-up' as const,
      },
      {
        key: 'cash',
        label: 'Cash ready',
        value: hideAmounts ? '•••' : formatCurrency(Math.max(cashValue, 0), cur),
        caption: 'Ready to deploy',
        icon: 'dollar-sign' as const,
      },
      {
        key: 'top',
        label: best ? `${best.sym} mover` : 'Top mover',
        value: best ? `${best.pct >= 0 ? '+' : ''}${best.pct.toFixed(1)}%` : '—',
        caption: best
          ? (hideAmounts ? 'Unrealised return' : `${best.totalReturn >= 0 ? '+' : ''}${formatCurrency(best.totalReturn, cur)} unrealised`)
          : 'Watch for opportunities',
        icon: 'zap' as const,
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


  console.log('🔍 [Invest] Rendering. States:', {
    currentPortfolioId,
    showAddHolding,
    showHoldingsFilter,
    showHoldingsSort,
    showManager,
    editPortfolioId,
    portfolioCount: Object.keys(portfolios || {}).length
  });

  return (
    <ScreenScroll
      refreshing={refreshing}
      onRefresh={async () => { try { await refreshFx(); const syms = allSymbols(); await refreshQuotes(syms && syms.length ? syms : undefined); } catch (e) {} }}
      inTab
    >
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s4 }}>
          <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>
            Invest
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <AnimatedPressable onPress={() => setShowChart(v => !v)}>
              <View
                style={{
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.pill,
                  backgroundColor: showChart ? accentPrimary : surface1,
                }}
              >
                <Icon name="bar-chart-2" size={16} color={showChart ? (get('text.onPrimary') as string) : textPrimary} />
              </View>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => setHideAmounts(v => !v)}>
              <View
                style={{
                  paddingVertical: spacing.s8,
                  paddingHorizontal: spacing.s12,
                  borderRadius: radius.pill,
                  backgroundColor: surface1,
                }}
              >
                <Icon name={hideAmounts ? 'eye-off' : 'eye'} size={16} color={textPrimary} />
              </View>
            </AnimatedPressable>
          </View>
        </View>

        {/* Global Indices Ticker */}
        <View style={{ marginLeft: -spacing.s16, marginRight: -spacing.s16, marginBottom: spacing.s16 }}>
          <GlobalIndicesTicker />
        </View>

        {/* Value Display */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.s4 }}>
            <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 }}>
              {hideAmounts ? '••••••' : totalValue.toFixed(2)}
            </Text>
            <Text style={{ color: textMuted, fontSize: 14, marginLeft: spacing.s6, fontWeight: '600' }}>
              {cur}
            </Text>
          </View>
          <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s8 }}>
            {hideAmounts ? '•••' : `Holdings: ${holdingsValue.toFixed(2)} ${cur}`} · {hideAmounts ? '•••' : `Cash: ${cashValue.toFixed(2)} ${cur}`}
          </Text>

          {/* Day's Gain */}
          <View style={{ marginBottom: spacing.s4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <Text style={{ color: todayInfo.color, fontWeight: '700', fontSize: 16 }}>
                {hideAmounts ? '•••' : todayInfo.text}
              </Text>
              <Text style={{ color: textMuted, fontSize: 12 }}>Today's Change</Text>
            </View>
          </View>

          {/* Interval Gain */}
          <View style={{ marginBottom: spacing.s20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <Text style={{ color: rangeInfo.color, fontWeight: '700', fontSize: 16 }}>
                {hideAmounts ? '•••' : rangeInfo.text}
              </Text>
              <Text style={{ color: textMuted, fontSize: 12 }}>{rangeInfo.label}</Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        {showChart && (
          <View style={{ gap: spacing.s8, marginLeft: -spacing.s16, marginRight: -spacing.s16, marginBottom: spacing.s16 }}>
            <LineChart
              data={visibleSeries.length ? visibleSeries : displaySeries}
              height={180}
              yAxisWidth={0}
              padding={{ left: 16, right: 16, bottom: 20, top: 10 }}
              xTickStrategy={xTickStrategy}
              currency={cur}
            />

            {/* Last Refreshed */}
            <Text style={{ color: textMuted, fontSize: 11, paddingHorizontal: spacing.s16 }}>
              Last refreshed: {lastRefreshedText}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.s16 }}>
              {(['1D','5D','1M','6M','YTD','1Y','ALL'] as const).map(k => {
                const on = pfTf === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setPfTf(k)}
                  >
                    <Text
                      style={{
                        color: on ? accentPrimary : textMuted,
                        fontSize: on ? 15 : 13,
                        fontWeight: on ? '800' : '600',
                      }}
                    >
                      {k}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Portfolio List */}
        <View style={{ marginBottom: spacing.s16 }}>
          <PortfolioListCard
            selectionMode={deleteMode}
            selectedIds={selectedPids}
            onToggleSelect={onToggleSelectPid}
            onDeleteSelected={onDeleteSelected}
            onStartDeleteMode={onStartDeleteMode}
            onOpenManager={() => setShowManager(true)}
            onOpenPortfolio={(id) => {
              console.log('🟢 [Invest] onOpenPortfolio callback called with id:', id);
              nav.navigate('PortfolioDetail', { portfolioId: id });
            }}
            onCreate={() => nav.navigate('CreatePortfolio')}
          />
        </View>

        {/* DCA Planning Action */}
        <AnimatedPressable onPress={() => nav.navigate('DCAPlanner' as never)}>
          <View
            style={{
              backgroundColor: withAlpha(accentPrimary, isDark ? 0.2 : 0.12),
              borderRadius: radius.lg,
              padding: spacing.s16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: accentPrimary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="target" size={22} color={get('text.onPrimary') as string} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>
                  Plan DCA Strategy
                </Text>
                <Text style={{ color: textMuted, fontSize: 13, marginTop: 2 }}>
                  Compare indices & project returns
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={20} colorToken="text.muted" />
          </View>
        </AnimatedPressable>
      </View>

      {showAddHolding && (
        <AddHoldingSheet
          visible={true}
          onClose={() => {
            setShowAddHolding(false);
            if (modalPortfolioId) {
              setCurrentPortfolioId(modalPortfolioId);
              // Set the default tab based on what mode was used
              setPortfolioDefaultTab(addMode === 'watchlist' ? 'Watchlist' : 'Holdings');
            }
            setModalPortfolioId(null);
          }}
          portfolioId={modalPortfolioId}
          mode={addMode}
        />
      )}

      {currentPortfolioId && (
        <PortfolioDetailSheet
          portfolioId={currentPortfolioId}
          visible={!!currentPortfolioId}
          dimmed={showAddHolding}
          defaultTab={portfolioDefaultTab}
          onClose={() => {
            console.log('🟡 [Invest] PortfolioDetailSheet onClose called');
            if (!showAddHolding) {
              setCurrentPortfolioId(null);
              setPortfolioDefaultTab('Holdings'); // Reset to default
            }
          }}
          onEditWatchlist={() => { const id = currentPortfolioId; setCurrentPortfolioId(null); nav.navigate('EditWatchlist' as never, { portfolioId: id } as never); }}
          onFilterHoldings={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setShowHoldingsFilter(true); }}
          onSortHoldings={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setShowHoldingsSort(true); }}
          onAddHolding={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setAddMode('watchlist'); setShowAddHolding(true); }}
          onOpenManager={() => setShowManager(true)}
          onAddWatchlist={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setAddMode('watchlist'); setShowAddHolding(true); }}
        />
      )}

      {showHoldingsFilter && (
        <HoldingsFilterSheet
          visible={true}
          onClose={() => { setShowHoldingsFilter(false); if (modalPortfolioId) { setCurrentPortfolioId(modalPortfolioId); setModalPortfolioId(null); } }}
          valueQuery={qHold}
          onChangeQuery={setQHold}
          valueMinWeight={minWeight}
          onChangeMinWeight={setMinWeight}
          onClear={() => { setQHold(''); setMinWeight(0); }}
        />
      )}

      {showHoldingsSort && (
        <HoldingsSortSheet
          visible={true}
          onClose={() => { setShowHoldingsSort(false); if (modalPortfolioId) { setCurrentPortfolioId(modalPortfolioId); setModalPortfolioId(null); } }}
          valueKey={sortKey}
          valueDir={sortDir}
          onChange={(k,d) => { setSortKey(k); setSortDir(d); }}
        />
      )}

      {showManager && (
        <PortfolioManagerModal
          visible={true}
          onClose={() => setShowManager(false)}
          onStartDelete={() => { setShowManager(false); onStartDeleteMode(); }}
          onRequestEdit={(id: string) => { setShowManager(false); setEditPortfolioId(id); }}
        />
      )}

      {editPortfolioId && (
        <EditPortfolioModal
          visible={true}
          onClose={() => setEditPortfolioId(null)}
          portfolioId={editPortfolioId}
        />
      )}

    </ScreenScroll>
  );
});

Invest.displayName = 'Invest';

export default Invest;
