// Test what fundamentals we can get from the chart endpoint metadata

async function fetchJson(url) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://finance.yahoo.com',
    'Origin': 'https://finance.yahoo.com',
  };

  const res = await fetch(url, { headers, credentials: 'omit' });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  return await res.json();
}

async function testChartMetadata(symbol) {
  console.log('='.repeat(80));
  console.log(`🧪 Testing Chart Metadata for ${symbol}`);
  console.log('='.repeat(80));

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
    const json = await fetchJson(url);
    const meta = json?.chart?.result?.[0]?.meta;

    if (!meta) {
      console.log('❌ No metadata found');
      return;
    }

    console.log('\n✅ AVAILABLE FUNDAMENTALS FROM CHART METADATA:\n');
    console.log('📊 COMPANY INFO:');
    console.log(`   Company Name: ${meta.longName || meta.shortName || 'N/A'}`);
    console.log(`   Symbol: ${meta.symbol || 'N/A'}`);
    console.log(`   Exchange: ${meta.fullExchangeName || meta.exchangeName || 'N/A'}`);
    console.log(`   Currency: ${meta.currency || 'N/A'}`);

    console.log('\n💰 PRICE DATA:');
    console.log(`   Current Price: ${meta.regularMarketPrice || 'N/A'}`);
    console.log(`   Day High: ${meta.regularMarketDayHigh || 'N/A'}`);
    console.log(`   Day Low: ${meta.regularMarketDayLow || 'N/A'}`);
    console.log(`   Volume: ${meta.regularMarketVolume || 'N/A'}`);
    console.log(`   Previous Close: ${meta.chartPreviousClose || 'N/A'}`);

    console.log('\n📈 52-WEEK RANGE:');
    console.log(`   52-Week High: ${meta.fiftyTwoWeekHigh || 'N/A'}`);
    console.log(`   52-Week Low: ${meta.fiftyTwoWeekLow || 'N/A'}`);

    console.log('\n❌ NOT AVAILABLE FROM CHART ENDPOINT:');
    console.log('   - Market Cap');
    console.log('   - P/E Ratio');
    console.log('   - Forward P/E');
    console.log('   - EPS');
    console.log('   - Dividend Yield');
    console.log('   - Beta');
    console.log('   - Sector/Industry');
    console.log('   - Company Description');
    console.log('   - Earnings History');

    console.log('\n📋 FULL METADATA DUMP:');
    console.log(JSON.stringify(meta, null, 2));

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }

  console.log('\n' + '='.repeat(80));
}

// Test multiple symbols to see consistency
testChartMetadata('NVDA').then(() => {
  console.log('\n');
  return testChartMetadata('AAPL');
}).then(() => {
  console.log('\n');
  return testChartMetadata('MSFT');
});
