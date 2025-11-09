// Test Alpha Vantage API (free tier: 25 calls/day, 5 calls/minute)
// No API key needed for demo, but limited

async function testAlphaVantage(symbol) {
  console.log('='.repeat(80));
  console.log(`🧪 Testing Alpha Vantage API for ${symbol}`);
  console.log('='.repeat(80));

  // Test 1: Company Overview (fundamentals)
  console.log('\n📊 TEST 1: Company Overview (Fundamentals)\n');
  try {
    // Using demo API key (limited to a few symbols like IBM, AAPL, MSFT)
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=demo`;
    console.log(`URL: ${url}\n`);

    const res = await fetch(url);
    console.log(`Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text();
      console.log(`Response: ${text.substring(0, 200)}`);
      throw new Error(`Alpha Vantage HTTP ${res.status}`);
    }

    const json = await res.json();

    // Check if rate limited or error
    if (json['Note']) {
      console.log(`⚠️  Rate limit message: ${json['Note']}`);
      console.log('\nAlpha Vantage free tier limits:');
      console.log('  - 25 requests per day');
      console.log('  - 5 requests per minute');
      console.log('\nWith 60s auto-refresh, you would hit the limit in < 30 minutes');
      return;
    }

    if (json['Error Message']) {
      console.log(`❌ Error: ${json['Error Message']}`);
      return;
    }

    if (!json.Symbol) {
      console.log('❌ No data returned (likely demo key limitation)');
      console.log('Demo key only works for: IBM, AAPL, MSFT');
      console.log('\nResponse:', JSON.stringify(json, null, 2));
      return;
    }

    console.log('✅ SUCCESS! Got fundamentals:\n');
    console.log('Symbol:', json.Symbol);
    console.log('Name:', json.Name);
    console.log('Description:', json.Description ? json.Description.substring(0, 100) + '...' : 'N/A');
    console.log('Sector:', json.Sector);
    console.log('Industry:', json.Industry);
    console.log('Market Cap:', json.MarketCapitalization);
    console.log('P/E Ratio:', json.PERatio);
    console.log('Forward P/E:', json.ForwardPE);
    console.log('EPS:', json.EPS);
    console.log('Dividend Yield:', json.DividendYield);
    console.log('Beta:', json.Beta);
    console.log('52 Week High:', json['52WeekHigh']);
    console.log('52 Week Low:', json['52WeekLow']);

    console.log('\n📋 ALL FIELDS:');
    console.log(Object.keys(json).join(', '));

  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
  }

  // Test 2: Global Quote (price data)
  console.log('\n📊 TEST 2: Global Quote (Price Data)\n');
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=demo`;
    console.log(`URL: ${url}\n`);

    const res = await fetch(url);
    console.log(`Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      throw new Error(`Alpha Vantage HTTP ${res.status}`);
    }

    const json = await res.json();

    if (json['Note'] || json['Error Message']) {
      console.log(`⚠️  ${json['Note'] || json['Error Message']}`);
      return;
    }

    const quote = json['Global Quote'];
    if (!quote || !quote['01. symbol']) {
      console.log('❌ No price data returned');
      return;
    }

    console.log('✅ SUCCESS! Got price data:\n');
    console.log('Symbol:', quote['01. symbol']);
    console.log('Price:', quote['05. price']);
    console.log('Volume:', quote['06. volume']);
    console.log('Change:', quote['09. change']);
    console.log('Change %:', quote['10. change percent']);

  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
  }

  console.log('\n' + '='.repeat(80));
}

// Test with IBM (works with demo key)
testAlphaVantage('IBM').then(() => {
  console.log('\n⏱️  Waiting 15 seconds to avoid rate limit...\n');
  return new Promise(resolve => setTimeout(resolve, 15000));
}).then(() => {
  // Test with NVDA (may not work with demo key)
  return testAlphaVantage('NVDA');
});
