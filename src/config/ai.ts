/**
 * AI Assistant Configuration
 * Controls rate limits, token limits, and feature access for different tiers
 */

// ALLOWED MODELS - GPT-4O MINI FOR BEST VALUE
const ALLOWED_MODELS = [
  'gpt-4o-mini',           // Best cost/quality ratio (RECOMMENDED)
  'gpt-4o-mini-2024-07-18' // Specific version
] as const;

// Validate model at compile time
type AllowedModel = typeof ALLOWED_MODELS[number];

export const AI_CONFIG = {
  // Testing mode - set to false in production
  TESTING_MODE: true,

  // API Configuration
  API: {
    PROVIDER: 'openai',
    // USING GPT-4O MINI FOR COST + QUALITY
    // For 1000 users @ 20 prompts/day:
    // - GPT-4o Mini: ~$63/month (BEST VALUE - 85% cheaper than Haiku, better quality)
    // - Haiku 3.5: ~$420/month (7x more expensive, worse quality)
    // - Sonnet 3.5: ~$1,260/month (20x more expensive)
    MODEL: 'gpt-4o-mini', // Cost-effective and reliable
    MAX_INPUT_TOKENS: 2000,
    TEMPERATURE: 0.8, // Higher for more natural responses
    CACHE_TTL_SECONDS: 3600, // 1 hour
  },

  // Free tier limits
  FREE_TIER: {
    messagesPerDay: 10,
    messagesPerHour: 5,
    maxTokensPerResponse: 500,
    conversationMemoryTurns: 2, // Keep last 2 exchanges
    features: {
      basicQueries: true,
      transactionLogging: true,
      spendingInsights: true,
      portfolioQueries: true,
      advancedAnalysis: false,
      trendPredictions: false,
      monthlyReports: false,
    }
  },

  // Premium tier limits
  PREMIUM_TIER: {
    messagesPerDay: 50,
    messagesPerHour: 20,
    maxTokensPerResponse: 1000,
    conversationMemoryTurns: 5, // Keep last 5 exchanges
    features: {
      basicQueries: true,
      transactionLogging: true,
      spendingInsights: true,
      portfolioQueries: true,
      advancedAnalysis: true,
      trendPredictions: true,
      monthlyReports: true,
    }
  },

  // Override limits during testing
  get CURRENT_LIMITS() {
    if (this.TESTING_MODE) {
      return {
        messagesPerDay: 999999,
        messagesPerHour: 999999,
        maxTokensPerResponse: 2000,
        conversationMemoryTurns: 10,
        features: {
          basicQueries: true,
          transactionLogging: true,
          spendingInsights: true,
          portfolioQueries: true,
          advancedAnalysis: true,
          trendPredictions: true,
          monthlyReports: true,
        }
      };
    }
    // In production, this would check user's actual tier from profile store
    return this.FREE_TIER;
  }
};

// System prompt - MUST use tools
export const SYSTEM_PROMPT = `You are a financial assistant for Fingrow. You MUST use tools to answer ALL questions about user data.

TODAY'S DATE: ${new Date().toISOString().split('T')[0]} (${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})
CURRENT YEAR: ${new Date().getFullYear()}

CRITICAL RULES:
1. You do NOT have access to user data directly. You MUST call tools to get data. NEVER answer without calling a tool first.
2. When user mentions a month without a year (e.g., "July", "last month"), ALWAYS use the CURRENT YEAR ${new Date().getFullYear()}.
3. When searching for items (e.g., "toast", "pizza"), search the ENTIRE YEAR or last 90 days, not just one month.

TOOLS (YOU MUST USE THESE):

SPENDING TOOLS:
1. search_transactions - Search for transactions by merchant/item name OR list by category. Returns dates + amounts + account used.
2. get_spending_data - Get total spending for a period
3. get_budget_data - Get budget info

INVESTMENT TOOLS:
4. get_portfolio_data - Get total portfolio value, gain/loss, and holdings summary
5. get_stock_details - Get detailed info about a stock user OWNS (purchase history, average cost, total shares, gain/loss, first purchase date)
6. get_stock_fundamentals - Get company info for stocks in watchlist/holdings (P/E ratio, market cap, sector, dividend, 52-week range, etc.)
7. add_to_watchlist - Add a stock to watchlist to fetch data (ask user which portfolio if they have multiple)

OTHER TOOLS:
8. get_net_worth_data - Get net worth breakdown

INVESTMENT QUERY EXAMPLES:
"How much AAPL do I own?" → get_stock_details(symbol="AAPL")
"What's my average cost for Tesla?" → get_stock_details(symbol="TSLA")
"When did I first buy Amazon?" → get_stock_details(symbol="AMZN")
"What's Apple's P/E ratio?" → get_stock_fundamentals(symbol="AAPL") [only works if in watchlist/holdings]
"Tell me about NVDA" → get_stock_fundamentals(symbol="NVDA") [if not in watchlist, offer to add it]
"What's my portfolio worth?" → get_portfolio_data()
"How is my portfolio doing today?" → get_portfolio_data()

WATCHLIST WORKFLOW:
If user asks about a stock NOT in their watchlist/holdings:
1. Check with get_stock_fundamentals first
2. If returns "I don't have data on XXX", offer: "Would you like me to add XXX to your watchlist to fetch the data?"
3. If user says yes, call add_to_watchlist(symbol="XXX")
4. If user says no (just wants quick info), use WebSearch to get basic info

SPENDING QUERY EXAMPLES:
"what food did I have this month?" → search_transactions(category="Food", start_date="2025-11-01", end_date="2025-11-30")
"what subscriptions?" → search_transactions(category="Subscriptions", start_date="2025-01-01", end_date="2025-11-30")
"did I buy toast?" → search_transactions(search_term="toast", start_date="2025-08-01", end_date="2025-11-07")
"spending in July" → get_spending_data(start_date="2025-07-01", end_date="2025-07-31")
"what account did I use for pizza?" → search_transactions(search_term="pizza", start_date="2025-08-01", end_date="2025-11-07")

DO NOT say "I don't have data" - CALL THE TOOL FIRST. The tool will tell you if there's no data.

FORMATTING YOUR RESPONSES:
- Use bullet points (- or •) for lists
- Use numbered lists (1. 2. 3.) for steps
- Use section headers ending with : for grouping
- Use **bold** for emphasis on important numbers or terms
- Add blank lines between sections for readability

Example formatted response:
"Here's your spending summary:

**Total spent:** $234.50

Top categories:
- Food: $120.30
- Transport: $65.20
- Shopping: $49.00

You spent the most on Nov 5 at Whole Foods ($45.50)."

For transaction logging: Extract amount, merchant, category, time, account. Return ONLY JSON.`;


// Runtime validation - check model is allowed
if (!ALLOWED_MODELS.includes(AI_CONFIG.API.MODEL as any)) {
  throw new Error(
    `❌ COST CONTROL VIOLATION: Invalid model "${AI_CONFIG.API.MODEL}"\n` +
    `Only Haiku models are allowed: ${ALLOWED_MODELS.join(', ')}\n` +
    `Current model would cost 3-15x more than Haiku.\n` +
    `Change MODEL in src/config/ai.ts to 'claude-3-5-haiku-20241022'`
  );
}

// Intent types for local classification
export enum IntentType {
  SPENDING_QUERY = 'spending_query',
  PORTFOLIO_QUERY = 'portfolio_query',
  NET_WORTH_QUERY = 'net_worth_query',
  BUDGET_QUERY = 'budget_query',
  TRANSACTION_LOG = 'transaction_log',
  PORTFOLIO_LOG = 'portfolio_log',
  SIMPLE_QUERY = 'simple_query',
  UNSUPPORTED = 'unsupported',
}

// Canned responses for simple queries (no AI needed)
export const SIMPLE_RESPONSES = {
  balance: "Let me get your current balance...",
  net_worth: "Let me calculate your current net worth...",
  help: "I can help you with:\n• Spending analysis\n• Portfolio insights\n• Transaction logging\n• Budget tracking\n\nWhat would you like to know?",
};
