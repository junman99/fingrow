import React from 'react';
import { View, LayoutChangeEvent, Animated, Easing } from 'react-native';
import Svg, { Path, Line, G, Defs, LinearGradient, Stop, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useThemeTokens } from '../theme/ThemeProvider';
import { ScrollContext } from './ScrollContext';

type Point = { t: number; v: number };
type CashEvent = { date: string; amount: number };

type Props = {
  data: Point[];
  height?: number;
  padding?: { left?: number; right?: number; bottom?: number; top?: number };
  yAxisWidth?: number;   // space reserved for y-axis labels (px)
  xTickStrategy?: { mode: 'auto' | 'day' | 'month'; every?: number };
  showArea?: boolean;
  baselineValue?: number;
  showMarker?: boolean;
  currency?: string;     // for label symbol (narrow)
  enableTooltip?: boolean;
  showCurrentLabel?: boolean; // show a small tag with latest value
  cashEvents?: CashEvent[]; // cash deposit/withdrawal markers
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
  xTickStrategy,
  showArea = true,
  baselineValue,
  showMarker = true,
  currency = 'USD',
  enableTooltip = true,
  showCurrentLabel = true,
  cashEvents = [],
}: Props) {
  const { get } = useThemeTokens();
  const { setScrollEnabled } = React.useContext(ScrollContext);
  const enableParent = React.useCallback(() => setScrollEnabled && setScrollEnabled(true), [setScrollEnabled]);
  const disableParent = React.useCallback(() => setScrollEnabled && setScrollEnabled(false), [setScrollEnabled]);
  // You can set left/right to 0 — yAxisWidth keeps a bit of space for labels
  const pad = { left: 6, right: 10, bottom: 26, top: 10, ...(padding || {}) };

  // Pinch-to-zoom state
  const [scale, setScale] = React.useState(1);
  const [panOffset, setPanOffset] = React.useState(0);
  const scaleRef = React.useRef(1);
  const panOffsetRef = React.useRef(0);
  const savedScaleRef = React.useRef(1);
  const savedPanRef = React.useRef(0);

  const [layoutW, setLayoutW] = React.useState<number>(340);
  const onLayout = (e: LayoutChangeEvent) => {
    const lw = e.nativeEvent.layout.width || 340;
    setLayoutW(lw);
  };
  const w = layoutW;
  const h = height;

  // Calculate visible data window based on zoom and pan
  const visibleData = React.useMemo(() => {
    if (!data.length) return data;

    const totalRange = data[data.length - 1].t - data[0].t;
    const visibleRange = totalRange / scale;

    // Calculate center point with pan offset
    const centerRatio = 0.5 + panOffset;
    const clampedCenter = Math.max(visibleRange / (2 * totalRange), Math.min(1 - visibleRange / (2 * totalRange), centerRatio));

    const centerTime = data[0].t + totalRange * clampedCenter;
    const startTime = centerTime - visibleRange / 2;
    const endTime = centerTime + visibleRange / 2;

    return data.filter(d => d.t >= startTime && d.t <= endTime);
  }, [data, scale, panOffset]);

  const values = visibleData.map(d => d.v);
  const suppressXAxisLabels = !visibleData.length || values.every(v => v === 0);
  const minRaw = values.length ? Math.min(...values) : 0;
  const maxRaw = values.length ? Math.max(...values) : 1;
  // Guard when min == max to avoid div-by-zero
  const padRange = maxRaw === minRaw ? Math.max(1, Math.abs(maxRaw)) * 0.05 : 0;
  const min = minRaw - padRange;
  const max = maxRaw + padRange;
  const range = Math.max(1e-6, max - min);

  const times = visibleData.map(d => d.t);
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
  // x-axis ticks - dynamically adjust based on zoom level
  const dayTicks: Array<{ t: number; label: string }> = [];
  const autoEvery = Math.max(1, Math.round(visibleData.length / 6));
  if ((xTickStrategy?.mode === 'day' || scale > 3) && visibleData.length) {
    const every = xTickStrategy?.mode === 'day' ? Math.max(1, Math.round(xTickStrategy.every || 1)) : autoEvery;
    for (let i = 0; i < visibleData.length; i += every) {
      const d = new Date(visibleData[i].t);
      const label = d.toLocaleString(undefined, { day: '2-digit', month: 'short' }); // e.g., "12 Sep"
      dayTicks.push({ t: visibleData[i].t, label });
    }
  }


  // x-axis month ticks (cap to ~6 labels)
  const monthTicks: Array<{ t: number; label: string }> = [];
  if (visibleData.length > 1 && scale <= 3) {
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
    if (!visibleData.length) return '';
    let d = `M ${xFor(visibleData[0].t)} ${yFor(visibleData[0].v)}`;
    for (let i = 1; i < visibleData.length; i++) d += ` L ${xFor(visibleData[i].t)} ${yFor(visibleData[i].v)}`;
    return d;
  }, [tmin, tmax, min, max, visibleData, plotLeft, plotWidth, plotBottom, plotHeight]);

  const areaD = React.useMemo(() => {
    if (!visibleData.length) return '';
    let d = `M ${xFor(visibleData[0].t)} ${plotBottom}`;
    d += ` L ${xFor(visibleData[0].t)} ${yFor(visibleData[0].v)}`;
    for (let i = 1; i < visibleData.length; i++) d += ` L ${xFor(visibleData[i].t)} ${yFor(visibleData[i].v)}`;
    d += ` L ${xFor(visibleData[visibleData.length-1].t)} ${plotBottom} Z`;
    return d;
  }, [tmin, tmax, min, max, visibleData, plotLeft, plotWidth, plotBottom, plotHeight]);

  const lastX = visibleData.length ? xFor(visibleData[visibleData.length-1].t) : plotLeft;
  const lastY = visibleData.length ? yFor(visibleData[visibleData.length-1].v) : plotBottom;
  const baselineY = baselineValue !== undefined ? yFor(baselineValue) : undefined;

  // Tooltip / crosshair interaction (tooltip pinned to top)
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const hasHover = enableTooltip && hoverIdx !== null && visibleData[hoverIdx];
  const touchXRef = React.useRef(0);

  // Cash event marker interaction
  const [selectedCashEvent, setSelectedCashEvent] = React.useState<number | null>(null);

  const handleTouch = React.useCallback((xPix: number) => {
    if (!enableTooltip || !visibleData.length) return;
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
    // Close cash event tooltip when touching chart
    setSelectedCashEvent(null);
  }, [enableTooltip, visibleData, w, plotLeft, plotRight, tmin, plotWidth, trange, times]);

  const hoverX = hasHover ? xFor(visibleData[hoverIdx!].t) : 0;
  const hoverY = hasHover ? yFor(visibleData[hoverIdx!].v) : 0;
  const tipDate = hasHover ? new Date(visibleData[hoverIdx!].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const tipValue = hasHover ? formatExact(visibleData[hoverIdx!].v, currency) : '';

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
  const curValue = visibleData.length ? formatExact(visibleData[visibleData.length-1].v, currency) : '';
  const curBoxW = Math.min(180, Math.max(60, curValue.length * 7 + 14));
  let curX = lastX + 8;
  let curY = lastY - 16 - 8;
  if (curX + curBoxW > plotRight) curX = lastX - curBoxW - 8;
  if (curX < plotLeft) curX = plotLeft;
  if (curY < plotTop) curY = lastY + 8;

  // Pinch gesture for zoom - with safeguards for Expo Go
  const pinchGesture = React.useMemo(() =>
    Gesture.Pinch()
      .runOnJS(true)
      .onBegin(() => {
        savedScaleRef.current = scaleRef.current;
        savedPanRef.current = panOffsetRef.current;
      })
      .onStart(() => {
        if (disableParent) disableParent();
      })
      .onUpdate((event) => {
        // Only update if scale is changing significantly (avoid Expo Go dev menu conflicts)
        if (Math.abs(event.scale - 1) < 0.1) return;

        try {
          const newScale = Math.max(1, Math.min(20, savedScaleRef.current * event.scale));
          scaleRef.current = newScale;
          setScale(newScale);

          // Simple zoom - keep center stable
          if (newScale > 1 && newScale !== savedScaleRef.current) {
            const maxPan = 0.5 - (0.5 / newScale);
            const adjustedPan = savedPanRef.current * (savedScaleRef.current / newScale);
            const clampedPan = Math.max(-maxPan, Math.min(maxPan, adjustedPan));
            panOffsetRef.current = clampedPan;
            setPanOffset(clampedPan);
          } else if (newScale === 1) {
            // Reset pan when fully zoomed out
            panOffsetRef.current = 0;
            setPanOffset(0);
          }
        } catch (err) {
          console.error('Pinch error:', err);
        }
      })
      .onEnd(() => {
        if (enableParent) enableParent();
      })
      .onFinalize(() => {
        if (enableParent) enableParent();
      }),
    [data, disableParent, enableParent]
  );

  // Two-finger pan gesture for horizontal scrolling when zoomed
  const panGesture = React.useMemo(() =>
    Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .runOnJS(true)
      .onBegin(() => {
        savedPanRef.current = panOffsetRef.current;
      })
      .onStart(() => {
        if (disableParent) disableParent();
      })
      .onUpdate((event) => {
        // Only pan when zoomed in
        if (scaleRef.current <= 1) return;

        // Convert horizontal translation to pan offset
        // Negative translationX means swiping left (pan right), positive means swiping right (pan left)
        const totalRange = data.length ? data[data.length - 1].t - data[0].t : 1;
        const panDelta = -(event.translationX / plotWidth) * (totalRange / scaleRef.current) / totalRange;

        // Calculate new pan with limits
        const maxPan = 0.5 - (0.5 / scaleRef.current);
        const newPan = Math.max(-maxPan, Math.min(maxPan, savedPanRef.current + panDelta));

        panOffsetRef.current = newPan;
        setPanOffset(newPan);
      })
      .onEnd(() => {
        if (enableParent) enableParent();
      })
      .onFinalize(() => {
        if (enableParent) enableParent();
      }),
    [data, plotWidth, disableParent, enableParent]
  );

  // Single-finger touch gesture for tooltip - works for both hold and drag
  const tooltipGesture = React.useMemo(() =>
    Gesture.Pan()
      .enabled(enableTooltip)
      .maxPointers(1)
      .minDistance(0)
      .runOnJS(true)
      .onTouchesDown((event) => {
        // Immediate response on touch down
        if (event.numberOfTouches === 1) {
          if (disableParent) disableParent();
          handleTouch(event.allTouches[0].absoluteX);
        }
      })
      .onTouchesMove((event) => {
        // Update while dragging
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
      })
      .onTouchesUp(() => {
        setHoverIdx(null);
        if (enableParent) enableParent();
      })
      .onFinalize(() => {
        setHoverIdx(null);
      }),
    [enableTooltip, handleTouch, disableParent, enableParent]
  );

  // Combine gestures - pinch and pan work simultaneously, tooltip is separate
  const composedGesture = Gesture.Exclusive(
    Gesture.Simultaneous(pinchGesture, panGesture),
    tooltipGesture
  );

  return (
    <GestureDetector gesture={composedGesture}>
    <View onLayout={onLayout}>
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
  const minGap = 12;
  const y = yFor(v);
  const yClamped = Math.min(y, plotBottom - minGap);
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
          {showMarker && visibleData.length ? (
            <G>
              <AnimatedCircle cx={lastX as any} cy={lastY as any} r={pulseR as any} fill={accent as any} opacity={pulseOpacity as any} />
              <Circle cx={lastX} cy={lastY} r={3.5} fill={accent} />
            </G>
          ) : null}

          {/* y-axis labels (reserved yAxisWidth) */}
          {yTicks.map((v, i) => {
  const minGap = 12;
  const y = yFor(v);
  const yClamped = Math.min(y, plotBottom - minGap);
  if ((plotBottom - y) < minGap) { return null; }
            return <SvgText key={`y${i}`} x={pad.left + 2} y={y - 2} fill={label} fontSize="10">{formatYAxis(v, currency)}</SvgText>;
          })}

          {/* x-axis month labels */}
          {!suppressXAxisLabels && (dayTicks.length ? dayTicks : monthTicks).map((m, i) => {
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

          {/* Cash event markers */}
          {cashEvents.map((event, idx) => {
            const eventTime = new Date(event.date).getTime();
            // Only show markers within visible time range
            if (eventTime < tmin || eventTime > tmax) return null;

            const eventX = xFor(eventTime);
            const eventY = plotTop + 20; // Position near top of chart
            const isDeposit = event.amount > 0;
            const markerColor = isDeposit ? (get('semantic.success') as string) : (get('semantic.danger') as string);
            const isSelected = selectedCashEvent === idx;
            const markerSize = isSelected ? 10 : 7;

            // Cash event tooltip
            const cashLabel = `${isDeposit ? '+' : ''}${formatExact(event.amount, currency)}`;
            const cashDate = new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const cashBoxW = Math.max(100, cashLabel.length * 7 + 16);
            const cashBoxH = 36;

            // Center tooltip above marker
            let cashBoxX = eventX - cashBoxW / 2;
            let cashBoxY = eventY - cashBoxH - 12;

            // Keep tooltip within horizontal bounds
            if (cashBoxX < plotLeft + 4) cashBoxX = plotLeft + 4;
            if (cashBoxX + cashBoxW > plotRight - 4) cashBoxX = plotRight - cashBoxW - 4;

            // Keep tooltip within vertical bounds (if too close to top, show below marker instead)
            if (cashBoxY < plotTop + 4) {
              cashBoxY = eventY + markerSize + 12;
            }

            return (
              <G key={`cash-${idx}`}>
                {/* Vertical dashed line */}
                <Line
                  x1={eventX}
                  x2={eventX}
                  y1={eventY + markerSize + 2}
                  y2={plotBottom}
                  stroke={markerColor}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.5}
                />

                {/* Marker icon - dollar sign in circle */}
                <Circle
                  cx={eventX}
                  cy={eventY}
                  r={markerSize}
                  fill={markerColor}
                  onPress={() => setSelectedCashEvent(isSelected ? null : idx)}
                />
                <SvgText
                  x={eventX}
                  y={eventY + 4}
                  fill="#FFFFFF"
                  fontSize="9"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  $
                </SvgText>

                {/* Tooltip when selected */}
                {isSelected ? (
                  <G>
                    <Rect
                      x={cashBoxX}
                      y={cashBoxY}
                      width={cashBoxW}
                      height={cashBoxH}
                      rx={8}
                      fill={tipBg}
                    />
                    <SvgText x={cashBoxX + 8} y={cashBoxY + 17} fill={markerColor} fontSize="12" fontWeight="700">
                      {cashLabel}
                    </SvgText>
                    <SvgText x={cashBoxX + 8} y={cashBoxY + 30} fill={label} fontSize="10">
                      {cashDate}
                    </SvgText>
                  </G>
                ) : null}
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
    </GestureDetector>
  );
}