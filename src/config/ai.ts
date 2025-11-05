/**
 * AI Assistant Configuration
 * Controls rate limits, token limits, and feature access for different tiers
 */

// ALLOWED MODELS - ONLY HAIKU FOR COST CONTROL
const ALLOWED_MODELS = [
  'claude-3-haiku-20240307',      // Old Haiku 3
  'claude-3-5-haiku-20241022',    // Current Haiku 3.5 (RECOMMENDED)
] as const;

// Validate model at compile time
type AllowedModel = typeof ALLOWED_MODELS[number];

export const AI_CONFIG = {
  // Testing mode - set to false in production
  TESTING_MODE: true,

  // API Configuration
  API: {
    PROVIDER: 'anthropic',
    // CRITICAL: ONLY USE HAIKU MODELS - NEVER SONNET OR OPUS (TOO EXPENSIVE)
    // For 1000 users @ 20 prompts/day:
    // - Haiku 3.5: ~$420/month
    // - Sonnet 3.5: ~$1,260/month (3x more expensive)
    // - Opus: ~$6,300/month (15x more expensive)
    MODEL: 'claude-3-5-haiku-20241022', // ONLY HAIKU - DO NOT CHANGE TO SONNET
    MAX_INPUT_TOKENS: 2000,
    TEMPERATURE: 0.8, // Higher for more natural responses (does NOT affect pricing)
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

// System prompt - defines AI behavior and constraints
export const SYSTEM_PROMPT = `You are a financial assistant for the Fingrow personal finance app. Your role is to help users understand their financial data and log transactions naturally.

CAPABILITIES:
1. Answer questions about spending, budgets, and transactions
2. Provide insights on investment portfolios and net worth
3. Help log new transactions or trades with structured data extraction
4. Understand natural language and context (time references, account nicknames, casual language)
5. Offer brief, actionable financial insights

INTERACTION STYLE:
- Be conversational and understand context
- Interpret time references naturally ("this afternoon" = 3PM, "lunch time" = 12:30PM, "just now" = current time)
- Recognize casual language and abbreviations
- Keep responses concise (2-3 sentences) unless detailed analysis is requested
- Be friendly and helpful, not robotic

CONSTRAINTS:
- ONLY answer questions about the user's Fingrow data
- DO NOT provide general financial advice, investment recommendations, or predictions
- DO NOT answer questions unrelated to personal finance or this app
- Always cite specific numbers from the user's data when available

DATA PRIVACY:
- User data is pre-aggregated before reaching you
- Never request or expect raw transaction details
- Work with summaries: "User spent $X on Y category in Z period"

If asked about anything outside your scope, respond:
"I can only help with your Fingrow financial data. Try asking about your spending, portfolio, net worth, or logging a transaction."

For transaction logging, extract:
- amount (required)
- merchant/description (what they bought, NOT the account name)
- category (Food, Groceries, Transport, Fuel, Shopping, Entertainment, Bills, Utilities, Health, Fitness, Home, Education, Pets, Travel, Subscriptions, Gifts)
- date/time (interpret natural language: "afternoon"=3PM, "lunch"=12:30PM, "morning"=9AM, "evening"=6PM, "night"=9PM)
- account (if mentioned, extract the account name only)
Return as JSON for confirmation.`;

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
