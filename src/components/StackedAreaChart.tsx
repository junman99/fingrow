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

  // Theme-aware colors: vibrant for light, milk/neutral for dark
  const cashColor = isDark ? '#D6D1CC' : '#3B82F6'; // Warm gray for dark, blue for light
  const investColor = isDark ? '#CFC9D1' : '#8B5CF6'; // Purple-tinted gray for dark, purple for light
  const netWorthLineColor = isDark ? '#F0EBE6' : '#6366F1'; // Soft white for dark, indigo for light (back to original)
  const currentNetWorthColor = isDark ? '#FFFFFF' : '#1E40AF'; // Pure white for dark, darker blue for light (for horizontal line)
  const debtColor = warningColor; // Keep warning color for debt

  // Calculate bounds with smart Y-axis scaling (don't start from 0)
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

  // Generate path data for stacked areas with smooth curves + net worth line
  const paths = useMemo(() => {
    if (!data.length) return { cashPath: '', investPath: '', debtPath: '', cashLine: '', investLine: '', debtLine: '', netWorthLine: '' };

    // Generate points for each layer with safety checks
    const cashPoints = data.map(d => {
      const cash = Number(d.cash) || 0;
      return { x: xFor(d.t), y: yFor(cash) };
    });
    const investPoints = data.map(d => {
      const cash = Number(d.cash) || 0;
      const investments = Number(d.investments) || 0;
      return { x: xFor(d.t), y: yFor(cash + investments) };
    });
    const netWorthPoints = data.map(d => {
      const cash = Number(d.cash) || 0;
      const investments = Number(d.investments) || 0;
      const debt = Number(d.debt) || 0;
      return { x: xFor(d.t), y: yFor(cash + investments - debt) };
    });

    // Safety check for empty data after filtering
    if (cashPoints.length === 0) {
      return { cashPath: '', investPath: '', debtPath: '', cashLine: '', investLine: '', debtLine: '', netWorthLine: '' };
    }

    // Cash layer (from minVal baseline) with straight lines
    const cashTopPath = straightPath(cashPoints);
    if (!cashTopPath) {
      return { cashPath: '', investPath: '', debtPath: '', cashLine: '', investLine: '', debtLine: '', netWorthLine: '' };
    }

    const firstCash = Number(data[0].cash) || 0;
    const lastCash = Number(data[data.length - 1].cash) || 0;
    const x0 = xFor(data[0].t);
    const xN = xFor(data[data.length - 1].t);
    const yMinVal = yFor(minVal);
    const yCash0 = yFor(firstCash);
    const yCashN = yFor(lastCash);

    // Cash area: start at minVal, go up to cash line, follow it, then back down to minVal
    let cashPath = `M ${x0} ${yMinVal}`;
    cashPath += ` L ${x0} ${yCash0}`;
    cashPath += cashTopPath.substring(1); // Remove M from start, add the line
    cashPath += ` L ${xN} ${yMinVal} Z`;

    // Cash top line for border
    const cashLine = cashTopPath;

    // Investments layer (on top of cash) with straight lines
    const investTopPath = straightPath(investPoints);
    if (!investTopPath) {
      return { cashPath, investPath: '', debtPath: '', cashLine, investLine: '', debtLine: '', netWorthLine: '' };
    }

    // Investment area: draw as area between cash line and investment line
    // Start with investment line, then connect back along cash line
    let investPath = investTopPath; // Investment top line (M x0 y0 L ...)

    // Connect to last cash point and trace back
    investPath += ` L ${cashPoints[cashPoints.length - 1].x} ${cashPoints[cashPoints.length - 1].y}`;

    // Trace back along cash in reverse
    for (let i = cashPoints.length - 2; i >= 0; i--) {
      investPath += ` L ${cashPoints[i].x} ${cashPoints[i].y}`;
    }

    investPath += ' Z';

    // Investment top line for border
    const investLine = investTopPath;

    // Net worth line (on top of everything) - straight lines
    const netWorthLine = straightPath(netWorthPoints);

    // Debt representation removed from stacked areas
    const debtPath = '';
    const debtLine = '';

    return { cashPath, investPath, debtPath, cashLine, investLine, debtLine, netWorthLine };
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

  // Tooltip data
  const hoverX = hasHover ? xFor(data[hoverIdx!].t) : 0;
  const hoverY = hasHover ? yFor(data[hoverIdx!].cash + data[hoverIdx!].investments - data[hoverIdx!].debt) : 0;
  const tipDate = hasHover ? new Date(data[hoverIdx!].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const tipNetWorth = hasHover ? formatCurrency(data[hoverIdx!].cash + data[hoverIdx!].investments - data[hoverIdx!].debt) : '';
  const tipCash = hasHover ? formatCurrency(data[hoverIdx!].cash) : '';
  const tipInvest = hasHover ? formatCurrency(data[hoverIdx!].investments) : '';
  const tipDebt = hasHover ? formatCurrency(data[hoverIdx!].debt) : '';

  // Tooltip box positioning
  const boxW = 160, boxH = 95, padBox = 10;
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
          {/* Theme-aware gradients - more subtle for dark mode */}
          <LinearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={cashColor} stopOpacity={isDark ? 0.12 : 0.5} />
            <Stop offset="0.5" stopColor={cashColor} stopOpacity={isDark ? 0.08 : 0.3} />
            <Stop offset="1" stopColor={cashColor} stopOpacity={isDark ? 0.04 : 0.1} />
          </LinearGradient>
          <LinearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={investColor} stopOpacity={isDark ? 0.14 : 0.5} />
            <Stop offset="0.5" stopColor={investColor} stopOpacity={isDark ? 0.09 : 0.3} />
            <Stop offset="1" stopColor={investColor} stopOpacity={isDark ? 0.05 : 0.1} />
          </LinearGradient>
        </Defs>

        <G>
          {/* Stacked areas with smooth curves */}
          {/* Cash (bottom layer) */}
          <Path d={paths.cashPath} fill="url(#cashGrad)" />
          {paths.cashLine && (
            <Path
              d={paths.cashLine}
              stroke={cashColor}
              strokeWidth={1.5}
              fill="none"
              opacity={isDark ? 0.4 : 0.6}
            />
          )}

          {/* Investments (top layer) */}
          <Path d={paths.investPath} fill="url(#investGrad)" />
          {paths.investLine && (
            <Path
              d={paths.investLine}
              stroke={investColor}
              strokeWidth={1.5}
              fill="none"
              opacity={isDark ? 0.4 : 0.6}
            />
          )}

          {/* Net worth line (on top) - most prominent */}
          {paths.netWorthLine ? (
            <Path
              d={paths.netWorthLine}
              stroke={netWorthLineColor}
              strokeWidth={2.5}
              fill="none"
              opacity={isDark ? 0.9 : 0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

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
          {hasHover && (
            <G>
              {/* Crosshair */}
              <Line
                x1={hoverX}
                x2={hoverX}
                y1={plotTop}
                y2={plotBottom}
                stroke={netWorthLineColor}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <Circle cx={hoverX} cy={hoverY} r={4} fill={netWorthLineColor} />

              {/* Tooltip box */}
              <Rect x={tipX} y={tipY} width={boxW} height={boxH} rx={8} fill={tipBg} opacity={0.97} />

              {/* Date */}
              <SvgText x={tipX + padBox} y={tipY + 16} fill={muted} fontSize="10" fontWeight="600">
                {tipDate}
              </SvgText>

              {/* Net Worth */}
              <SvgText x={tipX + padBox} y={tipY + 34} fill={text} fontSize="13" fontWeight="700">
                {tipNetWorth}
              </SvgText>

              {/* Breakdown */}
              <SvgText x={tipX + padBox} y={tipY + 50} fill={cashColor} fontSize="10" fontWeight="600">
                💰 {tipCash}
              </SvgText>
              <SvgText x={tipX + padBox} y={tipY + 64} fill={investColor} fontSize="10" fontWeight="600">
                📈 {tipInvest}
              </SvgText>
              {data[hoverIdx!].debt > 0 && (
                <SvgText x={tipX + padBox} y={tipY + 78} fill={debtColor} fontSize="10" fontWeight="600">
                  💳 -{tipDebt}
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
