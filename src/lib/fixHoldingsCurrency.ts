// Utility to fix currency metadata for existing holdings
// Run this once to migrate holdings from portfolio currency to ticker native currency

export function detectTickerCurrency(symbol: string): string {
  const s = symbol.toUpperCase();

  // Crypto symbols (BTC-USD, ETH-USD) - priced in USD
  if (s.includes('-USD') || s.includes('USD')) return 'USD';

  // Exchange-specific suffixes
  if (s.endsWith('.L')) return 'GBP';  // London Stock Exchange
  if (s.endsWith('.T')) return 'JPY';  // Tokyo Stock Exchange
  if (s.endsWith('.TO')) return 'CAD'; // Toronto Stock Exchange
  if (s.endsWith('.AX')) return 'AUD'; // Australian Stock Exchange
  if (s.endsWith('.HK')) return 'HKD'; // Hong Kong Stock Exchange
  if (s.endsWith('.PA')) return 'EUR'; // Paris (Euronext)
  if (s.endsWith('.DE')) return 'EUR'; // Deutsche Börse
  if (s.endsWith('.SW')) return 'CHF'; // Swiss Exchange
  if (s.endsWith('.MI')) return 'EUR'; // Milan Stock Exchange
  if (s.endsWith('.AS')) return 'EUR'; // Amsterdam (Euronext)
  if (s.endsWith('.BR')) return 'EUR'; // Brussels (Euronext)
  if (s.endsWith('.LS')) return 'EUR'; // Lisbon (Euronext)
  if (s.endsWith('.MC')) return 'EUR'; // Madrid Stock Exchange
  if (s.endsWith('.CO')) return 'DKK'; // Copenhagen Stock Exchange
  if (s.endsWith('.ST')) return 'SEK'; // Stockholm Stock Exchange
  if (s.endsWith('.OL')) return 'NOK'; // Oslo Stock Exchange
  if (s.endsWith('.HE')) return 'EUR'; // Helsinki Stock Exchange
  if (s.endsWith('.IC')) return 'ISK'; // Iceland Stock Exchange
  if (s.endsWith('.SA')) return 'BRL'; // São Paulo Stock Exchange
  if (s.endsWith('.MX')) return 'MXN'; // Mexican Stock Exchange
  if (s.endsWith('.KS')) return 'KRW'; // Korea Stock Exchange
  if (s.endsWith('.KQ')) return 'KRW'; // KOSDAQ
  if (s.endsWith('.TW')) return 'TWD'; // Taiwan Stock Exchange
  if (s.endsWith('.SS')) return 'CNY'; // Shanghai Stock Exchange
  if (s.endsWith('.SZ')) return 'CNY'; // Shenzhen Stock Exchange
  if (s.endsWith('.NS')) return 'INR'; // National Stock Exchange of India
  if (s.endsWith('.BO')) return 'INR'; // Bombay Stock Exchange

  // Default to USD for US stocks (no suffix: AAPL, TSLA, MSFT, etc.)
  return 'USD';
}

export function fixHoldingsCurrency(portfolios: Record<string, any>): Record<string, any> {
  console.log('🔧 [fixHoldingsCurrency] Starting migration...');

  let fixedCount = 0;
  const updatedPortfolios = { ...portfolios };

  Object.keys(updatedPortfolios).forEach(pid => {
    const portfolio = updatedPortfolios[pid];
    if (!portfolio?.holdings) return;

    const updatedHoldings = { ...portfolio.holdings };

    Object.keys(updatedHoldings).forEach(symbol => {
      const holding = updatedHoldings[symbol];
      if (!holding) return;

      const detectedCurrency = detectTickerCurrency(symbol);

      // Only update if currency is wrong
      if (holding.currency !== detectedCurrency) {
        console.log(`  ✓ Fixing ${symbol}: ${holding.currency} → ${detectedCurrency}`);
        updatedHoldings[symbol] = {
          ...holding,
          currency: detectedCurrency
        };
        fixedCount++;
      }
    });

    updatedPortfolios[pid] = {
      ...portfolio,
      holdings: updatedHoldings
    };
  });

  console.log(`✅ [fixHoldingsCurrency] Fixed ${fixedCount} holdings`);
  return updatedPortfolios;
}
