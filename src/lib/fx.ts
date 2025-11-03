// FX via exchangerate-api.com (free, no API key required).
// We normalize to base USD for equities & crypto (Yahoo Finance & CoinGecko nominally in USD).
export type FxRates = { base: string; ts: number; rates: Record<string, number> };

/** Fetch latest FX rates with base USD (e.g., USD->SGD). */
export async function fetchFxUSD(): Promise<FxRates> {
  const url = 'https://open.er-api.com/v6/latest/USD';
  const res = await fetch(url);
  if (!res.ok) throw new Error('FX HTTP ' + res.status);
  const json = await res.json();

  // Check if the API returned success
  if (json.result !== 'success') {
    throw new Error('FX API error: ' + (json.error?.info || 'Unknown error'));
  }

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

  // Debug logging
  const shouldLog = Math.random() < 0.02; // Log 2% of calls
  if (shouldLog) {
    console.log('💱 [convertCurrency]', {
      amount,
      from: src,
      to: dest,
      hasRates: !!rates,
      ratesCount: rates?.rates ? Object.keys(rates.rates).length : 0,
      srcRate: rates?.rates?.[src],
      destRate: rates?.rates?.[dest],
    });
  }

  if (!rates || !rates.rates) {
    console.warn('⚠️ [convertCurrency] No FX rates available!');
    return amount;
  }

  if (src === dest) {
    if (shouldLog) console.log('💱 [convertCurrency] Same currency, returning amount:', amount);
    return amount;
  }

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
  const result = amountUSD * rateTo;

  if (shouldLog) {
    console.log('💱 [convertCurrency] Result:', { amountUSD, rateTo, result });
  }

  return result;
}
