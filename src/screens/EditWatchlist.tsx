import React, { useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { Screen } from '../components/Screen';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useNavigation } from '@react-navigation/native';
import { useInvestStore } from '../store/invest';

type Row = { key: string; sym: string };

export default function EditWatchlist() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { watchlist, setWatch } = useInvestStore();

  const [data, setData] = useState<Row[]>(() => watchlist.map(s => ({ key: s, sym: s })));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null); // long-pressed item

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg = get('surface.level1') as string;
  const accent = get('accent.primary') as string;
  const danger = get('semantic.danger') as string;

  const onDone = async () => {
    await setWatch(data.map(d => d.sym));
    nav.goBack();
  };

  const onRemoveSelected = async () => {
    const keep = data.filter(d => !selected.has(d.sym));
    setData(keep);
    setSelected(new Set());
    await setWatch(keep.map(d => d.sym));
  };

  const toggleSelect = (sym: string) => {
    const next = new Set(selected);
    if (next.has(sym)) next.delete(sym); else next.add(sym);
    setSelected(next);
  };

  const move = (sym: string, dir: -1 | 1) => {
    const idx = data.findIndex(d => d.sym === sym);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= data.length) return;
    const copy = data.slice();
    const tmp = copy[idx];
    copy[idx] = copy[j];
    copy[j] = tmp;
    setData(copy);
  };

  const moveTop = (sym: string) => {
    const idx = data.findIndex(d => d.sym === sym);
    if (idx <= 0) return;
    const copy = data.slice();
    const [item] = copy.splice(idx, 1);
    copy.unshift(item);
    setData(copy);
  };

  const moveBottom = (sym: string) => {
    const idx = data.findIndex(d => d.sym === sym);
    if (idx < 0 || idx === data.length - 1) return;
    const copy = data.slice();
    const [item] = copy.splice(idx, 1);
    copy.push(item);
    setData(copy);
  };

  const renderItem = ({ item }: { item: Row }) => (
    <Pressable
      onLongPress={() => setActive(item.sym)}
      style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s12, marginBottom: spacing.s8 }}
    >
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap: spacing.s12 }}>
          <Text style={{ color: muted }}>{active === item.sym ? '⠿' : '≡'}</Text>
          <Text style={{ color: text, fontWeight:'700' }}>{item.sym}</Text>
        </View>

        <View style={{ flexDirection:'row', alignItems:'center', gap: spacing.s8 }}>
          {active === item.sym ? (
            <>
              <Pressable onPress={() => moveTop(item.sym)} style={{ backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s8, paddingVertical: spacing.s6, borderRadius: radius.pill }}>
                <Text style={{ color: text }}>Top</Text>
              </Pressable>
              <Pressable onPress={() => move(item.sym, -1)} style={{ backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s8, paddingVertical: spacing.s6, borderRadius: radius.pill }}>
                <Text style={{ color: text }}>↑</Text>
              </Pressable>
              <Pressable onPress={() => move(item.sym, +1)} style={{ backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s8, paddingVertical: spacing.s6, borderRadius: radius.pill }}>
                <Text style={{ color: text }}>↓</Text>
              </Pressable>
              <Pressable onPress={() => moveBottom(item.sym)} style={{ backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s8, paddingVertical: spacing.s6, borderRadius: radius.pill }}>
                <Text style={{ color: text }}>Bottom</Text>
              </Pressable>
            </>
          ) : null}
          <Pressable onPress={() => toggleSelect(item.sym)} style={{ backgroundColor: selected.has(item.sym) ? accent : (get('surface.level2') as string), paddingHorizontal: spacing.s12, paddingVertical: spacing.s6, borderRadius: radius.pill }}>
            <Text style={{ color: selected.has(item.sym) ? (get('text.onPrimary') as string) : text }}>{selected.has(item.sym) ? 'Selected' : 'Select'}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <Screen>
      <View style={{ padding: spacing.s16, gap: spacing.s12, flex: 1 }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ color: text, fontWeight:'700', fontSize: 18 }}>Edit watchlist</Text>
          <Pressable onPress={onDone} style={{ backgroundColor: accent, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
            <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Done</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          <Pressable onPress={() => setSelected(new Set(data.map(d => d.sym)))} style={{ backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
            <Text style={{ color: text }}>Select all</Text>
          </Pressable>
          <Pressable disabled={selected.size===0} onPress={onRemoveSelected} style={{ opacity: selected.size===0 ? 0.4 : 1, backgroundColor: danger, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
            <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Remove ({selected.size})</Text>
          </Pressable>
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </Screen>
  );
}