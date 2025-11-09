// Simple test to verify FX rates are working
// This simulates what React Native AsyncStorage would do

const AsyncStorage = {
  data: {},
  async getItem(key) {
    return this.data[key] || null;
  },
  async setItem(key, value) {
    this.data[key] = value;
  }
};

// Mock the global for testing
global.AsyncStorage = AsyncStorage;

const FX_CACHE_KEY = 'fingrow/fx/rates';
const FX_SERVER_URL = 'http://54.251.186.141:8080/fx-rates.json';

async function testFxSystem() {
  console.log('🧪 Testing FX System...\n');

  // Test 1: Check if server is accessible
  console.log('1️⃣ Testing server access...');
  try {
    const response = await fetch(FX_SERVER_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      timeout: 5000
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Server accessible! Got ${data.totalPairs} pairs`);
      console.log(`   SGD_USD: ${data.rates['SGD_USD']}`);
      console.log(`   USD_SGD: ${data.rates['USD_SGD']}`);

      // Test 2: Simulate caching
      console.log('\n2️⃣ Testing cache write...');
      await AsyncStorage.setItem(FX_CACHE_KEY, JSON.stringify(data));
      console.log('✅ Wrote to cache');

      // Test 3: Read from cache
      console.log('\n3️⃣ Testing cache read...');
      const cached = await AsyncStorage.getItem(FX_CACHE_KEY);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        console.log(`✅ Read from cache! Got ${parsedCache.totalPairs} pairs`);
        console.log(`   SGD_USD: ${parsedCache.rates['SGD_USD']}`);
        console.log(`   USD_SGD: ${parsedCache.rates['USD_SGD']}`);
      }

      // Test 4: Calculate exchange rate
      console.log('\n4️⃣ Testing rate calculation (SGD base)...');
      const sgdToUsd = data.rates['SGD_USD'];
      const sgdToEur = data.rates['SGD_EUR'];
      const sgdToGbp = data.rates['SGD_GBP'];
      console.log(`   1 SGD = ${sgdToUsd.toFixed(2)} USD`);
      console.log(`   1 SGD = ${sgdToEur.toFixed(2)} EUR`);
      console.log(`   1 SGD = ${sgdToGbp.toFixed(2)} GBP`);

      console.log('\n✅ All tests passed!');
    } else {
      console.log(`❌ Server returned ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Server not accessible: ${error.message}`);

    // Try fallback API
    console.log('\n🔄 Trying fallback API...');
    try {
      const fallbackResponse = await fetch('https://open.er-api.com/v6/latest/USD');
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        console.log('✅ Fallback API works!');
        console.log(`   USD_SGD: ${fallbackData.rates.SGD}`);
        console.log(`   Note: Fallback only has USD-based pairs, not cross-rates`);
      }
    } catch (fallbackError) {
      console.log(`❌ Fallback also failed: ${fallbackError.message}`);
    }
  }
}

testFxSystem().catch(console.error);
