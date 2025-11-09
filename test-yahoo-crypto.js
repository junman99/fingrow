// Test if Yahoo Finance provides crypto data (BTC, ETH, etc.)

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

async function testYahooCrypto(symbol, name) {
  console.log('='.repeat(80));
  console.log(`🧪 Testing Yahoo Finance for ${name} (${symbol})`);
  console.log('='.repeat(80));

  // Test 1: Price data via chart endpoint
  console.log('\n📊 TEST 1: Price Data (Chart Endpoint)\n');
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d&includePrePost=false`;
    console.log(`URL: ${url}\n`);

    const json = await fetchJson(url);
    const result = json?.chart?.result?.[0];

    if (!result) {
      console.log('❌ No data returned');
      return { priceWorks: false, historyWorks: false };
    }

    // Get metadata (company name, current price, etc.)
    const meta = result.meta;
    console.log('✅ METADATA SUCCESS:');
    console.log(`   Symbol: ${meta.symbol}`);
    console.log(`   Name: ${meta.longName || meta.shortName || 'N/A'}`);
    console.log(`   Current Price: $${meta.regularMarketPrice}`);
    console.log(`   Currency: ${meta.currency}`);
    console.log(`   Exchange: ${meta.fullExchangeName || meta.exchangeName}`);
    console.log(`   Instrument Type: ${meta.instrumentType}`);

    // Get historical data
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];

    if (timestamps.length > 0 && closes.length > 0) {
      console.log('\n✅ HISTORICAL DATA SUCCESS:');
      console.log(`   Total bars: ${timestamps.length}`);

      // Show last 5 days
      console.log('\n   Last 5 days:');
      for (let i = Math.max(0, timestamps.length - 5); i < timestamps.length; i++) {
        const date = new Date(timestamps[i] * 1000).toLocaleDateString();
        const close = closes[i];
        if (close) {
          console.log(`   ${date}: $${close.toFixed(2)}`);
        }
      }

      return { priceWorks: true, historyWorks: true };
    } else {
      console.log('\n❌ No historical data available');
      return { priceWorks: true, historyWorks: false };
    }

  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
    return { priceWorks: false, historyWorks: false };
  }
}

async function testCoinGecko(coinId, name) {
  console.log('='.repeat(80));
  console.log(`🧪 Testing CoinGecko for ${name} (${coinId})`);
  console.log('='.repeat(80));

  // Test 1: Current price
  console.log('\n📊 TEST 1: Current Price\n');
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    console.log(`URL: ${url}\n`);

    const res = await fetch(url);
    console.log(`Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }

    const json = await res.json();
    const price = json?.[coinId]?.usd;

    if (price) {
      console.log(`✅ Current Price: $${price}`);
    } else {
      console.log('❌ No price data');
      return { priceWorks: false, historyWorks: false };
    }

  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
    return { priceWorks: false, historyWorks: false };
  }

  // Test 2: Historical data (OHLC)
  console.log('\n📊 TEST 2: Historical OHLC Data\n');
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=365`;
    console.log(`URL: ${url}\n`);

    const res = await fetch(url);
    console.log(`Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }

    const json = await res.json();

    if (Array.isArray(json) && json.length > 0) {
      console.log(`✅ Historical Data: ${json.length} bars`);

      // Show last 5 days
      console.log('\n   Last 5 days:');
      for (let i = Math.max(0, json.length - 5); i < json.length; i++) {
        const [timestamp, open, high, low, close] = json[i];
        const date = new Date(timestamp).toLocaleDateString();
        console.log(`   ${date}: $${close.toFixed(2)} (O:${open.toFixed(2)} H:${high.toFixed(2)} L:${low.toFixed(2)})`);
      }

      return { priceWorks: true, historyWorks: true };
    } else {
      console.log('❌ No historical data');
      return { priceWorks: true, historyWorks: false };
    }

  } catch (err) {
    console.log(`❌ FAILED: ${err.message}\n`);
    return { priceWorks: false, historyWorks: false };
  }
}

async function runTests() {
  console.log('\n🚀 CRYPTO DATA SOURCE COMPARISON TEST\n');
  console.log('Testing Yahoo Finance vs CoinGecko for crypto data\n');

  const results = {
    yahoo: {},
    coingecko: {}
  };

  // Test BTC
  console.log('\n' + '█'.repeat(80));
  console.log('TESTING BITCOIN (BTC)');
  console.log('█'.repeat(80) + '\n');

  results.yahoo.btc = await testYahooCrypto('BTC-USD', 'Bitcoin');
  console.log('\n');
  results.coingecko.btc = await testCoinGecko('bitcoin', 'Bitcoin');

  // Test ETH
  console.log('\n\n' + '█'.repeat(80));
  console.log('TESTING ETHEREUM (ETH)');
  console.log('█'.repeat(80) + '\n');

  results.yahoo.eth = await testYahooCrypto('ETH-USD', 'Ethereum');
  console.log('\n');
  results.coingecko.eth = await testCoinGecko('ethereum', 'Ethereum');

  // Test other popular cryptos (to see what Yahoo supports)
  console.log('\n\n' + '█'.repeat(80));
  console.log('TESTING OTHER CRYPTOCURRENCIES');
  console.log('█'.repeat(80) + '\n');

  const otherCryptos = [
    { yahoo: 'SOL-USD', coingecko: 'solana', name: 'Solana' },
    { yahoo: 'BNB-USD', coingecko: 'binancecoin', name: 'Binance Coin' },
    { yahoo: 'ADA-USD', coingecko: 'cardano', name: 'Cardano' },
    { yahoo: 'DOGE-USD', coingecko: 'dogecoin', name: 'Dogecoin' },
  ];

  results.yahoo.other = {};
  results.coingecko.other = {};

  for (const crypto of otherCryptos) {
    console.log(`\n--- ${crypto.name} ---\n`);
    results.yahoo.other[crypto.name] = await testYahooCrypto(crypto.yahoo, crypto.name);
  }

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80) + '\n');

  console.log('YAHOO FINANCE:');
  console.log(`  BTC: Price ${results.yahoo.btc.priceWorks ? '✅' : '❌'} | History ${results.yahoo.btc.historyWorks ? '✅' : '❌'}`);
  console.log(`  ETH: Price ${results.yahoo.eth.priceWorks ? '✅' : '❌'} | History ${results.yahoo.eth.historyWorks ? '✅' : '❌'}`);
  Object.entries(results.yahoo.other).forEach(([name, result]) => {
    console.log(`  ${name}: Price ${result.priceWorks ? '✅' : '❌'} | History ${result.historyWorks ? '✅' : '❌'}`);
  });

  console.log('\nCOINGECKO:');
  console.log(`  BTC: Price ${results.coingecko.btc.priceWorks ? '✅' : '❌'} | History ${results.coingecko.btc.historyWorks ? '✅' : '❌'}`);
  console.log(`  ETH: Price ${results.coingecko.eth.priceWorks ? '✅' : '❌'} | History ${results.coingecko.eth.historyWorks ? '✅' : '❌'}`);

  console.log('\n' + '='.repeat(80));
  console.log('🎯 RECOMMENDATION:');

  const yahooWorks = results.yahoo.btc.priceWorks && results.yahoo.btc.historyWorks &&
                     results.yahoo.eth.priceWorks && results.yahoo.eth.historyWorks;
  const coinGeckoWorks = results.coingecko.btc.priceWorks && results.coingecko.btc.historyWorks &&
                         results.coingecko.eth.priceWorks && results.coingecko.eth.historyWorks;

  if (yahooWorks && coinGeckoWorks) {
    console.log('Both sources work! Yahoo Finance is RECOMMENDED because:');
    console.log('  ✅ Unified data source (stocks + crypto + FX)');
    console.log('  ✅ Same caching logic as stocks');
    console.log('  ✅ Simpler architecture (one API instead of two)');
    console.log('  ✅ Consistent date format across all assets');
  } else if (yahooWorks) {
    console.log('Use Yahoo Finance - it works!');
  } else if (coinGeckoWorks) {
    console.log('Use CoinGecko - Yahoo Finance crypto failed');
  } else {
    console.log('Both sources failed - need to investigate');
  }

  console.log('='.repeat(80) + '\n');
}

runTests();
