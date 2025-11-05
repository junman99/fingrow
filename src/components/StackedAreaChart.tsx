import React, { useMemo } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G, Line, Text as SvgText, Rect, Circle } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useThemeTokens } from '../theme/ThemeProvider';
import { formatCurrency } from '../lib/format';
import { spacing, radius } from '../theme/tokens';
import { ScrollContext } from './ScrollContext';

type DataPoint = {
  t: number;
  cash: number;
  investments: number;
  debt: number;
};

type Props = {
  data: DataPoint[];
  height?: number;
  padding?: { left?: number; right?: number; bottom?: number; top?: number };
  showLabels?: boolean;
};

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toFixed(0);
}

// Simple straight line path (no spline smoothing)
function straightPath(points: Array<{ x: number; y: number }>, tension: number = 0.3): string {
  if (points.length < 2) return '';

  // Filter out invalid points
  const validPoints = points.filter(p => isFinite(p.x) && isFinite(p.y));
  if (validPoints.length < 2) return '';

  let path = `M ${validPoints[0].x} ${validPoints[0].y}`;

  // Just use straight lines, no curves
  for (let i = 1; i < validPoints.length; i++) {
    path += ` L ${validPoints[i].x} ${validPoints[i].y}`;
  }

  return path;
}

export const StackedAreaChart: React.FC<Props> = ({
  data,
  height = 200,
  padding,
  showLabels = true,
}) => {
  const { get, isDark } = useThemeTokens();
  const { setScrollEnabled } = React.useContext(ScrollContext);
  const enableParent = React.useCallback(() => setScrollEnabled && setScrollEnabled(true), [setScrollEnabled]);
  const disableParent = React.useCallback(() => setScrollEnabled && setScrollEnabled(false), [setScrollEnabled]);

  const pad = { left: 0, right: 0, bottom: 26, top: 10, ...(padding || {}) };

  const [layoutW, setLayoutW] = React.useState<number>(340);
  const onLayout = (e: LayoutChangeEvent) => {
    setLayoutW(e.nativeEvent.layout.width || 340);
  };
  const w = layoutW;
  const h = height;

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;
  const bgDefault = get('background.default') as string;
  const tipBg = get('surface.level2') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const warningColor = get('semantic.warning') as string;

  // Use the same colors as the Money overview cards for visual consistency
  const cashColor = accentPrimary; // Matches Cash card
  const investColor = accentSecondary; // Matches Investments card
  const debtColor = warningColor; // Matches Debts card
  const netWorthLineColor = text; // Use text color for net worth line (more prominent)
  const currentNetWorthColor = muted; // Use muted color for current net worth horizontal line

  // Calculate bounds with smart Y-axis scaling for clean net worth trend line
  const { minVal, maxVal, times } = useMemo(() => {
    if (!data.length) return { minVal: 0, maxVal: 1, times: [] };

    const times = data.map(d => d.t).filter(t => !isNaN(t) && isFinite(t));
    if (!times.length) return { minVal: 0, maxVal: 1, times: [] };

    // Find the min and max net worth values, filtering out invalid numbers
    const netWorths = data
      .map(d => {
        const cash = Number(d.cash) || 0;
        const investments = Number(d.investments) || 0;
        const debt = Number(d.debt) || 0;
        return cash + investments - debt;
      })
      .filter(nw => !isNaN(nw) && isFinite(nw));

    if (!netWorths.length) return { minVal: 0, maxVal: 1, times: [] };

    let minNW = Math.min(...netWorths);
    let maxNW = Math.max(...netWorths);

    // Handle edge case where all values are the same
    if (minNW === maxNW) {
      const base = minNW || 1;
      minNW = base * 0.95;
      maxNW = base * 1.05;
    }

    // Add 15-20% padding to make the chart breathe
    const range = maxNW - minNW;
    const padding = range * 0.18;

    minNW -= padding;
    maxNW += padding;

    // Round to nice values (e.g., 347k -> 340k, 398k -> 410k)
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, Math.abs(maxNW - minNW)))));
    const roundTo = magnitude >= 10000 ? 10000 : magnitude >= 1000 ? 1000 : 100;

    const minVal = Math.floor(minNW / roundTo) * roundTo;
    const maxVal = Math.ceil(maxNW / roundTo) * roundTo;

    return { minVal, maxVal, times };
  }, [data]);

  const tmin = times[0] ?? 0;
  const tmax = times[times.length - 1] ?? 1;
  const trange = Math.max(1, tmax - tmin);
  const range = Math.max(1, maxVal - minVal);

  const plotLeft = pad.left;
  const plotRight = w - pad.right;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotTop = pad.top;
  const plotBottom = h - pad.bottom;
  const plotHeight = Math.max(1, plotBottom - plotTop);

  const xFor = (t: number) => {
    const x = plotLeft + ((t - tmin) / trange) * plotWidth;
    return isFinite(x) ? x : plotLeft;
  };
  const yFor = (v: number) => {
    const y = plotBottom - ((v - minVal) / range) * plotHeight;
    return isFinite(y) ? y : plotBottom;
  };

  // Current values for legend
  const currentValues = useMemo(() => {
    if (!data.length) return { cash: 0, investments: 0, debt: 0 };
    const last = data[data.length - 1];
    return {
      cash: last.cash,
      investments: last.investments,
      debt: last.debt
    };
  }, [data]);

  // Generate path data for clean net worth line only (no stacked areas)
  const paths = useMemo(() => {
    if (!data.length) return { netWorthLine: '', fillPath: '' };

    // Generate net worth line points
    const netWorthPoints = data.map(d => {
      const cash = Number(d.cash) || 0;
      const investments = Number(d.investments) || 0;
      const debt = Number(d.debt) || 0;
      return { x: xFor(d.t), y: yFor(cash + investments - debt) };
    });

    // Safety check for empty data after filtering
    if (netWorthPoints.length === 0) {
      return { netWorthLine: '', fillPath: '' };
    }

    // Net worth line
    const netWorthLine = straightPath(netWorthPoints);
    if (!netWorthLine) {
      return { netWorthLine: '', fillPath: '' };
    }

    // Optional: Create a subtle fill area below the net worth line
    const x0 = xFor(data[0].t);
    const xN = xFor(data[data.length - 1].t);
    const yBottom = yFor(minVal);

    let fillPath = netWorthLine; // Start with the net worth line
    fillPath += ` L ${xN} ${yBottom}`; // Go down to bottom right
    fillPath += ` L ${x0} ${yBottom}`; // Go to bottom left
    fillPath += ' Z'; // Close the path

    return { netWorthLine, fillPath };
  }, [data, tmin, trange, minVal, maxVal, range, plotLeft, plotWidth, plotBottom, plotHeight, xFor, yFor]);

  // X-axis month ticks
  const monthTicks = useMemo(() => {
    if (data.length < 2) return [];
    const ticks: Array<{ t: number; label: string }> = [];
    const start = new Date(tmin);
    const m0 = new Date(start.getFullYear(), start.getMonth(), 1).getTime();
    let cur = m0 < tmin ? new Date(start.getFullYear(), start.getMonth() + 1, 1).getTime() : m0;

    while (cur <= tmax) {
      const d = new Date(cur);
      ticks.push({ t: cur, label: d.toLocaleString(undefined, { month: 'short' }) });
      cur = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    }

    // Limit to ~6 ticks
    if (ticks.length > 6) {
      const step = Math.ceil(ticks.length / 6);
      for (let i = ticks.length - 2; i > 0; i--) {
        if (i % step !== 0) ticks.splice(i, 1);
      }
    }
    return ticks;
  }, [data, tmin, tmax]);

  // Tooltip interaction state
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const hasHover = hoverIdx !== null && data[hoverIdx];

  // Current net worth line visibility with delay
  const [showCurrentLine, setShowCurrentLine] = React.useState(true);
  const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleTouch = React.useCallback((xPix: number) => {
    if (!data.length) return;
    const svgX = (xPix / Math.max(1, w)) * w;
    const chartX = Math.max(plotLeft, Math.min(svgX, plotRight));
    const t = tmin + ((chartX - plotLeft) / Math.max(1e-6, plotWidth)) * trange;

    // Binary search for closest point
    let lo = 0, hi = times.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (times[mid] < t) lo = mid + 1; else hi = mid;
    }
    let idx = lo;
    if (idx > 0 && (idx >= times.length || Math.abs(times[idx-1] - t) < Math.abs(times[idx] - t))) idx = idx - 1;
    setHoverIdx(idx);
  }, [data, w, plotLeft, plotRight, tmin, plotWidth, trange, times]);

  // Single-finger touch gesture for tooltip
  const tooltipGesture = React.useMemo(() =>
    Gesture.Pan()
      .maxPointers(1)
      .minDistance(0)
      .runOnJS(true)
      .onTouchesDown((event) => {
        if (event.numberOfTouches === 1) {
          if (disableParent) disableParent();
          // Hide current net worth line immediately
          setShowCurrentLine(false);
          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
          }
          handleTouch(event.allTouches[0].absoluteX);
        }
      })
      .onTouchesMove((event) => {
        if (event.numberOfTouches === 1) {
          handleTouch(event.allTouches[0].absoluteX);
        }
      })
      .onStart((event) => {
        handleTouch(event.absoluteX);
      })
      .onUpdate((event) => {
        handleTouch(event.absoluteX);
      })
      .onEnd(() => {
        setHoverIdx(null);
        if (enableParent) enableParent();
        // Show current net worth line again after 1 second delay
        hideTimeoutRef.current = setTimeout(() => {
          setShowCurrentLine(true);
        }, 1000);
      })
      .onTouchesUp(() => {
        setHoverIdx(null);
        if (enableParent) enableParent();
        // Show current net worth line again after 1 second delay
        hideTimeoutRef.current = setTimeout(() => {
          setShowCurrentLine(true);
        }, 1000);
      })
      .onFinalize(() => {
        setHoverIdx(null);
      }),
    [handleTouch, disableParent, enableParent]
  );

  // Tooltip data with percentages
  const tooltipData = useMemo(() => {
    if (!hasHover) return null;

    const d = data[hoverIdx!];
    const cash = Number(d.cash) || 0;
    const investments = Number(d.investments) || 0;
    const debt = Number(d.debt) || 0;
    const netWorth = cash + investments - debt;

    // Calculate percentages (based on total assets, not net worth)
    const totalAssets = cash + investments;
    const cashPercent = totalAssets > 0 ? Math.round((cash / totalAssets) * 100) : 0;
    const investPercent = totalAssets > 0 ? Math.round((investments / totalAssets) * 100) : 0;
    const debtPercent = netWorth > 0 ? Math.round((debt / (netWorth + debt)) * 100) : 0;

    return {
      x: xFor(d.t),
      y: yFor(netWorth),
      date: new Date(d.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      netWorth: formatCurrency(netWorth),
      cash: formatCurrency(cash),
      cashPercent,
      investments: formatCurrency(investments),
      investPercent,
      debt: formatCurrency(debt),
      debtPercent,
      hasDebt: debt > 0
    };
  }, [hasHover, hoverIdx, data, xFor, yFor]);

  const hoverX = tooltipData?.x || 0;
  const hoverY = tooltipData?.y || 0;

  // Tooltip box positioning
  const boxW = 180, boxH = 105, padBox = 10;
  let tipX = hoverX + 12;
  const tipY = plotTop + 12;
  if (tipX + boxW > plotRight) tipX = hoverX - boxW - 12;
  if (tipX < plotLeft) tipX = plotLeft + 4;

  // Current net worth (latest value) for horizontal line
  const currentNetWorth = useMemo(() => {
    if (!data.length) return 0;
    const last = data[data.length - 1];
    return (Number(last.cash) || 0) + (Number(last.investments) || 0) - (Number(last.debt) || 0);
  }, [data]);
  const currentNetWorthY = yFor(currentNetWorth);

  // Early return if no valid data
  if (!data.length || times.length === 0) {
    return (
      <View onLayout={onLayout} style={{ height: h, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: muted, fontSize: 13 }}>No data available</Text>
      </View>
    );
  }

  return (
    <GestureDetector gesture={tooltipGesture}>
    <View onLayout={onLayout}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          {/* Gradients matching the card colors and opacities */}
          <LinearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={cashColor} stopOpacity={isDark ? 0.25 : 0.35} />
            <Stop offset="0.5" stopColor={cashColor} stopOpacity={isDark ? 0.15 : 0.25} />
            <Stop offset="1" stopColor={cashColor} stopOpacity={isDark ? 0.08 : 0.12} />
          </LinearGradient>
          <LinearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={investColor} stopOpacity={isDark ? 0.28 : 0.35} />
            <Stop offset="0.5" stopColor={investColor} stopOpacity={isDark ? 0.18 : 0.25} />
            <Stop offset="1" stopColor={investColor} stopOpacity={isDark ? 0.10 : 0.14} />
          </LinearGradient>
        </Defs>

        <G>
          {/* Subtle fill gradient below net worth line */}
          <Defs>
            <LinearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accentPrimary} stopOpacity={isDark ? 0.15 : 0.2} />
              <Stop offset="1" stopColor={accentPrimary} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Fill area below net worth line */}
          {paths.fillPath && (
            <Path d={paths.fillPath} fill="url(#netWorthGrad)" />
          )}

          {/* Net worth line - clean and prominent */}
          {paths.netWorthLine && (
            <Path
              d={paths.netWorthLine}
              stroke={accentPrimary}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current net worth horizontal dotted line */}
          {showCurrentLine && (
            <G>
              <Line
                x1={plotLeft}
                x2={plotRight}
                y1={currentNetWorthY}
                y2={currentNetWorthY}
                stroke={currentNetWorthColor}
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={0.8}
              />
              {/* Small label on the right showing the value */}
              <SvgText
                x={plotRight - 4}
                y={currentNetWorthY - 6}
                fill={currentNetWorthColor}
                fontSize="11"
                fontWeight="700"
                textAnchor="end"
              >
                {formatCurrency(currentNetWorth)}
              </SvgText>
            </G>
          )}

          {/* X-axis */}
          <Line
            x1={plotLeft}
            x2={plotRight}
            y1={plotBottom}
            y2={plotBottom}
            stroke={border}
            strokeWidth={1}
          />

          {/* X-axis labels */}
          {showLabels && monthTicks.map((tick, i) => {
            const x = xFor(tick.t);
            return (
              <SvgText
                key={`x${i}`}
                x={x}
                y={h - 4}
                fill={muted}
                fontSize="10"
                textAnchor="middle"
              >
                {tick.label}
              </SvgText>
            );
          })}

          {/* Y-axis labels on the left */}
          {showLabels && (
            <>
              <SvgText
                x={plotLeft + 4}
                y={yFor(maxVal) + 12}
                fill={muted}
                fontSize="10"
              >
                {formatCompact(maxVal)}
              </SvgText>
              <SvgText
                x={plotLeft + 4}
                y={yFor(minVal) - 4}
                fill={muted}
                fontSize="10"
              >
                {formatCompact(minVal)}
              </SvgText>
            </>
          )}

          {/* Tooltip on touch */}
          {hasHover && tooltipData && (
            <G>
              {/* Crosshair */}
              <Line
                x1={hoverX}
                x2={hoverX}
                y1={plotTop}
                y2={plotBottom}
                stroke={accentPrimary}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <Circle cx={hoverX} cy={hoverY} r={5} fill={accentPrimary} />

              {/* Tooltip box */}
              <Rect x={tipX} y={tipY} width={boxW} height={boxH} rx={8} fill={tipBg} opacity={0.97} />

              {/* Date */}
              <SvgText x={tipX + padBox} y={tipY + 16} fill={muted} fontSize="10" fontWeight="600">
                {tooltipData.date}
              </SvgText>

              {/* Net Worth */}
              <SvgText x={tipX + padBox} y={tipY + 34} fill={text} fontSize="14" fontWeight="700">
                {tooltipData.netWorth}
              </SvgText>

              {/* Breakdown with percentages */}
              <SvgText x={tipX + padBox} y={tipY + 52} fill={cashColor} fontSize="10" fontWeight="600">
                💰 {tooltipData.cash} ({tooltipData.cashPercent}%)
              </SvgText>
              <SvgText x={tipX + padBox} y={tipY + 68} fill={investColor} fontSize="10" fontWeight="600">
                📈 {tooltipData.investments} ({tooltipData.investPercent}%)
              </SvgText>
              {tooltipData.hasDebt && (
                <SvgText x={tipX + padBox} y={tipY + 84} fill={debtColor} fontSize="10" fontWeight="600">
                  💳 {tooltipData.debt} ({tooltipData.debtPercent}%)
                </SvgText>
              )}
            </G>
          )}
        </G>
      </Svg>
    </View>
    </GestureDetector>
  );
};
