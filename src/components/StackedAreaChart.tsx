import React, { useMemo } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G, Line, Text as SvgText, Rect } from 'react-native-svg';
import { useThemeTokens } from '../theme/ThemeProvider';
import { formatCurrency } from '../lib/format';
import { spacing, radius } from '../theme/tokens';

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

// Smooth curve generation using bezier curves
function smoothPath(points: Array<{ x: number; y: number }>, tension: number = 0.3): string {
  if (points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) * tension;
    const cp1y = p0.y;
    const cp2x = p1.x - (p1.x - p0.x) * tension;
    const cp2y = p1.y;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }

  return path;
}

export const StackedAreaChart: React.FC<Props> = ({
  data,
  height = 200,
  padding,
  showLabels = true,
}) => {
  const { get } = useThemeTokens();
  const pad = { left: 12, right: 12, bottom: 26, top: 10, ...(padding || {}) };

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
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const warningColor = get('semantic.warning') as string;

  // Use app theme colors instead of bright fixed colors
  const cashColor = accentPrimary; // Use primary accent
  const investColor = accentSecondary; // Use secondary accent
  const debtColor = warningColor; // Use warning color

  // Calculate bounds
  const { minVal, maxVal, times } = useMemo(() => {
    if (!data.length) return { minVal: 0, maxVal: 1, times: [] };

    const times = data.map(d => d.t);
    let minVal = 0;
    let maxVal = 0;

    data.forEach(d => {
      const netWorth = d.cash + d.investments - d.debt;
      minVal = Math.min(minVal, netWorth);
      maxVal = Math.max(maxVal, d.cash + d.investments);
    });

    // Add padding to range
    const range = maxVal - minVal;
    minVal -= range * 0.1;
    maxVal += range * 0.1;

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

  const xFor = (t: number) => plotLeft + ((t - tmin) / trange) * plotWidth;
  const yFor = (v: number) => plotBottom - ((v - minVal) / range) * plotHeight;

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

  // Generate path data for stacked areas with smooth curves
  const paths = useMemo(() => {
    if (!data.length) return { cashPath: '', investPath: '', debtPath: '', cashLine: '', investLine: '', debtLine: '' };

    // Generate points for each layer
    const cashPoints = data.map(d => ({ x: xFor(d.t), y: yFor(d.cash) }));
    const investPoints = data.map(d => ({ x: xFor(d.t), y: yFor(d.cash + d.investments) }));
    const debtPoints = data.map(d => ({ x: xFor(d.t), y: yFor(-d.debt) }));

    // Cash layer (bottom) with smooth curves
    const cashTopPath = smoothPath(cashPoints, 0.35);
    let cashPath = `M ${xFor(data[0].t)} ${yFor(0)}`;
    cashPath += ` L ${xFor(data[0].t)} ${yFor(data[0].cash)}`;
    cashPath += cashTopPath.substring(1); // Remove M from start
    cashPath += ` L ${xFor(data[data.length - 1].t)} ${yFor(0)} Z`;

    // Cash top line for border
    const cashLine = cashTopPath;

    // Investments layer (on top of cash) with smooth curves
    const investTopPath = smoothPath(investPoints, 0.35);
    const investBottomPath = smoothPath([...cashPoints].reverse(), 0.35);
    let investPath = investTopPath;
    investPath += ' L ' + investBottomPath.substring(2); // Connect to bottom
    investPath += ' Z';

    // Investment top line for border
    const investLine = investTopPath;

    // Debt cutout (visual representation) with smooth curves
    let debtPath = '';
    let debtLine = '';
    if (data.some(d => d.debt > 0)) {
      const debtTopPath = smoothPath(debtPoints, 0.35);
      debtPath = `M ${xFor(data[0].t)} ${yFor(0)}`;
      debtPath += ` L ${xFor(data[0].t)} ${yFor(-data[0].debt)}`;
      debtPath += debtTopPath.substring(1);
      debtPath += ` L ${xFor(data[data.length - 1].t)} ${yFor(0)} Z`;
      debtLine = debtTopPath;
    }

    return { cashPath, investPath, debtPath, cashLine, investLine, debtLine };
  }, [data, tmin, trange, minVal, range, plotLeft, plotWidth, plotBottom, plotHeight]);

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

  return (
    <View onLayout={onLayout}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          {/* Subtle gradients that match app theme */}
          <LinearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={cashColor} stopOpacity={0.7} />
            <Stop offset="0.5" stopColor={cashColor} stopOpacity={0.45} />
            <Stop offset="1" stopColor={cashColor} stopOpacity={0.2} />
          </LinearGradient>
          <LinearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={investColor} stopOpacity={0.7} />
            <Stop offset="0.5" stopColor={investColor} stopOpacity={0.45} />
            <Stop offset="1" stopColor={investColor} stopOpacity={0.2} />
          </LinearGradient>
          <LinearGradient id="debtGrad" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={debtColor} stopOpacity={0.6} />
            <Stop offset="0.5" stopColor={debtColor} stopOpacity={0.35} />
            <Stop offset="1" stopColor={debtColor} stopOpacity={0.15} />
          </LinearGradient>
        </Defs>

        <G>
          {/* Baseline - thicker and more prominent */}
          <Line
            x1={plotLeft}
            x2={plotRight}
            y1={yFor(0)}
            y2={yFor(0)}
            stroke={border}
            strokeWidth={2}
            strokeDasharray="4 4"
          />

          {/* Stacked areas with smooth curves */}
          {/* Debt (below baseline) */}
          {paths.debtPath && (
            <>
              <Path d={paths.debtPath} fill="url(#debtGrad)" />
              {paths.debtLine && (
                <Path
                  d={paths.debtLine}
                  stroke={debtColor}
                  strokeWidth={1.5}
                  fill="none"
                  opacity={0.6}
                />
              )}
            </>
          )}

          {/* Cash (bottom layer) */}
          <Path d={paths.cashPath} fill="url(#cashGrad)" />
          {paths.cashLine && (
            <Path
              d={paths.cashLine}
              stroke={cashColor}
              strokeWidth={1.5}
              fill="none"
              opacity={0.7}
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
              opacity={0.7}
            />
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

          {/* Y-axis labels on the right */}
          {showLabels && (
            <>
              <SvgText
                x={plotRight - 4}
                y={yFor(maxVal) + 12}
                fill={muted}
                fontSize="10"
                textAnchor="end"
              >
                {formatCompact(maxVal)}
              </SvgText>
              <SvgText
                x={plotRight - 4}
                y={yFor(0) - 4}
                fill={muted}
                fontSize="10"
                textAnchor="end"
              >
                0
              </SvgText>
            </>
          )}

          {/* Inline legend - top right corner */}
          {showLabels && (
            <G>
              {/* Semi-transparent background */}
              <Rect
                x={plotRight - 135}
                y={plotTop + 8}
                width={130}
                height={70}
                rx={6}
                fill={bgDefault}
                opacity={0.92}
              />

              {/* Cash */}
              <Rect
                x={plotRight - 127}
                y={plotTop + 16}
                width={10}
                height={10}
                rx={2}
                fill={cashColor}
              />
              <SvgText
                x={plotRight - 112}
                y={plotTop + 25}
                fill={text}
                fontSize="10"
                fontWeight="600"
              >
                Cash
              </SvgText>
              <SvgText
                x={plotRight - 8}
                y={plotTop + 25}
                fill={cashColor}
                fontSize="10"
                fontWeight="700"
                textAnchor="end"
              >
                {formatCompact(currentValues.cash)}
              </SvgText>

              {/* Investments */}
              <Rect
                x={plotRight - 127}
                y={plotTop + 34}
                width={10}
                height={10}
                rx={2}
                fill={investColor}
              />
              <SvgText
                x={plotRight - 112}
                y={plotTop + 43}
                fill={text}
                fontSize="10"
                fontWeight="600"
              >
                Invest
              </SvgText>
              <SvgText
                x={plotRight - 8}
                y={plotTop + 43}
                fill={investColor}
                fontSize="10"
                fontWeight="700"
                textAnchor="end"
              >
                {formatCompact(currentValues.investments)}
              </SvgText>

              {/* Debt */}
              {currentValues.debt > 0 && (
                <>
                  <Rect
                    x={plotRight - 127}
                    y={plotTop + 52}
                    width={10}
                    height={10}
                    rx={2}
                    fill={debtColor}
                  />
                  <SvgText
                    x={plotRight - 112}
                    y={plotTop + 61}
                    fill={text}
                    fontSize="10"
                    fontWeight="600"
                  >
                    Debt
                  </SvgText>
                  <SvgText
                    x={plotRight - 8}
                    y={plotTop + 61}
                    fill={debtColor}
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="end"
                  >
                    -{formatCompact(currentValues.debt)}
                  </SvgText>
                </>
              )}
            </G>
          )}
        </G>
      </Svg>
    </View>
  );
};
