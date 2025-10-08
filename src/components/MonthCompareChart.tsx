
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, TouchableWithoutFeedback } from 'react-native';
import Svg, { Rect, G, Line, Text as SvgText } from 'react-native-svg';
import { useThemeTokens } from '../theme/ThemeProvider';
import { ScrollContext } from './ScrollContext';
import { spacing, radius } from '../theme/tokens';
import { useTxStore } from '../store/transactions';
import { useBudgetsStore } from '../store/budgets';
import { useNavigation } from '@react-navigation/native';

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
  const [offset, setOffset] = useState(0);
  const [chartW, setChartW] = useState(0);
  const [labelW, setLabelW] = useState(0);

  // scrub state
  const [hoverActive, setHoverActive] = useState(false);
  const [hoverI, setHoverI] = useState(0);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // month picker modal
  const [mpOpen, setMpOpen] = useState(false);
  const ref = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const [mpYear, setMpYear] = useState(ref.getFullYear());

  const Y = ref.getFullYear(); const M = ref.getMonth();
  const prevRef = new Date(Y, M - 1, 1);
  const pY = prevRef.getFullYear(); const pM = prevRef.getMonth();

  const sameMonth = (d: Date, y: number, m: number) => d.getFullYear() === y && d.getMonth() === m;
  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const daysCurr = daysInMonth(Y, M);
  const daysPrev = daysInMonth(pY, pM);
  const isCurrent = offset === 0;
  const idxToday = isCurrent ? clamp(now.getDate() - 1, 0, daysCurr - 1) : daysCurr - 1;
  const daysPlotThis = isCurrent ? Math.min(daysCurr, idxToday + 1) : daysCurr;
  const daysPlotPrev = isCurrent ? Math.min(daysPrev, idxToday + 1) : daysPrev;

  const daily = (txs: any[], y: number, m: number, len: number) => {
    const arr = Array.from({ length: len }, () => 0);
    for (const t of txs) {
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
  const h = 160; // original height
  const w = Math.max(1, chartW);
  const top = 8, bottom = 17; // compact bottom for controls
  // Y max and dynamic margins
  const rawMax = Math.max(1, ...dailyThis.slice(0, daysPlotThis), ...dailyPrev.slice(0, daysPlotPrev));
  const maxVal = niceCeilTight(rawMax);
  const left = Math.max(28, Math.min(38, labelW + 0));
  const right = 35; // mirror left

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
    setMpYear(Y);
    setMpOpen(true);
  };

  const selectMonth = (yr: number, mIdx: number) => {
    const newOffset = (yr - now.getFullYear()) * 12 + (mIdx - now.getMonth());
    if (newOffset > 0) return; // disallow future months
    setOffset(newOffset);
    setMpOpen(false);
  };

  return (
    <Pressable accessibilityRole="button"
      onPress={() => { if (hoverActive) setHoverActive(false); }}
      style={{ backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12 }}
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

      {/* Header row: Title (left), Stats (right) */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.s6 }}>
        <Text style={{ color: get('text.primary') as string, fontWeight: '700', fontSize: 18 }}>Spending</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{'Total Spent $' + sumThis.toFixed(0)}</Text>
          <Text style={{ color: get('text.muted') as string }}>
            {'$' + avgPerDay.toFixed(0) + '/day'}
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
            <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>{`Day: $${daySpend.toFixed(0)}`}</Text>
            <Text style={{ color: get('text.muted') as string, fontSize: 11 }}>{`MTD: $${mtdAtDay.toFixed(0)}`}</Text>
          </View>
        )}
      </View>

      {/* Bottom controls row (single pill with chevrons) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.s4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: get('surface.level2') as string, borderRadius: 999 }}>
            <Pressable onPress={() => setOffset(offset - 1)} hitSlop={10} style={{ paddingVertical: 6, paddingHorizontal: spacing.s8 }}>
              <Text style={{ color: get('text.primary') as string, fontSize: 14 }}>‹</Text>
            </Pressable>
            <Pressable onPress={openMonthPicker} hitSlop={10} style={{ paddingVertical: 6, paddingHorizontal: spacing.s10 }}>
              <Text style={{ color: get('text.primary') as string, fontWeight: '700' }}>
                {new Date(Y, M, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { if (isCurrent) return; setOffset(offset + 1); }}
              disabled={isCurrent}
              hitSlop={10}
              style={{ paddingVertical: 6, paddingHorizontal: spacing.s8, opacity: isCurrent ? 0.4 : 1 }}
            >
              <Text style={{ color: get('text.primary') as string, fontSize: 14 }}>›</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => nav.navigate('InsightsModal')} hitSlop={12} style={{ paddingVertical: 6, paddingHorizontal: spacing.s8 }}>
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
