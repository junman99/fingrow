import React, { useMemo } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, G, Line, Text as SvgText } from 'react-native-svg';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';

type DataPoint = {
  t: number; // timestamp
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

export const CompoundBarChart: React.FC<Props> = ({
  data,
  height = 220,
  padding,
  showLabels = true,
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
  const bgDefault = get('background.default') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const warningColor = get('semantic.warning') as string;
  const successColor = get('semantic.success') as string;

  // Bar colors - using theme colors with opacity
  const netWorthColor = successColor;
  const netWorthNegativeColor = warningColor;

  // Calculate bounds and net worth for each bar
  const { minVal, maxVal, bars } = useMemo(() => {
    if (!data.length) return { minVal: 0, maxVal: 1, bars: [] };

    const bars = data.map(d => ({
      t: d.t,
      netWorth: d.cash + d.investments - d.debt,
      cash: d.cash,
      investments: d.investments,
      debt: d.debt,
    }));

    let minVal = Math.min(0, ...bars.map(b => b.netWorth));
    let maxVal = Math.max(0, ...bars.map(b => b.netWorth));

    // Add padding to range
    const range = maxVal - minVal;
    minVal -= range * 0.1;
    maxVal += range * 0.1;

    // Ensure we have some range
    if (Math.abs(maxVal - minVal) < 1) {
      minVal = -1;
      maxVal = 1;
    }

    return { minVal, maxVal, bars };
  }, [data]);

  const range = Math.max(1, maxVal - minVal);

  const plotLeft = pad.left;
  const plotRight = w - pad.right;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotTop = pad.top;
  const plotBottom = h - pad.bottom;
  const plotHeight = Math.max(1, plotBottom - plotTop);

  const yFor = (v: number) => plotBottom - ((v - minVal) / range) * plotHeight;
  const zeroY = yFor(0);

  // Calculate bar positions
  const barData = useMemo(() => {
    if (!bars.length) return [];

    const barCount = bars.length;
    const totalGapRatio = 0.2; // 20% of space for gaps
    const gapWidth = (plotWidth * totalGapRatio) / Math.max(1, barCount + 1);
    const totalBarWidth = plotWidth - gapWidth * (barCount + 1);
    const barWidth = Math.max(2, totalBarWidth / barCount);

    return bars.map((bar, i) => {
      const x = plotLeft + gapWidth * (i + 1) + barWidth * i;
      const barHeight = Math.abs(yFor(bar.netWorth) - zeroY);
      const barY = bar.netWorth >= 0 ? yFor(bar.netWorth) : zeroY;

      return {
        x,
        y: barY,
        width: barWidth,
        height: barHeight,
        netWorth: bar.netWorth,
        t: bar.t,
        isPositive: bar.netWorth >= 0,
      };
    });
  }, [bars, plotLeft, plotWidth, zeroY]);

  // X-axis labels - show first, middle, and last
  const xAxisLabels = useMemo(() => {
    if (data.length === 0) return [];
    const labels: Array<{ t: number; label: string; x: number }> = [];

    // Determine format based on data length
    const daysDiff = (data[data.length - 1].t - data[0].t) / (24 * 3600 * 1000);

    let indices: number[] = [];
    if (data.length <= 7) {
      // Show all days for 1W
      indices = data.map((_, i) => i);
    } else if (data.length <= 31) {
      // Show every ~5 days for 1M
      const step = Math.ceil(data.length / 6);
      indices = data.map((_, i) => i).filter((_, i) => i % step === 0 || i === data.length - 1);
    } else {
      // Show first, some middle, and last
      const step = Math.floor(data.length / 5);
      indices = [0];
      for (let i = step; i < data.length - 1; i += step) {
        indices.push(i);
      }
      indices.push(data.length - 1);
    }

    indices.forEach(i => {
      const d = new Date(data[i].t);
      let label: string;

      if (daysDiff <= 31) {
        // For 1W and 1M: show day
        label = d.getDate().toString();
      } else if (daysDiff <= 90) {
        // For 3M: show date
        label = `${d.getMonth() + 1}/${d.getDate()}`;
      } else {
        // For 6M, 1Y, ALL: show month
        label = d.toLocaleString(undefined, { month: 'short' });
      }

      if (barData[i]) {
        labels.push({
          t: data[i].t,
          label,
          x: barData[i].x + barData[i].width / 2,
        });
      }
    });

    return labels;
  }, [data, barData]);

  // Y-axis labels
  const yAxisLabels = useMemo(() => {
    return [
      { value: maxVal, y: yFor(maxVal) },
      { value: 0, y: zeroY },
      ...(minVal < 0 ? [{ value: minVal, y: yFor(minVal) }] : []),
    ];
  }, [maxVal, minVal, zeroY]);

  // Current net worth for legend
  const currentNetWorth = bars.length > 0 ? bars[bars.length - 1].netWorth : 0;

  return (
    <View onLayout={onLayout}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <G>
          {/* Zero baseline - more prominent */}
          <Line
            x1={plotLeft}
            x2={plotRight}
            y1={zeroY}
            y2={zeroY}
            stroke={border}
            strokeWidth={2}
            strokeDasharray="4 4"
          />

          {/* Y-axis grid lines */}
          {yAxisLabels.map((tick, i) => (
            <G key={`y${i}`}>
              <Line
                x1={plotLeft}
                x2={plotRight}
                y1={tick.y}
                y2={tick.y}
                stroke={border}
                strokeWidth={0.5}
                opacity={0.3}
              />
              {showLabels && (
                <SvgText
                  x={plotRight - 4}
                  y={tick.y - 4}
                  fill={muted}
                  fontSize="10"
                  textAnchor="end"
                >
                  {formatCompact(tick.value)}
                </SvgText>
              )}
            </G>
          ))}

          {/* Bars */}
          {barData.map((bar, i) => (
            <Rect
              key={`bar${i}`}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              fill={bar.isPositive ? netWorthColor : netWorthNegativeColor}
              opacity={isDark ? 0.8 : 0.7}
              rx={Math.min(2, bar.width / 4)}
            />
          ))}

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
          {showLabels && xAxisLabels.map((tick, i) => (
            <SvgText
              key={`x${i}`}
              x={tick.x}
              y={h - 4}
              fill={muted}
              fontSize="10"
              textAnchor="middle"
            >
              {tick.label}
            </SvgText>
          ))}

          {/* Legend - top left corner */}
          {showLabels && (
            <G>
              <Rect
                x={plotLeft + 8}
                y={plotTop + 8}
                width={100}
                height={32}
                rx={6}
                fill={bgDefault}
                opacity={0.92}
              />
              <Rect
                x={plotLeft + 16}
                y={plotTop + 16}
                width={10}
                height={10}
                rx={2}
                fill={currentNetWorth >= 0 ? netWorthColor : netWorthNegativeColor}
              />
              <SvgText
                x={plotLeft + 31}
                y={plotTop + 25}
                fill={text}
                fontSize="10"
                fontWeight="600"
              >
                Net Worth
              </SvgText>
              <SvgText
                x={plotLeft + 100}
                y={plotTop + 25}
                fill={currentNetWorth >= 0 ? netWorthColor : netWorthNegativeColor}
                fontSize="10"
                fontWeight="700"
                textAnchor="end"
              >
                {formatCompact(currentNetWorth)}
              </SvgText>
            </G>
          )}
        </G>
      </Svg>
    </View>
  );
};
