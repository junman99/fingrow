// Test alternative Yahoo Finance endpoints that might work without auth

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

  console.log(`Status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const text = await res.text();
    console.log(`Response: ${text.substring(0, 200)}`);
    throw new Error(`Yahoo HTTP ${res.status}`);
  }

  return await res.json();
}

async function testAlternativeEndpoints() {
  console.log('='.repeat(80));
  console.log('🧪 Testing Alternative Yahoo Finance Endpoints for NVDA');
  console.log('='.repeat(80));

  // Test 1: /v7/finance/quote endpoint (used by Yahoo Finance website)
  console.log('\n📊 TEST 1: /v7/finance/quote endpoint\n');
  try {
    const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=NVDA';
    console.log(`URL: ${url}\n`);
    const json = await fetchJson(url);
    const result = json?.quoteResponse?.result?.[0];

    if (result) {
      console.log('✅ SUCCESS! Got data:\n');
      console.log('Company Name:', result.longName || result.shortName);
      console.log('Symbol:', result.symbol);
      console.log('Regular Market Price:', result.regularMarketPrice);
      console.log('Market Cap:', result.marketCap);
      console.log('P/E Ratio (Trailing):', result.trailingPE);
      console.log('Forward P/E:', result.forwardPE);
      console.log('EPS (TTM):', result.epsTrailingTwelveMonths);
      console.log('Dividend Yield:', result.dividendYield);
      console.log('Beta:', result.beta);
      console.log('52 Week High:', result.fiftyTwoWeekHigh);
      console.log('52 Week Low:', result.fiftyTwoWeekLow);
      console.log('Avg Volume:', result.averageVolume);
      console.log('Sector:', result.sector || 'N/A');
      console.log('Industry:', result.industry || 'N/A');

      console.log('\n📋 ALL FIELDS AVAILABLE:');
      console.log(Object.keys(result).sort().join(', '));
    }
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
  }

  // Test 2: /v6/finance/quote endpoint
  console.log('\n📊 TEST 2: /v6/finance/quote endpoint\n');
  try {
    const url = 'https://query1.finance.yahoo.com/v6/finance/quote?symbols=NVDA';
    console.log(`URL: ${url}\n`);
    const json = await fetchJson(url);
    const result = json?.quoteResponse?.result?.[0];

    if (result) {
      console.log('✅ SUCCESS! Got market cap:', result.marketCap);
    }
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
  }

  // Test 3: chart endpoint with full metadata
  console.log('\n📊 TEST 3: /v8/finance/chart with metadata\n');
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/NVDA?range=1d&interval=1d';
    console.log(`URL: ${url}\n`);
    const json = await fetchJson(url);
    const meta = json?.chart?.result?.[0]?.meta;

    if (meta) {
      console.log('✅ Got metadata from chart endpoint:\n');
      console.log('Symbol:', meta.symbol);
      console.log('Regular Market Price:', meta.regularMarketPrice);
      console.log('Previous Close:', meta.previousClose);
      console.log('Currency:', meta.currency);
      console.log('Exchange Name:', meta.exchangeName);
      console.log('Instrument Type:', meta.instrumentType);

      console.log('\n📋 METADATA FIELDS:');
      console.log(Object.keys(meta).sort().join(', '));
    }
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
  }

  console.log('\n' + '='.repeat(80));
}

testAlternativeEndpoints();
