// Test FMP (Financial Modeling Prep) API to see if it works and provides fundamentals

const FMP_API_KEY = 'sWxdAauXH6gWSD74UDR4MKAtuOQviM3e';

async function testFMP(symbol) {
  console.log('='.repeat(80));
  console.log(`🧪 Testing FMP API for ${symbol}`);
  console.log('='.repeat(80));

  // Test 1: Quote endpoint
  console.log('\n📊 TEST 1: FMP Quote Endpoint\n');
  try {
    const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`;
    console.log(`URL: ${url.replace(FMP_API_KEY, 'API_KEY')}\n`);

    const res = await fetch(url);
    console.log(`Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text();
      console.log(`Response: ${text.substring(0, 200)}`);
      throw new Error(`FMP HTTP ${res.status}`);
    }

    const json = await res.json();
    const quote = json?.[0];

    if (!quote) {
      console.log('❌ No data returned');
      return;
    }

    console.log('✅ SUCCESS! Got quote data:\n');
    console.log('Symbol:', quote.symbol);
    console.log('Name:', quote.name);
    console.log('Price:', quote.price);
    console.log('Market Cap:', quote.marketCap);
    console.log('P/E Ratio:', quote.pe);
    console.log('EPS:', quote.eps);
    console.log('Exchange:', quote.exchange);
    console.log('Volume:', quote.volume);
    console.log('Avg Volume:', quote.avgVolume);
    console.log('52 Week High:', quote.yearHigh);
    console.log('52 Week Low:', quote.yearLow);

    console.log('\n📋 ALL FIELDS:');
    console.log(Object.keys(quote).join(', '));

  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
  }

  // Test 2: Company Profile endpoint (more detailed fundamentals)
  console.log('\n📊 TEST 2: FMP Company Profile Endpoint\n');
  try {
    const url = `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_API_KEY}`;
    console.log(`URL: ${url.replace(FMP_API_KEY, 'API_KEY')}\n`);

    const res = await fetch(url);
    console.log(`Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text();
      console.log(`Response: ${text.substring(0, 200)}`);
      throw new Error(`FMP HTTP ${res.status}`);
    }

    const json = await res.json();
    const profile = json?.[0];

    if (!profile) {
      console.log('❌ No data returned');
      return;
    }

    console.log('✅ SUCCESS! Got profile data:\n');
    console.log('Company Name:', profile.companyName);
    console.log('Sector:', profile.sector);
    console.log('Industry:', profile.industry);
    console.log('Description:', profile.description ? profile.description.substring(0, 100) + '...' : 'N/A');
    console.log('Market Cap:', profile.mktCap);
    console.log('Beta:', profile.beta);
    console.log('Website:', profile.website);
    console.log('Country:', profile.country);

  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
  }

  // Test 3: Check API rate limit status
  console.log('\n📊 TEST 3: API Rate Limit Status\n');
  try {
    const url = `https://financialmodelingprep.com/api/v3/quote/AAPL?apikey=${FMP_API_KEY}`;
    const res = await fetch(url);

    // FMP returns rate limit info in headers
    const headers = res.headers;
    console.log('Rate Limit Info:');
    console.log('  X-RateLimit-Limit:', headers.get('X-RateLimit-Limit') || 'N/A');
    console.log('  X-RateLimit-Remaining:', headers.get('X-RateLimit-Remaining') || 'N/A');
    console.log('  X-RateLimit-Reset:', headers.get('X-RateLimit-Reset') || 'N/A');

    if (res.status === 429) {
      console.log('\n⚠️  RATE LIMIT EXCEEDED!');
      console.log('FMP free tier limit: 250 requests/day');
      console.log('With auto-refresh (60s intervals), limit is reached quickly');
    }

  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
  }

  console.log('\n' + '='.repeat(80));
}

// Test NVDA with FMP
testFMP('NVDA').then(() => {
  console.log('\n');
  return testFMP('AAPL');
});
