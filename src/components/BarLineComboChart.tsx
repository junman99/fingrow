import React, { useMemo } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Path, Defs, LinearGradient, Stop, G, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useThemeTokens } from '../theme/ThemeProvider';

type DataPoint = { t: number; v: number };

type Props = {
  data: DataPoint[];
  height?: number;
  padding?: { left?: number; right?: number; bottom?: number; top?: number };
  showLabels?: boolean;
  barWidth?: number;
};

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toFixed(0);
}

export const BarLineComboChart: React.FC<Props> = ({
  data,
  height = 200,
  padding,
  showLabels = true,
  barWidth = 8,
}) => {
  const { get, isDark } = useThemeTokens();
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
  const accent = get('accent.primary') as string;
  const success = get('semantic.success') as string;
  const danger = get('semantic.danger') as string;

  // Calculate bounds
  const { minVal, maxVal, times } = useMemo(() => {
    if (!data.length) return { minVal: 0, maxVal: 1, times: [] };

    const values = data.map(d => d.v);
    const times = data.map(d => d.t);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);

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

  // Sample data points for bars (show every nth point to avoid crowding)
  const barData = useMemo(() => {
    const step = Math.max(1, Math.floor(data.length / 30)); // Max 30 bars
    return data.filter((_, i) => i % step === 0);
  }, [data]);

  // Calculate moving average for trend line (smooth line)
  const trendLine = useMemo(() => {
    if (data.length < 5) return data;
    const window = 7; // 7-day moving average
    const trend: DataPoint[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(data.length, i + Math.ceil(window / 2));
      const slice = data.slice(start, end);
      const avg = slice.reduce((sum, d) => sum + d.v, 0) / slice.length;
      trend.push({ t: data[i].t, v: avg });
    }

    return trend;
  }, [data]);

  // Generate trend line path
  const trendPath = useMemo(() => {
    if (!trendLine.length) return '';
    let d = `M ${xFor(trendLine[0].t)} ${yFor(trendLine[0].v)}`;
    for (let i = 1; i < trendLine.length; i++) {
      d += ` L ${xFor(trendLine[i].t)} ${yFor(trendLine[i].v)}`;
    }
    return d;
  }, [trendLine, tmin, trange, minVal, range, plotLeft, plotWidth, plotBottom, plotHeight]);

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
          <LinearGradient id="barGradientUp" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={success} stopOpacity={0.8} />
            <Stop offset="1" stopColor={success} stopOpacity={0.4} />
          </LinearGradient>
          <LinearGradient id="barGradientDown" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={danger} stopOpacity={0.6} />
            <Stop offset="1" stopColor={danger} stopOpacity={0.3} />
          </LinearGradient>
        </Defs>

        <G>
          {/* Axes */}
          <Line
            x1={plotLeft}
            x2={plotRight}
            y1={plotBottom}
            y2={plotBottom}
            stroke={border}
            strokeWidth={1}
          />

          {/* Bars - colored based on increase/decrease from previous */}
          {barData.map((point, i) => {
            const x = xFor(point.t);
            const y = yFor(point.v);
            const barHeight = plotBottom - y;

            // Determine color based on change
            const prevValue = i > 0 ? barData[i - 1].v : point.v;
            const isUp = point.v >= prevValue;
            const barColor = isUp ? success : danger;
            const gradientId = isUp ? 'barGradientUp' : 'barGradientDown';

            return (
              <Rect
                key={`bar${i}`}
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={Math.max(2, barHeight)}
                fill={`url(#${gradientId})`}
                rx={barWidth / 2}
              />
            );
          })}

          {/* Trend line (moving average) - overlay on top */}
          <Path
            d={trendPath}
            stroke={accent}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* End point marker */}
          {trendLine.length > 0 && (
            <Circle
              cx={xFor(trendLine[trendLine.length - 1].t)}
              cy={yFor(trendLine[trendLine.length - 1].v)}
              r={4}
              fill={accent}
            />
          )}

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
                y={yFor(minVal) - 4}
                fill={muted}
                fontSize="10"
                textAnchor="end"
              >
                {formatCompact(minVal)}
              </SvgText>
            </>
          )}
        </G>
      </Svg>
    </View>
  );
};
