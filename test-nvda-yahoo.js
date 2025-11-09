// Test NVDA data fetching using the exact same Yahoo Finance code as the app

// Replicate the fetchJson function from yahoo.ts
async function fetchJson(url) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://finance.yahoo.com',
    'Origin': 'https://finance.yahoo.com',
  };

  const res = await fetch(url, {
    headers,
    credentials: 'omit',
  });

  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  return await res.json();
}

// Replicate toYahooSymbol
function toYahooSymbol(userSymbol) {
  if (!userSymbol) return '';
  return userSymbol.toUpperCase().replace(/\.[A-Z]+$/, '');
}

// Replicate parseFundamentals
function parseFundamentals(result, sym) {
  const summary = result.summaryDetail || {};
  const price = result.price || {};
  const keyStats = result.defaultKeyStatistics || {};
  const profile = result.assetProfile || {};
  const earnings = result.earningsHistory?.history || [];

  const earningsHistory = earnings.map((e) => ({
    quarter: e.quarter?.fmt || '',
    date: (e.quarter?.raw || 0) * 1000,
    actual: e.epsActual?.raw,
    estimate: e.epsEstimate?.raw,
  })).filter((e) => e.quarter);

  return {
    companyName: price.longName || price.shortName,
    sector: profile.sector,
    industry: profile.industry,
    description: profile.longBusinessSummary,
    marketCap: price.marketCap?.raw,
    peRatio: summary.trailingPE?.raw || keyStats.trailingPE?.raw,
    forwardPE: summary.forwardPE?.raw || keyStats.forwardPE?.raw,
    eps: keyStats.trailingEps?.raw,
    dividendYield: summary.dividendYield?.raw,
    beta: keyStats.beta?.raw,
    week52High: summary.fiftyTwoWeekHigh?.raw,
    week52Low: summary.fiftyTwoWeekLow?.raw,
    avgVolume: summary.averageVolume?.raw || summary.averageVolume10days?.raw,
    earningsHistory,
  };
}

// Replicate fetchYahooFundamentals
async function fetchYahooFundamentals(userSymbol) {
  const sym = toYahooSymbol(userSymbol);
  if (!sym) return null;

  const modules = 'summaryDetail,price,defaultKeyStatistics,assetProfile,earningsHistory';

  // Try query2 first
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${modules}`;
    console.log(`\n🔍 Trying query2: ${url}\n`);
    const json = await fetchJson(url);
    const result = json?.quoteSummary?.result?.[0];
    if (result) {
      console.log('✅ query2 succeeded!\n');
      return parseFundamentals(result, sym);
    }
  } catch (err) {
    console.log(`❌ query2 failed: ${err.message}\n`);
  }

  // Fallback to query1
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${modules}`;
    console.log(`🔍 Trying query1: ${url}\n`);
    const json = await fetchJson(url);
    const result = json?.quoteSummary?.result?.[0];
    if (result) {
      console.log('✅ query1 succeeded!\n');
      return parseFundamentals(result, sym);
    }
  } catch (err) {
    console.log(`❌ query1 failed: ${err.message}\n`);
  }

  // Return null if both failed
  return null;
}

// Replicate fetchDailyHistoryYahoo (simplified - just for price)
async function fetchDailyHistoryYahoo(userSymbol, range = '5y') {
  const sym = toYahooSymbol(userSymbol);
  if (!sym) throw new Error('Bad symbol');

  // Try query1 chart
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d&includePrePost=false`;
    console.log(`\n🔍 Fetching price data: ${url}\n`);
    const j1 = await fetchJson(url);
    const r = j1?.chart?.result?.[0];
    if (!r || !Array.isArray(r.timestamp)) {
      console.log('❌ No price data in response\n');
      return [];
    }

    const ts = r.timestamp;
    const q = r.indicators?.quote?.[0] || {};
    const closes = q.close || [];

    const bars = [];
    for (let i = 0; i < ts.length; i++) {
      const c = Number((closes[i] ?? 0) || 0);
      if (c > 0) {
        bars.push({
          date: (ts[i] || 0) * 1000,
          close: c,
        });
      }
    }

    console.log(`✅ Got ${bars.length} price bars\n`);
    return bars;
  } catch (err) {
    console.log(`❌ Price fetch failed: ${err.message}\n`);
    throw err;
  }
}

// Main test
async function testNVDA() {
  console.log('='.repeat(80));
  console.log('🧪 Testing NVDA data fetch using app\'s Yahoo Finance code');
  console.log('='.repeat(80));

  try {
    // Test 1: Fetch price data
    console.log('\n📊 TEST 1: Fetching NVDA price data...\n');
    const bars = await fetchDailyHistoryYahoo('NVDA', '1y');

    if (bars.length > 0) {
      const latest = bars[bars.length - 1];
      const previous = bars[bars.length - 2];
      console.log('✅ Price data SUCCESS:');
      console.log(`   Latest price: $${latest.close.toFixed(2)}`);
      console.log(`   Previous close: $${previous.close.toFixed(2)}`);
      console.log(`   Change: $${(latest.close - previous.close).toFixed(2)}`);
      console.log(`   Total bars: ${bars.length}`);
    }

    // Test 2: Fetch fundamentals
    console.log('\n📊 TEST 2: Fetching NVDA fundamentals...\n');
    const fundamentals = await fetchYahooFundamentals('NVDA');

    if (!fundamentals) {
      console.log('❌ FUNDAMENTALS FAILED - Both query1 and query2 returned null');
      console.log('\nThis is why you see "-" for all metrics in the app!');
      return;
    }

    console.log('✅ FUNDAMENTALS SUCCESS:');
    console.log('='.repeat(80));
    console.log('\n📋 COMPANY INFO:');
    console.log(`   Name: ${fundamentals.companyName || 'undefined'}`);
    console.log(`   Sector: ${fundamentals.sector || 'undefined'}`);
    console.log(`   Industry: ${fundamentals.industry || 'undefined'}`);
    console.log(`   Description: ${fundamentals.description ? fundamentals.description.substring(0, 100) + '...' : 'undefined'}`);

    console.log('\n💰 KEY METRICS:');
    console.log(`   Market Cap: ${fundamentals.marketCap !== undefined ? '$' + (fundamentals.marketCap / 1e9).toFixed(2) + 'B' : 'undefined'}`);
    console.log(`   P/E Ratio: ${fundamentals.peRatio !== undefined ? fundamentals.peRatio.toFixed(2) : 'undefined'}`);
    console.log(`   Forward P/E: ${fundamentals.forwardPE !== undefined ? fundamentals.forwardPE.toFixed(2) : 'undefined'}`);
    console.log(`   EPS: ${fundamentals.eps !== undefined ? '$' + fundamentals.eps.toFixed(2) : 'undefined'}`);
    console.log(`   Dividend Yield: ${fundamentals.dividendYield !== undefined ? (fundamentals.dividendYield * 100).toFixed(2) + '%' : 'undefined'}`);
    console.log(`   Beta: ${fundamentals.beta !== undefined ? fundamentals.beta.toFixed(2) : 'undefined'}`);
    console.log(`   52W High: ${fundamentals.week52High !== undefined ? '$' + fundamentals.week52High.toFixed(2) : 'undefined'}`);
    console.log(`   52W Low: ${fundamentals.week52Low !== undefined ? '$' + fundamentals.week52Low.toFixed(2) : 'undefined'}`);
    console.log(`   Avg Volume: ${fundamentals.avgVolume !== undefined ? (fundamentals.avgVolume / 1e6).toFixed(2) + 'M' : 'undefined'}`);

    console.log('\n📅 EARNINGS HISTORY:');
    if (fundamentals.earningsHistory && fundamentals.earningsHistory.length > 0) {
      fundamentals.earningsHistory.slice(0, 4).forEach(e => {
        console.log(`   ${e.quarter}: Actual=${e.actual?.toFixed(2) || 'N/A'}, Estimate=${e.estimate?.toFixed(2) || 'N/A'}`);
      });
    } else {
      console.log('   undefined or empty');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🎯 RESULT: If you see "undefined" above, that\'s why the app shows "-"');
    console.log('\n✅ If all values show properly, then the issue is with caching or app state');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nThis error is likely why you see "-" for metrics in the app!');
  }
}

// Run the test
testNVDA();
