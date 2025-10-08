// Tiny Stooq helper: fetch daily history CSV and parse into array
// Docs: https://stooq.com (unofficial use; CSV endpoints are public)
// Example daily history: https://stooq.com/q/d/l/?s=aapl.us&i=d

export type StooqBar = { date: number; open: number; high: number; low: number; close: number; volume: number };

/** Map a user symbol (e.g., AAPL, TSLA, SPY) to Stooq code (aapl.us, tsla.us, spy.us). */
export function toStooqSymbol(userSymbol: string): string | null {
  if (!userSymbol) return null;
  const s = userSymbol.trim().toLowerCase();
  // Basic mapping for US symbols
  // If user already provided suffix like .us, keep it
  if (/[.](us|uk|de|jp|pl)$/.test(s)) return s;
  // naive defaults to US market for MVP
  return s + '.us';
}

/** Fetch daily history bars for a single symbol from Stooq. */
export async function fetchDailyHistoryStooq(userSymbol: string, opts?: { signal?: AbortSignal, retries?: number }): Promise<StooqBar[]> {
  const stooqSym = toStooqSymbol(userSymbol);
  if (!stooqSym) throw new Error('Bad symbol');
  const retries = Math.max(0, Math.min(3, opts?.retries ?? 1));
  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const bust = Date.now() + '-' + Math.floor(Math.random() * 1000);
      const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=d&r=${bust}`;
      const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: opts?.signal } as any);
      if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
      const csv = await res.text();
      const lines = csv.trim().split(/\r?\n/);
      const out: StooqBar[] = [];
      for (let i=1; i<lines.length; i++) {
        const [dateStr, open, high, low, close, vol] = lines[i].split(',');
        const ts = Date.parse(dateStr + 'T00:00:00Z');
        out.push({
          date: isNaN(ts) ? Date.now() : ts,
          open: Number(open) || 0,
          high: Number(high) || 0,
          low: Number(low) || 0,
          close: Number(close) || 0,
          volume: Number(vol) || 0,
        });
      }
      if (out.length) return out;
      throw new Error('Stooq empty');
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 300 + Math.random()*300));
    }
  }
  throw lastErr || new Error('Stooq failed');
}
