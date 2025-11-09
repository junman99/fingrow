// Test script to see ALL data Yahoo Finance provides for a ticker

async function fetchYahooFullData(symbol) {
  const modules = [
    'summaryDetail',
    'price',
    'defaultKeyStatistics',
    'assetProfile',
    'earningsHistory',
    'financialData',
    'calendarEvents',
    'upgradeDowngradeHistory',
    'recommendationTrend',
    'quoteType',
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
    'earnings',
    'esgScores'
  ].join(',');

  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;

  console.log(`\n🔍 Fetching ALL available data for ${symbol}...\n`);

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}`);
      return;
    }

    const json = await response.json();
    const result = json?.quoteSummary?.result?.[0];

    if (!result) {
      console.log('❌ No data returned');
      return;
    }

    console.log('✅ Data received! Here\'s what Yahoo Finance provides:\n');
    console.log('=' .repeat(80));

    // Price & Quote Info
    if (result.price) {
      console.log('\n📊 PRICE & QUOTE:');
      console.log('  Company Name:', result.price.longName || result.price.shortName);
      console.log('  Symbol:', result.price.symbol);
      console.log('  Exchange:', result.price.exchangeName);
      console.log('  Currency:', result.price.currency);
      console.log('  Regular Market Price:', result.price.regularMarketPrice?.fmt);
      console.log('  Previous Close:', result.price.regularMarketPreviousClose?.fmt);
      console.log('  Market Cap:', result.price.marketCap?.fmt);
      console.log('  Market State:', result.price.marketState);
    }

    // Summary Detail
    if (result.summaryDetail) {
      console.log('\n📈 SUMMARY DETAIL:');
      console.log('  Day Range:', `${result.summaryDetail.dayLow?.fmt} - ${result.summaryDetail.dayHigh?.fmt}`);
      console.log('  52 Week Range:', `${result.summaryDetail.fiftyTwoWeekLow?.fmt} - ${result.summaryDetail.fiftyTwoWeekHigh?.fmt}`);
      console.log('  Volume:', result.summaryDetail.volume?.fmt);
      console.log('  Avg Volume:', result.summaryDetail.averageVolume?.fmt);
      console.log('  Dividend Rate:', result.summaryDetail.dividendRate?.fmt);
      console.log('  Dividend Yield:', result.summaryDetail.dividendYield?.fmt);
      console.log('  P/E Ratio:', result.summaryDetail.trailingPE?.fmt);
      console.log('  Beta:', result.summaryDetail.beta?.fmt);
    }

    // Key Statistics
    if (result.defaultKeyStatistics) {
      console.log('\n📊 KEY STATISTICS:');
      console.log('  Forward P/E:', result.defaultKeyStatistics.forwardPE?.fmt);
      console.log('  PEG Ratio:', result.defaultKeyStatistics.pegRatio?.fmt);
      console.log('  Price to Book:', result.defaultKeyStatistics.priceToBook?.fmt);
      console.log('  Enterprise Value:', result.defaultKeyStatistics.enterpriseValue?.fmt);
      console.log('  EPS (TTM):', result.defaultKeyStatistics.trailingEps?.fmt);
      console.log('  Shares Outstanding:', result.defaultKeyStatistics.sharesOutstanding?.fmt);
      console.log('  Float Shares:', result.defaultKeyStatistics.floatShares?.fmt);
      console.log('  % Held by Insiders:', result.defaultKeyStatistics.heldPercentInsiders?.fmt);
      console.log('  % Held by Institutions:', result.defaultKeyStatistics.heldPercentInstitutions?.fmt);
    }

    // Company Profile
    if (result.assetProfile) {
      console.log('\n🏢 COMPANY PROFILE:');
      console.log('  Sector:', result.assetProfile.sector);
      console.log('  Industry:', result.assetProfile.industry);
      console.log('  Employees:', result.assetProfile.fullTimeEmployees);
      console.log('  Website:', result.assetProfile.website);
      console.log('  Address:', result.assetProfile.address1);
      console.log('  City:', result.assetProfile.city);
      console.log('  Country:', result.assetProfile.country);
      console.log('  Description:', result.assetProfile.longBusinessSummary?.substring(0, 200) + '...');
    }

    // Financial Data
    if (result.financialData) {
      console.log('\n💰 FINANCIAL DATA:');
      console.log('  Revenue (TTM):', result.financialData.totalRevenue?.fmt);
      console.log('  Revenue Per Share:', result.financialData.revenuePerShare?.fmt);
      console.log('  Gross Profit:', result.financialData.grossProfits?.fmt);
      console.log('  EBITDA:', result.financialData.ebitda?.fmt);
      console.log('  Operating Margin:', result.financialData.operatingMargins?.fmt);
      console.log('  Profit Margin:', result.financialData.profitMargins?.fmt);
      console.log('  Return on Assets:', result.financialData.returnOnAssets?.fmt);
      console.log('  Return on Equity:', result.financialData.returnOnEquity?.fmt);
      console.log('  Free Cash Flow:', result.financialData.freeCashflow?.fmt);
      console.log('  Current Ratio:', result.financialData.currentRatio?.fmt);
      console.log('  Debt to Equity:', result.financialData.debtToEquity?.fmt);
      console.log('  Target Price:', result.financialData.targetMeanPrice?.fmt);
      console.log('  Recommendation:', result.financialData.recommendationKey);
      console.log('  Number of Analyst Opinions:', result.financialData.numberOfAnalystOpinions?.fmt);
    }

    // Earnings History
    if (result.earningsHistory?.history) {
      console.log('\n📅 EARNINGS HISTORY:');
      result.earningsHistory.history.slice(0, 5).forEach(e => {
        console.log(`  ${e.quarter?.fmt}: Actual=${e.epsActual?.fmt}, Estimate=${e.epsEstimate?.fmt}, Surprise=${e.surprisePercent?.fmt}`);
      });
    }

    // Earnings (Quarterly & Annual)
    if (result.earnings) {
      console.log('\n📊 EARNINGS TREND:');
      if (result.earnings.financialsChart?.quarterly) {
        console.log('  Quarterly Revenue:', result.earnings.financialsChart.quarterly.slice(0, 3).map(q => `${q.date}: ${q.revenue?.fmt}`).join(', '));
      }
      if (result.earnings.financialsChart?.yearly) {
        console.log('  Annual Revenue:', result.earnings.financialsChart.yearly.slice(0, 3).map(y => `${y.date}: ${y.revenue?.fmt}`).join(', '));
      }
    }

    // Calendar Events (Earnings Date, Dividend Date)
    if (result.calendarEvents) {
      console.log('\n📆 UPCOMING EVENTS:');
      console.log('  Earnings Date:', result.calendarEvents.earnings?.earningsDate?.[0]?.fmt);
      console.log('  Dividend Date:', result.calendarEvents.dividendDate?.fmt);
      console.log('  Ex-Dividend Date:', result.calendarEvents.exDividendDate?.fmt);
    }

    // Analyst Recommendations
    if (result.recommendationTrend?.trend) {
      console.log('\n👥 ANALYST RECOMMENDATIONS (Latest):');
      const latest = result.recommendationTrend.trend[0];
      if (latest) {
        console.log(`  Strong Buy: ${latest.strongBuy || 0}`);
        console.log(`  Buy: ${latest.buy || 0}`);
        console.log(`  Hold: ${latest.hold || 0}`);
        console.log(`  Sell: ${latest.sell || 0}`);
        console.log(`  Strong Sell: ${latest.strongSell || 0}`);
      }
    }

    // Upgrades/Downgrades
    if (result.upgradeDowngradeHistory?.history) {
      console.log('\n📈📉 RECENT ANALYST ACTIONS:');
      result.upgradeDowngradeHistory.history.slice(0, 5).forEach(u => {
        console.log(`  ${new Date(u.epochGradeDate * 1000).toLocaleDateString()}: ${u.firm} - ${u.toGrade} (from ${u.fromGrade})`);
      });
    }

    // ESG Scores
    if (result.esgScores) {
      console.log('\n🌍 ESG SCORES:');
      console.log('  Total ESG:', result.esgScores.totalEsg?.fmt);
      console.log('  Environment:', result.esgScores.environmentScore?.fmt);
      console.log('  Social:', result.esgScores.socialScore?.fmt);
      console.log('  Governance:', result.esgScores.governanceScore?.fmt);
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Complete! Yahoo Finance provides a TON of data for free! 🎉\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test with AAPL
fetchYahooFullData('AAPL');
