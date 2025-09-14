// Minimal CoinGecko helpers (no key).
// Price + daily history for BTC/ETH in USD.
export type CgPoint = { t: number; v: number };

const MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
};

/** Normalize user-entered crypto symbols to base asset tickers (BTC/ETH). */
export function baseCryptoSymbol(sym: string): 'BTC' | 'ETH' | null {
  const u = (sym || '').toUpperCase().replace(/[^A-Z]/g, '');
  // common aliases and pairs (BTC, XBT, BTCUSD, BTCUSDT, BTC-USD, etc.)
  if (u === 'BTC' || u === 'XBT' || u.startsWith('BTC') || u.startsWith('XBT')) return 'BTC';
  if (u === 'ETH' || u.startsWith('ETH')) return 'ETH';
  return null;
}

export function isCryptoSymbol(sym: string): boolean {
  return baseCryptoSymbol(sym) !== null;
}

export function mapCryptoId(sym: string): string | null {
  const base = baseCryptoSymbol(sym);
  return base ? MAP[base] : null;
}

// Returns last price (USD) and daily line (array of {t,v}) for ~1 year by defaultDays.
export async function fetchCrypto(sym: string, defaultDays: number = 365): Promise<{ last: number; line: CgPoint[] }> {
  const id = mapCryptoId(sym);
  if (!id) throw new Error('Unknown crypto symbol');
  // market_chart returns arrays of [ts, price] in ms
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${defaultDays}&interval=daily`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = await res.json();
  const prices: Array<[number, number]> = json?.prices || [];
  const line: CgPoint[] = prices.map(([ts, price]) => ({ t: ts, v: Number(price) }));
  const last = line.length ? Number(line[line.length-1].v) : 0;
  return { last, line };
}

export type CgBar = { t: number; o: number; h: number; l: number; c: number };

/** Fetch daily OHLC bars for BTC/ETH (days: 1, 7, 30, 90, 180, 365, max). */
export async function fetchCryptoOhlc(sym: string, days: number): Promise<CgBar[]> {
  const id = mapCryptoId(sym);
  if (!id) throw new Error('Unknown crypto symbol');
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko OHLC HTTP ${res.status}`);
  const arr: Array<[number, number, number, number, number]> = await res.json();
  return (arr || []).map(([t,o,h,l,c]) => ({ t, o, h, l, c }));
}
