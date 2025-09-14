// FX via exchangerate.host (free; uses ECB rates).
// We normalize to base USD for equities & crypto (Stooq & CoinGecko nominally in USD).
export type FxRates = { base: string; ts: number; rates: Record<string, number> };

/** Fetch latest FX rates with base USD (e.g., USD->SGD). */
export async function fetchFxUSD(): Promise<FxRates> {
  const url = 'https://api.exchangerate.host/latest?base=USD';
  const res = await fetch(url);
  if (!res.ok) throw new Error('FX HTTP ' + res.status);
  const json = await res.json();
  return { base: 'USD', ts: Date.now(), rates: json?.rates || {} };
}

export function convertUSD(rates: FxRates | undefined, to: string, amountUSD: number): number {
  if (!rates || !rates.rates) return amountUSD;
  const rate = rates.rates[(to || 'USD').toUpperCase()];
  if (!rate) return amountUSD;
  return amountUSD * rate;
}