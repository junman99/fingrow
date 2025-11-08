import React from 'react';
import { Pressable, ScrollView, Text, View, Animated as RNAnimated, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, useAnimatedScrollHandler, interpolate, Extrapolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScroll } from '../../../components/ScreenScroll';
import { spacing, radius } from '../../../theme/tokens';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { useInvestStore } from '../store/invest';
import { formatCurrency } from '../../../lib/format';
import { useProfileStore } from '../../../store/profile';
import { useNavigation } from '@react-navigation/native';
import LineChart from '../../../components/LineChart';
import { computePnL } from '../../../lib/positions';
import { convertCurrency } from '../../../lib/fx';
import PortfolioListCard from '../components/PortfolioListCard';
// CreatePortfolioModal removed - now using CreatePortfolio screen
import PortfolioDetailSheet from '../components/PortfolioDetailSheet';
import AddHoldingSheet from '../components/AddHoldingSheet';
import PortfolioManagerModal from '../components/PortfolioManagerModal';
import EditPortfolioModal from '../components/EditPortfolioModal';
import HoldingsFilterSheet from '../components/HoldingsFilterSheet';
import HoldingsSortSheet from '../components/HoldingsSortSheet';
import Icon from '../../../components/Icon';
import { GlobalIndicesTicker } from '../../../components/GlobalIndicesTicker';

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
  const scaleAnim = React.useRef(new RNAnimated.Value(1)).current;

  const handlePressIn = () => {
    RNAnimated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    RNAnimated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <RNAnimated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </RNAnimated.View>
    </Pressable>
  );
};

export const Invest = React.memo(() => {
  const { get, isDark } = useThemeTokens();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
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

  // Main Tab Title Animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Get invest currency from profile (fallback to primary currency)
  const investCurrency = (profile.investCurrency || profile.currency || 'USD').toUpperCase();

  React.useEffect(() => { hydrate(); refreshFx(); const syms = allSymbols(); refreshQuotes(syms && syms.length ? syms : undefined); }, []);

  const effectiveHoldings: Record<string, any> = React.useMemo(() => {
    const out: Record<string, any> = {};
    Object.values(portfolios || {}).forEach((p:any) => {
      // Skip portfolios with tracking disabled
      if (!p || !p.holdings || (p.trackingEnabled === false)) return;
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
      // Skip portfolios with tracking disabled
      if (!p || (p.trackingEnabled === false)) return;

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

  /**
   * CHART DATA: Portfolio value over time (holdings only, cash excluded)
   *
   * The chart tracks your holdings value historically:
   * - For each date, calculates quantity held at that time (based on transaction dates)
   * - Applies historical prices from quote bars data
   * - Excludes cash balance to show pure investment performance
   * - Leading zeros removed to avoid chart starting from 0 when no holdings exist
   *
   * This gives you a visual representation of how your investments (not cash) have performed.
   */
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
        // Skip portfolios with tracking disabled
        if (!p || (p.trackingEnabled === false)) return;
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
          if (qty > 0) {
            // Get ticker currency and convert price to investment currency
            const h = effectiveHoldings[sym];
            let tickerCurrency = h?.currency;
            if (!tickerCurrency) {
              const s = sym.toUpperCase();
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

            const priceInInvestCurrency = convertCurrency(fxRates, price, tickerCurrency, investCurrency);
            total += qty * priceInInvestCurrency;
          }
        }
      });
      // Exclude cash from chart - only track holdings performance
      // total += cashByDateUSD[d] || 0;
      return { t: new Date(d).getTime(), v: total };
    });

    // Always add/update current value as the final point (using today's live prices)
    const now = Date.now();
    const todayKey = new Date(now).toISOString().slice(0, 10);
    const lastHistoricalDate = dates.length > 0 ? dates[dates.length - 1] : '';

    // Calculate current total value
    let currentTotal = 0;
    syms.forEach(sym => {
      const q = quotes[sym];
      const currentPrice = Number(q?.last || 0);
      if (currentPrice > 0) {
        const lots = positionLots[sym];
        const qty = lots.reduce((s, l) => s + (l.side === 'buy' ? l.qty : -l.qty), 0);
        if (qty > 0) {
          // Get ticker currency and convert to investment currency
          const h = effectiveHoldings[sym];
          let tickerCurrency = h?.currency;
          if (!tickerCurrency) {
            const s = sym.toUpperCase();
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

          const priceInInvestCurrency = convertCurrency(fxRates, currentPrice, tickerCurrency, investCurrency);
          currentTotal += qty * priceInInvestCurrency;
        }
      }
    });

    // If today is different from last historical date, add a new point
    // Otherwise, replace the last point with current value (for intraday updates)
    if (lastHistoricalDate !== todayKey) {
      points.push({ t: now, v: currentTotal });
    } else if (points.length > 0) {
      // Update the last point with current live price
      points[points.length - 1] = { t: now, v: currentTotal };
    } else {
      // No historical data at all, just add current point
      points.push({ t: now, v: currentTotal });
    }

    // Remove leading zeros to avoid chart starting from 0 when there's no data
    let firstNonZeroIndex = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i].v > 0) {
        firstNonZeroIndex = i;
        break;
      }
    }

    // Return only non-zero portion, limited to last 520 points
    const nonZeroPoints = points.slice(firstNonZeroIndex);
    return nonZeroPoints.slice(-520);
  }, [showChart, effectiveHoldings, quotes, rate, portfolios, fxRates, investCurrency]);

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

    const filtered = pfTf === 'ALL' ? s : s.filter(p => p.t >= since);

    // Remove leading zeros from filtered series
    let firstNonZero = 0;
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].v > 0) {
        firstNonZero = i;
        break;
      }
    }

    return filtered.slice(firstNonZero);
  }, [portfolioLine, pfTf]);

  /**
   * CALCULATION METHODOLOGY: Modified Money-Weighted Return (MWR)
   *
   * This implementation calculates portfolio performance using a modified money-weighted approach:
   * - Includes the timing of your buy/sell transactions (when YOU bought/sold)
   * - Excludes cash deposits/withdrawals (to show pure investment performance)
   * - Shows YOUR actual returns, accounting for your entry/exit timing
   *
   * This differs from Time-Weighted Return (TWR) used by Yahoo Finance:
   * - TWR eliminates all cash flow effects completely
   * - TWR shows how the investments performed independent of timing
   * - TWR is better for comparing to benchmarks
   *
   * Our approach is better for individual investors because it shows your ACTUAL returns,
   * accounting for when you made your investment decisions.
   *
   * Example:
   * - You buy 10 shares @ $100 = $1,000
   * - Stock rises to $150 (+50%)
   * - You buy 10 more @ $150 = $1,500
   * - Stock drops to $120
   *
   * TWR (Yahoo): ~+20% (pure stock performance, ignoring your timing)
   * MWR (Ours): ~+10% (YOUR actual return, accounting for buying more at $150)
   */

  const todayInfo = React.useMemo(() => {
    // Calculate today's change based on actual price movements, not chart data points
    let totalDayChange = 0;

    Object.values(portfolios || {}).forEach((p: any) => {
      if (!p || (p.trackingEnabled === false)) return;

      Object.values(p.holdings || {}).forEach((h: any) => {
        const lots = h?.lots || [];
        const qty = lots.reduce((s: number, l: any) => s + (l.side === 'buy' ? l.qty : -l.qty), 0);
        if (qty <= 0) return;

        const q = quotes[h.symbol];
        const changeNative = Number(q?.change || 0);

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

        // Convert change from ticker currency to investment currency
        const change = convertCurrency(fxRates, changeNative, tickerCurrency, investCurrency);
        totalDayChange += change * qty;
      });
    });

    const delta = totalDayChange;
    const valueYesterday = holdingsValue - delta;
    const pct = valueYesterday !== 0 ? (delta / Math.abs(valueYesterday)) * 100 : 0;
    const color = delta > 0 ? (get('semantic.success') as string) : delta < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
    const sign = delta > 0 ? '+' : '';
    const text = `${sign}${formatCurrency(Math.abs(delta), cur)} (${sign}${Math.abs(pct).toFixed(2)}%)`;
    return { color, text };
  }, [portfolios, quotes, fxRates, investCurrency, holdingsValue, get, cur]);

  const rangeInfo = React.useMemo(() => {
    const labels: Record<typeof pfTf, string> = {
      '1D': '1 Day Gain/Loss',
      '5D': '5 Day Gain/Loss',
      '1M': '1 Month Gain/Loss',
      '6M': '6 Month Gain/Loss',
      'YTD': 'YTD Gain/Loss',
      '1Y': '1 Year Gain/Loss',
      'ALL': 'All-Time Gain/Loss',
    };

    // For ALL interval, show total P&L (realized + unrealized)
    if (pfTf === 'ALL') {
      let totalGain = 0;
      let totalCost = 0;

      Object.values(portfolios || {}).forEach((p: any) => {
        if (!p || (p.trackingEnabled === false)) return;

        Object.values(p.holdings || {}).forEach((h: any) => {
          const lots = h?.lots || [];
          if (!lots.length) return;

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

          const q = quotes[h.symbol];
          const lastNative = Number(q?.last || 0);
          const last = convertCurrency(fxRates, lastNative, tickerCurrency, investCurrency);

          // Convert lot prices to investment currency
          const normalizedLots = lots.map((l: any) => ({
            ...l,
            price: convertCurrency(fxRates, l.price || 0, tickerCurrency, investCurrency),
            fee: convertCurrency(fxRates, (l.fee ?? l.fees) || 0, tickerCurrency, investCurrency)
          }));

          const pnl = computePnL(normalizedLots, last);
          totalGain += (pnl.realized || 0) + (pnl.unrealized || 0);

          // Calculate cost basis
          const currentQty = lots.reduce((acc: number, lot: any) => acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
          if (currentQty > 0) {
            totalCost += pnl.qty * pnl.avgCost;
          }
        });
      });

      const pct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
      const color = totalGain > 0 ? (get('semantic.success') as string) : totalGain < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
      const sign = totalGain > 0 ? '+' : '';
      const text = `${sign}${formatCurrency(Math.abs(totalGain), cur)} (${sign}${Math.abs(pct).toFixed(2)}%)`;
      return { color, text, label: labels[pfTf] };
    }

    // For time-based intervals, calculate P&L change during that period (excluding cash deposits/withdrawals)
    const now = Date.now();
    let days = 30;
    switch (pfTf) {
      case '1D': days = 1; break;
      case '5D': days = 5; break;
      case '1M': days = 30; break;
      case '6M': days = 180; break;
      case 'YTD': {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
        days = Math.ceil((now - startOfYear) / (24 * 60 * 60 * 1000));
        break;
      }
      case '1Y': days = 365; break;
    }

    const startTime = now - (days * 24 * 60 * 60 * 1000);

    // Calculate P&L at start and current, tracking cost basis
    let pnlAtStart = 0;
    let currentPnL = 0;
    let currentCostBasis = 0;

    Object.values(portfolios || {}).forEach((p: any) => {
      if (!p || (p.trackingEnabled === false)) return;

      Object.values(p.holdings || {}).forEach((h: any) => {
        if (!h || !h.lots) return;

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

        const q = quotes[h.symbol];
        if (!q) return;

        // Calculate current P&L
        const currentQty = h.lots.reduce((acc: number, lot: any) => acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
        if (currentQty > 0) {
          const lastNative = Number(q.last || 0);
          const last = convertCurrency(fxRates, lastNative, tickerCurrency, investCurrency);

          const normalizedLots = h.lots.map((l: any) => ({
            ...l,
            price: convertCurrency(fxRates, l.price || 0, tickerCurrency, investCurrency),
            fee: convertCurrency(fxRates, (l.fee ?? l.fees) || 0, tickerCurrency, investCurrency)
          }));

          const pnl = computePnL(normalizedLots, last);
          currentPnL += (pnl.realized || 0) + (pnl.unrealized || 0);
          currentCostBasis += pnl.qty * pnl.avgCost;
        }

        // Calculate P&L at start time
        const lotsAtStart = h.lots.filter((lot: any) => new Date(lot.date).getTime() <= startTime);
        if (lotsAtStart.length === 0) return;

        // Get price at start time from bars
        let priceAtStartNative = q.last; // fallback to current
        if (q.bars && q.bars.length > 0) {
          for (let j = q.bars.length - 1; j >= 0; j--) {
            if (q.bars[j].t <= startTime) {
              priceAtStartNative = q.bars[j].c;
              break;
            }
          }
        }
        const priceAtStart = convertCurrency(fxRates, priceAtStartNative, tickerCurrency, investCurrency);

        const normLotsAtStart = lotsAtStart.map((l: any) => ({
          ...l,
          price: convertCurrency(fxRates, l.price || 0, tickerCurrency, investCurrency),
          fee: convertCurrency(fxRates, (l.fee ?? l.fees) || 0, tickerCurrency, investCurrency)
        }));

        const pnlStart = computePnL(normLotsAtStart, priceAtStart);
        pnlAtStart += (pnlStart.realized || 0) + (pnlStart.unrealized || 0);
      });
    });

    const pnlChange = currentPnL - pnlAtStart;
    const pct = currentCostBasis > 0 ? (pnlChange / currentCostBasis) * 100 : 0;
    const color = pnlChange > 0 ? (get('semantic.success') as string) : pnlChange < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
    const sign = pnlChange > 0 ? '+' : '';
    const text = `${sign}${formatCurrency(Math.abs(pnlChange), cur)} (${sign}${Math.abs(pct).toFixed(2)}%)`;

    return { color, text, label: labels[pfTf] };
  }, [pfTf, portfolios, quotes, fxRates, investCurrency, get, cur]);

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
      // Skip portfolios with tracking disabled
      if (!p || (p.trackingEnabled === false)) return;
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
  const bgDefault = get('background.default') as string;

  // Main Tab Title Animation - Animated Styles
  const originalTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity: 1 - progress,
    };
  });

  const floatingTitleAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    const fontSize = interpolate(progress, [0, 1], [28, 20]);
    const fontWeight = interpolate(progress, [0, 1], [800, 700]);

    return {
      fontSize,
      fontWeight: fontWeight.toString() as any,
      opacity: progress >= 1 ? 1 : progress,
    };
  });

  const gradientAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity: progress >= 1 ? 1 : progress,
    };
  });

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
        // Skip portfolios with tracking disabled
        if (!p || (p.trackingEnabled === false)) return;
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
        // Skip portfolios with tracking disabled
        if (!p || (p.trackingEnabled === false)) return;
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
    <>
      {/* Main Tab Title Animation - Floating Gradient Header (Fixed at top, outside scroll) */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            pointerEvents: 'none',
          },
          gradientAnimatedStyle,
        ]}
      >
        <LinearGradient
          colors={[
            bgDefault,
            bgDefault,
            withAlpha(bgDefault, 0.95),
            withAlpha(bgDefault, 0.8),
            withAlpha(bgDefault, 0.5),
            withAlpha(bgDefault, 0)
          ]}
          style={{
            paddingTop: insets.top + spacing.s16,
            paddingBottom: spacing.s32 + spacing.s20,
            paddingHorizontal: spacing.s16,
          }}
        >
          <Animated.Text
            style={[
              {
                color: textPrimary,
                fontSize: 20,
                fontWeight: '700',
                letterSpacing: -0.5,
                textAlign: 'center',
              },
              floatingTitleAnimatedStyle,
            ]}
          >
            Invest
          </Animated.Text>
        </LinearGradient>
      </Animated.View>

      <ScreenScroll
        refreshing={refreshing}
        onRefresh={async () => { try { await refreshFx(); const syms = allSymbols(); await refreshQuotes(syms && syms.length ? syms : undefined); } catch (e) {} }}
        inTab
        fullScreen
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentStyle={{
          paddingTop: insets.top + spacing.s16,
          paddingBottom: spacing.s32,
        }}
      >
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s4 }}>
          <Animated.Text style={[{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.s2 }, originalTitleAnimatedStyle]}>
            Invest
          </Animated.Text>
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
              {hideAmounts ? '••••••' : formatCurrency(totalValue, cur).replace(/[^\d,.-]/g, '')}
            </Text>
            <Text style={{ color: textMuted, fontSize: 14, marginLeft: spacing.s6, fontWeight: '600' }}>
              {cur}
            </Text>
          </View>
          <Text style={{ color: textMuted, fontSize: 12, marginBottom: spacing.s8 }}>
            {hideAmounts ? '•••' : `Holdings: ${formatCurrency(holdingsValue, cur).replace(/[^\d,.-]/g, '')} ${cur}`} · {hideAmounts ? '•••' : `Cash: ${formatCurrency(cashValue, cur).replace(/[^\d,.-]/g, '')} ${cur}`}
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
                    style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}
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
    </>
  );
});

Invest.displayName = 'Invest';

export default Invest;
