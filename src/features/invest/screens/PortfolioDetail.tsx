import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import { useInvestStore } from '../store/invest';
import { useProfileStore } from '../store/profile';
import Icon from '../components/Icon';
import { formatCurrency } from '../lib/format';
import { computePnL } from '../lib/positions';
import { convertCurrency } from '../lib/fx';
import LineChart from '../components/LineChart';
import WatchRow from '../components/WatchRow';
import HoldingRow from '../components/HoldingRow';
import AddHoldingSheet from '../components/AddHoldingSheet';
import HoldingsFilterSheet from '../components/HoldingsFilterSheet';
import HoldingsSortSheet from '../components/HoldingsSortSheet';
import PopoverMenu from '../components/PopoverMenu';

function withAlpha(color: string, alpha: number) {
  if (!color) return color;
  const raw = color.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type TimeInterval = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | 'ALL';

export default function PortfolioDetail() {
  const { get, isDark } = useThemeTokens();
  const route = useRoute<any>();
  const nav = useNavigation<any>();

  const portfolioId = route.params?.portfolioId as string;
  const { portfolios, quotes, lastUpdated, refreshQuotes, fxRates } = useInvestStore();
  const setPortfolioTracking = useInvestStore(state => state.setPortfolioTracking);
  const { profile } = useProfileStore();
  const p = portfolios[portfolioId];

  const [selectedInterval, setSelectedInterval] = React.useState<TimeInterval>('6M');
  const [viewMode, setViewMode] = React.useState<'watchlist' | 'holdings' | 'cash'>('watchlist');
  const [showAddSheet, setShowAddSheet] = React.useState(false);
  const [showFilterSheet, setShowFilterSheet] = React.useState(false);
  const [showSortSheet, setShowSortSheet] = React.useState(false);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const menuBtnRef = React.useRef<View>(null);

  // Use portfolio's own currency for all displays in this screen
  const portfolioCurrency = (p?.baseCurrency || 'USD').toUpperCase();

  // Filter and sort state
  const [filterQuery, setFilterQuery] = React.useState('');
  const [minWeight, setMinWeight] = React.useState(0);
  const [sortKey, setSortKey] = React.useState<'mv' | 'pnlAbs' | 'pnlPct' | 'ticker'>('mv');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;
  const successColor = get('semantic.success') as string;
  const dangerColor = get('semantic.danger') as string;
  const bgDefault = get('background.default') as string;

  const summary = React.useMemo(() => {
    if (!p) return null;
    const base = portfolioCurrency;

    let holdingsValue = 0;
    let dayDelta = 0;
    let totalGain = 0;
    const openRows: Array<{ sym: string; value: number }> = [];

    Object.values(p.holdings || {}).forEach((h: any) => {
      if (!h) return;
      const lots = h.lots || [];
      const qty = lots.reduce((acc: number, lot: any) => acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
      if (qty <= 0) return;

      const q = quotes[h.symbol];

      // Get ticker currency: use holding metadata, or infer from symbol
      let holdingCurrency = h.currency;
      if (!holdingCurrency) {
        // Infer from symbol pattern
        const s = h.symbol.toUpperCase();
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

      // Convert stock price from its native currency to invest currency
      const lastNative = q?.last || 0;
      const changeNative = q?.change || 0;
      const last = convertCurrency(fxRates, lastNative, holdingCurrency, base);
      const change = convertCurrency(fxRates, changeNative, holdingCurrency, base);

      const value = last * qty;
      holdingsValue += value;
      dayDelta += change * qty;

      // Lot prices are in the stock's native currency, convert to invest currency for P&L
      const norm = lots.map((l: any) => ({
        ...l,
        price: convertCurrency(fxRates, l.price || 0, holdingCurrency, base),
        fee: convertCurrency(fxRates, (l.fee ?? l.fees) || 0, holdingCurrency, base)
      }));
      const pnl = computePnL(norm, last);
      totalGain += pnl.realized + pnl.unrealized;
      openRows.push({ sym: h.symbol, value });
    });

    // Convert cash from portfolio base currency to investment currency
    const portfolioBaseCurrency = String(p.baseCurrency || 'USD').toUpperCase();
    const cashValue = convertCurrency(fxRates, Number(p.cash || 0), portfolioBaseCurrency, base);
    const totalValue = holdingsValue + cashValue;
    const positions = openRows.length;

    return { base, totalValue, holdingsValue, cashValue, dayDelta, totalGain, positions, openHoldings: openRows.map(r => r.sym) };
  }, [p, quotes, fxRates, portfolioCurrency]);

  // Filter and sort holdings
  const filteredAndSortedHoldings = React.useMemo(() => {
    if (!summary) return [];

    let holdings = [...summary.openHoldings];

    // Apply filter
    if (filterQuery) {
      holdings = holdings.filter(sym =>
        sym.toLowerCase().includes(filterQuery.toLowerCase())
      );
    }

    // Apply weight filter
    if (minWeight > 0 && summary.totalValue > 0) {
      holdings = holdings.filter(sym => {
        const h = p.holdings?.[sym];
        if (!h) return false;
        const qty = (h.lots || []).reduce((acc: number, lot: any) =>
          acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
        const q = quotes[sym];
        const value = (q?.last || 0) * qty;
        const weight = (value / summary.totalValue) * 100;
        return weight >= minWeight;
      });
    }

    // Apply sort
    holdings.sort((a, b) => {
      const hA = p.holdings?.[a];
      const hB = p.holdings?.[b];
      if (!hA || !hB) return 0;

      const qtyA = (hA.lots || []).reduce((acc: number, lot: any) =>
        acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
      const qtyB = (hB.lots || []).reduce((acc: number, lot: any) =>
        acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);

      const qA = quotes[a];
      const qB = quotes[b];

      let comparison = 0;
      switch (sortKey) {
        case 'ticker':
          comparison = a.localeCompare(b);
          break;
        case 'mv':
          const mvA = (qA?.last || 0) * qtyA;
          const mvB = (qB?.last || 0) * qtyB;
          comparison = mvA - mvB;
          break;
        case 'pnlAbs':
          const pnlA = computePnL(hA.lots.map((l: any) => ({ ...l, fee: l.fee ?? l.fees })), qA?.last || 0);
          const pnlB = computePnL(hB.lots.map((l: any) => ({ ...l, fee: l.fee ?? l.fees })), qB?.last || 0);
          comparison = (pnlA.realized + pnlA.unrealized) - (pnlB.realized + pnlB.unrealized);
          break;
        case 'pnlPct':
          const pnlPctA = computePnL(hA.lots.map((l: any) => ({ ...l, fee: l.fee ?? l.fees })), qA?.last || 0);
          const pnlPctB = computePnL(hB.lots.map((l: any) => ({ ...l, fee: l.fee ?? l.fees })), qB?.last || 0);
          const costA = pnlPctA.qty * pnlPctA.avgCost;
          const costB = pnlPctB.qty * pnlPctB.avgCost;
          const pctA = costA > 0 ? ((pnlPctA.realized + pnlPctA.unrealized) / costA) * 100 : 0;
          const pctB = costB > 0 ? ((pnlPctB.realized + pnlPctB.unrealized) / costB) * 100 : 0;
          comparison = pctA - pctB;
          break;
      }

      return sortDir === 'asc' ? comparison : -comparison;
    });

    return holdings;
  }, [summary, filterQuery, minWeight, sortKey, sortDir, p, quotes]);

  if (!p || !summary) {
    return (
      <View style={{ flex: 1, backgroundColor: bgDefault, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: textMuted }}>Portfolio not found</Text>
      </View>
    );
  }

  const dayColor = summary.dayDelta >= 0 ? successColor : dangerColor;
  const totalColor = summary.totalGain >= 0 ? successColor : dangerColor;

  // Generate portfolio history chart data based on actual transaction history (excluding cash)
  const chartData = React.useMemo(() => {
    if (!p) return [];

    const now = Date.now();
    let days = 30;
    switch (selectedInterval) {
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
      case 'ALL': days = 730; break;
    }

    const startTime = now - (days * 24 * 60 * 60 * 1000);
    const points: Array<{ t: number; v: number }> = [];

    // For 1D, use intraday line data if available
    if (selectedInterval === '1D') {
      // Get all holdings quantities
      const holdings: Record<string, number> = {};
      Object.values(p.holdings || {}).forEach((h: any) => {
        if (!h || !h.lots) return;
        const qty = h.lots.reduce((acc: number, lot: any) =>
          acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
        if (qty > 0) holdings[h.symbol] = qty;
      });

      // Find the symbol with the most intraday data points
      let maxDataPoints: Array<{ t: number; v: number }> = [];
      Object.keys(holdings).forEach(sym => {
        const q = quotes[sym];
        if (q?.line && Array.isArray(q.line) && q.line.length > maxDataPoints.length) {
          maxDataPoints = q.line;
        }
      });

      // Use the timestamps from the symbol with most data
      const timestamps = maxDataPoints.length > 0
        ? maxDataPoints.filter(p => p.t >= startTime).map(p => p.t)
        : [startTime, now];

      // Calculate portfolio value at each timestamp (excluding cash)
      timestamps.forEach(t => {
        let portfolioValue = 0; // Start at 0, no cash included

        Object.entries(holdings).forEach(([sym, qty]) => {
          const q = quotes[sym];
          if (!q) return;

          // Get ticker currency
          const h = p.holdings?.[sym];
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

          // Find price at this timestamp from line data
          let priceAtTimeNative = q.last;
          if (q.line && Array.isArray(q.line)) {
            for (let i = q.line.length - 1; i >= 0; i--) {
              if (q.line[i].t <= t) {
                priceAtTimeNative = q.line[i].v;
                break;
              }
            }
          }

          // Convert price from ticker currency to investment currency
          const priceAtTime = convertCurrency(fxRates, priceAtTimeNative, tickerCurrency, portfolioCurrency);
          portfolioValue += qty * priceAtTime;
        });

        points.push({ t, v: portfolioValue });
      });
    } else {
      // For other intervals, use daily bars data
      const numPoints = Math.min(days, 100);
      for (let i = 0; i < numPoints; i++) {
        const t = startTime + (i / (numPoints - 1)) * (days * 24 * 60 * 60 * 1000);

        // Calculate portfolio value at this point in time (excluding cash)
        let portfolioValue = 0; // Start at 0, no cash included

        Object.values(p.holdings || {}).forEach((h: any) => {
          if (!h || !h.lots) return;

          const q = quotes[h.symbol];
          if (!q || !q.bars || q.bars.length === 0) return;

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

          // Calculate quantity held at time t
          let qtyAtTime = 0;
          h.lots.forEach((lot: any) => {
            const lotTime = new Date(lot.date).getTime();
            if (lotTime <= t) {
              qtyAtTime += lot.side === 'buy' ? lot.qty : -lot.qty;
            }
          });

          if (qtyAtTime <= 0) return;

          // Find the closest historical price at or before time t
          let priceAtTimeNative = q.last; // default to current price
          for (let j = q.bars.length - 1; j >= 0; j--) {
            if (q.bars[j].t <= t) {
              priceAtTimeNative = q.bars[j].c;
              break;
            }
          }

          // Convert price from ticker currency to investment currency
          const priceAtTime = convertCurrency(fxRates, priceAtTimeNative, tickerCurrency, portfolioCurrency);
          portfolioValue += qtyAtTime * priceAtTime;
        });

        points.push({ t, v: portfolioValue });
      }
    }

    // Remove leading zeros from chart data
    let firstNonZero = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i].v > 0) {
        firstNonZero = i;
        break;
      }
    }

    const nonZeroPoints = points.slice(firstNonZero);
    return nonZeroPoints.length > 1 ? nonZeroPoints : [{ t: startTime, v: summary.holdingsValue }, { t: now, v: summary.holdingsValue }];
  }, [p, quotes, selectedInterval, summary.holdingsValue, fxRates, portfolioCurrency]);

  // Calculate interval-based gain/loss (excluding cash deposits/withdrawals)
  const intervalGain = React.useMemo(() => {
    const labels: Record<TimeInterval, string> = {
      '1D': '1 Day Gain/Loss',
      '5D': '5 Day Gain/Loss',
      '1M': '1 Month Gain/Loss',
      '6M': '6 Month Gain/Loss',
      'YTD': 'YTD Gain/Loss',
      '1Y': '1 Year Gain/Loss',
      'ALL': 'All-Time Gain/Loss',
    };

    // For ALL interval, just show total P&L (realized + unrealized)
    if (selectedInterval === 'ALL') {
      return { value: summary.totalGain, label: labels[selectedInterval], costBasis: 0 };
    }

    // For time-based intervals, calculate P&L change during that period
    // This excludes cash deposits/withdrawals and only tracks investment performance
    const now = Date.now();
    let days = 30;
    switch (selectedInterval) {
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
    const base = portfolioCurrency;

    // Calculate P&L at start, current value, and cost basis for current holdings
    let pnlAtStart = 0;
    let currentCostBasis = 0;

    Object.values(p.holdings || {}).forEach((h: any) => {
      if (!h || !h.lots) return;

      // Get ticker currency
      let holdingCurrency = h.currency;
      if (!holdingCurrency) {
        const s = h.symbol.toUpperCase();
        if (s.includes('-USD') || s.includes('USD')) holdingCurrency = 'USD';
        else if (s.endsWith('.L')) holdingCurrency = 'GBP';
        else if (s.endsWith('.T')) holdingCurrency = 'JPY';
        else if (s.endsWith('.TO')) holdingCurrency = 'CAD';
        else if (s.endsWith('.AX')) holdingCurrency = 'AUD';
        else if (s.endsWith('.HK')) holdingCurrency = 'HKD';
        else if (s.endsWith('.PA') || s.endsWith('.DE')) holdingCurrency = 'EUR';
        else if (s.endsWith('.SW')) holdingCurrency = 'CHF';
        else holdingCurrency = 'USD';
      }
      holdingCurrency = String(holdingCurrency).toUpperCase();

      const q = quotes[h.symbol];
      if (!q) return;

      // Calculate current cost basis (all lots)
      const allLotsConverted = h.lots.map((l: any) => ({
        ...l,
        price: convertCurrency(fxRates, l.price || 0, holdingCurrency, base),
        fee: convertCurrency(fxRates, (l.fee ?? l.fees) || 0, holdingCurrency, base)
      }));

      const currentQty = h.lots.reduce((acc: number, lot: any) => acc + (lot.side === 'buy' ? lot.qty : -lot.qty), 0);
      if (currentQty > 0) {
        // Calculate cost basis for current holdings
        let totalCost = 0;
        allLotsConverted.forEach((lot: any) => {
          if (lot.side === 'buy') {
            totalCost += lot.qty * lot.price + lot.fee;
          } else {
            // For sells, reduce cost proportionally
            totalCost -= lot.qty * lot.price - lot.fee;
          }
        });
        currentCostBasis += totalCost;
      }

      // Filter lots that existed at start time
      const lotsAtStart = h.lots.filter((lot: any) => new Date(lot.date).getTime() <= startTime);
      if (lotsAtStart.length === 0) return;

      // Get price at start time
      let priceAtStartNative = q.last; // fallback to current
      if (q.bars && q.bars.length > 0) {
        for (let j = q.bars.length - 1; j >= 0; j--) {
          if (q.bars[j].t <= startTime) {
            priceAtStartNative = q.bars[j].c;
            break;
          }
        }
      }
      const priceAtStart = convertCurrency(fxRates, priceAtStartNative, holdingCurrency, base);

      // Convert lot prices to investment currency
      const normLotsAtStart = lotsAtStart.map((l: any) => ({
        ...l,
        price: convertCurrency(fxRates, l.price || 0, holdingCurrency, base),
        fee: convertCurrency(fxRates, (l.fee ?? l.fees) || 0, holdingCurrency, base)
      }));

      const pnlStart = computePnL(normLotsAtStart, priceAtStart);
      pnlAtStart += pnlStart.realized + pnlStart.unrealized;
    });

    // Current P&L is already calculated in summary.totalGain
    const pnlChange = summary.totalGain - pnlAtStart;

    return { value: pnlChange, label: labels[selectedInterval], costBasis: currentCostBasis };
  }, [p, quotes, selectedInterval, summary.totalGain, fxRates, portfolioCurrency]);

  const intervalColor = intervalGain.value >= 0 ? successColor : dangerColor;

  const intervals: TimeInterval[] = ['1D', '5D', '1M', '6M', 'YTD', '1Y', 'ALL'];

  const xTickStrategy = React.useMemo(() => {
    if (selectedInterval === '1D' || selectedInterval === '5D') {
      return { mode: 'day', every: 1 } as const;
    }
    if (selectedInterval === '1M') {
      const len = chartData.length || 0;
      const every = Math.max(1, Math.round(len / 6));
      return { mode: 'day', every } as const;
    }
    return { mode: 'month' } as const;
  }, [selectedInterval, chartData.length]);

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

  const openMenu = () => {
    const ref: any = menuBtnRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x: number, y: number, w: number, h: number) => {
        setMenuAnchor({ x, y, w, h });
        setMenuVisible(true);
      });
    } else {
      setMenuAnchor({ x: 280, y: 120, w: 1, h: 1 });
      setMenuVisible(true);
    }
  };

  const handleEditPortfolio = () => {
    if (!p) return;
    setMenuVisible(false);
    nav.navigate('CreatePortfolio', { portfolioId: p.id });
  };

  const handleToggleTracking = async () => {
    if (!p) return;
    setMenuVisible(false);
    await setPortfolioTracking(p.id, !(p.trackingEnabled ?? true));
  };

  return (
    <ScreenScroll inTab contentStyle={{ paddingBottom: spacing.s32 }}>
      {/* Header with Back Button */}
      <View style={{ paddingHorizontal: spacing.s16, marginTop: spacing.s12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8, marginBottom: spacing.s20 }}>
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
            <Icon name="chevron-left" size={28} color={textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
              {p.name}
            </Text>
          </View>
          <Pressable
            ref={menuBtnRef as any}
            onPress={openMenu}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginRight: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="more-horizontal" size={24} color={textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Total Portfolio Value (including cash) */}
      <View style={{ paddingHorizontal: spacing.s16, marginBottom: spacing.s8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 }}>
            {summary.totalValue.toFixed(2)}
          </Text>
          <Text style={{ color: textMuted, fontSize: 14, marginLeft: spacing.s6, fontWeight: '600' }}>
            {summary.base}
          </Text>
        </View>
        <Text style={{ color: textMuted, fontSize: 12, marginTop: spacing.s4 }}>
          Holdings: {summary.holdingsValue.toFixed(2)} {summary.base} · Cash: {summary.cashValue.toFixed(2)} {summary.base}
        </Text>
      </View>

      {/* Day's Gain */}
      <View style={{ paddingHorizontal: spacing.s16, marginBottom: spacing.s4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
          <Text style={{ color: dayColor, fontWeight: '700', fontSize: 16 }}>
            {summary.dayDelta >= 0 ? '+' : ''}{formatCurrency(Math.abs(summary.dayDelta), summary.base)} ({summary.dayDelta >= 0 ? '+' : ''}{(() => {
              const valueYesterday = summary.holdingsValue - summary.dayDelta;
              return valueYesterday > 0 ? ((summary.dayDelta / valueYesterday) * 100).toFixed(2) : '0.00';
            })()}%)
          </Text>
          <Text style={{ color: textMuted, fontSize: 12 }}>Today's Change</Text>
        </View>
      </View>

      {/* Interval Gain */}
      <View style={{ paddingHorizontal: spacing.s16, marginBottom: spacing.s20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
          <Text style={{ color: intervalColor, fontWeight: '700', fontSize: 16 }}>
            {intervalGain.value >= 0 ? '+' : ''}{formatCurrency(Math.abs(intervalGain.value), summary.base)} ({intervalGain.value >= 0 ? '+' : ''}{(() => {
              if (selectedInterval === 'ALL') {
                // For ALL, calculate percentage based on total cost
                const totalCost = summary.holdingsValue - summary.totalGain;
                return totalCost > 0 ? ((intervalGain.value / totalCost) * 100).toFixed(2) : '0.00';
              } else {
                // For time intervals, calculate based on current cost basis
                const costBasis = intervalGain.costBasis || 0;
                return costBasis > 0 ? ((intervalGain.value / costBasis) * 100).toFixed(2) : '0.00';
              }
            })()}%)
          </Text>
          <Text style={{ color: textMuted, fontSize: 12 }}>{intervalGain.label}</Text>
        </View>
      </View>

      {/* Line Chart */}
      <View style={{ marginBottom: spacing.s12 }}>
        <LineChart
          key={selectedInterval}
          data={chartData}
          height={180}
          yAxisWidth={0}
          padding={{ left: 16, right: 16, bottom: 20, top: 10 }}
          xTickStrategy={xTickStrategy}
          currency={summary.base}
          color={totalColor}
          showGrid={false}
          cashEvents={p.cashEvents || []}
        />
      </View>

      {/* Last Refreshed */}
      <View style={{ paddingHorizontal: spacing.s16, marginBottom: spacing.s12 }}>
        <Text style={{ color: textMuted, fontSize: 11 }}>
          Last refreshed: {lastRefreshedText}
        </Text>
      </View>

      {/* Interval Buttons */}
      <View style={{ paddingHorizontal: spacing.s16, marginBottom: spacing.s24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {intervals.map((interval) => (
            <Pressable
              key={interval}
              onPress={() => setSelectedInterval(interval)}
              style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}
            >
              <Text style={{
                color: selectedInterval === interval ? accentPrimary : textMuted,
                fontSize: selectedInterval === interval ? 15 : 13,
                fontWeight: selectedInterval === interval ? '800' : '600',
              }}>
                {interval}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Watchlist/Holdings Section with Switch */}
      <View style={{ paddingHorizontal: spacing.s16 }}>
        {/* Segmented Switch and Action Icons */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s12 }}>
          {/* Segmented Switch */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: withAlpha(border, isDark ? 0.2 : 0.15),
            borderRadius: radius.pill,
            padding: 2,
          }}>
            <Pressable
              onPress={() => setViewMode('watchlist')}
              style={{
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s8,
                borderRadius: radius.pill,
                backgroundColor: viewMode === 'watchlist' ? accentPrimary : 'transparent',
              }}
            >
              <Text style={{
                color: viewMode === 'watchlist' ? '#FFFFFF' : textMuted,
                fontSize: 13,
                fontWeight: '700',
              }}>
                Watchlist
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('holdings')}
              style={{
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s8,
                borderRadius: radius.pill,
                backgroundColor: viewMode === 'holdings' ? accentPrimary : 'transparent',
              }}
            >
              <Text style={{
                color: viewMode === 'holdings' ? '#FFFFFF' : textMuted,
                fontSize: 13,
                fontWeight: '700',
              }}>
                Holdings
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('cash')}
              style={{
                paddingHorizontal: spacing.s12,
                paddingVertical: spacing.s8,
                borderRadius: radius.pill,
                backgroundColor: viewMode === 'cash' ? accentPrimary : 'transparent',
              }}
            >
              <Text style={{
                color: viewMode === 'cash' ? '#FFFFFF' : textMuted,
                fontSize: 13,
                fontWeight: '700',
              }}>
                Cash
              </Text>
            </Pressable>
          </View>

          {/* Action Icons */}
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <Pressable
              onPress={() => setShowAddSheet(true)}
              style={({ pressed }) => ({
                padding: spacing.s8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon name="plus" size={20} color={textMuted} />
            </Pressable>
            <Pressable
              onPress={() => setShowFilterSheet(true)}
              style={({ pressed }) => ({
                padding: spacing.s8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon name="filter" size={20} color={textMuted} />
            </Pressable>
            <Pressable
              onPress={() => setShowSortSheet(true)}
              style={({ pressed }) => ({
                padding: spacing.s8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon name="bar-chart-2" size={20} color={textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={{
          backgroundColor: cardBg,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: withAlpha(border, isDark ? 0.5 : 1),
          overflow: 'hidden',
        }}>
          {viewMode === 'watchlist' ? (
            // Watchlist View
            p.watchlist && p.watchlist.length > 0 ? (
              p.watchlist.map((sym, index) => (
                <View key={sym}>
                  <WatchRow sym={sym} portfolioCurrency={portfolioCurrency} />
                  {index < p.watchlist.length - 1 && (
                    <View style={{ height: 1, backgroundColor: withAlpha(border, 0.3), marginHorizontal: spacing.s12 }} />
                  )}
                </View>
              ))
            ) : (
              <View style={{ padding: spacing.s24, alignItems: 'center' }}>
                <Text style={{ color: textMuted, fontSize: 14 }}>No symbols in watchlist</Text>
              </View>
            )
          ) : viewMode === 'holdings' ? (
            // Holdings View
            filteredAndSortedHoldings.length > 0 ? (
              filteredAndSortedHoldings.map((sym, index) => (
                <View key={sym}>
                  <HoldingRow sym={sym} portfolioId={portfolioId} variant="list" />
                  {index < filteredAndSortedHoldings.length - 1 && (
                    <View style={{ height: 1, backgroundColor: withAlpha(border, 0.3), marginHorizontal: spacing.s12 }} />
                  )}
                </View>
              ))
            ) : (
              <View style={{ padding: spacing.s24, alignItems: 'center', gap: spacing.s8 }}>
                <Icon name="briefcase" size={48} color={textMuted} />
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>No holdings yet</Text>
                <Text style={{ color: textMuted, fontSize: 14, textAlign: 'center' }}>
                  Add your first position by tapping a ticker from the watchlist or search for a stock to buy
                </Text>
              </View>
            )
          ) : (
            // Cash View
            <View style={{ padding: spacing.s24, alignItems: 'center', gap: spacing.s16 }}>
              <View style={{ alignItems: 'center', gap: spacing.s8 }}>
                <Text style={{ color: textPrimary, fontSize: 36, fontWeight: '800' }}>
                  {formatCurrency(summary?.cashValue || 0, summary?.base || 'USD')}
                </Text>
                <Text style={{ color: textMuted, fontSize: 14 }}>Available Cash</Text>
              </View>
              <Pressable
                onPress={() => nav.navigate('CashManagement' as never, { portfolioId } as never)}
                style={({ pressed }) => ({
                  backgroundColor: accentPrimary,
                  paddingHorizontal: spacing.s24,
                  paddingVertical: spacing.s12,
                  borderRadius: radius.md,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                  Adjust Cash
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Add Ticker Sheet */}
      {showAddSheet && (
        <AddHoldingSheet
          visible={showAddSheet}
          onClose={() => setShowAddSheet(false)}
          portfolioId={portfolioId}
          mode={viewMode === 'watchlist' ? 'watchlist' : 'holdings'}
        />
      )}

      {/* Filter Sheet */}
      {showFilterSheet && (
        <HoldingsFilterSheet
          visible={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          valueQuery={filterQuery}
          onChangeQuery={setFilterQuery}
          valueMinWeight={minWeight}
          onChangeMinWeight={setMinWeight}
          onClear={() => {
            setFilterQuery('');
            setMinWeight(0);
          }}
        />
      )}

      {/* Sort Sheet */}
      {showSortSheet && (
        <HoldingsSortSheet
          visible={showSortSheet}
          onClose={() => setShowSortSheet(false)}
          valueKey={sortKey}
          valueDir={sortDir}
          onChange={(key, dir) => {
            setSortKey(key);
            setSortDir(dir);
          }}
        />
      )}

      {/* Portfolio Menu */}
      <PopoverMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        anchor={menuAnchor}
        items={[
          {
            key: 'edit',
            label: 'Edit portfolio',
            description: 'Change name, currency, and benchmark',
            icon: 'edit',
            iconToken: 'accent.primary',
            onPress: handleEditPortfolio,
          },
          {
            key: 'tracking',
            label: (p?.trackingEnabled ?? true) ? 'Disable tracking' : 'Enable tracking',
            description: (p?.trackingEnabled ?? true)
              ? 'Exclude from total portfolio value'
              : 'Include in total portfolio value',
            icon: (p?.trackingEnabled ?? true) ? 'eye-off' : 'eye',
            iconToken: (p?.trackingEnabled ?? true) ? 'text.muted' : 'accent.secondary',
            onPress: handleToggleTracking,
          },
        ]}
      />

    </ScreenScroll>
  );
}
