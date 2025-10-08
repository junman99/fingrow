
// Minimal Yahoo finance fetchers (no API key).
// We try chart@query1 -> chart@query2 -> spark fallback.
// All return array of { date (ms), open, high, low, close, volume }.

export type YahooBar = { date: number; open: number; high: number; low: number; close: number; volume: number };

export function toYahooSymbol(userSymbol: string): string {
  if (!userSymbol) return '';
  return userSymbol.toUpperCase().replace(/\.[A-Z]+$/, '');
}

async function fetchJson(url: string): Promise<any> {
  const headers: any = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' };
  const res = await fetch(url as any, { headers } as any);
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  return await res.json();
}

function chartToBars(json: any): YahooBar[] {
  const r = json?.chart?.result?.[0];
  if (!r || !Array.isArray(r.timestamp)) return [];
  const ts: number[] = r.timestamp;
  const q = r.indicators?.quote?.[0] || {};
  const opens = q.open || [];
  const highs = q.high || [];
  const lows  = q.low  || [];
  const closes= q.close|| [];
  const vols  = q.volume||[];
  const out: YahooBar[] = [];
  for (let i=0; i<ts.length; i++) {
    const c = Number((closes[i] ?? 0) || 0);
    out.push({
      date: (ts[i] || 0) * 1000,
      open: Number(opens[i] ?? c ?? 0) || 0,
      high: Number(highs[i] ?? c ?? 0) || 0,
      low:  Number(lows[i]  ?? c ?? 0) || 0,
      close: c,
      volume: Number(vols[i] ?? 0) || 0,
    });
  }
  return out.filter(b => b.close > 0);
}

function sparkToBars(json: any): YahooBar[] {
  const r = json?.spark?.result?.[0];
  if (!r) return [];
  const ts: number[] = r.timestamp || [];
  const closes: number[] = r.response?.[0]?.indicators?.quote?.[0]?.close || r.close || [];
  const out: YahooBar[] = [];
  for (let i=0; i<ts.length; i++) {
    const c = Number((closes[i] ?? 0) || 0);
    if (!c) continue;
    out.push({ date: (ts[i] || 0) * 1000, open: c, high: c, low: c, close: c, volume: 0 });
  }
  return out;
}

export async function fetchDailyHistoryYahoo(userSymbol: string, range: '1y'|'2y'|'5y'|'max' = '5y'): Promise<YahooBar[]> {
  const sym = toYahooSymbol(userSymbol);
  if (!sym) throw new Error('Bad symbol');

  // 1) query1 chart
  try {
    const j1 = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d&includePrePost=false`);
    const b1 = chartToBars(j1);
    if (b1.length) return b1;
  } catch {}

  // 2) query2 chart
  try {
    const j2 = await fetchJson(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d&includePrePost=false`);
    const b2 = chartToBars(j2);
    if (b2.length) return b2;
  } catch {}

  // 3) spark fallback
  try {
    const s = await fetchJson(`https://query2.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(sym)}&range=${range}&interval=1d`);
    const bs = sparkToBars(s);
    if (bs.length) return bs;
  } catch {}

  throw new Error('Yahoo failed');
}
