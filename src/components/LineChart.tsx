import React from 'react';
import { View, LayoutChangeEvent, Animated, Easing } from 'react-native';
import Svg, { Path, Line, G, Defs, LinearGradient, Stop, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { useThemeTokens } from '../theme/ThemeProvider';

type Point = { t: number; v: number };

type Props = {
  data: Point[];
  height?: number;
  padding?: { left?: number; right?: number; bottom?: number; top?: number };
  yAxisWidth?: number;   // space reserved for y-axis labels (px)
  showArea?: boolean;
  baselineValue?: number;
  showMarker?: boolean;
  currency?: string;     // for label symbol (narrow)
  enableTooltip?: boolean;
  showCurrentLabel?: boolean; // show a small tag with latest value
};

// Compact "1k / 2m" style without decimals and with a narrow currency symbol
function formatYAxis(value: number, currency: string = 'USD'): string {
  const code = (currency || 'USD').toUpperCase();
  try {
    // Use Intl with no decimals
    const nf = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
      notation: 'compact',
      compactDisplay: 'short',
    });
    return nf.format(value);
  } catch {
    // Simple fallback
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    const units = abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : abs >= 1e3 ? [1e3, 'K'] : [1, ''];
    const n = Math.floor(abs / (units[0] as number));
    const sym = code === 'SGD' ? 'S$' : code === 'USD' ? '$' : code;
    return `${sign}${sym}${n}${units[1]}`;
  }
}

// Exact currency with 2 decimals for tooltip / current value
function formatExact(value: number, currency: string = 'USD'): string {
  const code = (currency || 'USD').toUpperCase();
  try {
    const nf = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      notation: 'standard',
    });
    return nf.format(value);
  } catch {
    const sym = code === 'SGD' ? 'S$' : code === 'USD' ? '$' : code + ' ';
    return `${sym}${value.toFixed(2)}`;
  }
}

// Nice ticks (rounded) for y-axis
function niceTicks(min: number, max: number, count: number): number[] {
  if (!isFinite(min) || !isFinite(max) || count <= 0) return [0];
  if (min === max) {
    const step = Math.pow(10, Math.floor(Math.log10(Math.max(1, Math.abs(min)))));
    return [min - step, min, min + step, min + 2 * step];
  }
  const span = max - min;
  const step0 = span / Math.max(1, count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const candidates = [1, 2, 5, 10];
  let step = candidates[0] * mag;
  for (let i = 1; i < candidates.length; i++) {
    const s = candidates[i] * mag;
    if (Math.abs(step0 - s) < Math.abs(step0 - step)) step = s;
  }
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + 1e-9; v += step) ticks.push(v);
  // Ensure at least 3-4 ticks
  if (ticks.length < 3) {
    ticks.unshift(niceMin - step);
    ticks.push(niceMax + step);
  }
  return ticks;
}

export default function LineChart({
  data,
  height = 180,
  padding,
  yAxisWidth = 0,
  showArea = true,
  baselineValue,
  showMarker = true,
  currency = 'USD',
  enableTooltip = true,
  showCurrentLabel = true,
}: Props) {
  const { get } = useThemeTokens();
  // You can set left/right to 0 — yAxisWidth keeps a bit of space for labels
  const pad = { left: 0, right: 6, bottom: 26, top: 10, ...(padding || {}) };

  const [layoutW, setLayoutW] = React.useState<number>(340);
  const onLayout = (e: LayoutChangeEvent) => {
    const lw = e.nativeEvent.layout.width || 340;
    setLayoutW(lw);
  };
  const w = layoutW;
  const h = height;

  const values = data.map(d => d.v);
  const minRaw = values.length ? Math.min(...values) : 0;
  const maxRaw = values.length ? Math.max(...values) : 1;
  // Guard when min == max to avoid div-by-zero
  const padRange = maxRaw === minRaw ? Math.max(1, Math.abs(maxRaw)) * 0.05 : 0;
  const min = minRaw - padRange;
  const max = maxRaw + padRange;
  const range = Math.max(1e-6, max - min);

  const times = data.map(d => d.t);
  const tmin = times[0] ?? 0;
  const tmax = times[times.length-1] ?? 1;
  const trange = Math.max(1, tmax - tmin);

  const accent = get('accent.primary') as string;
  const grid = get('border.subtle') as string;
  const axis = get('border.subtle') as string; // solid axis lines
  const label = get('text.muted') as string;
  const tipBg = get('surface.level2') as string;
  const tipText = get('text.primary') as string;

  // Plot frame — inner drawable area
  const plotLeft = pad.left + yAxisWidth;
  const plotRight = w - pad.right;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const plotTop = pad.top;
  const plotBottom = h - pad.bottom;
  const plotHeight = Math.max(1, plotBottom - plotTop);

  const xFor = (t: number) => plotLeft + ((t - tmin) / trange) * plotWidth;
  const yFor = (v: number) => plotBottom - ((v - min) / range) * plotHeight;

  // Rounded y-axis ticks
  const yTicks = niceTicks(min, max, 4);

  // x-axis month ticks (cap to ~6 labels)
  const monthTicks: Array<{ t: number; label: string }> = [];
  if (data.length > 1) {
    const start = new Date(tmin);
    const m0 = new Date(start.getFullYear(), start.getMonth(), 1).getTime();
    let cur = m0 < tmin ? new Date(start.getFullYear(), start.getMonth() + 1, 1).getTime() : m0;
    while (cur <= tmax) {
      const d = new Date(cur);
      monthTicks.push({ t: cur, label: d.toLocaleString(undefined, { month: 'short' }) });
      cur = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    }
    const maxTicks = 6;
    if (monthTicks.length > maxTicks) {
      const step = Math.ceil(monthTicks.length / maxTicks);
      for (let i = monthTicks.length - 2; i > 0; i--) {
        if (i % step !== 0) monthTicks.splice(i, 1);
      }
    }
  }

  const pathD = React.useMemo(() => {
    if (!data.length) return '';
    let d = `M ${xFor(data[0].t)} ${yFor(data[0].v)}`;
    for (let i = 1; i < data.length; i++) d += ` L ${xFor(data[i].t)} ${yFor(data[i].v)}`;
    return d;
  }, [tmin, tmax, min, max, data, plotLeft, plotWidth, plotBottom, plotHeight]);

  const areaD = React.useMemo(() => {
    if (!data.length) return '';
    let d = `M ${xFor(data[0].t)} ${plotBottom}`;
    d += ` L ${xFor(data[0].t)} ${yFor(data[0].v)}`;
    for (let i = 1; i < data.length; i++) d += ` L ${xFor(data[i].t)} ${yFor(data[i].v)}`;
    d += ` L ${xFor(data[data.length-1].t)} ${plotBottom} Z`;
    return d;
  }, [tmin, tmax, min, max, data, plotLeft, plotWidth, plotBottom, plotHeight]);

  const lastX = data.length ? xFor(data[data.length-1].t) : plotLeft;
  const lastY = data.length ? yFor(data[data.length-1].v) : plotBottom;
  const baselineY = baselineValue !== undefined ? yFor(baselineValue) : undefined;

  // Tooltip / crosshair interaction (tooltip pinned to top)
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const hasHover = enableTooltip && hoverIdx !== null && data[hoverIdx];

  const handleTouch = (xPix: number) => {
    if (!enableTooltip || !data.length) return;
    const svgX = (xPix / Math.max(1, w)) * w;
    const chartX = Math.max(plotLeft, Math.min(svgX, plotRight));
    const t = tmin + ((chartX - plotLeft) / Math.max(1e-6, plotWidth)) * trange;
    let lo = 0, hi = times.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (times[mid] < t) lo = mid + 1; else hi = mid;
    }
    let idx = lo;
    if (idx > 0 && (idx >= times.length || Math.abs(times[idx-1] - t) < Math.abs(times[idx] - t))) idx = idx - 1;
    setHoverIdx(idx);
  };

  const onStart = (e: any) => handleTouch(e.nativeEvent.locationX);
  const onMove = (e: any) => handleTouch(e.nativeEvent.locationX);
  const onEnd = () => setHoverIdx(null);

  const hoverX = hasHover ? xFor(data[hoverIdx!].t) : 0;
  const hoverY = hasHover ? yFor(data[hoverIdx!].v) : 0;
  const tipDate = hasHover ? new Date(data[hoverIdx!].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const tipValue = hasHover ? formatExact(data[hoverIdx!].v, currency) : '';

  // Tooltip box pinned to top
  const boxW = 140, boxH = 40, padBox = 8;
  let tipX = hoverX + 8;
  const tipY = plotTop + 6; // fixed at top
  if (tipX + boxW > plotRight) tipX = hoverX - boxW - 8;
  if (tipX < plotLeft) tipX = plotLeft;

  // Breathing effect for current marker
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, [pulse]);
  const AnimatedCircle = Animated.createAnimatedComponent(Circle);
  const pulseR = pulse.interpolate({ inputRange: [0,1], outputRange: [6, 12] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0,1], outputRange: [0.25, 0] });

  // Current value tag near latest point (always visible)
  const curValue = data.length ? formatExact(data[data.length-1].v, currency) : '';
  const curBoxW = Math.min(180, Math.max(60, curValue.length * 7 + 14));
  let curX = lastX + 8;
  let curY = lastY - 16 - 8;
  if (curX + curBoxW > plotRight) curX = lastX - curBoxW - 8;
  if (curX < plotLeft) curX = plotLeft;
  if (curY < plotTop) curY = lastY + 8;

  return (
    <View
      onLayout={onLayout}
      onStartShouldSetResponder={() => enableTooltip}
      onMoveShouldSetResponder={() => enableTooltip}
      onResponderGrant={onStart}
      onResponderMove={onMove}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}
    >
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <LinearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity={0.24} />
            <Stop offset="1" stopColor={accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <G>
          {/* SOLID axes */}
          <Line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} stroke={axis} strokeWidth={1} />
          <Line x1={plotLeft} x2={plotLeft}  stroke={axis} strokeWidth={1} />

          {/* dotted horizontal gridlines at y ticks (excluding axes line) */}
          {yTicks.map((v, i) => {
            const y = yFor(v);
            if (Math.abs(y - plotBottom) < 0.5) return null; // skip axis line
            return <Line key={`gy${i}`} x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke={grid} strokeWidth={1} strokeDasharray="2 2" />;
          })}

          {/* baseline */}
          {baselineY !== undefined ? (
            <Line x1={plotLeft} x2={plotRight} y1={baselineY} y2={baselineY} stroke={grid} strokeWidth={1} strokeDasharray="4 4" />
          ) : null}

          {/* area + line */}
          {showArea && areaD ? <Path d={areaD} fill="url(#lcGrad)" /> : null}
          {pathD ? <Path d={pathD} stroke={accent} strokeWidth={2} fill="none" /> : null}

          {/* current marker with breathing */}
          {showMarker && data.length ? (
            <G>
              <AnimatedCircle cx={lastX as any} cy={lastY as any} r={pulseR as any} fill={accent as any} opacity={pulseOpacity as any} />
              <Circle cx={lastX} cy={lastY} r={3.5} fill={accent} />
            </G>
          ) : null}

          {/* y-axis labels (reserved yAxisWidth) */}
          {yTicks.map((v, i) => {
            const y = yFor(v);
            return <SvgText key={`y${i}`} x={pad.left + 2} y={y - 2} fill={label} fontSize="10">{formatYAxis(v, currency)}</SvgText>;
          })}

          {/* x-axis month labels */}
          {monthTicks.map((m, i) => {
            const x = xFor(m.t);
            return <SvgText key={`m${i}`} x={x} y={h - 4} fill={label} fontSize="10" textAnchor="middle">{m.label}</SvgText>;
          })}

          {/* crosshair + tooltip (tooltip pinned to top) */}
          {enableTooltip && hasHover ? (
            <G>
              <Line x1={hoverX} x2={hoverX} y1={plotTop} y2={plotBottom} stroke={accent} strokeWidth={1.5} strokeDasharray="2 2" />
              <Circle cx={hoverX} cy={hoverY} r={4} fill={accent} />
              <Rect x={tipX} y={tipY} width={boxW} height={boxH} rx={8} fill={tipBg} />
              <SvgText x={tipX + padBox} y={tipY + 16} fill={tipText} fontSize="11">{tipValue}</SvgText>
              <SvgText x={tipX + padBox} y={tipY + 30} fill={label} fontSize="10">{tipDate}</SvgText>
            </G>
          ) : null}

          {/* current value tag (always on) */}
          {showCurrentLabel && data.length ? (
            <G>
              <Rect x={curX} y={curY} width={curBoxW} height={22} rx={8} fill={tipBg} />
              <SvgText x={curX + 8} y={curY + 15} fill={tipText} fontSize="11">{curValue}</SvgText>
            </G>
          ) : null}
        </G>
      </Svg>
    </View>
  );
}