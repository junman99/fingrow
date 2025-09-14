import React, { useEffect } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { Screen } from '../components/Screen';
import { SectionList } from 'react-native';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useInvestStore } from '../store/invest';
import { formatCurrency, formatPercent } from '../lib/format';
import { useProfileStore } from '../store/profile';
import { useNavigation } from '@react-navigation/native';
import LineChart from '../components/LineChart';
import HoldingRow from '../components/invest/HoldingRow';
import WatchRow from '../components/invest/WatchRow';
import SectionToolbar from '../components/invest/SectionToolbar';

export function Invest() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const [pfTf, setPfTf] = React.useState<'1M'|'6M'|'YTD'|'1Y'|'ALL'>('6M');
  const [hideAmounts, setHideAmounts] = React.useState(false);
  const { holdings, watchlist, quotes, hydrate, refreshQuotes, ready, lastUpdated, refreshing, error, fxRates, refreshFx } = useInvestStore();
  const { profile } = useProfileStore();

  React.useEffect(() => { hydrate(); refreshFx(); }, []);
  React.useEffect(() => { if (watchlist.length) refreshQuotes(watchlist); }, [watchlist]);

  const bg = get('surface.level1') as string;
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;

  const symbols = Object.keys(holdings);
  const allSyms = Array.from(new Set([...symbols, ...watchlist]));

  const totalUSD = symbols.reduce((acc, sym) => {
    const q = quotes[sym]?.last || 0;
    const qty = (holdings[sym]?.lots || []).reduce((s,l)=> s + (l.side==='buy'? l.qty : -l.qty), 0);
    return acc + q * qty;
  }, 0);

  const cur = (profile?.currency || 'USD').toUpperCase();
  const rate = fxRates?.rates?.[cur] || (cur==='USD'?1:undefined);
  const totalValue = rate ? totalUSD * rate : totalUSD;
  // Build a portfolio time series (last 180 days) by summing per-symbol position value each day.
  // Build a portfolio time series based on selected timeframe
  const portfolioLine = React.useMemo(() => {
    const oneDay = 24*60*60*1000;
    const curCode = (profile?.currency || 'USD').toUpperCase();
    const fx = fxRates?.rates?.[curCode] || (curCode==='USD' ? 1 : undefined);

    const symbols = Object.keys(holdings);
    if (!symbols.length) return [] as Array<{t:number; v:number}>;

    // Prepare price maps and lots per symbol
    const priceMaps: Record<string, Record<string, number>> = {};
    const positionLots: Record<string, { side:'buy'|'sell'; qty:number; date:number }[]> = {};

    symbols.forEach(sym => {
      const q = quotes[sym];
      const map: Record<string, number> = {};
      if (q?.bars && q.bars.length) {
        q.bars.forEach(b => { const key = new Date(b.t).toISOString().slice(0,10); map[key] = b.c; });
      } else if (q?.line && q.line.length) {
        q.line.forEach(p => { const key = new Date(p.t).toISOString().slice(0,10); map[key] = p.v; });
      }
      priceMaps[sym] = map;
      const lots = (holdings[sym]?.lots || []).map(l => ({ side: l.side, qty: l.qty, date: new Date(l.date).getTime() }));
      positionLots[sym] = lots.sort((a,b)=> a.date - b.date);
    });

    // Determine range
    const now = new Date();
    let start: Date;
    if (pfTf === '1M') start = new Date(now.getFullYear(), now.getMonth()-1, now.getDate());
    else if (pfTf === '6M') start = new Date(now.getFullYear(), now.getMonth()-6, now.getDate());
    else if (pfTf === 'YTD') start = new Date(now.getFullYear(), 0, 1);
    else if (pfTf === '1Y') start = new Date(now.getFullYear()-1, now.getMonth(), now.getDate());
    else start = new Date(now.getFullYear()-5, now.getMonth(), now.getDate()); // ALL ~5y cap for perf

    const days = Math.max(1, Math.ceil((now.getTime() - start.getTime())/oneDay));
    let lastPrices: Record<string, number> = {};
    const out: Array<{ t:number; v:number }> = [];

    for (let d = 0; d <= days; d++) {
      const dt = new Date(start.getTime() + d * oneDay);
      const key = dt.toISOString().slice(0,10);
      let totalUSD = 0;

      symbols.forEach(sym => {
        const map = priceMaps[sym] || {};
        if (map[key] !== undefined) lastPrices[sym] = map[key];
        const price = lastPrices[sym];
        if (price === undefined) return;

        // qty position on that date
        const lots = positionLots[sym] || [];
        let qty = 0;
        for (const l of lots) {
          if (l.date <= dt.getTime()) qty += (l.side==='buy' ? l.qty : -l.qty);
          else break;
        }
        if (qty <= 0) return;
        totalUSD += qty * price;
      });

      const value = fx ? totalUSD * fx : totalUSD;
      out.push({ t: dt.getTime(), v: Number(value.toFixed(2)) });
    }
    return out;
  }, [pfTf, holdings, quotes, fxRates, profile]);

  const pfBaseline = portfolioLine.length ? portfolioLine[0].v : 0;
  const pfLast = portfolioLine.length ? portfolioLine[portfolioLine.length-1].v : 0;
  const pfPrev = portfolioLine.length>1 ? portfolioLine[portfolioLine.length-2].v : pfLast;
  const pfTodayAbs = Number((pfLast - pfPrev).toFixed(2));
  const pfTodayPct = pfPrev ? Number(((pfLast - pfPrev)/pfPrev*100).toFixed(2)) : 0;
  const pfRangeAbs = Number((pfLast - pfBaseline).toFixed(2));
  const pfRangePct = pfBaseline ? Number(((pfLast - pfBaseline)/pfBaseline*100).toFixed(2)) : 0;


  type Row = { key: string; sym: string; kind: 'holding' | 'watch' };

  const sections: Array<{ title: string; data: Row[] }> = [
    { title: 'Holdings', data: symbols.map(sym => ({ key: 'h:'+sym, sym, kind: 'holding' })) },
    { title: 'Watchlist', data: allSyms.map(sym => ({ key: 'w:'+sym, sym, kind: 'watch' })) },
  ];

  const renderHeader = () => (
    <View style={{ padding: spacing.s16, gap: spacing.s12 }}>
      {/* top toolbar */}
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
        <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Invest</Text>
        <View style={{ flexDirection:'row', gap: spacing.s8 }}>
          <Pressable onPress={() => nav.navigate('EditWatchlist')} style={{ backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
            <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => nav.navigate('Search')} style={{ backgroundColor: get('accent.primary') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
            <Text style={{ color: get('text.onPrimary') as string, fontWeight:'700' }}>Add</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={{ backgroundColor: get('surface.level2') as string, borderRadius: radius.lg, padding: spacing.s12 }}>
          <Text style={{ color: get('text.muted') as string }}>Offline or unable to refresh. Showing cached data.</Text>
        </View>
      ) : null}
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
        <Text style={{ color: get('text.primary') as string, fontWeight:'700' }}>Invest</Text>
        <Pressable onPress={() => nav.navigate('Search')} style={{ backgroundColor: get('surface.level2') as string, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
          <Text style={{ color: get('text.primary') as string }}>Add to watchlist</Text>
        </Pressable>
      </View>

      <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.s16, marginTop: spacing.s12, borderWidth: 1, borderColor: get('border.subtle') as string, overflow: 'hidden' }}>
        <Text style={{ color: muted, marginBottom: spacing.s8 }}>Portfolio</Text>
        <Text style={{ color: text, fontWeight: '700', fontSize: 24 }}>{formatCurrency(totalValue, cur, { compact: false })}</Text>
        <Text style={{ color: muted, marginTop: spacing.s4 }}>{lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleTimeString()}` : ''}</Text>
        {/* KPI lines */}
        <Text style={{ marginTop: spacing.s4, color: (pfTodayAbs>=0 ? (get('semantic.success') as string) : (get('semantic.danger') as string)) }}>{`${pfTodayAbs>=0?'+':''}${formatCurrency(Math.abs(pfTodayAbs), cur)} (${formatPercent(pfTodayPct)})`} Today</Text>
        <Text style={{ color: (pfRangeAbs>=0 ? (get('semantic.success') as string) : (get('semantic.danger') as string)) }}>{`${pfRangeAbs>=0?'+':''}${formatCurrency(Math.abs(pfRangeAbs), cur)} (${formatPercent(pfRangePct)})`} {pfTf==='6M'?'Past 6 months': pfTf==='1M'?'Past month': pfTf==='YTD'?'Year to date': pfTf==='1Y'?'Past year':'All time'}</Text>
        {portfolioLine.length ? (
          <View style={{ marginTop: spacing.s12 }}>
            <LineChart data={portfolioLine} height={160} baselineValue={pfBaseline} area showMarker />
          </View>
        ) : null}
        {/* Timeframes */}
        <View style={{ flexDirection:'row', gap: spacing.s8, marginTop: spacing.s12 }}>
          {(['1D','5D','1M','6M','YTD','1Y','ALL'] as const).map(k => {
            const disabled = (k==='1D' || k==='5D');
            const on = pfTf===k;
            return (
              <Pressable key={k} disabled={disabled} onPress={() => setPfTf(k as any)} style={{ opacity: disabled? 0.4:1, backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string), paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
                <Text style={{ color: on ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight:'700' }}>{k}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  );

  return (
    <Screen>
      <SectionList
        refreshControl={undefined}
        refreshing={refreshing}
        onRefresh={() => refreshQuotes(allSyms)}
        sections={sections}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={renderHeader}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <SectionToolbar
            title={section.title}
            onEdit={section.title === 'Watchlist' ? () => nav.navigate('EditWatchlist' as never) : undefined}
            onSort={() => {}}
            onFilter={() => {}}
          />
        )}
        renderItem={({ item }) => (
  item.kind === 'holding'
    ? <HoldingRow sym={item.sym} onPress={() => nav.navigate('Instrument' as never, { symbol: item.sym } as never)} />
    : <WatchRow sym={item.sym} onPress={() => nav.navigate('Instrument' as never, { symbol: item.sym } as never)} />
)}
        contentInsetAdjustmentBehavior="never"
      />
    </Screen>
  );
}