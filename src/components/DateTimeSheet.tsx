import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TouchableWithoutFeedback } from 'react-native';
import { spacing, radius, elevation } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';

type Props = {
  visible: boolean;
  date: Date;
  onCancel: () => void;
  onConfirm: (d: Date) => void;
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startOfMonthDOW(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 Sun ... 6 Sat
}

const ITEM_HEIGHT = 46;
const VISIBLE_ROWS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export default function DateTimeSheet({ visible, date, onCancel, onConfirm }: Props) {
  const { get } = useThemeTokens();
  const [cursor, setCursor] = useState(new Date(date));
  const [sel, setSel] = useState(new Date(date));
  const [viewMode, setViewMode] = useState<'calendar' | 'time'>('calendar');

  const hourRef = useRef<ScrollView>(null);
  const minuteRef = useRef<ScrollView>(null);
  const periodRef = useRef<ScrollView>(null);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  const days = useMemo(() => {
    const firstDow = startOfMonthDOW(y, m);
    const count = daysInMonth(y, m);
    const arr: Array<{ day: number | null, date?: Date }> = [];
    for (let i=0;i<firstDow;i++) arr.push({ day: null });
    for (let d=1; d<=count; d++) {
      arr.push({ day: d, date: new Date(y, m, d, sel.getHours(), sel.getMinutes()) });
    }
    // pad to full weeks
    while (arr.length % 7 !== 0) arr.push({ day: null });
    return arr;
  }, [y,m, sel]);

  const hourValues = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minuteValues = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const periodValues = ['AM', 'PM'] as const;
  const is12h = true; // use device locale in future

  const isSameDay = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

  const setSelection = (next: Date) => {
    const normalized = new Date(next.getTime());
    setSel(normalized);
    setCursor(new Date(normalized.getFullYear(), normalized.getMonth(), 1, normalized.getHours(), normalized.getMinutes()));
  };

  useEffect(() => {
    if (visible) {
      const base = new Date(date.getTime());
      setSelection(base);
      setViewMode('calendar');
    }
  }, [visible, date]);

  const onDone = () => onConfirm(sel);

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const chipBg = get('surface.level1') as string;
  const accent = get('accent.primary') as string;
  const onAccent = get('text.onPrimary') as string;
  const border = get('border.subtle') as string;

  const currentHour = sel.getHours();
  const am = currentHour < 12;
  const hourIndex = ((currentHour % 12) || 12) - 1;
  const minuteIndex = sel.getMinutes();
  const periodIndex = am ? 0 : 1;

  const wheelPadding = ITEM_HEIGHT * ((VISIBLE_ROWS - 1) / 2);

  const alignTimeWheels = (target: Date, animated = false) => {
    const hour = target.getHours();
    const hourIdx = ((hour % 12) || 12) - 1;
    hourRef.current?.scrollTo({ y: hourIdx * ITEM_HEIGHT, animated });
    minuteRef.current?.scrollTo({ y: target.getMinutes() * ITEM_HEIGHT, animated });
    periodRef.current?.scrollTo({ y: (hour >= 12 ? 1 : 0) * ITEM_HEIGHT, animated });
  };

  const handleWheelEnd = (event: any, length: number, onIndex: (index: number) => void) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const idx = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(length - 1, idx));
    onIndex(clamped);
  };

  const renderWheel = (
    data: readonly any[],
    selectedIndex: number,
    formatter: (value: any) => string,
    onIndexChange: (index: number) => void,
    ref: React.RefObject<ScrollView>,
    width: number
  ) => (
    <View style={{ width, height: ITEM_HEIGHT * VISIBLE_ROWS }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: wheelPadding }}
        onMomentumScrollEnd={(event) => handleWheelEnd(event, data.length, onIndexChange)}
        onScrollEndDrag={(event) => handleWheelEnd(event, data.length, onIndexChange)}
      >
        {data.map((value, idx) => {
          const active = idx === selectedIndex;
          return (
            <View key={`${value}-${idx}`} style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: active ? accent : textMuted, fontSize: 22, fontWeight: active ? '700' : '500' }}>
                {formatter(value)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: wheelPadding,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
        }}
      />
    </View>
  );

  const handleHourIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(hourValues.length - 1, index));
    const value = hourValues[clamped];
    if (!value) return;
    const next = new Date(sel.getTime());
    let hour = value % 12;
    if (!am) hour += 12;
    next.setHours(hour);
    setSelection(next);
    alignTimeWheels(next, true);
  };

  const handleMinuteIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(minuteValues.length - 1, index));
    const value = minuteValues[clamped];
    const next = new Date(sel.getTime());
    next.setMinutes(value);
    setSelection(next);
    alignTimeWheels(next, true);
  };

  const handlePeriodIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(periodValues.length - 1, index));
    const value = periodValues[clamped];
    const next = new Date(sel.getTime());
    const hour = next.getHours();
    if (value === 'AM' && hour >= 12) next.setHours(hour - 12);
    if (value === 'PM' && hour < 12) next.setHours(hour + 12);
    setSelection(next);
    alignTimeWheels(next, true);
  };

  const enterTimeView = (base: Date) => {
    const next = new Date(base.getTime());
    setSelection(next);
    setViewMode('time');
    requestAnimationFrame(() => alignTimeWheels(next, false));
  };

  const handleCalendarNow = () => {
    enterTimeView(new Date());
  };

  const handleToday = () => {
    const now = new Date();
    const next = new Date(sel.getTime());
    next.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    setSelection(next);
    setViewMode('calendar');
  };

  const handleTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const next = new Date(sel.getTime());
    next.setFullYear(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    setSelection(next);
    setViewMode('calendar');
  };

  const handleTimeNow = () => {
    const now = new Date();
    setSelection(now);
    requestAnimationFrame(() => alignTimeWheels(now, true));
  };

  useEffect(() => {
    if (viewMode === 'time') {
      requestAnimationFrame(() => alignTimeWheels(sel, false));
    }
  }, [viewMode, sel]);

  useEffect(() => {
    if (!visible) {
      setViewMode('calendar');
    }
  }, [visible]);

  const overlayStyle = {
    flex: 1,
    backgroundColor: 'rgba(8,10,18,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.s16,
  } as const;

  const modalBody = 'rgba(11,13,22,0.88)';
  const modalBorder = 'rgba(255,255,255,0.18)';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={overlayStyle}>
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        </TouchableWithoutFeedback>
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            maxHeight: 560,
            borderRadius: radius.xl,
            padding: spacing.s16,
            backgroundColor: modalBody,
            borderWidth: 1,
            borderColor: modalBorder,
          }}
        >
      {/* Header */}
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: spacing.s8 }}>
        <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12}><Text style={{ color: accent, fontWeight:'700' }}>Cancel</Text></Pressable>
        <Text style={{ color: textPrimary, fontWeight:'700' }}>{sel.toDateString()} · {sel.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        <Pressable onPress={onDone} hitSlop={12}><Text style={{ color: accent, fontWeight:'700' }}>Done</Text></Pressable>
      </View>

      <View style={{ position: 'relative', marginBottom: spacing.s12 }}>
        {/* Month switcher */}
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: spacing.s8 }}>
          <Pressable onPress={() => setCursor(new Date(y, m-1, 1, sel.getHours(), sel.getMinutes()))} hitSlop={12}>
            <Text style={{ color: accent, fontWeight:'700' }}>{'‹'}</Text>
          </Pressable>
          <Text style={{ color: textPrimary, fontWeight:'700' }}>{cursor.toLocaleString(undefined, { month:'long', year:'numeric' })}</Text>
          <Pressable onPress={() => setCursor(new Date(y, m+1, 1, sel.getHours(), sel.getMinutes()))} hitSlop={12}>
            <Text style={{ color: accent, fontWeight:'700' }}>{'›'}</Text>
          </Pressable>
        </View>

        {/* Weekday header */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom: spacing.s4 }}>
          {['S','M','T','W','T','F','S'].map((d,i)=>(
            <Text key={i} style={{ width: 40, textAlign:'center', color: textMuted }}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
        <View style={{ flexDirection:'row', flexWrap:'wrap', rowGap: spacing.s4, columnGap: 0 }}>
          {days.map((d, idx) => {
            const selected = d.date && isSameDay(d.date, sel);
            return (
              <Pressable
                key={idx}
                onPress={() => d.date && setSelection(d.date)}
                disabled={!d.day}
                style={{
                  width: 40, height: 40, borderRadius: radius.pill,
                  alignItems:'center', justifyContent:'center',
                  backgroundColor: selected ? accent : 'transparent',
                  opacity: d.day ? 1 : 0,
                }}
              >
                <Text style={{ color: selected ? onAccent : textPrimary, fontWeight: selected ? '700' : '400' }}>{d.day || ''}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.s12 }}>
          <Pressable
            onPress={handleCalendarNow}
            style={{ backgroundColor: chipBg, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}
          >
            <Text style={{ color: textPrimary, fontWeight: '600' }}>Now</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
            <Pressable
              onPress={handleToday}
              style={{ backgroundColor: chipBg, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}
            >
              <Text style={{ color: textPrimary }}>Today</Text>
            </Pressable>
            <Pressable
              onPress={handleTomorrow}
              style={{ backgroundColor: chipBg, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}
            >
              <Text style={{ color: textPrimary }}>Tomorrow</Text>
            </Pressable>
          </View>
        </View>

        {viewMode === 'time' ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: radius.lg,
              backgroundColor: 'rgba(8,10,18,0.9)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
              padding: spacing.s16,
              justifyContent: 'center',
            }}
          >
            <View style={{ alignItems: 'center', gap: spacing.s12 }}>
              <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>Select time</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.s12 }}>
                {renderWheel(hourValues, hourIndex, (v) => String(v), handleHourIndex, hourRef, 64)}
                {renderWheel(minuteValues, minuteIndex, (v) => String(v).padStart(2, '0'), handleMinuteIndex, minuteRef, 72)}
                {renderWheel(periodValues, periodIndex, (v) => v, handlePeriodIndex, periodRef, 64)}
              </View>
            </View>
            <View style={{ position: 'absolute', left: spacing.s16, right: spacing.s16, bottom: spacing.s16, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pressable
                onPress={handleTimeNow}
                style={{ backgroundColor: chipBg, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}
              >
                <Text style={{ color: textPrimary, fontWeight: '600' }}>Now</Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode('calendar')}
                style={{ backgroundColor: accent, borderRadius: radius.pill, paddingHorizontal: spacing.s16, paddingVertical: spacing.s8 }}
              >
                <Text style={{ color: onAccent, fontWeight: '700' }}>OK</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>


      <Text style={{ color: textMuted, marginTop: spacing.s12 }}>Using device timezone</Text>
        </View>
      </View>
    </Modal>
  );
}
