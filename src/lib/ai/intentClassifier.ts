/**
 * Local Intent Classifier
 * Classifies user queries without calling the AI API
 * Saves API costs by handling simple queries locally
 */

import { IntentType } from '../../config/ai';

export type Intent = {
  type: IntentType;
  confidence: 'high' | 'medium' | 'low';
  needsAI: boolean;
  params?: {
    category?: string;
    period?: string;
    amount?: number;
    merchant?: string;
    symbol?: string;
    date?: string;
    account?: string;
  };
  directResponse?: string;
};

/**
 * Classify user query intent using regex pattern matching
 */
export function classifyIntent(query: string): Intent {
  const q = query.toLowerCase().trim();

  // Empty query
  if (!q) {
    return {
      type: IntentType.UNSUPPORTED,
      confidence: 'high',
      needsAI: false,
      directResponse: 'How can I help you today?'
    };
  }

  // Help queries
  if (/^(help|what can you do|commands)$/i.test(q)) {
    return {
      type: IntentType.SIMPLE_QUERY,
      confidence: 'high',
      needsAI: false,
      directResponse: "I can help you with:\n• Spending analysis\n• Portfolio insights\n• Transaction logging\n• Budget tracking\n\nWhat would you like to know?"
    };
  }

  // Transaction logging (contains amount)
  const amountMatch = q.match(/\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:dollars?)?/);
  if (amountMatch && /(?:spent|paid|bought|purchased|add|log|had|ate|ordered|got|cost|dinner|lunch|breakfast|coffee)/i.test(q)) {
    const amount = parseFloat(amountMatch[1]);
    const merchant = extractMerchant(q);
    const category = extractCategory(q);
    const date = extractDate(q);

    return {
      type: IntentType.TRANSACTION_LOG,
      confidence: 'high',
      needsAI: true, // Need AI to extract structured data
      params: {
        amount,
        merchant,
        category,
        date
      }
    };
  }

  // Portfolio transaction logging (stock/crypto purchases)
  if (/(?:bought|sold|purchase|add|log).*(?:shares?|stock|crypto)/i.test(q)) {
    const sharesMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:shares?|units?)/);
    const symbolMatch = q.match(/\b([A-Z]{1,5})\b/);

    return {
      type: IntentType.PORTFOLIO_LOG,
      confidence: 'high',
      needsAI: true,
      params: {
        amount: sharesMatch ? parseFloat(sharesMatch[1]) : undefined,
        symbol: symbolMatch ? symbolMatch[1] : undefined,
        date: extractDate(q)
      }
    };
  }

  // Balance/Cash queries - check for keywords but let AI handle the response with local data
  if (/(?:balance|cash|account|money|have|total)/i.test(q) &&
      !/(?:spent|spending|spend|bought|paid|purchased|add|log)/i.test(q)) {
    // Likely asking about balance - provide aggregated data to AI
    return {
      type: IntentType.SIMPLE_QUERY,
      confidence: 'medium',
      needsAI: true, // Let AI format the response naturally
      params: { queryType: 'balance' }
    };
  }

  // Simple net worth query
  if (/^(?:what(?:'s| is) my )?(?:net worth|networth)(?:\?)?$/i.test(q)) {
    return {
      type: IntentType.NET_WORTH_QUERY,
      confidence: 'high',
      needsAI: false,
      directResponse: 'net_worth' // Will be handled by direct query
    };
  }

  // Spending queries
  if (/(?:spent|spending|spend|cost|expense)/i.test(q)) {
    const category = extractCategory(q);
    const period = extractPeriod(q);

    return {
      type: IntentType.SPENDING_QUERY,
      confidence: category ? 'high' : 'medium',
      needsAI: true,
      params: { category, period }
    };
  }

  // Budget queries
  if (/(?:budget|budgeted|budgeting)/i.test(q)) {
    const category = extractCategory(q);
    const period = extractPeriod(q);

    return {
      type: IntentType.BUDGET_QUERY,
      confidence: 'high',
      needsAI: true,
      params: { category, period }
    };
  }

  // Portfolio queries
  if (/(?:portfolio|stock|invest|shares?|holdings?|crypto|amd|nvda|aapl|tsla)/i.test(q)) {
    const symbol = extractSymbol(q);

    return {
      type: IntentType.PORTFOLIO_QUERY,
      confidence: 'high',
      needsAI: true,
      params: { symbol }
    };
  }

  // Net worth queries (more complex)
  if (/(?:net worth|networth|total worth|wealth)/i.test(q)) {
    const period = extractPeriod(q);

    return {
      type: IntentType.NET_WORTH_QUERY,
      confidence: 'high',
      needsAI: !!period, // Need AI if comparing periods
      params: { period }
    };
  }

  // Unsupported - non-financial queries
  if (/(?:weather|news|movie|recipe|sport|game|hello|hi|hey|thanks|thank you)/i.test(q)) {
    return {
      type: IntentType.UNSUPPORTED,
      confidence: 'high',
      needsAI: false,
      directResponse: "I can only help with your Fingrow financial data. Try asking about your spending, portfolio, or logging a transaction."
    };
  }

  // Check if query contains financial keywords
  const hasFinancialKeywords = /(?:money|dollar|spend|spent|paid|cost|price|buy|bought|sale|invest|stock|crypto|portfolio|account|balance|worth|budget|transaction|expense|income|saving)/i.test(q);

  // Default - only use AI if query seems financial
  if (hasFinancialKeywords) {
    return {
      type: IntentType.SPENDING_QUERY,
      confidence: 'low',
      needsAI: true,
      params: {}
    };
  }

  // Non-financial query - reject
  return {
    type: IntentType.UNSUPPORTED,
    confidence: 'medium',
    needsAI: false,
    directResponse: "I can only help with your Fingrow financial data. Try asking about your spending, portfolio, or logging a transaction."
  };
}

/**
 * Extract spending category from query
 * Maps to actual app categories: Food, Groceries, Transport, Fuel, Shopping,
 * Entertainment, Bills, Utilities, Health, Fitness, Home, Education, Pets, Travel, Subscriptions, Gifts
 */
function extractCategory(query: string): string | undefined {
  const q = query.toLowerCase();

  // Map keywords to actual app categories
  const categoryMap: Record<string, string> = {
    // Food
    'food': 'Food',
    'restaurant': 'Food',
    'dining': 'Food',
    'coffee': 'Food',
    'lunch': 'Food',
    'dinner': 'Food',
    'breakfast': 'Food',
    'snack': 'Food',
    'pizza': 'Food',
    'burger': 'Food',
    'sushi': 'Food',

    // Groceries
    'groceries': 'Groceries',
    'supermarket': 'Groceries',
    'market': 'Groceries',

    // Transport
    'transport': 'Transport',
    'uber': 'Transport',
    'taxi': 'Transport',
    'bus': 'Transport',
    'train': 'Transport',
    'metro': 'Transport',
    'subway': 'Transport',

    // Fuel
    'fuel': 'Fuel',
    'gas': 'Fuel',
    'petrol': 'Fuel',
    'diesel': 'Fuel',

    // Shopping
    'shopping': 'Shopping',
    'clothes': 'Shopping',
    'clothing': 'Shopping',
    'shoes': 'Shopping',

    // Entertainment
    'entertainment': 'Entertainment',
    'movie': 'Entertainment',
    'cinema': 'Entertainment',
    'game': 'Entertainment',
    'concert': 'Entertainment',

    // Bills & Utilities
    'bills': 'Bills',
    'utilities': 'Utilities',
    'electric': 'Utilities',
    'electricity': 'Utilities',
    'water': 'Utilities',
    'internet': 'Utilities',

    // Health
    'health': 'Health',
    'medical': 'Health',
    'doctor': 'Health',
    'pharmacy': 'Health',
    'medicine': 'Health',

    // Fitness
    'fitness': 'Fitness',
    'gym': 'Fitness',
    'workout': 'Fitness',

    // Home
    'home': 'Home',
    'rent': 'Home',
    'mortgage': 'Home',
    'furniture': 'Home',

    // Education
    'education': 'Education',
    'school': 'Education',
    'course': 'Education',
    'book': 'Education',

    // Pets
    'pets': 'Pets',
    'pet': 'Pets',
    'vet': 'Pets',

    // Travel
    'travel': 'Travel',
    'flight': 'Travel',
    'hotel': 'Travel',
    'vacation': 'Travel',

    // Subscriptions
    'subscription': 'Subscriptions',
    'subscriptions': 'Subscriptions',
    'netflix': 'Subscriptions',
    'spotify': 'Subscriptions',

    // Gifts
    'gift': 'Gifts',
    'gifts': 'Gifts',
  };

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (q.includes(keyword)) {
      return category;
    }
  }

  return undefined;
}

/**
 * Extract time period from query
 */
function extractPeriod(query: string): string | undefined {
  const q = query.toLowerCase();

  if (/today/i.test(q)) return 'today';
  if (/yesterday/i.test(q)) return 'yesterday';
  if (/this week/i.test(q)) return 'this_week';
  if (/last week/i.test(q)) return 'last_week';
  if (/this month/i.test(q)) return 'this_month';
  if (/last month/i.test(q)) return 'last_month';
  if (/this year/i.test(q)) return 'this_year';
  if (/last year/i.test(q)) return 'last_year';

  // "past X days/weeks/months"
  const pastMatch = q.match(/(?:past|last)\s+(\d+)\s+(day|week|month|year)s?/);
  if (pastMatch) {
    return `past_${pastMatch[1]}_${pastMatch[2]}s`;
  }

  // "last 3 months", "past 6 months"
  const rangeMatch = q.match(/(?:past|last)\s+(\d+)\s+(day|week|month|year)s?/);
  if (rangeMatch) {
    return `past_${rangeMatch[1]}_${rangeMatch[2]}s`;
  }

  return undefined;
}

/**
 * Extract merchant/description from query
 */
function extractMerchant(query: string): string | undefined {
  const q = query.toLowerCase();

  // Look for "at <merchant>"
  const atMatch = query.match(/\bat\s+([a-z]+(?:\s+[a-z]+){0,2})/i);
  if (atMatch) return atMatch[1];

  // Look for "from <merchant>"
  const fromMatch = query.match(/\bfrom\s+([a-z]+(?:\s+[a-z]+){0,2})/i);
  if (fromMatch) return fromMatch[1];

  // Look for "for <item>" before time words - e.g., "for pizza just now"
  const forBeforeTimeMatch = query.match(/\bfor\s+([a-z]+)\s+(?:just\s+now|today|yesterday)/i);
  if (forBeforeTimeMatch) {
    return forBeforeTimeMatch[1].charAt(0).toUpperCase() + forBeforeTimeMatch[1].slice(1);
  }

  // Look for "for <item/description>"
  const forMatch = query.match(/\bfor\s+([a-z]+(?:\s+[a-z]+){0,2})/i);
  if (forMatch) {
    const matched = forMatch[1].toLowerCase();
    // Filter out time words and common fillers
    const filtered = matched.split(' ').filter(word =>
      !['just', 'now', 'today', 'yesterday', 'dinner', 'lunch', 'breakfast', 'food', 'it'].includes(word)
    ).join(' ');
    if (filtered) {
      return filtered.charAt(0).toUpperCase() + filtered.slice(1);
    }
  }

  // Look for "on <item/description>"
  const onMatch = query.match(/\bon\s+([a-z]+(?:\s+[a-z]+){0,2})/i);
  if (onMatch) {
    const matched = onMatch[1].toLowerCase();
    // Filter out time words and common fillers
    const filtered = matched.split(' ').filter(word =>
      !['just', 'now', 'today', 'yesterday', 'dinner', 'lunch', 'breakfast', 'food'].includes(word)
    ).join(' ');
    if (filtered) {
      return filtered.charAt(0).toUpperCase() + filtered.slice(1);
    }
  }

  // Look for "was <description>" (like "it was pizza")
  const wasMatch = query.match(/\bwas\s+([a-z]+(?:\s+[a-z]+){0,2})/i);
  if (wasMatch) {
    const matched = wasMatch[1].toLowerCase();
    // Filter out time words
    const filtered = matched.split(' ').filter(word =>
      !['just', 'now', 'today', 'yesterday'].includes(word)
    ).join(' ');
    if (filtered) {
      return filtered.charAt(0).toUpperCase() + filtered.slice(1);
    }
  }

  // Common merchants/items
  const merchants = ['starbucks', 'walmart', 'target', 'amazon', 'mcdonalds', 'uber', 'netflix', 'pizza', 'burger', 'sushi', 'coffee'];
  for (const merchant of merchants) {
    if (q.includes(merchant)) {
      return merchant.charAt(0).toUpperCase() + merchant.slice(1);
    }
  }

  return undefined;
}

/**
 * Extract stock symbol from query
 */
function extractSymbol(query: string): string | undefined {
  // Look for uppercase tickers (AMD, NVDA, AAPL, etc.)
  const symbolMatch = query.match(/\b([A-Z]{1,5})\b/);
  if (symbolMatch) return symbolMatch[1];

  // Common company names
  const companyMap: Record<string, string> = {
    'apple': 'AAPL',
    'microsoft': 'MSFT',
    'google': 'GOOGL',
    'amazon': 'AMZN',
    'tesla': 'TSLA',
    'amd': 'AMD',
    'nvidia': 'NVDA',
    'meta': 'META',
    'facebook': 'META'
  };

  for (const [name, symbol] of Object.entries(companyMap)) {
    if (query.toLowerCase().includes(name)) {
      return symbol;
    }
  }

  return undefined;
}

/**
 * Extract date from query
 */
function extractDate(query: string): string | undefined {
  const q = query.toLowerCase();

  if (/today/i.test(q)) return 'today';
  if (/yesterday/i.test(q)) return 'yesterday';

  // Look for specific dates (e.g., "on Jan 15", "on 1/15")
  const dateMatch = q.match(/(?:on\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (dateMatch) return dateMatch[1];

  return 'today'; // Default to today
}
