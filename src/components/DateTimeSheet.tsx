import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import BottomSheet from './BottomSheet';
import { spacing, radius } from '../theme/tokens';
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

export default function DateTimeSheet({ visible, date, onCancel, onConfirm }: Props) {
  const { get } = useThemeTokens();
  const [cursor, setCursor] = useState(new Date(date));
  const [sel, setSel] = useState(new Date(date));

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

  const hours = Array.from({length:12}, (_,i)=> i+1);
  const minutes = Array.from({length:12}, (_,i)=> (i*5));
  const is12h = true; // use device locale in future

  const isSameDay = (a: Date, b: Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

  const onDone = () => onConfirm(sel);

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const chipBg = get('surface.level1') as string;
  const accent = get('accent.primary') as string;
  const onAccent = get('text.onPrimary') as string;
  const border = get('border.subtle') as string;

  const am = sel.getHours() < 12;
  const hour12 = ((sel.getHours() % 12) || 12);
  const minute = sel.getMinutes() - (sel.getMinutes() % 5);

  return (
    <BottomSheet visible={visible} onClose={onCancel} height={560}>
      {/* Header */}
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: spacing.s8 }}>
        <Pressable onPress={onCancel} hitSlop={12}><Text style={{ color: accent, fontWeight:'700' }}>Cancel</Text></Pressable>
        <Text style={{ color: textPrimary, fontWeight:'700' }}>{sel.toDateString()} · {sel.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        <Pressable onPress={onDone} hitSlop={12}><Text style={{ color: accent, fontWeight:'700' }}>Done</Text></Pressable>
      </View>

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
      <View style={{ flexDirection:'row', flexWrap:'wrap', rowGap: spacing.s4, columnGap: 0, marginBottom: spacing.s12 }}>
        {days.map((d, idx) => {
          const selected = d.date && isSameDay(d.date, sel);
          return (
            <Pressable
              key={idx}
              onPress={() => d.date && (setSel(new Date(d.date)), setCursor(new Date(d.date)))}
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

      {/* Quick jumps */}
      <View style={{ flexDirection:'row', gap: spacing.s8, marginBottom: spacing.s12 }}>
        <Pressable onPress={() => { const now = new Date(); setSel(now); setCursor(new Date(now.getFullYear(), now.getMonth(), 1, now.getHours(), now.getMinutes())); }} style={{ backgroundColor: chipBg, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
          <Text style={{ color: textPrimary }}>Today</Text>
        </Pressable>
        <Pressable onPress={() => { const t = new Date(Date.now()+86400000); setSel(t); setCursor(new Date(t.getFullYear(), t.getMonth(), 1, t.getHours(), t.getMinutes())); }} style={{ backgroundColor: chipBg, borderRadius: radius.pill, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8 }}>
          <Text style={{ color: textPrimary }}>Tomorrow</Text>
        </Pressable>
      </View>

      {/* Time selector */}
      <View style={{ borderTopWidth: 1, borderTopColor: border, paddingTop: spacing.s12 }}>
        {/* Hour row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.s4 }}>
          <View style={{ flexDirection:'row', gap: spacing.s8 }}>
            {hours.map(h => {
              const active = h === hour12;
              return (
                <Pressable key={h} onPress={() => {
                  let hour = h % 12;
                  if (!am) hour += 12;
                  const d = new Date(sel); d.setHours(hour);
                  setSel(d);
                }} style={{ backgroundColor: active ? accent : chipBg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
                  <Text style={{ color: active ? onAccent : textPrimary, fontWeight: '700' }}>{h}</Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        {/* Minute row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.s4, marginTop: spacing.s8 }}>
          <View style={{ flexDirection:'row', gap: spacing.s8 }}>
            {minutes.map(min => {
              const active = min === minute;
              return (
                <Pressable key={min} onPress={() => {
                  const d = new Date(sel); d.setMinutes(min); setSel(d);
                }} style={{ backgroundColor: active ? accent : chipBg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
                  <Text style={{ color: active ? onAccent : textPrimary, fontWeight: '700' }}>{String(min).padStart(2,'0')}</Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        {/* AM/PM */}
        <View style={{ flexDirection:'row', gap: spacing.s8, marginTop: spacing.s8 }}>
          {['AM','PM'].map((ap) => {
            const active = (ap === 'AM') === am;
            return (
              <Pressable key={ap} onPress={() => {
                const d = new Date(sel);
                const h = d.getHours();
                if (ap === 'AM' && h>=12) d.setHours(h-12);
                if (ap === 'PM' && h<12) d.setHours(h+12);
                setSel(d);
              }} style={{ backgroundColor: active ? accent : chipBg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
                <Text style={{ color: active ? onAccent : textPrimary, fontWeight: '700' }}>{ap}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <Text style={{ color: textMuted, marginTop: spacing.s12 }}>Using device timezone</Text>
    </BottomSheet>
  );
}