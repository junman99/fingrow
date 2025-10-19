// FX via exchangerate.host (free; uses ECB rates).
// We normalize to base USD for equities & crypto (Yahoo Finance & CoinGecko nominally in USD).
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

export function convertCurrency(rates: FxRates | undefined, amount: number, from: string, to: string): number {
  if (!Number.isFinite(amount)) return 0;
  const src = (from || 'USD').toUpperCase();
  const dest = (to || 'USD').toUpperCase();
  if (!rates || !rates.rates || src === dest) return amount;

  let amountUSD = amount;
  if (src !== 'USD') {
    const rateFrom = rates.rates[src];
    if (rateFrom && rateFrom !== 0) {
      amountUSD = amount / rateFrom;
    }
  }

  if (dest === 'USD') return amountUSD;
  const rateTo = rates.rates[dest];
  if (!rateTo || rateTo === 0) return amountUSD;
  return amountUSD * rateTo;
}
