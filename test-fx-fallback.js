// Test the fallback API with cross-rate calculation

async function testFallback() {
  console.log('🧪 Testing Fallback API with cross-rates...\n');

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const json = await response.json();

    if (json.result !== 'success') {
      console.log('❌ API error');
      return;
    }

    const usdRates = json.rates || {};
    const currencies = Object.keys(usdRates);

    console.log(`📦 Got ${currencies.length} USD-based rates from API`);

    // Calculate cross-rates
    const allRates = {};

    // Add USD pairs
    for (const [currency, rate] of Object.entries(usdRates)) {
      allRates[`USD_${currency}`] = rate;
    }

    // Calculate cross-rates
    for (const fromCurrency of currencies) {
      for (const toCurrency of currencies) {
        if (fromCurrency === toCurrency) continue;

        const key = `${fromCurrency}_${toCurrency}`;
        if (allRates[key]) continue;

        const fromRate = usdRates[fromCurrency];
        const toRate = usdRates[toCurrency];

        if (fromRate && toRate && fromRate !== 0) {
          allRates[key] = toRate / fromRate;
        }
      }
    }

    console.log(`✅ Calculated ${Object.keys(allRates).length} total pairs\n`);

    // Test specific rates
    console.log('📊 SGD-based rates (what user would see):');
    console.log(`   SGD -> USD: ${allRates['SGD_USD'].toFixed(4)} (should be ~0.768)`);
    console.log(`   SGD -> EUR: ${allRates['SGD_EUR'].toFixed(4)}`);
    console.log(`   SGD -> GBP: ${allRates['SGD_GBP'].toFixed(4)}`);

    console.log('\n📊 USD-based rates:');
    console.log(`   USD -> SGD: ${allRates['USD_SGD'].toFixed(4)} (should be ~1.302)`);
    console.log(`   USD -> EUR: ${allRates['USD_EUR'].toFixed(4)}`);
    console.log(`   USD -> GBP: ${allRates['USD_GBP'].toFixed(4)}`);

    // Verify calculation
    console.log('\n🔍 Verification:');
    const sgdUsd = allRates['SGD_USD'];
    const usdSgd = allRates['USD_SGD'];
    const product = sgdUsd * usdSgd;
    console.log(`   SGD_USD * USD_SGD = ${product.toFixed(6)} (should be ~1.0)`);

    console.log('\n✅ Fallback API working correctly!');

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testFallback();
