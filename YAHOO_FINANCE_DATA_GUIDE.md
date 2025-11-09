# Yahoo Finance Data Guide - What You Can Get For FREE 🎉

## Data Sources Summary

### **Crypto Data: CoinGecko** 🪙
**Source:** `src/lib/coingecko.ts`

**What you get:**
- BTC & ETH only (hardcoded)
- Price in USD
- Historical OHLC data (1d, 7d, 30d, 90d, 180d, 365d, max)
- Daily price points for charts

**API:** https://api.coingecko.com/api/v3/
- Free tier: Unlimited calls
- No API key needed
- Public API

**Limitations:**
- Only supports BTC and ETH
- No fundamentals (market cap, etc. - but available if you expand)
- USD pricing only

---

### **Stock/ETF Data: Yahoo Finance** 📈
**Source:** `src/lib/yahoo.ts`

**What you're ALREADY getting:**

#### ✅ **Price Data** (via `/v8/finance/chart/`)
- Current price
- Open, High, Low, Close
- Volume
- 5-year historical OHLC data
- Timestamps

#### ✅ **Company Fundamentals** (via `/v10/finance/quoteSummary/`)
Currently fetching from modules: `summaryDetail`, `price`, `defaultKeyStatistics`, `assetProfile`, `earningsHistory`

**What's included:**
```typescript
{
  companyName: "Apple Inc.",
  sector: "Technology",
  industry: "Consumer Electronics",
  description: "Apple Inc. designs, manufactures...",
  marketCap: 2890000000000,  // $2.89T
  peRatio: 29.5,
  forwardPE: 28.3,
  eps: 6.16,
  dividendYield: 0.0047,  // 0.47%
  beta: 1.24,
  week52High: 199.62,
  week52Low: 164.08,
  avgVolume: 56789000,
  earningsHistory: [
    { quarter: "Q4 2024", actual: 2.50, estimate: 2.55 },
    // ... more quarters
  ]
}
```

---

## What ELSE Yahoo Finance Can Provide (Not Currently Using)

### **📊 Additional Modules Available:**

#### 1. **Financial Statements** 💰
**Modules:** `incomeStatementHistory`, `balanceSheetHistory`, `cashflowStatementHistory`

**Data includes:**
- Revenue (quarterly & annual)
- Net income
- Operating income
- Gross profit
- Total assets
- Total liabilities
- Cash flow from operations
- Free cash flow
- Historical trends (4 quarters / 4 years)

**Use cases:**
- Show revenue growth charts
- Display profit margins
- Show debt levels
- Cash flow analysis

---

#### 2. **Financial Ratios & Metrics** 📈
**Module:** `financialData`

**Data includes:**
```
Revenue (TTM): $385.7B
Revenue Per Share: $23.46
Gross Profit: $169.1B
EBITDA: $125.3B
Operating Margin: 30.1%
Profit Margin: 25.3%
Return on Assets: 22.6%
Return on Equity: 147.4%
Free Cash Flow: $99.6B
Current Ratio: 0.98
Debt to Equity: 181.7%
Target Price (Analyst avg): $195.50
Recommendation: "buy"
Number of Analysts: 42
```

**Use cases:**
- Fundamental analysis
- Company health metrics
- Valuation ratios
- Analyst targets

---

#### 3. **Analyst Recommendations** 👥
**Modules:** `recommendationTrend`, `upgradeDowngradeHistory`

**Data includes:**
```
Latest Recommendations:
- Strong Buy: 15
- Buy: 20
- Hold: 7
- Sell: 0
- Strong Sell: 0

Recent Actions:
- Jan 15, 2025: Morgan Stanley - Overweight (from Equal-Weight)
- Jan 10, 2025: Goldman Sachs - Buy (maintained)
- Dec 20, 2024: JP Morgan - Neutral (from Overweight)
```

**Use cases:**
- Show analyst consensus
- Display recent upgrades/downgrades
- Sentiment indicator

---

#### 4. **Upcoming Events** 📆
**Module:** `calendarEvents`

**Data includes:**
```
Earnings Date: Feb 1, 2025
Dividend Date: Feb 15, 2025
Ex-Dividend Date: Feb 8, 2025
```

**Use cases:**
- Earnings calendar
- Dividend tracker
- Event notifications

---

#### 5. **ESG Scores** 🌍
**Module:** `esgScores`

**Data includes:**
```
Total ESG Score: 21.5
Environment Score: 8.2
Social Score: 10.5
Governance Score: 2.8
ESG Percentile: 87th
Controversy Level: 3 (Moderate)
```

**Use cases:**
- Sustainable investing
- ESG-focused portfolios
- Corporate responsibility metrics

---

#### 6. **Earnings Trends** 📊
**Module:** `earnings`

**Data includes:**
```
Quarterly Revenue:
- Q4 2024: $119.6B
- Q3 2024: $94.9B
- Q2 2024: $85.8B

Annual Revenue:
- 2024: $385.7B
- 2023: $383.3B
- 2022: $394.3B

Quarterly Earnings:
- Q4 2024: $2.18 EPS
- Q3 2024: $1.64 EPS
```

**Use cases:**
- Revenue growth charts
- Earnings trends
- Quarter-over-quarter comparisons

---

#### 7. **Options Data** 📊
**Module:** `options` (separate API)

**Data includes:**
- Option chains (calls & puts)
- Strike prices
- Expiration dates
- Implied volatility
- Open interest

**Use cases:**
- Options trading
- Volatility analysis
- Advanced trading features

---

#### 8. **Insider Transactions** 👔
**Module:** `insiderTransactions`

**Data includes:**
- Insider buys/sells
- Transaction dates
- Share amounts
- Transaction prices

**Use cases:**
- Insider activity tracking
- Sentiment analysis

---

## What You're Currently Using vs. Available

| Data Type | Currently Using? | Available from Yahoo? | Effort to Add |
|-----------|------------------|----------------------|---------------|
| **Price (OHLC)** | ✅ Yes | ✅ Yes | N/A |
| **Company Name** | ✅ Yes | ✅ Yes | N/A |
| **Market Cap** | ✅ Yes | ✅ Yes | N/A |
| **P/E Ratio** | ✅ Yes | ✅ Yes | N/A |
| **52-Week High/Low** | ✅ Yes | ✅ Yes | N/A |
| **EPS** | ✅ Yes | ✅ Yes | N/A |
| **Dividend Yield** | ✅ Yes | ✅ Yes | N/A |
| **Beta** | ✅ Yes | ✅ Yes | N/A |
| **Earnings History** | ✅ Yes (4 quarters) | ✅ Yes | N/A |
| **Sector/Industry** | ✅ Yes | ✅ Yes | N/A |
| **Description** | ✅ Yes | ✅ Yes | N/A |
| | | | |
| **Revenue (TTM)** | ❌ No | ✅ Yes | Easy (5 min) |
| **Profit Margin** | ❌ No | ✅ Yes | Easy (5 min) |
| **ROE/ROA** | ❌ No | ✅ Yes | Easy (5 min) |
| **Free Cash Flow** | ❌ No | ✅ Yes | Easy (5 min) |
| **Debt to Equity** | ❌ No | ✅ Yes | Easy (5 min) |
| **Target Price** | ❌ No | ✅ Yes | Easy (5 min) |
| **Analyst Ratings** | ❌ No | ✅ Yes | Medium (10 min) |
| **Upgrades/Downgrades** | ❌ No | ✅ Yes | Medium (10 min) |
| **Earnings Calendar** | ❌ No | ✅ Yes | Easy (5 min) |
| **Dividend Calendar** | ❌ No | ✅ Yes | Easy (5 min) |
| **ESG Scores** | ❌ No | ✅ Yes | Easy (5 min) |
| **Revenue/Earnings Charts** | ❌ No | ✅ Yes | Medium (15 min) |
| **Income Statement** | ❌ No | ✅ Yes | Medium (15 min) |
| **Balance Sheet** | ❌ No | ✅ Yes | Medium (15 min) |
| **Cash Flow Statement** | ❌ No | ✅ Yes | Medium (15 min) |
| **Insider Transactions** | ❌ No | ✅ Yes | Hard (30 min) |
| **Options Chain** | ❌ No | ✅ Yes | Hard (30 min) |

---

## How to Add More Data

### **Example: Adding Financial Metrics (Revenue, Margins, etc.)**

**Step 1:** Update the type in `yahoo.ts`:
```typescript
export type YahooFundamentals = {
  // ... existing fields

  // Add these:
  revenue?: number;              // Total revenue (TTM)
  revenuePerShare?: number;
  grossProfit?: number;
  ebitda?: number;
  operatingMargin?: number;
  profitMargin?: number;
  returnOnAssets?: number;
  returnOnEquity?: number;
  freeCashFlow?: number;
  currentRatio?: number;
  debtToEquity?: number;
  targetPrice?: number;
  analystRecommendation?: string;
  numberOfAnalysts?: number;
};
```

**Step 2:** Update the modules to fetch:
```typescript
const modules = 'summaryDetail,price,defaultKeyStatistics,assetProfile,earningsHistory,financialData';
// Added: financialData ^
```

**Step 3:** Parse the new data:
```typescript
function parseFundamentals(result: any, sym: string): YahooFundamentals {
  const summary = result.summaryDetail || {};
  const price = result.price || {};
  const keyStats = result.defaultKeyStatistics || {};
  const profile = result.assetProfile || {};
  const earnings = result.earningsHistory?.history || [];
  const financial = result.financialData || {};  // NEW

  return {
    // ... existing fields

    // Add these:
    revenue: financial.totalRevenue?.raw,
    revenuePerShare: financial.revenuePerShare?.raw,
    grossProfit: financial.grossProfits?.raw,
    ebitda: financial.ebitda?.raw,
    operatingMargin: financial.operatingMargins?.raw,
    profitMargin: financial.profitMargins?.raw,
    returnOnAssets: financial.returnOnAssets?.raw,
    returnOnEquity: financial.returnOnEquity?.raw,
    freeCashFlow: financial.freeCashflow?.raw,
    currentRatio: financial.currentRatio?.raw,
    debtToEquity: financial.debtToEquity?.raw,
    targetPrice: financial.targetMeanPrice?.raw,
    analystRecommendation: financial.recommendationKey,
    numberOfAnalysts: financial.numberOfAnalystOpinions?.raw,
  };
}
```

**That's it!** Now you have all that data available in your app. 🎉

---

## Crypto Data - Can Get More?

### **Currently: BTC & ETH only**

**CoinGecko FREE tier can give you:**
- 10,000+ cryptocurrencies
- Market cap, volume, circulating supply
- Price change % (1h, 24h, 7d, 30d, 1y)
- All-time high/low
- Market dominance
- Fully diluted valuation

**To expand crypto support:**

**Option 1: Add more coins** (Easy - 5 min)
```typescript
const MAP: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',  // Add Binance Coin
  'SOL': 'solana',       // Add Solana
  'ADA': 'cardano',      // Add Cardano
  'MATIC': 'matic-network', // Add Polygon
  // ... etc
};
```

**Option 2: Search CoinGecko by symbol** (Medium - 15 min)
- Use CoinGecko's search API to find coin by symbol dynamically
- Support ANY cryptocurrency user enters

**Option 3: Get fundamentals** (Easy - 5 min)
```javascript
// CoinGecko provides market data
const url = `https://api.coingecko.com/api/v3/coins/${id}`;
// Returns:
// - Market cap
// - Total volume
// - Circulating supply
// - All-time high/low
// - Price change %
```

---

## Yahoo Finance vs. Paid Alternatives

| Feature | Yahoo Finance (FREE) | Alpha Vantage (FREE) | Finnhub (FREE) | Bloomberg Terminal |
|---------|---------------------|---------------------|----------------|-------------------|
| **Price** | $0 | $0 (25 calls/day) | $0 (60 calls/min) | $24,000/year |
| **Stock Prices** | ✅ Unlimited | ✅ Limited | ✅ Limited | ✅ Unlimited |
| **Fundamentals** | ✅ Full | ✅ Basic | ✅ Basic | ✅ Full |
| **Earnings** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Analyst Ratings** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| **Financial Statements** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Real-time** | ❌ 15min delay | ❌ 15min delay | ✅ Real-time | ✅ Real-time |
| **Options** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **ESG** | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| **API Limits** | ✅ Unlimited | ⚠️ 25/day | ⚠️ 60/min | ✅ Unlimited |

**Yahoo Finance wins for free tier!** 🏆

---

## Summary

### **What you're getting NOW:**
✅ Stock prices (OHLC, 5 years)
✅ Basic fundamentals (P/E, market cap, etc.)
✅ Earnings history (4 quarters)
✅ Company profile (sector, industry, description)
✅ BTC & ETH crypto prices

### **What you can EASILY add:**
📊 Financial metrics (revenue, margins, cash flow)
📈 Analyst ratings & price targets
📆 Earnings/dividend calendar
🌍 ESG scores
💰 Income statement, balance sheet, cash flow
👥 Analyst upgrades/downgrades

### **All from Yahoo Finance for FREE!** 🎉

Want me to add any of these features? Just say which ones! 🚀
