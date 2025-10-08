import React from 'react';
import { View, Text, Pressable, ScrollView, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';
import { useInvestStore } from '../../store/invest';
import HoldingRow from './HoldingRow';
import WatchRow from './WatchRow';
import Button from '../Button';
import Icon from '../Icon';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../Card';
import PopoverMenu from '../PopoverMenu';
import { computePnL } from '../../lib/positions';
import { exportPortfolioCsv } from '../../lib/export';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

type Props = {
  portfolioId: string | null;
  visible: boolean;
  onClose: () => void;
  onEditWatchlist?: () => void;
  onFilterHoldings?: () => void;
  onSortHoldings?: () => void;
  onAddHolding?: () => void;
  onAddWatchlist?: () => void;
  onOpenManager?: () => void;
  dimmed?: boolean;
};

export default function PortfolioDetailSheet({ portfolioId, visible, onClose, onEditWatchlist, onFilterHoldings, onSortHoldings, onAddHolding, onAddWatchlist, onOpenManager, dimmed }: Props) {
  const { get } = useThemeTokens();
  const { portfolios } = useInvestStore();
  const archivePortfolio = useInvestStore((s) => (s as any).archivePortfolio);
  const quotes = useInvestStore(s => (s as any).quotes);
  const removeHolding = useInvestStore(s => (s as any).removeHolding);
  const setHoldingsArchived = useInvestStore(s => (s as any).setHoldingsArchived);
  const addWatch = useInvestStore(s => (s as any).addWatch);
  const removeWatch = useInvestStore(s => (s as any).removeWatch);
  const addHolding = useInvestStore(s => (s as any).addHolding);
  const nav = useNavigation<any>();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;

  const p = portfolioId ? portfolios[portfolioId] : null;
  const insets = useSafeAreaInsets();
  const windowH = Dimensions.get('window').height;
  const sheetHeight = Math.max(420, Math.min(windowH - insets.top - 24, 740));
  const [tab, setTab] = React.useState<'Holdings'|'Watchlist'>('Holdings');
  const [holdingsFilter, setHoldingsFilter] = React.useState<'all'|'gainers'|'losers'|'min1'>('all');
  const [sortKey, setSortKey] = React.useState<'value'|'pnl'|'ticker'|'custom'>('value');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('desc');
  // Watchlist filter/sort state (separate from holdings)
  const [watchFilter, setWatchFilter] = React.useState<'all'|'gainers'|'losers'|'min1'>('all');
  const [watchSortKey, setWatchSortKey] = React.useState<'value'|'pnl'|'ticker'|'custom'>('value');
  const [watchSortDir, setWatchSortDir] = React.useState<'asc'|'desc'>('desc');
  const [editMode, setEditMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [reorderHold, setReorderHold] = React.useState(false);
  const [orderHold, setOrderHold] = React.useState<string[]>([]);
  const [rowH, setRowH] = React.useState(60);
  const dragIndexH = useSharedValue(-1);
  const dragYH = useSharedValue(0);
  const baseLenH = useSharedValue(0);
  const dragStartIndexH = useSharedValue(0);
  const hoverIndexH = useSharedValue(-1);
  const [reorderWatch, setReorderWatch] = React.useState(false);
  const [orderWatch, setOrderWatch] = React.useState<string[]>([]);
  const dragIndexW = useSharedValue(-1);
  const dragYW = useSharedValue(0);
  const baseLenW = useSharedValue(0);
  const dragStartIndexW = useSharedValue(0);
  const hoverIndexW = useSharedValue(-1);

  // Per-row components to keep hooks usage valid
  const HoldingItem: React.FC<{ sym: string; index: number }> = ({ sym, index }) => {
    const gesture = Gesture.Pan()
      .onStart(() => { 
        dragIndexH.value = index; dragStartIndexH.value = index; hoverIndexH.value = index; 
        try { runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      })
      .onChange((e) => {
        dragYH.value = e.translationY;
        const next = Math.max(0, Math.min(baseLenH.value - 1, Math.round((dragStartIndexH.value * rowH + e.translationY) / rowH)));
        hoverIndexH.value = next;
      })
      .onEnd(() => {
        if (reorderHold) {
          const next = Math.max(0, Math.min(baseLenH.value - 1, Math.round((dragStartIndexH.value * rowH + dragYH.value) / rowH)));
          runOnJS(updateOrderHold)(sym, next);
          try { runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light); } catch {}
        }
        dragIndexH.value = -1; dragYH.value = 0;
      });

    const rowStyle = useAnimatedStyle(() => {
      // If this is the dragged row, follow the finger (compensate for spacing)
      if (dragIndexH.value === index) {
        return {
          transform: [{ translateY: dragYH.value }, { scale: 1.02 }],
          zIndex: 10, elevation: 8, shadowOpacity: 0.25, shadowRadius: 8,
        } as any;
      }
      // Otherwise, shift to create space while hovering
      let offset = 0;
      if (dragIndexH.value !== -1) {
        const start = dragStartIndexH.value;
        const hover = hoverIndexH.value;
        if (hover > start && index > start && index <= hover) {
          offset = -rowH;
        } else if (hover < start && index >= hover && index < start) {
          offset = rowH;
        }
      }
      return { transform: [{ translateY: withTiming(offset, { duration: 80 }) }] } as any;
    });

    return (
      <Animated.View style={[{ borderTopWidth: index===0 ? 0 : 1, borderColor: get('border.subtle') as string } as any, rowStyle]}
        onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 20 && Math.abs(h - rowH) > 6) setRowH(h); }}
      >
        {reorderHold ? (
          <View style={{ flexDirection:'row', alignItems:'center', paddingVertical: spacing.s4 }}>
            <GestureDetector gesture={gesture}>
              <View style={{ width: 36, height: 36, marginLeft: spacing.s8, marginRight: spacing.s8, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: get('component.button.secondary.bg') as string, borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}>
                <Icon name="menu" size={18} colorToken="text.primary" />
              </View>
            </GestureDetector>
            <View style={{ flex: 1 }}>
              <HoldingRow sym={sym} portfolioId={portfolioId || undefined} variant="list" onPress={() => {}} />
            </View>
          </View>
        ) : editMode ? (
          <View style={{ flexDirection:'row', alignItems:'center', paddingVertical: spacing.s4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${sym}`}
              onPress={() => setSelected(prev => ({ ...prev, [sym]: !prev[sym] }))}
              style={({ pressed }) => ({ width: 36, height: 36, marginLeft: spacing.s8, marginRight: spacing.s8, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: (selected[sym] ? (get('component.button.primary.bg') as string) : (pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string))), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}
            >
              <Icon name="check" size={18} colorToken={selected[sym] ? 'text.onPrimary' : 'text.primary'} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <HoldingRow sym={sym} portfolioId={portfolioId || undefined} variant="list" onPress={() => setSelected(prev => ({ ...prev, [sym]: !prev[sym] }))} />
            </View>
          </View>
        ) : (
          <HoldingRow sym={sym} portfolioId={portfolioId || undefined} variant="list" onPress={() => { onClose(); try { nav.navigate('AddLot', { symbol: sym, portfolioId }); } catch (e) {} }} />
        )}
      </Animated.View>
    );
  };

  const WatchItem: React.FC<{ sym: string; index: number }> = ({ sym, index }) => {
    const gesture = Gesture.Pan()
      .onStart(() => { 
        dragIndexW.value = index; dragStartIndexW.value = index; hoverIndexW.value = index; 
        try { runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      })
      .onChange((e) => {
        dragYW.value = e.translationY;
        const next = Math.max(0, Math.min(baseLenW.value - 1, Math.round((dragStartIndexW.value * rowH + e.translationY) / rowH)));
        hoverIndexW.value = next;
      })
      .onEnd(() => {
        if (reorderWatch) {
          const next = Math.max(0, Math.min(baseLenW.value - 1, Math.round((dragStartIndexW.value * rowH + dragYW.value) / rowH)));
          runOnJS(updateOrderWatch)(sym, next);
          try { runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light); } catch {}
        }
        dragIndexW.value = -1; dragYW.value = 0;
      });

    const rowStyleW = useAnimatedStyle(() => {
      if (dragIndexW.value === index) {
        return {
          transform: [{ translateY: dragYW.value }, { scale: 1.02 }],
          zIndex: 10, elevation: 8, shadowOpacity: 0.25, shadowRadius: 8,
        } as any;
      }
      let offset = 0;
      if (dragIndexW.value !== -1) {
        const start = dragStartIndexW.value;
        const hover = hoverIndexW.value;
        if (hover > start && index > start && index <= hover) {
          offset = -rowH;
        } else if (hover < start && index >= hover && index < start) {
          offset = rowH;
        }
      }
      return { transform: [{ translateY: withTiming(offset, { duration: 80 }) }] } as any;
    });

    return (
      <Animated.View style={[{ borderTopWidth: index===0 ? 0 : 1, borderColor: get('border.subtle') as string } as any, rowStyleW]}
        onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 20 && Math.abs(h - rowH) > 6) setRowH(h); }}
      >
        {reorderWatch ? (
          <View style={{ flexDirection:'row', alignItems:'center', paddingVertical: spacing.s4 }}>
            <GestureDetector gesture={gesture}>
              <View style={{ width: 36, height: 36, marginLeft: spacing.s8, marginRight: spacing.s8, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: get('component.button.secondary.bg') as string, borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}>
                <Icon name="menu" size={18} colorToken="text.primary" />
              </View>
            </GestureDetector>
            <View style={{ flex: 1 }}>
              <HoldingRow sym={sym} portfolioId={portfolioId || undefined} variant="list" onPress={() => {}} />
            </View>
          </View>
        ) : editWatchMode ? (
          <View style={{ flexDirection:'row', alignItems:'center', paddingVertical: spacing.s4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${sym}`}
              onPress={() => setSelectedWatch(prev => ({ ...prev, [sym]: !prev[sym] }))}
              style={({ pressed }) => ({ width: 36, height: 36, marginLeft: spacing.s8, marginRight: spacing.s8, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: (selectedWatch[sym] ? (get('component.button.primary.bg') as string) : (pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string))), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}
            >
              <Icon name="check" size={18} colorToken={selectedWatch[sym] ? 'text.onPrimary' : 'text.primary'} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <HoldingRow sym={sym} portfolioId={portfolioId || undefined} variant="list" onPress={() => setSelectedWatch(prev => ({ ...prev, [sym]: !prev[sym] }))} />
            </View>
          </View>
        ) : (
          <HoldingRow sym={sym} portfolioId={portfolioId || undefined} variant="list" />
        )}
      </Animated.View>
    );
  };
  const [editWatchMode, setEditWatchMode] = React.useState(false);
  const [selectedWatch, setSelectedWatch] = React.useState<Record<string, boolean>>({});

  // Dropdown menu states
  const [filterMenuVisible, setFilterMenuVisible] = React.useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = React.useState<{x:number;y:number;w:number;h:number}|null>(null);
  const filterBtnRef = React.useRef<View>(null);

  const [sortMenuVisible, setSortMenuVisible] = React.useState(false);
  const [sortMenuAnchor, setSortMenuAnchor] = React.useState<{x:number;y:number;w:number;h:number}|null>(null);
  const sortBtnRef = React.useRef<View>(null);

  const [settingsMenuVisible, setSettingsMenuVisible] = React.useState(false);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = React.useState<{x:number;y:number;w:number;h:number}|null>(null);
  const settingsBtnRef = React.useRef<View>(null);

  React.useEffect(()=>{
    if (visible) { setTab('Holdings'); setEditMode(false); setSelected({}); setEditWatchMode(false); setSelectedWatch({}); }
  }, [visible]);

  // Defensive lists for rendering maps
  const displayHoldSyms = React.useMemo(() => {
    const base = reorderHold ? (orderHold || []) : (holdingsSyms || []);
    let arr = Array.isArray(base) ? base : [] as string[];
    if ((!arr || arr.length === 0) && p && p.holdings) {
      const keys = Object.keys(p.holdings || {});
      if (keys.length) arr = keys;
    }
    return arr;
  }, [reorderHold, orderHold, holdingsSyms, p]);
  const displayWatchSyms = React.useMemo(() => {
    const base = reorderWatch ? (orderWatch || []) : (watchSyms || []);
    let arr = Array.isArray(base) ? base : [] as string[];
    const wl = (p?.watchlist || []);
    if ((!arr || arr.length === 0) && wl && wl.length) arr = wl;
    return arr;
  }, [reorderWatch, orderWatch, watchSyms, p]);

  React.useEffect(() => { try { baseLenH.value = displayHoldSyms.length; } catch {} }, [displayHoldSyms, reorderHold]);
  React.useEffect(() => { try { baseLenW.value = displayWatchSyms.length; } catch {} }, [displayWatchSyms, reorderWatch]);

  const updateOrderHold = React.useCallback((sym: string, nextIndex: number) => {
    setOrderHold(prev => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      const idx = arr.indexOf(sym);
      if (idx === -1) return arr;
      arr.splice(idx, 1);
      arr.splice(Math.max(0, Math.min(nextIndex, Math.max(0, arr.length))), 0, sym);
      return arr;
    });
  }, []);

  const updateOrderWatch = React.useCallback((sym: string, nextIndex: number) => {
    setOrderWatch(prev => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      const idx = arr.indexOf(sym);
      if (idx === -1) return arr;
      arr.splice(idx, 1);
      arr.splice(Math.max(0, Math.min(nextIndex, Math.max(0, arr.length))), 0, sym);
      return arr;
    });
  }, []);

  const holdingsSymsAll = React.useMemo(()=> Object.keys(p?.holdings || {}), [p]);
  
  // Build computed metrics for holdings (qty, value, today change, weight)
  const holdingsData = React.useMemo(() => {
    const out: Array<{ sym: string; qty: number; value: number; change: number; pnlAbs: number; pnlPct: number; }> = [];
    const map = p?.holdings || {} as Record<string, any>;
    Object.values(map).forEach((h: any) => {
      if (h?.archived && !editMode) return;
      const sym = h.symbol;
      const lots = (h?.lots || []) as Array<{ side:'buy'|'sell'; qty:number }>;
      const qty = lots.reduce((s, l) => s + (l.side === 'buy' ? l.qty : -l.qty), 0);
      if (!qty) { out.push({ sym, qty: 0, value: 0, change: 0, pnlAbs: 0, pnlPct: 0 }); return; }
      const q = (quotes || {})[sym] || {} as any;
      const last = Number(q.last || 0);
      const chg = Number(q.change || 0);
      const pnl = computePnL((h?.lots || []) as any, last);
      const pnlAbs = (pnl.realized || 0) + (pnl.unrealized || 0);
      const cost = pnl.qty > 0 ? pnl.avgCost * pnl.qty : 0;
      const mv = last * qty;
      const pnlPct = cost > 0 ? (pnlAbs / cost) : 0;
      out.push({ sym, qty, value: mv, change: chg * qty, pnlAbs, pnlPct });
    });
    const total = out.reduce((s, x) => s + (x.value || 0), 0);
    return { list: out, totalValue: total };
  }, [p, quotes, editMode]);

  const holdingsSyms = React.useMemo(() => {
    const { list, totalValue } = holdingsData;
    let arr = list;
    if (holdingsFilter === 'gainers') {
      arr = arr.filter(x => x.change > 0.000001);
    } else if (holdingsFilter === 'losers') {
      arr = arr.filter(x => x.change < -0.000001);
    } else if (holdingsFilter === 'min1') {
      if (totalValue > 0) {
        arr = arr.filter(x => (x.value / totalValue) > 0.01);
      } else {
        arr = [];
      }
    }
    // custom order
    if (sortKey === 'custom' && (p?.holdingsOrder && (p.holdingsOrder as any).length)) {
      const set = new Set(arr.map(x => x.sym));
      const ordered = (p!.holdingsOrder || []).filter(s => set.has(s));
      return ordered;
    }
    // sort
    const dir = sortDir === 'asc' ? 1 : -1;
    arr = [...arr].sort((a, b) => {
      if (sortKey === 'ticker') return a.sym.localeCompare(b.sym) * dir;
      if (sortKey === 'pnl') return ((a.pnlAbs || 0) - (b.pnlAbs || 0)) * dir;
      // default value
      return ((a.value || 0) - (b.value || 0)) * dir;
    });
    return arr.map(x => x.sym);
  }, [holdingsData, holdingsFilter, sortKey, sortDir, p?.holdingsOrder]);
  // Watchlist computed metrics + filtered/sorted list
  const watchlistData = React.useMemo(() => {
    const syms = (p?.watchlist || []) as string[];
    const list = syms.map(sym => {
      const q = (quotes || {})[sym] || {} as any;
      const last = Number(q.last || 0);
      const chg = Number(q.change || 0);
      // No P&L for watchlist; reuse fields for uniform sorting
      return { sym, value: last, change: chg, pnlAbs: chg, pnlPct: 0 };
    });
    const totalValue = list.reduce((s,x)=> s + (x.value||0), 0);
    return { list, totalValue };
  }, [p, quotes]);

  const watchSyms = React.useMemo(() => {
    const { list, totalValue } = watchlistData;
    let arr = list;
    if (watchFilter === 'gainers') arr = arr.filter(x => x.change > 0.000001);
    else if (watchFilter === 'losers') arr = arr.filter(x => x.change < -0.000001);
    else if (watchFilter === 'min1') {
      if (totalValue > 0) arr = arr.filter(x => (x.value / totalValue) > 0.01);
      else arr = [];
    }
    if (watchSortKey === 'custom') {
      return (p?.watchlist || []).filter(s => arr.find(x => x.sym === s));
    }
    const dir = watchSortDir === 'asc' ? 1 : -1;
    arr = [...arr].sort((a,b) => {
      if (watchSortKey === 'ticker') return a.sym.localeCompare(b.sym) * dir;
      if (watchSortKey === 'pnl') return ((a.pnlAbs||0) - (b.pnlAbs||0)) * dir;
      return ((a.value||0) - (b.value||0)) * dir;
    });
    return arr.map(x => x.sym);
  }, [watchlistData, watchFilter, watchSortKey, watchSortDir, p?.watchlist]);

  // Menu handlers
  const openFilterMenu = () => {
    const ref: any = filterBtnRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x:number,y:number,w:number,h:number) => {
        setFilterMenuAnchor({ x, y, w, h });
        setFilterMenuVisible(true);
      });
    } else {
      setFilterMenuAnchor({ x: 280, y: 120, w: 1, h: 1 });
      setFilterMenuVisible(true);
    }
  };

  const openSortMenu = () => {
    const ref: any = sortBtnRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x:number,y:number,w:number,h:number) => {
        setSortMenuAnchor({ x, y, w, h });
        setSortMenuVisible(true);
      });
    } else {
      setSortMenuAnchor({ x: 280, y: 120, w: 1, h: 1 });
      setSortMenuVisible(true);
    }
  };

  const openSettingsMenu = () => {
    const ref: any = settingsBtnRef.current;
    if (ref && typeof ref.measureInWindow === 'function') {
      ref.measureInWindow((x:number,y:number,w:number,h:number) => {
        setSettingsMenuAnchor({ x, y, w, h });
        setSettingsMenuVisible(true);
      });
    } else {
      setSettingsMenuAnchor({ x: 280, y: 120, w: 1, h: 1 });
      setSettingsMenuVisible(true);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={sheetHeight} dimmed={dimmed}>
      <View style={{ gap: spacing.s12 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <View>
            <Text style={{ color: text, fontWeight:'800', fontSize: 18 }}>{p?.name || 'Portfolio'}</Text>
            <Text style={{ color: muted, fontSize: 12 }}>{(p?.baseCurrency || 'USD').toUpperCase()} · Holdings & Watchlist</Text>
          </View>
        </View>

        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          <Pressable onPress={() => setTab('Holdings')} style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: tab==='Holdings' ? (get('component.button.primary.bg') as string) : 'transparent', borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}>
            <Text style={{ color: tab==='Holdings' ? (get('component.button.primary.text') as string) : (get('component.button.secondary.text') as string), fontWeight:'700' }}>Holdings</Text>
          </Pressable>
          <Pressable onPress={() => setTab('Watchlist')} style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: tab==='Watchlist' ? (get('component.button.primary.bg') as string) : 'transparent', borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}>
            <Text style={{ color: tab==='Watchlist' ? (get('component.button.primary.text') as string) : (get('component.button.secondary.text') as string), fontWeight:'700' }}>Watchlist</Text>
          </Pressable>
        </View>

        {tab==='Holdings' ? (
          <View style={{ gap: spacing.s8 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
              <Text style={{ color: text, fontWeight:'700' }}>{reorderHold ? 'Reorder holdings' : (editMode ? 'Edit holdings' : 'Holdings')}</Text>
              {reorderHold ? (
                <View style={{ flexDirection:'row', gap: spacing.s8, alignItems:'center' }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={async () => {
                    try { if (p?.id) await (useInvestStore.getState() as any).setHoldingsOrder(p.id, (orderHold && orderHold.length ? orderHold : holdingsSyms)); } catch {}
                    setReorderHold(false);
                    setOrderHold([]);
                    setSortKey('custom');
                  }} style={{ paddingHorizontal: spacing.s12, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}>
                    <Text style={{ color: text, fontWeight:'700' }}>Done</Text>
                  </Pressable>
                </View>
              ) : editMode ? (
                <View style={{ flexDirection:'row', gap: spacing.s8, alignItems:'center' }}>
                  {/* Delete */}
                  <Pressable accessibilityRole="button" accessibilityLabel="Delete selected" onPress={async () => {
                    const syms = Object.keys(selected).filter(k => selected[k]);
                    for (const s of syms) { try { await removeHolding(s, { portfolioId: portfolioId || undefined }); } catch {} }
                    setSelected({});
                  }}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                    <Icon name="trash" size={18} colorToken="text.primary" />
                  </Pressable>
                  {/* Archive/Unarchive */}
                  <Pressable accessibilityRole="button" accessibilityLabel="Archive selected" onPress={async () => {
                    const syms = Object.keys(selected).filter(k => selected[k]);
                    if (!syms.length) return;
                    // Decide action: if all selected already archived -> unarchive; else archive
                    const map = (p?.holdings || {}) as any;
                    const allArchived = syms.every(s => !!map[s]?.archived);
                    await setHoldingsArchived({ portfolioId: portfolioId || undefined, symbols: syms, archived: !allArchived });
                    setSelected({});
                  }}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                    <Icon name="archive" size={18} colorToken="text.primary" />
                  </Pressable>
                  {/* Add to Watchlist */}
                  <Pressable accessibilityRole="button" accessibilityLabel="Add to watchlist" onPress={async () => {
                    const syms = Object.keys(selected).filter(k => selected[k]);
                    for (const s of syms) { try { await addWatch(s, { portfolioId: portfolioId || undefined }); } catch {} }
                    setSelected({});
                  }}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                    <Icon name="plus" size={18} colorToken="text.primary" />
                  </Pressable>
                  {/* Done */}
                  <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => { setEditMode(false); setSelected({}); }} style={{ paddingHorizontal: spacing.s12, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}>
                    <Text style={{ color: text, fontWeight:'700' }}>Done</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection:'row', gap: spacing.s8 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Add holding" onPress={onAddHolding}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                    <Icon name="plus" size={18} colorToken="text.primary" />
                  </Pressable>
                  <Pressable
                    ref={filterBtnRef as any}
                    accessibilityRole="button"
                    accessibilityLabel="Filter holdings"
                    onPress={openFilterMenu}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                    <Icon name="filter" size={18} colorToken="text.primary" />
                  </Pressable>
                  <Pressable
                    ref={sortBtnRef as any}
                    accessibilityRole="button"
                    accessibilityLabel="Sort holdings"
                    onPress={openSortMenu}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                    <Icon name="sort" size={18} colorToken="text.primary" />
                  </Pressable>
                  <Pressable
                    ref={settingsBtnRef as any}
                    accessibilityRole="button"
                    accessibilityLabel="Manage portfolio"
                    onPress={openSettingsMenu}
                    style={({ pressed }) => ({
                      width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center',
                      backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string),
                      borderWidth: 1, borderColor: get('component.button.secondary.border') as string
                    })}
                  >
                    <Icon name="settings" size={18} colorToken="text.primary" />
                  </Pressable>
                </View>
              )}
            </View>
            {holdingsSyms.length === 0 ? (
              <Text style={{ color: muted }}>No holdings.</Text>
            ) : (
              <ScrollView
                alwaysBounceVertical={Platform.OS === 'ios'}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                scrollEnabled={!reorderHold}
                style={{ maxHeight: sheetHeight - 200 }}
                contentContainerStyle={{ paddingBottom: spacing.s16 }}
                scrollIndicatorInsets={{ bottom: Math.max(16, 0) as any }}
              >
                <Card padding={0}>
                  {displayHoldSyms.map((sym, i) => (
                    <HoldingItem key={sym} sym={sym} index={i} />
                  ))}
                </Card>
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={{ gap: spacing.s8 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
              <Text style={{ color: text, fontWeight:'700' }}>{reorderWatch ? 'Reorder watchlist' : editWatchMode ? 'Edit watchlist' : 'Watchlist'}</Text>
              <View style={{ flexDirection:'row', gap: spacing.s8 }}>
                {reorderWatch ? (
                  <>
                    <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={async () => {
                      try { if (p?.id) await (useInvestStore.getState() as any).setWatch(orderWatch, { portfolioId }); } catch {}
                      setReorderWatch(false);
                      setOrderWatch([]);
                      setWatchSortKey('custom');
                    }} style={{ paddingHorizontal: spacing.s12, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}>
                      <Text style={{ color: text, fontWeight:'700' }}>Done</Text>
                    </Pressable>
                  </>
                ) : editWatchMode ? (
                  <>
                    <Pressable accessibilityRole="button" accessibilityLabel="Delete selected" onPress={async () => {
                      const syms = Object.keys(selectedWatch).filter(k => selectedWatch[k]);
                      for (const s of syms) { try { await removeWatch(s, { portfolioId: portfolioId || undefined }); } catch {} }
                      setSelectedWatch({});
                    }}
                      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                      <Icon name="trash" size={18} colorToken="text.primary" />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Add to holdings" onPress={async () => {
                      const syms = Object.keys(selectedWatch).filter(k => selectedWatch[k]);
                      const cur = ((p?.baseCurrency) || 'USD').toUpperCase();
                      for (const s of syms) { try { await addHolding(s, { name: s, type: 'stock', currency: cur }, { portfolioId: portfolioId || undefined }); } catch {} }
                      setSelectedWatch({});
                    }}
                      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                      <Icon name="plus" size={18} colorToken="text.primary" />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={() => { setEditWatchMode(false); setSelectedWatch({}); }} style={{ paddingHorizontal: spacing.s12, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', borderWidth: 1, borderColor: get('component.button.secondary.border') as string }}>
                      <Text style={{ color: text, fontWeight:'700' }}>Done</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable accessibilityRole="button" accessibilityLabel="Add to watchlist" onPress={onAddWatchlist}
                      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                      <Icon name="plus" size={18} colorToken="text.primary" />
                    </Pressable>
                    <Pressable
                      ref={filterBtnRef as any}
                      accessibilityRole="button"
                      accessibilityLabel="Filter watchlist"
                      onPress={openFilterMenu}
                      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                      <Icon name="filter" size={18} colorToken="text.primary" />
                    </Pressable>
                    <Pressable
                      ref={sortBtnRef as any}
                      accessibilityRole="button"
                      accessibilityLabel="Sort watchlist"
                      onPress={openSortMenu}
                      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center', backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string), borderWidth: 1, borderColor: get('component.button.secondary.border') as string })}>
                      <Icon name="sort" size={18} colorToken="text.primary" />
                    </Pressable>
                    <Pressable
                      ref={settingsBtnRef as any}
                      accessibilityRole="button"
                      accessibilityLabel="Manage watchlist"
                      onPress={openSettingsMenu}
                      style={({ pressed }) => ({
                        width: 44, height: 44, borderRadius: radius.pill, alignItems:'center', justifyContent:'center',
                        backgroundColor: pressed ? (get('surface.level2') as string) : (get('component.button.secondary.bg') as string),
                        borderWidth: 1, borderColor: get('component.button.secondary.border') as string
                      })}
                    >
                      <Icon name="settings" size={18} colorToken="text.primary" />
                    </Pressable>
                  </>
                )}
              </View>
            </View>
            {watchSyms.length === 0 ? (
              <Text style={{ color: muted }}>Empty watchlist.</Text>
            ) : (
              <ScrollView
                alwaysBounceVertical={Platform.OS === 'ios'}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                scrollEnabled={!reorderWatch}
                style={{ maxHeight: sheetHeight - 200 }}
                contentContainerStyle={{ paddingBottom: spacing.s16 }}
                scrollIndicatorInsets={{ bottom: Math.max(16, 0) as any }}
              >
                <Card padding={0}>
                  {displayWatchSyms.map((sym, i) => (
                    <WatchItem key={sym} sym={sym} index={i} />
                  ))}
                </Card>
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Filter Menu */}
      <PopoverMenu
        visible={filterMenuVisible}
        onClose={() => setFilterMenuVisible(false)}
        anchor={filterMenuAnchor}
        items={[
          { key: 'all', label: 'Show all', onPress: () => { (tab==='Watchlist'? setWatchFilter : setHoldingsFilter)('all' as any); setFilterMenuVisible(false); } },
          { key: 'gainers', label: 'Gainers only', onPress: () => { (tab==='Watchlist'? setWatchFilter : setHoldingsFilter)('gainers' as any); setFilterMenuVisible(false); } },
          { key: 'losers', label: 'Losers only', onPress: () => { (tab==='Watchlist'? setWatchFilter : setHoldingsFilter)('losers' as any); setFilterMenuVisible(false); } },
          { key: 'min-weight', label: 'Min weight > 1%', onPress: () => { (tab==='Watchlist'? setWatchFilter : setHoldingsFilter)('min1' as any); setFilterMenuVisible(false); } },
        ]}
      />

      {/* Sort Menu */}
      <PopoverMenu
        visible={sortMenuVisible}
        onClose={() => setSortMenuVisible(false)}
        anchor={sortMenuAnchor}
        items={[
          { key: 'value-desc', label: 'Value: High to Low', onPress: () => { (tab==='Watchlist'? setWatchSortKey : setSortKey)('value' as any); (tab==='Watchlist'? setWatchSortDir : setSortDir)('desc' as any); setSortMenuVisible(false); } },
          { key: 'value-asc', label: 'Value: Low to High', onPress: () => { (tab==='Watchlist'? setWatchSortKey : setSortKey)('value' as any); (tab==='Watchlist'? setWatchSortDir : setSortDir)('asc' as any); setSortMenuVisible(false); } },
          { key: 'pnl-desc', label: 'P&L: Best first', onPress: () => { (tab==='Watchlist'? setWatchSortKey : setSortKey)('pnl' as any); (tab==='Watchlist'? setWatchSortDir : setSortDir)('desc' as any); setSortMenuVisible(false); } },
          { key: 'pnl-asc', label: 'P&L: Worst first', onPress: () => { (tab==='Watchlist'? setWatchSortKey : setSortKey)('pnl' as any); (tab==='Watchlist'? setWatchSortDir : setSortDir)('asc' as any); setSortMenuVisible(false); } },
          { key: 'ticker', label: 'Ticker (A-Z)', onPress: () => { (tab==='Watchlist'? setWatchSortKey : setSortKey)('ticker' as any); (tab==='Watchlist'? setWatchSortDir : setSortDir)('asc' as any); setSortMenuVisible(false); } },
        ]}
      />

      {/* Settings Menu */}
      <PopoverMenu
        visible={settingsMenuVisible}
        onClose={() => setSettingsMenuVisible(false)}
        anchor={settingsMenuAnchor}
        items={[
          { key: 'edit', label: (tab==='Watchlist' ? 'Edit watchlist' : 'Edit portfolio'), onPress: () => { setSettingsMenuVisible(false); if (tab==='Watchlist') { setEditWatchMode(true); setSelectedWatch({}); } else { setEditMode(true); setSelected({}); } } },
          { key: 'reorder', label: (tab==='Watchlist' ? 'Reorder watchlist' : 'Reorder holdings'), onPress: () => { setSettingsMenuVisible(false); if (tab==='Watchlist') { setOrderWatch([...(watchSyms || [])]); setWatchSortKey('custom'); setReorderWatch(true); } else { setOrderHold([...(holdingsSyms || [])]); setSortKey('custom'); setReorderHold(true); } } },
          { key: 'export', label: 'Export CSV', onPress: () => { setSettingsMenuVisible(false); if (p?.id) { try { exportPortfolioCsv(p.id); } catch {} } } },
          { key: 'archive', label: 'Archive portfolio', onPress: () => { setSettingsMenuVisible(false); if (p?.id) { try { archivePortfolio(p.id); } catch {} } } },
        ]}
      />
    </BottomSheet>
  );
}
