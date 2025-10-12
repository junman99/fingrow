import React from 'react';
import { Card } from '../components/Card';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenScroll } from '../components/ScreenScroll';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useInvestStore } from '../store/invest';
import { formatCurrency, formatPercent } from '../lib/format';
import { useProfileStore } from '../store/profile';
import { useNavigation } from '@react-navigation/native';
import LineChart from '../components/LineChart';
import { computePnL } from '../lib/positions';
import AppHeader from '../components/AppHeader';
import PortfolioListCard from '../components/invest/PortfolioListCard';
import CreatePortfolioModal from '../components/invest/CreatePortfolioModal';
import PortfolioDetailSheet from '../components/invest/PortfolioDetailSheet';
import AddHoldingSheet from '../components/invest/AddHoldingSheet';
import PortfolioManagerModal from '../components/invest/PortfolioManagerModal';
import EditPortfolioModal from '../components/invest/EditPortfolioModal';
import HoldingsFilterSheet from '../components/invest/HoldingsFilterSheet';
import HoldingsSortSheet from '../components/invest/HoldingsSortSheet';

export function Invest() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const [pfTf, setPfTf] = React.useState<'1D'|'5D'|'1M'|'6M'|'YTD'|'1Y'|'ALL'>('6M');
  const [hideAmounts, setHideAmounts] = React.useState(false);
  const [showCreateSheet, setShowCreateSheet] = React.useState(false);
  const [showManager, setShowManager] = React.useState(false);
  const [showAddHolding, setShowAddHolding] = React.useState(false);
  const [addMode, setAddMode] = React.useState<'holdings'|'watchlist'>('holdings');
  const [editPortfolioId, setEditPortfolioId] = React.useState<string | null>(null);
    // Selection mode for deleting portfolios
  const [deleteMode, setDeleteMode] = React.useState(false);
  const [selectedPids, setSelectedPids] = React.useState<string[]>([]);
  const onToggleSelectPid = React.useCallback((pid: string) => {
    setSelectedPids(prev => prev.includes(pid) ? prev.filter(x => x!==pid) : [...prev, pid]);
  }, []);
  const deletePortfolio = useInvestStore(s => (s as any).deletePortfolio);
  const onDeleteSelected = React.useCallback(async () => {
    for (const pid of selectedPids) { try { await deletePortfolio(pid); } catch {} }
    setSelectedPids([]); setDeleteMode(false);
  }, [selectedPids, deletePortfolio]);
const onStartDeleteMode = React.useCallback(() => { setDeleteMode(true); setSelectedPids([]); }, []);
  const [currentPortfolioId, setCurrentPortfolioId] = React.useState<string|null>(null);
  const [modalPortfolioId, setModalPortfolioId] = React.useState<string|null>(null);
  const [showHoldingsFilter, setShowHoldingsFilter] = React.useState(false);
  const [showHoldingsSort, setShowHoldingsSort] = React.useState(false);
  const [qHold, setQHold] = React.useState('');
  const [minWeight, setMinWeight] = React.useState(0);
  const [sortKey, setSortKey] = React.useState<'mv'|'pnlAbs'|'pnlPct'|'ticker'>('mv');
  const [sortDir, setSortDir] = React.useState<'asc'|'desc'>('desc');

  const { portfolios, quotes, hydrate, refreshQuotes, refreshing, error, fxRates, refreshFx, allSymbols } = useInvestStore();
  const { profile } = useProfileStore();

  React.useEffect(() => { hydrate(); refreshFx(); /* auto-refresh quotes on mount */ const syms = allSymbols(); refreshQuotes(syms && syms.length ? syms : undefined); }, []);

  // Aggregate holdings across all portfolios for the overview chart
  const effectiveHoldings: Record<string, any> = React.useMemo(() => {
    const out: Record<string, any> = {};
    Object.values(portfolios || {}).forEach((p:any) => {
      if (!p || !p.holdings) return;
      Object.values(p.holdings || {}).forEach((h:any) => {
        const sym = h.symbol;
        if (!out[sym]) out[sym] = { ...h, lots: [] };
        out[sym].lots = out[sym].lots.concat(h.lots || []);
      });
    });
    return out;
  }, [portfolios]);

  const symbols = React.useMemo(()=> Object.keys(effectiveHoldings), [effectiveHoldings]);

  const totalUSD = React.useMemo(() => {
    return symbols.reduce((acc, sym) => {
      const last = quotes[sym]?.last || 0;
      const qty = (effectiveHoldings[sym]?.lots || []).reduce((s:any,l:any)=> s + (l.side==='buy'? l.qty : -l.qty), 0);
      return acc + last * qty;
    }, 0);
  }, [symbols, effectiveHoldings, quotes]);

  // Include portfolio cash balances (converted to USD baseline)
  const cashUSD = React.useMemo(() => {
    const rates = fxRates?.rates || {} as Record<string, number>;
    let sum = 0;
    Object.values(portfolios || {}).forEach((p: any) => {
      const cash = Number(p?.cash || 0);
      if (!cash) return;
      const cur = String(p?.baseCurrency || 'USD').toUpperCase();
      if (cur === 'USD') sum += cash;
      else {
        const r = Number(rates[cur] || 0);
        sum += r ? (cash / r) : cash; // fallback assume ~USD if missing
      }
    });
    return sum;
  }, [portfolios, fxRates]);

  const cur = ((profile?.currency) || 'USD').toUpperCase();
  const rate = fxRates?.rates?.[cur] || (cur==='USD'?1:undefined);
  const totalValue = rate ? (totalUSD + cashUSD) * rate : (totalUSD + cashUSD);

  const portfolioLine = React.useMemo(() => {
    const syms = Object.keys(effectiveHoldings);
    if (!syms.length) return [] as Array<{t:number; v:number}>;
    const priceMaps: Record<string, Record<string, number>> = {};
    const positionLots: Record<string, { side:'buy'|'sell'; qty:number; date:number }[]> = {};
    syms.forEach(sym => {
      const q = quotes[sym];
      const map: Record<string, number> = {};
      if (q?.bars && q.bars.length) {
        let lastC: number | undefined;
        q.bars.forEach(b => {
          const c = Number((b as any).c);
          if (!Number.isFinite(c) || c <= 0) return;
          if (lastC && (c > lastC * 5 || c < lastC / 5)) return;
          const key = new Date((b as any).t).toISOString().slice(0,10);
          map[key] = c;
          lastC = c;
        });
      } else if (q?.line && q.line.length) {
        const last = Number.isFinite((q as any).last) ? (q as any).last as number : undefined;
        (q.line as any[]).forEach(p => {
          const v = (p as any)?.v;
          if (Number.isFinite(v) && v > 0 && (!last || v < last * 5)) {
            const key = new Date((p as any).t).toISOString().slice(0,10);
            map[key] = v as number;
          }
        });
      }
      priceMaps[sym] = map;
      const lots = (effectiveHoldings[sym]?.lots || []).map((l:any) => ({ side: l.side, qty: l.qty, date: new Date(l.date).getTime() }));
      positionLots[sym] = lots.sort((a,b)=> a.date - b.date);
    });
    // date domain & forward-fill
    // Collect union of all dates present across symbols
    const allDates = new Set<string>();
    Object.values(priceMaps).forEach(m => Object.keys(m).forEach(d => allDates.add(d)));
    // Include cash event dates across portfolios (converted to USD later)
    const cashEventMapUSD: Record<string, number> = {};
    try {
      const rates = fxRates?.rates || {} as Record<string, number>;
      Object.values(portfolios || {}).forEach((p: any) => {
        const base = String(p?.baseCurrency || 'USD').toUpperCase();
        const r = Number(rates[base] || 0);
        const toUSD = (amt: number) => base==='USD' || !r ? amt : (amt / r);
        (p?.cashEvents || []).forEach((ev: any) => {
          const d = new Date(ev.date);
          const key = isNaN(d.getTime()) ? undefined : d.toISOString().slice(0,10);
          if (!key) return;
          cashEventMapUSD[key] = (cashEventMapUSD[key] || 0) + toUSD(Number(ev.amount || 0));
          allDates.add(key);
        });
      });
    } catch {}
    const dates = Array.from(allDates).sort(); // 'YYYY-MM-DD'

    // Build a forward-filled price map per symbol (no back-fill before first price)
    const ff: Record<string, Record<string, number>> = {};
    syms.forEach(sym => {
      const src = priceMaps[sym] || {};
      const dst: Record<string, number> = {};
      let lastKnown: number | undefined;
      for (const d of dates) {
        if (Object.prototype.hasOwnProperty.call(src, d)) {
          const val = src[d];
          if (lastKnown && (val > lastKnown * 5 || val < lastKnown / 5)) {
            // ignore absurd jump; keep lastKnown for this day
            dst[d] = lastKnown;
          } else {
            dst[d] = val;
            lastKnown = val;
          }
        } else if (lastKnown !== undefined) {
          dst[d] = lastKnown;
        }
      }
      ff[sym] = dst;
    });

    // Running cash balance in USD across all portfolios by date
    const cashByDateUSD: Record<string, number> = {};
    let run = 0;
    for (const d of dates) {
      if (Object.prototype.hasOwnProperty.call(cashEventMapUSD, d)) run += cashEventMapUSD[d];
      cashByDateUSD[d] = run;
    }

    const points: Array<{t:number; v:number}> = dates.map(d => {
      let total = 0;
      syms.forEach(sym => {
        const price = ff[sym]?.[d];
        if (price !== undefined) {
          const lots = positionLots[sym];
          const cutTs = new Date(d).getTime();
          const qty = lots.reduce((s,l) => s + (l.date <= cutTs ? (l.side==='buy' ? l.qty : -l.qty) : 0), 0);
          if (qty) total += qty * price;
        }
      });
      // add cash (USD baseline)
      total += cashByDateUSD[d] || 0;
      return { t: new Date(d).getTime(), v: (rate || 1) * total };
    });
    return points.slice(-520); // keep it light
  }, [effectiveHoldings, quotes, rate, portfolios, fxRates]);

// Always have something to render for the chart (placeholder if empty)
const displaySeries = React.useMemo(() => {
  if (portfolioLine && portfolioLine.length) return portfolioLine;
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  return Array.from({ length: 14 }, (_, i) => ({ t: now - (13 - i) * day, v: 0 }));
}, [portfolioLine]);

// Timeframe-filtered view
const visibleSeries = React.useMemo(() => {
  const s = portfolioLine || [];
  if (!s.length) return s;
  const endTs = s[s.length - 1].t;
  const end = new Date(endTs);
  const msDay = 24 * 3600 * 1000;

  const since = (() => {
    switch (pfTf) {
      case '1D': return endTs - 1 * msDay;
      case '5D': return endTs - 5 * msDay;
      case '1M': { const d = new Date(end); d.setMonth(d.getMonth() - 1); return d.getTime(); }
      case '6M': { const d = new Date(end); d.setMonth(d.getMonth() - 6); return d.getTime(); }
      case '1Y': { const d = new Date(end); d.setFullYear(d.getFullYear() - 1); return d.getTime(); }
      case 'YTD': { const d = new Date(end); d.setMonth(0,1); d.setHours(0,0,0,0); return d.getTime(); }
      default: return 0; // ALL
    }
  })();

  return pfTf === 'ALL' ? s : s.filter(p => p.t >= since);
}, [portfolioLine, pfTf]);

// Change label (color + text)
const changeInfo = React.useMemo(() => {
  const s = (visibleSeries && visibleSeries.length >= 2) ? visibleSeries : displaySeries;
  if (!s || s.length < 2) return { color: get('text.muted') as string, text: '+0 (+0.0%)' };
  const first = s[0].v;
  const last = s[s.length - 1].v;
  const delta = last - first;
  const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;
  const color = delta > 0 ? (get('semantic.success') as string) : delta < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
  const sign = delta > 0 ? '+' : (delta < 0 ? '' : '+');
  const absDelta = Math.abs(delta);
  const text = `${sign}${absDelta.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${sign}${Math.abs(pct).toFixed(1)}%)`;
  return { color, text };
}, [visibleSeries, displaySeries, get]);



  

// Change labels
const todayInfo = React.useMemo(() => {
  const s = portfolioLine || [];
  if (!s || s.length < 2) return { color: get('text.muted') as string, text: '+0 (+0.0%) Today' };
  const last = s[s.length - 1].v;
  const prev = s[s.length - 2].v;
  const delta = last - prev;
  const pct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : 0;
  const color = delta > 0 ? (get('semantic.success') as string) : delta < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
  const sign = delta > 0 ? '+' : (delta < 0 ? '' : '+');
  const absDelta = Math.abs(delta);
  const text = `${sign}${absDelta.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${sign}${Math.abs(pct).toFixed(1)}%) Today`;
  return { color, text };
}, [portfolioLine, get]);

const rangeInfo = React.useMemo(() => {
  const s = (visibleSeries && visibleSeries.length >= 2) ? visibleSeries : displaySeries;
  if (!s || s.length < 2) return { color: get('text.muted') as string, text: '+0 (+0.0%)' };
  const first = s[0].v;
  const last = s[s.length - 1].v;
  const delta = last - first;
  const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;
  const color = delta > 0 ? (get('semantic.success') as string) : delta < 0 ? (get('semantic.danger') as string) : (get('text.muted') as string);
  const sign = delta > 0 ? '+' : (delta < 0 ? '' : '+');
  const absDelta = Math.abs(delta);
  const text = `${sign}${absDelta.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${sign}${Math.abs(pct).toFixed(1)}%)`;
  return { color, text };
}, [visibleSeries, displaySeries, get]);
const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const good = get('semantic.success') as string;


  const xTickStrategy = React.useMemo(() => {
    if (pfTf === '1D' || pfTf === '5D') {
      return { mode: 'day', every: 1 } as const; // every point
    }
    if (pfTf === '1M') {
      // About ~6 labels across 1M
      const len = (visibleSeries.length ? visibleSeries.length : displaySeries.length) || 0;
      const every = Math.max(1, Math.round(len / 6));
      return { mode: 'day', every } as const;
    }
    // Others: month labels
    return { mode: 'month' } as const;
  }, [pfTf, visibleSeries, displaySeries]);

  return (
    <ScreenScroll
      refreshing={refreshing}
      onRefresh={async () => { try { await refreshFx(); const syms = allSymbols(); await refreshQuotes(syms && syms.length ? syms : undefined); } catch (e) {} }} inTab>
      <View style={{ padding: spacing.s16, gap: spacing.s16 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: get('text.primary') as string, marginTop: spacing.s12, marginBottom: spacing.s12 }}>Invest</Text>

        {/* Overview card with chart */}
        <Card style={{ padding: spacing.s16 }}>
<Text style={{ color: text, fontWeight:'800', fontSize: 28 }}>{hideAmounts ? '•••' : formatCurrency(totalValue, cur)}</Text>
          <Text style={{ color: todayInfo.color, marginTop: spacing.s4 }}>{todayInfo.text}</Text>
<Text style={{ color: rangeInfo.color, marginTop: spacing.s4 }}>{rangeInfo.text}</Text>
          {
  <View style={{ marginTop: spacing.s12, marginHorizontal: -spacing.s8 }}>
    <LineChart data={visibleSeries.length ? visibleSeries : displaySeries} height={160} yAxisWidth={28} padding={{ left: 6, right: 10, bottom: 17, top: 8 }} xTickStrategy={xTickStrategy} />
  </View>
}
          {/* Timeframes */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s8, paddingVertical: spacing.s8 }} bounces={true} overScrollMode="always">
            {(['1D','5D','1M','6M','YTD','1Y','ALL'] as const).map(k => {
              const disabled = false;
              const on = pfTf===k;
              return (
                <Pressable accessibilityRole="button" key={k} disabled={disabled} onPress={() => setPfTf(k as any)} style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string) }}>
                  <Text style={{ color: on ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight:'700', fontSize: 14  }}>{k}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
          </Card>

        {/* Portfolios card */}
        {/* Allocation chips across all portfolios (top 3 including cash) */}
        {(() => {
          try {
            const positions: Record<string, number> = {};
            Object.values(portfolios || {}).forEach((p:any) => {
              Object.values((p?.holdings||{}) as any).forEach((h:any) => {
                const qty = (h?.lots||[]).reduce((s:number,l:any)=> s + (l.side==='buy'?l.qty:-l.qty),0);
                if (qty>0) positions[h.symbol] = (positions[h.symbol]||0) + qty;
              });
            });
            const syms = Object.keys(positions);
            let total = syms.reduce((acc, sym) => {
              const last = quotes[sym]?.last || 0;
              return acc + last * positions[sym];
            }, 0);
            // add cash (USD baseline) across portfolios
            let cashAll = 0;
            const rates = fxRates?.rates || {} as Record<string, number>;
            Object.values(portfolios || {}).forEach((p:any)=>{
              const cash = Number(p?.cash||0);
              if (!cash) return;
              const cur = String(p?.baseCurrency||'USD').toUpperCase();
              const r = Number(rates[cur]||0);
              cashAll += (cur==='USD'||!r) ? cash : (cash / r);
            });
            total += cashAll;
            const arr = [
              ...syms.map(sym => {
                const last = quotes[sym]?.last || 0;
                const val = last * positions[sym];
                return { sym, wt: total>0 ? (val/total) : 0 };
              }),
              ...(cashAll ? [{ sym: 'CASH', wt: total>0 ? (cashAll/total) : 0 }] : [])
            ].sort((a,b)=> b.wt - a.wt).slice(0,3);
            if (!arr.length) return null;
            return (
              <Card style={{ padding: spacing.s12 }}>
                <Text style={{ color: text, fontWeight:'700', marginBottom: spacing.s8 }}>Top allocation</Text>
                <View style={{ flexDirection:'row', gap: spacing.s8, flexWrap:'wrap' }}>
                  {arr.map(x => (
                    <View key={x.sym} style={{ paddingVertical: spacing.s4, paddingHorizontal: spacing.s12, borderRadius: 999, borderWidth:1, borderColor: get('border.subtle') as string }}>
                      <Text style={{ color: get('text.onSurface') as string }}>{x.sym} {(x.wt*100).toFixed(0)}%</Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          } catch { return null; }
        })()}

        
        
        
        
        
        <PortfolioListCard
        selectionMode={deleteMode}
        selectedIds={selectedPids}
        onToggleSelect={onToggleSelectPid}
        onDeleteSelected={onDeleteSelected}
        onStartDeleteMode={onStartDeleteMode}
        onOpenManager={() => setShowManager(true)}
          onOpenPortfolio={(id) => setCurrentPortfolioId(id)}
          onCreate={() => setShowCreateSheet(true)}
        />
      </View>


      {/* Bottom sheet for adding a holding via symbol search (multi-add) */}
      <AddHoldingSheet
        visible={showAddHolding}
        onClose={() => {
          setShowAddHolding(false);
          if (modalPortfolioId) { setCurrentPortfolioId(modalPortfolioId); }
          setModalPortfolioId(null);
        }}
        portfolioId={modalPortfolioId}
        mode={addMode}
      />
{/* Sheets */}
      <PortfolioDetailSheet
        portfolioId={currentPortfolioId}
        visible={!!currentPortfolioId}
        dimmed={showAddHolding}
        onClose={() => {
          if (!showAddHolding) {
            setCurrentPortfolioId(null);
          }
        }}
        onEditWatchlist={() => { const id = currentPortfolioId; setCurrentPortfolioId(null); nav.navigate('EditWatchlist' as never, { portfolioId: id } as never); }}
        onFilterHoldings={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setShowHoldingsFilter(true); }}
        onSortHoldings={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setShowHoldingsSort(true); }}
        onAddHolding={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setAddMode('holdings'); setShowAddHolding(true); }}
      onOpenManager={() => setShowManager(true)}
      onAddWatchlist={() => { setModalPortfolioId(currentPortfolioId); setCurrentPortfolioId(null); setAddMode('watchlist'); setShowAddHolding(true); }}
      />

      <HoldingsFilterSheet
        visible={showHoldingsFilter}
        onClose={() => { setShowHoldingsFilter(false); if (modalPortfolioId) { setCurrentPortfolioId(modalPortfolioId); setModalPortfolioId(null); } }}
        valueQuery={qHold}
        onChangeQuery={setQHold}
        valueMinWeight={minWeight}
        onChangeMinWeight={setMinWeight}
        onClear={() => { setQHold(''); setMinWeight(0); }}
      />

      <HoldingsSortSheet
        visible={showHoldingsSort}
        onClose={() => { setShowHoldingsSort(false); if (modalPortfolioId) { setCurrentPortfolioId(modalPortfolioId); setModalPortfolioId(null); } }}
        valueKey={sortKey}
        valueDir={sortDir}
        onChange={(k,d) => { setSortKey(k); setSortDir(d); }}
      />

      <PortfolioManagerModal
        visible={showManager}
        onClose={() => setShowManager(false)}
        onStartDelete={() => { setShowManager(false); onStartDeleteMode(); }}
        onRequestEdit={(id: string) => { setShowManager(false); setEditPortfolioId(id); }}
      />

      <EditPortfolioModal
        visible={!!editPortfolioId}
        onClose={() => setEditPortfolioId(null)}
        portfolioId={editPortfolioId}
      />

      <CreatePortfolioModal
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        defaultCurrency={(profile?.currency || 'SGD').toUpperCase()}
        onConfirm={async (name, currency, type, benchmark) => {
          const id = await (useInvestStore.getState() as any).createPortfolio(name, currency, { type, benchmark: benchmark === 'NONE' ? undefined : benchmark });
          await (useInvestStore.getState() as any).setActivePortfolio(id);
          setShowCreateSheet(false);
          setCurrentPortfolioId(id);
        }}
      />
    </ScreenScroll>
  );
}

export default Invest;
