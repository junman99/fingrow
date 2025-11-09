
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, TouchableWithoutFeedback, Animated, Easing } from 'react-native';
import Svg, { Rect, G, Line, Text as SvgText } from 'react-native-svg';
import { useThemeTokens } from '../theme/ThemeProvider';
import { ScrollContext } from './ScrollContext';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { useBudgetsStore } from '../store/budgets';
import { useNavigation } from '@react-navigation/native';
import Icon from './Icon';

// ---- helpers for axis ----
const niceCeilTight = (value: number, headroom = 0.08) => {
  if (!isFinite(value) || value <= 0) return 1;
  const v = value * (1 + headroom);
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const n = v / base;
  const steps = [1, 1.2, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const s = steps.find(s => n <= s) ?? 10;
  return s * base;
};

const fmtMoneyShort = (n: number) => {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${sign}$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}m`;
  if (v >= 1_000)     return `${sign}$${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(v)}`;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const MonthCompareChart: React.FC = () => {
  const { get } = useThemeTokens();
  const { setScrollEnabled } = React.useContext(ScrollContext);
  const enableParent = React.useCallback(() => setScrollEnabled && setScrollEnabled(true), [setScrollEnabled]);
  const disableParent = React.useCallback(() => setScrollEnabled && setScrollEnabled(false), [setScrollEnabled]);
  const nav = useNavigation<any>();
  const { transactions, hydrate } = useTxStore();
  const { hydrate: hydrateBudget } = useBudgetsStore();

  useEffect(() => { hydrate(); hydrateBudget(); }, []);

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const [offset, setOffset] = useState(0);
  const [chartW, setChartW] = useState(0);
  const [labelW, setLabelW] = useState(0);

  const transactionsArray = Array.isArray(transactions) ? transactions : [];
  const earliestTxDate = useMemo(() => {
    const valid = transactionsArray
      .map((t: any) => new Date(t?.date))
      .filter(d => Number.isFinite(d?.getTime?.()) && d.getTime() <= now.getTime()) as Date[];
    if (!valid.length) return new Date(nowYear, nowMonth, 1);
    valid.sort((a, b) => a.getTime() - b.getTime());
    const first = valid[0];
    return new Date(first.getFullYear(), first.getMonth(), 1);
  }, [transactions, nowYear, nowMonth]);
  const minYear = earliestTxDate.getFullYear();
  const minMonth = earliestTxDate.getMonth();

  // scrub state & transitions
  const minOffset = Math.min(0, (minYear - nowYear) * 12 + (minMonth - nowMonth));

  const [hoverActive, setHoverActive] = useState(false);
  const [hoverI, setHoverI] = useState(0);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const gestureStart = useRef({ x: 0, y: 0 });
  const slide = useRef(new Animated.Value(0)).current;
  const [animating, setAnimating] = useState(false);

  // month picker modal
  const [mpOpen, setMpOpen] = useState(false);
  const [showLastMonth, setShowLastMonth] = useState(true);
  const [renderLastMonth, setRenderLastMonth] = useState(true);
  const lastMonthOpacity = useRef(new Animated.Value(1)).current;
  const ref = new Date(nowYear, nowMonth + offset, 1);
  const initialYear = Math.max(minYear, ref.getFullYear());
  const [mpYear, setMpYear] = useState(initialYear);

  const Y = ref.getFullYear(); const M = ref.getMonth();
  const prevRef = new Date(Y, M - 1, 1);
  const pY = prevRef.getFullYear(); const pM = prevRef.getMonth();

  // Animate last month opacity
  useEffect(() => {
    if (showLastMonth) {
      // Show: render immediately then fade in
      setRenderLastMonth(true);
      Animated.timing(lastMonthOpacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false
      }).start();
    } else {
      // Hide: fade out then stop rendering
      Animated.timing(lastMonthOpacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false
      }).start(({ finished }) => {
        if (finished) setRenderLastMonth(false);
      });
    }
  }, [showLastMonth]);

  const sameMonth = (d: Date, y: number, m: number) => d.getFullYear() === y && d.getMonth() === m;
  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const daysCurr = daysInMonth(Y, M);
  const daysPrev = daysInMonth(pY, pM);
  const isCurrent = offset === 0;
  const idxToday = isCurrent ? clamp(now.getDate() - 1, 0, daysCurr - 1) : daysCurr - 1;
  const daysPlotThis = isCurrent ? Math.min(daysCurr, idxToday + 1) : daysCurr;
  const daysPlotPrev = isCurrent ? Math.min(daysPrev, idxToday + 1) : daysPrev;

  const daily = (txs: any[], y: number, m: number, len: number) => {
    const source = Array.isArray(txs) ? txs : [];
    const arr = Array.from({ length: len }, () => 0);
    for (const t of source) {
      const d = new Date(t.date);
      if (sameMonth(d, y, m) && t.type === 'expense') arr[d.getDate() - 1] += Math.abs(Number(t.amount) || 0);
    }
    return arr;
  };

  const dailyThis = useMemo(() => daily(transactions, Y, M, daysCurr), [transactions, Y, M, daysCurr]);
  const dailyPrev = useMemo(() => daily(transactions, pY, pM, daysPrev), [transactions, pY, pM, daysPrev]);

  const sum = (arr: number[], n: number) => arr.slice(0, n).reduce((a, b) => a + b, 0);
  const sumThis = sum(dailyThis, daysPlotThis);
  const sumPrev = sum(dailyPrev, daysPlotPrev);
  const avgPerDay = sumThis / Math.max(1, daysPlotThis);
  const pace = sumThis - sumPrev;

// ===== DIMENSIONS =====
  const h = 180;
  const w = Math.max(1, chartW);
  const top = 18, bottom = 22;
  const rawMax = renderLastMonth
    ? Math.max(1, ...dailyThis.slice(0, daysPlotThis), ...dailyPrev.slice(0, daysPlotPrev))
    : Math.max(1, ...dailyThis.slice(0, daysPlotThis));
  const maxVal = niceCeilTight(rawMax);
  const left = Math.max(32, Math.min(42, labelW + 4));
  const right = 16;

  const innerW = Math.max(1, w - left - right);
  const innerH = Math.max(1, h - top - bottom);

  const xForIndex = (i: number) => left + (i * (innerW / Math.max(1, daysPlotThis)));
  const seg = innerW / Math.max(1, daysPlotThis);
  const bwNow = seg * 0.56;
  const bwPrev = seg * 0.28;

  const totalDaysVisible = isCurrent ? daysPlotThis : daysCurr;
  const parts = 3;
  const baseTicks = Array.from({ length: parts + 1 }, (_, i) =>
    clamp(Math.round(1 + i * ((totalDaysVisible - 1) / parts)), 1, totalDaysVisible)
  );
  const ticksX = Array.from(new Set(baseTicks));

  const insidePlot = (x: number, y: number) =>
    x >= left && x <= left + innerW && y >= top && y <= top + innerH;

  const idxFromX = (x: number) => clamp(Math.round((x - left) / seg), 0, daysPlotThis - 1);
  const centerX   = (i: number) => left + i * seg + seg / 2;

  const requestOffsetChange = (delta: number) => {
    if (delta === 0 || animating) return;
    const target = Math.max(minOffset, Math.min(0, offset + delta));
    const steps = target - offset;
    if (steps === 0) return;
    // Skip animation for multi-month jumps or when width not yet measured
    if (Math.abs(steps) > 1 || chartW === 0) {
      setHoverActive(false);
      slide.setValue(0);
      setOffset(target);
      return;
    }
    const direction = steps > 0 ? -1 : 1;
    setHoverActive(false);
    setAnimating(true);
    slide.stopAnimation();
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: direction,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start(() => {
      setOffset(target);
      slide.setValue(-direction);
      Animated.timing(slide, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start(() => {
        setAnimating(false);
      });
    });
  };

  const startScrub = (x: number, y: number) => {
    if (animating) return;
    if (!insidePlot(x, y)) { setHoverActive(false); return; }
    const i = idxFromX(x);
    gestureStart.current = { x, y };
    setHoverActive(true);
    setHoverI(i);
    setHoverPos({ x: centerX(i), y: top + 6 });
  };

  const moveScrub = (x: number, y: number) => {
    if (animating) return;
    if (!insidePlot(x, y)) return;
    const i = idxFromX(x);
    if (i !== hoverI) {
      setHoverI(i);
      setHoverPos({ x: centerX(i), y: top + 6 });
    }
  };

  const endScrub = (x: number, y: number) => {
    const dx = x - gestureStart.current.x;
    const dy = y - gestureStart.current.y;
    const swipeThreshold = 80;
    const verticalTolerance = 60;
    const isStrongSwipe = Math.abs(dx) > swipeThreshold && Math.abs(dy) < verticalTolerance;
    if (isStrongSwipe) {
      if (dx > 0) {
        requestOffsetChange(-1);
      } else if (dx < 0) {
        requestOffsetChange(1);
      }
      return;
    }
    if (!insidePlot(x, y)) setHoverActive(false);
  };

  const tipW = 152;
  const tipX = clamp(hoverPos.x - tipW / 2, left, left + innerW - tipW);
  const tipY = top + 6;

  const day = hoverI + 1;
  const dateLabel = new Date(Y, M, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const daySpend = dailyThis[hoverI] || 0;
  const mtdAtDay = sum(dailyThis, hoverI + 1);

  const openMonthPicker = () => {
    setMpYear(Math.max(minYear, Y));
    setMpOpen(true);
  };

  const selectMonth = (yr: number, mIdx: number) => {
    const newOffset = (yr - nowYear) * 12 + (mIdx - nowMonth);
    if (newOffset > 0 || newOffset < minOffset) return;
    setMpOpen(false);
    if (newOffset === offset) return;
    requestOffsetChange(newOffset - offset);
  };

  const accentPrimary = get('accent.primary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const borderSubtle = get('border.subtle') as string;
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const cardBg = surface1;

  const paceColor = pace > 0 ? (get('semantic.danger') as string) : (pace < 0 ? (get('semantic.success') as string) : textMuted);

  function withAlpha(hex: string, alpha: number) {
    if (!hex) return hex;
    if (hex.startsWith('rgba')) return hex;
    const raw = hex.replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
    const bigint = parseInt(expanded, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const slideRange = Math.max(chartW || 0, 240);
  const translateX = slide.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-slideRange, 0, slideRange],
  });
  const chartTransform = chartW
    ? [{ translateX: translateX }]
    : undefined;
  const leftDisabled = animating || chartW === 0 || offset <= minOffset;
  const rightDisabled = animating || chartW === 0 || offset >= 0;

  return (
    <View onLayout={e => setChartW(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s10 }}>
        <View style={{ flex: 1, paddingRight: spacing.s10 }}>
          <Text style={{ color: textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' }}>Month pace</Text>
          <Text style={{ color: textPrimary, fontSize: 26, fontWeight: '800', marginTop: spacing.s2 }}>${sumThis.toFixed(2)}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s6, marginTop: spacing.s6 }}>
            <View style={{ backgroundColor: surface2, borderRadius: radius.pill, paddingHorizontal: spacing.s10, paddingVertical: spacing.s6 }}>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>{`Avg ${avgPerDay ? `$${avgPerDay.toFixed(2)}/day` : '$0/day'}`}</Text>
            </View>
            <View style={{ backgroundColor: surface2, borderRadius: radius.pill, paddingHorizontal: spacing.s10, paddingVertical: spacing.s6 }}>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>{`Prev ${sumPrev ? `$${sumPrev.toFixed(2)}` : '$0'}`}</Text>
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: spacing.s4 }}>
          <Pressable
            onPress={openMonthPicker}
            hitSlop={10}
            style={({ pressed }) => ({
              borderRadius: radius.pill,
              paddingHorizontal: spacing.s10,
              paddingVertical: spacing.s6,
              backgroundColor: surface2,
              opacity: pressed ? 0.85 : 1
            })}
          >
            <Text style={{ color: textPrimary, fontWeight: '700' }}>
              {new Date(Y, M, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })}
            </Text>
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600' }}>vs last month</Text>
            <Text style={{ color: paceColor, fontWeight: '700' }}>
              {pace === 0 ? 'Even' : `${pace > 0 ? '+' : '-'}$${Math.abs(pace).toFixed(2)}`}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accentPrimary }} />
          <Text style={{ color: textMuted, fontSize: 11, fontWeight: '600' }}>This month</Text>
        </View>
        <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s4, opacity: lastMonthOpacity }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: withAlpha(textMuted, 0.5) }} />
          <Text style={{ color: textMuted, fontSize: 11, fontWeight: '600' }}>Last month</Text>
        </Animated.View>
      </View>

      <Animated.View style={chartTransform ? { transform: chartTransform } : undefined}>
        <View style={{ position: 'relative' }}>
          <Svg width={w} height={h}>
            <G>
              <Line x1={left} y1={top} x2={left} y2={top + innerH} stroke={borderSubtle} strokeWidth={1} />
              <Line x1={left} y1={top + innerH} x2={left + innerW} y2={top + innerH} stroke={borderSubtle} strokeWidth={1} />

              {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                const y = top + innerH * (1 - t);
                const val = Math.round(maxVal * t);
                return (
                  <G key={`gl-${idx}`}>
                    <Line x1={left} y1={y} x2={left + innerW} y2={y} stroke={borderSubtle} strokeDasharray="3 3" strokeWidth={1} />
                    <SvgText
                      x={left - 4}
                      y={y + 4 + (idx === 0 ? 4 : 0)}
                      fontSize="10"
                      fill={textMuted}
                      textAnchor="end"
                    >
                      {fmtMoneyShort(val)}
                    </SvgText>
                  </G>
                );
              })}

              {renderLastMonth && Array.from({ length: daysPlotPrev }).map((_, i) => {
                const v = dailyPrev[i] || 0;
                const barH = (v / Math.max(1, maxVal)) * innerH;
                const x = xForIndex(i) + (seg - bwPrev) / 2;
                const y = top + innerH - barH;
                return (
                  <Rect
                    key={`p-${i}`}
                    x={x}
                    y={y}
                    width={bwPrev}
                    height={barH}
                    rx={Math.min(6, radius.sm / 2)}
                    ry={Math.min(6, radius.sm / 2)}
                    fill={withAlpha(textMuted, 0.5)}
                    opacity={0.72}
                  />
                );
              })}

              {Array.from({ length: daysPlotThis }).map((_, i) => {
                const v = dailyThis[i] || 0;
                const barH = (v / Math.max(1, maxVal)) * innerH;
                const x = xForIndex(i) + (seg - bwNow) / 2;
                const y = top + innerH - barH;
                const isActive = hoverActive && i === hoverI;
                return (
                  <Rect
                    key={`t-${i}`}
                    x={x}
                    y={y}
                    width={bwNow}
                    height={barH}
                    rx={Math.min(6, radius.sm / 2)}
                    ry={Math.min(6, radius.sm / 2)}
                    fill={accentPrimary}
                    opacity={isActive ? 1 : 0.92}
                    stroke={isActive ? accentPrimary : 'none'}
                    strokeWidth={isActive ? 1.5 : 0}
                  />
                );
              })}

              {hoverActive && (
                <Line
                  x1={centerX(hoverI)}
                  y1={top}
                  x2={centerX(hoverI)}
                  y2={top + innerH}
                  stroke={accentPrimary}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.6}
                />
              )}

              {ticksX.map((d) => {
                const i = clamp(d - 1, 0, daysPlotThis - 1);
                const xCenter = xForIndex(i) + seg / 2;
                return (
                  <SvgText key={`x-${d}`} x={xCenter} y={top + innerH + 14} fontSize="10" fill={textMuted} textAnchor="middle">
                    {d}
                  </SvgText>
                );
              })}
            </G>
          </Svg>

          <View
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            pointerEvents="box-only"
            onStartShouldSetResponderCapture={() => true}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => { disableParent(); startScrub(e.nativeEvent.locationX, e.nativeEvent.locationY); }}
            onResponderMove={(e)  => moveScrub(e.nativeEvent.locationX, e.nativeEvent.locationY)}
            onResponderRelease={(e) => { endScrub(e.nativeEvent.locationX, e.nativeEvent.locationY); enableParent(); }}
            onResponderTerminate={() => { setHoverActive(false); enableParent(); }}
          />

          {hoverActive && (
            <View
              style={{
                position: 'absolute',
                left: tipX,
                top: tipY,
                width: tipW,
                borderRadius: radius.md,
                paddingVertical: 8,
                paddingHorizontal: spacing.s10,
                backgroundColor: surface2,
                borderWidth: 1,
                borderColor: borderSubtle
              }}
            >
              <Text style={{ color: textMuted, fontSize: 11 }}>{dateLabel}</Text>
              <Text style={{ color: textPrimary, fontWeight: '700' }}>{`$${daySpend.toFixed(2)} spent`}</Text>
              <Text style={{ color: textMuted, fontSize: 11 }}>{`MTD $${mtdAtDay.toFixed(2)}`}</Text>
            </View>
          )}
        </View>
      </Animated.View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.s2 }}>
        <Text style={{ color: textMuted, fontSize: 11, fontWeight: '500', fontStyle: 'italic' }}>
          Swipe to explore previous months
        </Text>
        <Pressable onPress={() => setShowLastMonth(!showLastMonth)} hitSlop={12} style={({ pressed }) => ({
          paddingVertical: spacing.s6,
          paddingHorizontal: spacing.s10,
          borderRadius: radius.pill,
          backgroundColor: showLastMonth ? accentPrimary : surface2,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.s4
        })}>
          <Icon name="calendar" size={14} color={showLastMonth ? textOnPrimary : accentPrimary} />
          <Text style={{ color: showLastMonth ? textOnPrimary : accentPrimary, fontWeight: '700', fontSize: 12 }}>Last month</Text>
        </Pressable>
      </View>

      <Modal visible={mpOpen} transparent animationType="fade" onRequestClose={() => setMpOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setMpOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(8,10,18,0.72)', justifyContent: 'center', alignItems: 'center', padding: spacing.s16 }}>
            <TouchableWithoutFeedback>
              <View style={{ width: '100%', maxWidth: 360, backgroundColor: cardBg, borderRadius: radius.xl, padding: spacing.s16, ...{ shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 } }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Select month</Text>
                  <Pressable onPress={() => setMpOpen(false)} hitSlop={8}>
                    <Text style={{ color: textMuted, fontSize: 16 }}>Close</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                  <Pressable
                    onPress={() => setMpYear(prev => (prev <= minYear ? prev : prev - 1))}
                    hitSlop={8}
                    style={{ padding: spacing.s8, opacity: mpYear <= minYear ? 0.3 : 1 }}
                    disabled={mpYear <= minYear}
                  >
                    <Text style={{ color: textPrimary, fontSize: 20 }}>‹</Text>
                  </Pressable>
                  <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18 }}>{mpYear}</Text>
                  <Pressable
                    onPress={() => setMpYear(prev => (prev >= nowYear ? prev : prev + 1))}
                    hitSlop={8}
                    style={{ padding: spacing.s8, opacity: mpYear >= nowYear ? 0.4 : 1 }}
                    disabled={mpYear >= nowYear}
                  >
                    <Text style={{ color: textPrimary, fontSize: 20 }}>›</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                  {MONTHS.map((lbl, idx) => {
                    const beforeEarliest = (mpYear < minYear) || (mpYear === minYear && idx < minMonth);
                    const afterNow = (mpYear > nowYear) || (mpYear === nowYear && idx > nowMonth);
                    const disabled = beforeEarliest || afterNow;
                    const isSelected = (mpYear === Y && idx === M);
                    return (
                      <Pressable
                        key={lbl}
                        onPress={() => { if (!disabled) selectMonth(mpYear, idx); }}
                        disabled={disabled}
                        style={{
                          width: '23%',
                          paddingVertical: spacing.s10,
                          borderRadius: radius.lg,
                          alignItems: 'center',
                          backgroundColor: isSelected ? surface2 : surface1,
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? accentPrimary : borderSubtle,
                          opacity: disabled ? 0.35 : 1
                        }}
                      >
                        <Text style={{ color: textPrimary, fontWeight: isSelected ? '700' : '500' }}>{lbl}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export const MonthCompareChartClassic: React.FC = () => {
  const { get } = useThemeTokens();
  const { setScrollEnabled } = React.useContext(ScrollContext);
  const enableParent = React.useCallback(() => setScrollEnabled && setScrollEnabled(true), [setScrollEnabled]);
  const disableParent = React.useCallback(() => setScrollEnabled && setScrollEnabled(false), [setScrollEnabled]);
  const nav = useNavigation<any>();
  const { transactions, hydrate } = useTxStore();
  const { hydrate: hydrateBudget } = useBudgetsStore();

  useEffect(() => { hydrate(); hydrateBudget(); }, []);

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const [offset, setOffset] = useState(0);
  const [chartW, setChartW] = useState(0);
  const [labelW, setLabelW] = useState(0);

  const transactionsArray = Array.isArray(transactions) ? transactions : [];
  const earliestTxDate = useMemo(() => {
    const valid = transactionsArray
      .map((t: any) => new Date(t?.date))
      .filter(d => Number.isFinite(d?.getTime?.()) && d.getTime() <= now.getTime()) as Date[];
    if (!valid.length) return new Date(nowYear, nowMonth, 1);
    valid.sort((a, b) => a.getTime() - b.getTime());
    const first = valid[0];
    return new Date(first.getFullYear(), first.getMonth(), 1);
  }, [transactions, nowYear, nowMonth]);
  const minYear = earliestTxDate.getFullYear();
  const minMonth = earliestTxDate.getMonth();
  const minOffset = Math.min(0, (minYear - nowYear) * 12 + (minMonth - nowMonth));

  // scrub state
  const [hoverActive, setHoverActive] = useState(false);
  const [hoverI, setHoverI] = useState(0);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // month picker modal
  const [mpOpen, setMpOpen] = useState(false);
  const ref = new Date(nowYear, nowMonth + offset, 1);
  const initialYear = Math.max(minYear, ref.getFullYear());
  const [mpYear, setMpYear] = useState(initialYear);

  const Y = ref.getFullYear(); const M = ref.getMonth();
  const prevRef = new Date(Y, M - 1, 1);
  const pY = prevRef.getFullYear(); const pM = prevRef.getMonth();

  // Animate last month opacity
  useEffect(() => {
    if (showLastMonth) {
      // Show: render immediately then fade in
      setRenderLastMonth(true);
      Animated.timing(lastMonthOpacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false
      }).start();
    } else {
      // Hide: fade out then stop rendering
      Animated.timing(lastMonthOpacity, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false
      }).start(({ finished }) => {
        if (finished) setRenderLastMonth(false);
      });
    }
  }, [showLastMonth]);

  const sameMonth = (d: Date, y: number, m: number) => d.getFullYear() === y && d.getMonth() === m;
  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const daysCurr = daysInMonth(Y, M);
  const daysPrev = daysInMonth(pY, pM);
  const isCurrent = offset === 0;
  const idxToday = isCurrent ? clamp(now.getDate() - 1, 0, daysCurr - 1) : daysCurr - 1;
  const daysPlotThis = isCurrent ? Math.min(daysCurr, idxToday + 1) : daysCurr;
  const daysPlotPrev = isCurrent ? Math.min(daysPrev, idxToday + 1) : daysPrev;

  const daily = (txs: any[], y: number, m: number, len: number) => {
    const source = Array.isArray(txs) ? txs : [];
    const arr = Array.from({ length: len }, () => 0);
    for (const t of source) {
      const d = new Date(t.date);
      if (sameMonth(d, y, m) && t.type === 'expense') arr[d.getDate() - 1] += Math.abs(Number(t.amount) || 0);
    }
    return arr;
  };

  const dailyThis = useMemo(() => daily(transactions, Y, M, daysCurr), [transactions, Y, M, daysCurr]);
  const dailyPrev = useMemo(() => daily(transactions, pY, pM, daysPrev), [transactions, pY, pM, daysPrev]);

  const sum = (arr: number[], n: number) => arr.slice(0, n).reduce((a, b) => a + b, 0);
  const sumThis = sum(dailyThis, daysPlotThis);
  const sumPrev = sum(dailyPrev, daysPlotPrev);
  const avgPerDay = sumThis / Math.max(1, daysPlotThis);
  const pace = sumThis - sumPrev;

  const leftDisabledClassic = offset <= minOffset;
  const rightDisabledClassic = offset >= 0;
  const changeOffsetClassic = (delta: number) => {
    const next = Math.max(minOffset, Math.min(0, offset + delta));
    if (next === offset) return;
    setOffset(next);
  };

  // ===== DIMENSIONS =====
  const h = 160; // original height
  const w = Math.max(1, chartW);
  const top = 8, bottom = 17; // compact bottom for controls
  // Y max and dynamic margins
  const rawMax = Math.max(1, ...dailyThis.slice(0, daysPlotThis), ...dailyPrev.slice(0, daysPlotPrev));
  const maxVal = niceCeilTight(rawMax);
  const left = Math.max(28, Math.min(38, labelW + 0));
  const right = 16; // mirror left

  const innerW = Math.max(1, w - left - right);
  const innerH = Math.max(1, h - top - bottom);

  const xForIndex = (i: number) => left + (i * (innerW / Math.max(1, daysPlotThis)));
  const seg = innerW / Math.max(1, daysPlotThis);
  const bwNow = seg * 0.56;
  const bwPrev = seg * 0.28;

  // ticks
  const totalDaysVisible = isCurrent ? daysPlotThis : daysCurr;
  const parts = 3;
  const baseTicks = Array.from({ length: parts + 1 }, (_, i) =>
    clamp(Math.round(1 + i * ((totalDaysVisible - 1) / parts)), 1, totalDaysVisible)
  );
  const ticksX = Array.from(new Set(baseTicks));

  // vertical slice selection
  const insidePlot = (x: number, y: number) =>
    x >= left && x <= left + innerW && y >= top && y <= top + innerH;

  const idxFromX = (x: number) => clamp(Math.round((x - left) / seg), 0, daysPlotThis - 1);
  const centerX   = (i: number) => left + i * seg + seg / 2;

  const startScrub = (x: number, y: number) => {
    if (!insidePlot(x, y)) { setHoverActive(false); return; }
    const i = idxFromX(x);
    setHoverActive(true);
    setHoverI(i);
    setHoverPos({ x: centerX(i), y: top + 6 }); // y unused for tip now
  };

  const moveScrub = (x: number, y: number) => {
    if (!insidePlot(x, y)) return;
    const i = idxFromX(x);
    if (i !== hoverI) {
      setHoverI(i);
      setHoverPos({ x: centerX(i), y: top + 6 });
    }
  };

  const endScrub = (x: number, y: number) => {
    if (!insidePlot(x, y)) setHoverActive(false);
  };

  // tooltip layout (anchored near top; stable Y)
  const tipW = 140;
  const tipH = 54;
  const tipX = clamp(hoverPos.x - tipW / 2, left, left + innerW - tipW);
  const tipY = top + 6; // fixed high position

  // derived values for tooltip (current displayed month only)
  const day = hoverI + 1;
  const dateLabel = new Date(Y, M, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const daySpend = dailyThis[hoverI] || 0;
  const mtdAtDay = sum(dailyThis, hoverI + 1);

  // month picker helpers
  const openMonthPicker = () => {
    setMpYear(Math.max(minYear, Y));
    setMpOpen(true);
  };

  const selectMonth = (yr: number, mIdx: number) => {
    const newOffset = (yr - nowYear) * 12 + (mIdx - nowMonth);
    if (newOffset > 0 || newOffset < minOffset) return;
    setMpOpen(false);
    setOffset(newOffset);
  };

  return (
    <Pressable accessibilityRole="button"
      onPress={() => { if (hoverActive) setHoverActive(false); }}
      style={{}}
      onLayout={e => setChartW(e.nativeEvent.layout.width)}
    >
      {/* hidden text to measure Y label width */}
      <Text
        style={{ position: 'absolute', opacity: 0, fontSize: 10 }}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          if (w > labelW) setLabelW(w);
        }}
      >
        {'$' + maxVal}
      </Text>

      {/* Header row: Stats only (title moved to page header) */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', marginBottom: spacing.s6 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{'Total Spent $' + sumThis.toFixed(2)}</Text>
          <Text style={{ color: get('text.muted') as string }}>
            {'$' + avgPerDay.toFixed(2) + '/day'}
          </Text>
        </View>
      </View>

      {/* Chart wrapper */}
      <View style={{ position: 'relative' }}>
        <Svg width={w} height={h}>
          <G>
            {/* Axes */}
            <Line x1={left} y1={top} x2={left} y2={top + innerH} stroke={get('border.subtle') as string} strokeWidth={1} />
            <Line x1={left} y1={top + innerH} x2={left + innerW} y2={top + innerH} stroke={get('border.subtle') as string} strokeWidth={1} />

            {/* Gridlines & Y labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
              const y = top + innerH * (1 - t);
              const val = Math.round(maxVal * t);
              return (
                <G key={`gl-${idx}`}>
                  <Line x1={left} y1={y} x2={left + innerW} y2={y} stroke={get('border.subtle') as string} strokeDasharray="3 3" strokeWidth={1} />
                  <SvgText
                    x={left - 2}
                    y={y + 4 + (idx === 0 ? 4 : 0)}
                    fontSize="10"
                    fill={get('text.muted') as string}
                    textAnchor="end"
                  >
                    {fmtMoneyShort(val)}
                  </SvgText>
                </G>
              );
            })}

            {/* Previous month bars (muted) */}
            {Array.from({ length: daysPlotPrev }).map((_, i) => {
              const v = dailyPrev[i] || 0;
              const barH = (v / Math.max(1, maxVal)) * innerH;
              const x = xForIndex(i) + (seg - bwPrev) / 2;
              const y = top + innerH - barH;
              return (
                <Rect
                  key={`p-${i}`}
                  x={x}
                  y={y}
                  width={bwPrev}
                  height={barH}
                  rx={Math.min(6, radius.sm / 2)}
                  ry={Math.min(6, radius.sm / 2)}
                  fill={get('icon.muted') as string}
                  opacity={0.5}
                />
              );
            })}

            {/* Current month bars (lighter transparency) */}
            {Array.from({ length: daysPlotThis }).map((_, i) => {
              const v = dailyThis[i] || 0;
              const barH = (v / Math.max(1, maxVal)) * innerH;
              const x = xForIndex(i) + (seg - bwNow) / 2;
              const y = top + innerH - barH;
              const isActive = hoverActive && i === hoverI;
              return (
                <Rect
                  key={`t-${i}`}
                  x={x}
                  y={y}
                  width={bwNow}
                  height={barH}
                  rx={Math.min(6, radius.sm / 2)}
                  ry={Math.min(6, radius.sm / 2)}
                  fill={get('accent.primary') as string}
                  opacity={isActive ? 1 : 0.78}
                  stroke={isActive ? (get('accent.primary') as string) : 'none'}
                  strokeWidth={isActive ? 1 : 0}
                />
              );
            })}

            {/* Selection vertical dotted guide */}
            {hoverActive && (
              <Line
                x1={centerX(hoverI)}
                y1={top}
                x2={centerX(hoverI)}
                y2={top + innerH}
                stroke={get('accent.primary') as string}
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.5}
              />
            )}

            {/* X ticks */}
            {ticksX.map((d) => {
              const i = clamp(d - 1, 0, daysPlotThis - 1);
              const xCenter = xForIndex(i) + seg / 2;
              return (
                <SvgText key={`x-${d}`} x={xCenter} y={top + innerH + 12} fontSize="10" fill={get('text.muted') as string} textAnchor="middle">
                  {d}
                </SvgText>
              );
            })}
          </G>
        </Svg>

        {/* SCRUB OVERLAY */}
        <View
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          pointerEvents="box-only"
          onStartShouldSetResponderCapture={() => true}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => { disableParent(); startScrub(e.nativeEvent.locationX, e.nativeEvent.locationY); }}
          onResponderMove={(e)  => moveScrub(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          onResponderRelease={(e) => { endScrub(e.nativeEvent.locationX, e.nativeEvent.locationY); enableParent(); }}
          onResponderTerminate={() => { setHoverActive(false); enableParent(); }}
        />

        {/* TOOLTIP (anchored high) */}
        {hoverActive && (
          <View
            style={{
              position: 'absolute',
              left: tipX,
              top: tipY,
              width: tipW,
              borderRadius: radius.md,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: get('surface.level2') as string,
              borderWidth: 1,
              borderColor: get('border.subtle') as string,
            }}
          >
            <Text style={{ color: get('text.muted') as string, fontSize: 11 }}>{dateLabel}</Text>
            <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{`Day: $${daySpend.toFixed(2)}`}</Text>
            <Text style={{ color: get('text.muted') as string, fontSize: 11 }}>{`MTD: $${mtdAtDay.toFixed(2)}`}</Text>
          </View>
        )}
      </View>

      {/* Bottom controls row (single pill with chevrons) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.s4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', borderRadius: 999 }}>
            <Pressable
              onPress={() => changeOffsetClassic(-1)}
              disabled={leftDisabledClassic}
              hitSlop={10}
              style={({ pressed }) => ({ paddingVertical: 6, paddingHorizontal: spacing.s8, opacity: leftDisabledClassic ? 0.4 : pressed ? 0.7 : 1 })}
            >
              <Icon name="arrow-bold-left" size={18} colorToken="icon.default" />
            </Pressable>
            <Pressable onPress={openMonthPicker} hitSlop={10} style={{ paddingVertical: 6, paddingHorizontal: spacing.s10 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>
                {new Date(Y, M, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => changeOffsetClassic(1)}
              disabled={rightDisabledClassic}
              hitSlop={10}
              style={({ pressed }) => ({ paddingVertical: 6, paddingHorizontal: spacing.s8, opacity: rightDisabledClassic ? 0.4 : pressed ? 0.7 : 1 })}
            >
              <Icon name="arrow-bold-right" size={18} colorToken="icon.default" />
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => nav.navigate('InsightsModal')} hitSlop={12} style={{ paddingVertical: 6, paddingHorizontal: spacing.s8, flexDirection: 'row', alignItems: 'center', gap: spacing.s4 }}>
          <Icon name="bar-chart-2" size={14} colorToken="accent.primary" />
          <Text style={{ color: get('accent.primary') as string, fontWeight: '700' }}>See insights</Text>
        </Pressable>
      </View>

      {/* Month-Year Picker Modal */}
      <Modal visible={mpOpen} transparent animationType="fade" onRequestClose={() => setMpOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setMpOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: get('surface.level1') as string, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.s16 }}>
                {/* Year row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s12 }}>
                  <Pressable onPress={() => setMpYear(mpYear - 1)} hitSlop={8} style={{ padding: spacing.s8 }}>
                    <Text style={{ color: get('text.primary') as string, fontSize: 18 }}>‹</Text>
                  </Pressable>
                  <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 16 }}>{mpYear}</Text>
                  <Pressable onPress={() => setMpYear(mpYear + 1)} hitSlop={8} style={{ padding: spacing.s8, opacity: mpYear > now.getFullYear() ? 0.4 : 1 }} disabled={mpYear > now.getFullYear()}>
                    <Text style={{ color: get('text.primary') as string, fontSize: 18 }}>›</Text>
                  </Pressable>
                </View>

                {/* Months grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {MONTHS.map((lbl, idx) => {
                    const disabled = (mpYear > now.getFullYear()) || (mpYear === now.getFullYear() && idx > now.getMonth());
                    const isSelected = (mpYear === Y && idx === M);
                    return (
                      <Pressable
                        key={lbl}
                        onPress={() => !disabled && selectMonth(mpYear, idx)}
                        disabled={disabled}
                        style={{
                          width: '33.333%',
                          paddingVertical: spacing.s12,
                          alignItems: 'center',
                          opacity: disabled ? 0.4 : 1,
                        }}
                      >
                        <View style={{
                          paddingVertical: spacing.s6,
                          paddingHorizontal: spacing.s8,
                          borderRadius: radius.lg,
                          backgroundColor: isSelected ? (get('surface.level2') as string) : 'transparent',
                          borderWidth: isSelected ? 1 : 0,
                          borderColor: isSelected ? (get('border.subtle') as string) : 'transparent',
                        }}>
                          <Text style={{ color: get('text.primary') as string, fontWeight: isSelected ? '700' : '500' }}>{lbl}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ height: spacing.s8 }} />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Pressable>
  );
};

export default MonthCompareChart;
