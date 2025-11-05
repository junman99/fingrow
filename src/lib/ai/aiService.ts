/**
 * AI Service - Main Orchestration Layer
 * Coordinates: intent classification → data aggregation → Claude API → response
 */

import { classifyIntent, Intent } from './intentClassifier';
import {
  getSpendingData,
  getPortfolioData,
  getNetWorthData,
  getBudgetData,
  AggregatedData
} from './dataAggregator';
import {
  callClaude,
  ClaudeMessage,
  ClaudeResponse,
  ClaudeError,
  getRateLimitStatus
} from './claudeAPI';
import {
  getConversationManager,
  Message as ConversationMessage
} from './conversationManager';
import { AI_CONFIG, IntentType } from '../../config/ai';
import { useProfileStore } from '../../store/profile';
import { useAccountsStore } from '../../store/accounts';

export type AIMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    intent?: Intent;
    aggregatedData?: AggregatedData;
    usage?: { input_tokens: number; output_tokens: number };
    cached?: boolean;
    error?: boolean;
    aiExtracted?: boolean;
  };
};

export type AIResponse = {
  message: AIMessage;
  requiresConfirmation?: {
    type: 'transaction' | 'portfolio_transaction';
    data: any;
  };
};

/**
 * Process user query and get AI response
 */
export async function processQuery(
  query: string,
  options?: {
    skipCache?: boolean;
  }
): Promise<AIResponse> {
  console.log('[AI Service] Processing query:', query);

  // Step 1: Classify intent locally
  const intent = classifyIntent(query);
  console.log('[AI Service] Intent classified:', intent.type, 'confidence:', intent.confidence);

  // Step 2: Handle transaction logging with AI-powered extraction
  if (intent.type === IntentType.TRANSACTION_LOG) {
    const conversationManager = getConversationManager(getMemoryTurns());
    conversationManager.addUserMessage(query, { intent });

    console.log('[AI Service] Using AI extraction for transaction...');

    // Get user's accounts for matching (include ALL accounts - cash, credit, investment, etc.)
    const { accounts } = useAccountsStore.getState();
    const accountNames = accounts?.map(acc => `${acc.name} (${acc.kind})`) || [];

    // Get current time for context
    const now = new Date();
    const currentHour = now.getHours();

    // Always use Claude to extract transaction details for better accuracy
    const extractionPrompt = `You are a transaction data extraction assistant. Extract transaction details from the user's natural language query.

Query: "${query}"

Context:
- Current time: ${now.toLocaleString()}
- Current hour: ${currentHour}
- Available accounts: ${accountNames.join(', ')}

Instructions:
1. Extract the AMOUNT the user spent (required, must be a number)
2. Extract the MERCHANT or item description (what they bought, e.g., "Shopee", "McDonald's", "Pizza" - NOT the account name)
3. Extract the CATEGORY from this list: Food, Groceries, Transport, Fuel, Shopping, Entertainment, Bills, Utilities, Health, Fitness, Home, Education, Pets, Travel, Subscriptions, Gifts
4. Extract the TIME if mentioned (convert phrases like "afternoon" to 15:00, "lunch time" to 12:30, "morning" to 09:00, "just now" to ${currentHour}:00)
5. Extract the ACCOUNT name if mentioned (match against available accounts above, return ONLY the account name without the type in parentheses)

CRITICAL: If user says "Trust account" or "Trust card" and you see "Trust (credit)" in the available accounts, return "Trust" as the account, NOT "Trust (credit)".
CRITICAL: The merchant field should be what they bought (e.g., "Pizza", "Uber ride"), NOT the payment method or account.

Return ONLY valid JSON (no markdown, no code blocks, no explanations):
{
  "amount": number (required),
  "merchant": string (what they bought),
  "category": string (from list above),
  "time": string (HH:MM format in 24hr),
  "account": string or null (just the account name, or null)
}

Examples:
Query: "I bought Shopee for 5 dollars this afternoon"
{"amount": 5, "merchant": "Shopee", "category": "Shopping", "time": "15:00", "account": null}

Query: "Had lunch at McDonald's for $12 using my Trust account"
{"amount": 12, "merchant": "McDonald's", "category": "Food", "time": "12:30", "account": "Trust"}

Query: "Uber ride cost me $15 yesterday morning"
{"amount": 15, "merchant": "Uber", "category": "Transport", "time": "09:00", "account": null}

Query: "Spent $50 on groceries just now"
{"amount": 50, "merchant": "Groceries", "category": "Groceries", "time": "${currentHour}:00", "account": null}`;

    const aiResult = await callClaude(
      [{ role: 'user', content: extractionPrompt }],
      { maxTokens: 200, temperature: 0.3 }
    );

    let extractedData: any = {
      amount: 0,
      merchant: 'Transaction',
      category: 'Shopping',
      date: now.toISOString(),
      account: null
    };

    if (!('error' in aiResult)) {
      try {
        console.log('[AI Service] Raw AI response:', aiResult.content);

        // Parse AI response - handle both raw JSON and JSON in markdown blocks
        let jsonText = aiResult.content.trim();

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```(?:json)?\n?/g, '');
        }

        // Extract JSON object
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('[AI Service] Parsed JSON:', parsed);

          // Parse time and combine with date
          let transactionDate = new Date();
          if (parsed.time) {
            const [hours, minutes] = parsed.time.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
              transactionDate.setHours(hours, minutes, 0, 0);
            }
          }

          // Validate account name - be VERY flexible with matching
          let accountName = parsed.account;
          if (accountName && typeof accountName === 'string') {
            // Clean up account name (remove quotes, trim whitespace, remove "card", "account")
            accountName = accountName
              .trim()
              .replace(/['"]/g, '')
              .replace(/\s+(card|account)$/i, '') // Remove trailing "card" or "account"
              .trim();

            console.log('[AI Service] Account matching - cleaned input:', accountName);

            // Try exact match first
            let matchedAccount = accounts?.find(acc =>
              acc.name.toLowerCase() === accountName.toLowerCase()
            );

            // If no exact match, try partial match
            if (!matchedAccount) {
              matchedAccount = accounts?.find(acc =>
                acc.name.toLowerCase().includes(accountName.toLowerCase()) ||
                accountName.toLowerCase().includes(acc.name.toLowerCase())
              );
            }

            accountName = matchedAccount ? matchedAccount.name : null;
            console.log('[AI Service] Account matching - input:', parsed.account, 'cleaned:', accountName, 'matched:', matchedAccount?.name);
          }

          extractedData = {
            amount: parsed.amount || 0,
            merchant: parsed.merchant || 'Transaction',
            category: parsed.category || 'Shopping',
            date: transactionDate.toISOString(),
            account: accountName
          };
          console.log('[AI Service] AI extraction successful:', extractedData);
        } else {
          console.error('[AI Service] No JSON found in response:', aiResult.content);
        }
      } catch (error) {
        console.error('[AI Service] Failed to parse AI extraction:', error);
        console.error('[AI Service] Raw response was:', aiResult.content);
        // Use fallback data
      }
    } else {
      console.error('[AI Service] AI extraction error:', aiResult.error);
      // Use fallback data
    }

    // Build confirmation message
    let confirmationText = `I'll help you log that transaction. Please review the details and confirm.`;
    if (extractedData.account) {
      const matchedAccount = accounts?.find(acc => acc.name === extractedData.account);
      if (matchedAccount) {
        const accountType = matchedAccount.kind === 'credit' ? 'credit card' : matchedAccount.kind + ' account';
        confirmationText = `Found your ${extractedData.account} (${accountType})! Please review the details and confirm.`;
      }
    }

    const confirmationMsg = conversationManager.addAssistantMessage(
      confirmationText,
      { intent }
    );

    return {
      message: {
        id: confirmationMsg.id,
        role: 'assistant',
        content: confirmationMsg.content,
        timestamp: confirmationMsg.timestamp,
        metadata: { intent, aiExtracted: true }
      },
      requiresConfirmation: {
        type: 'transaction',
        data: extractedData
      }
    };
  }

  // Step 3: Handle direct responses (no AI needed)
  if (intent.directResponse && !intent.needsAI) {
    const conversationManager = getConversationManager(getMemoryTurns());
    conversationManager.addUserMessage(query, { intent });

    const assistantMsg = conversationManager.addAssistantMessage(intent.directResponse, {
      directResponse: true
    });

    return {
      message: {
        id: assistantMsg.id,
        role: 'assistant',
        content: intent.directResponse,
        timestamp: assistantMsg.timestamp,
        metadata: { intent, cached: true }
      }
    };
  }

  // Step 3: Aggregate relevant data locally
  let aggregatedData: AggregatedData | null = null;

  try {
    aggregatedData = aggregateDataForIntent(intent);
    console.log('[AI Service] Data aggregated:', aggregatedData?.summary);
  } catch (error) {
    console.error('[AI Service] Data aggregation error:', error);
  }

  // Step 4: If simple query with aggregated data, return direct answer
  if (intent.type === IntentType.SIMPLE_QUERY && aggregatedData && intent.directResponse) {
    // For balance/net worth queries, use aggregated data
    const conversationManager = getConversationManager(getMemoryTurns());
    conversationManager.addUserMessage(query, { intent });

    const response = aggregatedData.summary;
    const assistantMsg = conversationManager.addAssistantMessage(response, {
      aggregatedData,
      directResponse: true
    });

    return {
      message: {
        id: assistantMsg.id,
        role: 'assistant',
        content: response,
        timestamp: assistantMsg.timestamp,
        metadata: { intent, aggregatedData, cached: true }
      }
    };
  }

  // Step 5: Build context for Claude
  const conversationManager = getConversationManager(getMemoryTurns());
  conversationManager.addUserMessage(query, { intent, aggregatedData });

  // Get conversation history
  const contextMessages = conversationManager.getContextMessages();

  // Add current query with aggregated data
  const messages: ClaudeMessage[] = contextMessages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  // If we have aggregated data, enhance the current query
  if (aggregatedData && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user') {
      lastMessage.content = `${lastMessage.content}\n\n[Context: ${aggregatedData.summary}]`;
    }
  }

  console.log('[AI Service] Calling Claude with', messages.length, 'messages');

  // Step 6: Call Claude API
  const result = await callClaude(messages, {
    skipCache: options?.skipCache,
    maxTokens: getMaxTokens(),
    temperature: AI_CONFIG.API.TEMPERATURE
  });

  // Step 7: Handle errors
  if ('error' in result) {
    const errorResponse = formatErrorResponse(result);
    const assistantMsg = conversationManager.addAssistantMessage(errorResponse, {
      error: true,
      errorType: result.type
    });

    return {
      message: {
        id: assistantMsg.id,
        role: 'assistant',
        content: errorResponse,
        timestamp: assistantMsg.timestamp,
        metadata: { intent, aggregatedData, error: true }
      }
    };
  }

  // Step 8: Process successful response
  const claudeResponse = result as ClaudeResponse;
  const assistantMsg = conversationManager.addAssistantMessage(claudeResponse.content, {
    usage: claudeResponse.usage,
    cached: claudeResponse.stop_reason === 'cached'
  });

  const aiMessage: AIMessage = {
    id: assistantMsg.id,
    role: 'assistant',
    content: claudeResponse.content,
    timestamp: assistantMsg.timestamp,
    metadata: {
      intent,
      aggregatedData: aggregatedData || undefined,
      usage: claudeResponse.usage,
      cached: claudeResponse.stop_reason === 'cached'
    }
  };

  return { message: aiMessage };
}

/**
 * Check if we should use AI extraction instead of regex
 * Detects suspicious or incomplete regex extraction
 */
function shouldUseAIExtraction(params: any, query: string): boolean {
  // 1. Missing amount - critical field
  if (!params.amount || params.amount <= 0) {
    console.log('[AI Service] Missing or invalid amount, using AI');
    return true;
  }

  // 2. Description contains time words (regex captured time as description)
  if (params.merchant) {
    const timeWords = ['just now', 'today', 'yesterday', 'just', 'now'];
    const lowerMerchant = params.merchant.toLowerCase();
    if (timeWords.some(word => lowerMerchant.includes(word))) {
      console.log('[AI Service] Description contains time words, using AI');
      return true;
    }
  }

  // 3. Missing both category AND merchant (low confidence extraction)
  if (!params.category && !params.merchant) {
    console.log('[AI Service] Missing both category and merchant, using AI');
    return true;
  }

  // 4. Query is complex (more than 10 words suggests natural language)
  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount > 12) {
    console.log('[AI Service] Complex query, using AI');
    return true;
  }

  // Regex extraction looks good!
  return false;
}

/**
 * Aggregate data based on intent
 */
function aggregateDataForIntent(intent: Intent): AggregatedData | null {
  switch (intent.type) {
    case IntentType.SPENDING_QUERY:
      return getSpendingData(intent.params?.category, intent.params?.period);

    case IntentType.BUDGET_QUERY:
      return getBudgetData(intent.params?.category, intent.params?.period);

    case IntentType.PORTFOLIO_QUERY:
      return getPortfolioData(intent.params?.symbol);

    case IntentType.NET_WORTH_QUERY:
      return getNetWorthData(intent.params?.period);

    case IntentType.SIMPLE_QUERY:
      // Check if it's a balance/cash query
      if (intent.params?.queryType === 'balance' || intent.directResponse === 'balance') {
        return getNetWorthData();
      }
      if (intent.directResponse === 'net_worth') {
        return getNetWorthData();
      }
      return null;

    default:
      return null;
  }
}

/**
 * Format error response for user
 */
function formatErrorResponse(error: ClaudeError): string {
  switch (error.type) {
    case 'rate_limit':
      return error.message;

    case 'invalid_key':
      return "⚠️ AI Assistant is not configured yet. Please add your Claude API key in the app settings.";

    case 'api_error':
      return "I encountered an error processing your request. Please try again.";

    case 'network_error':
      return "I couldn't connect to the AI service. Please check your internet connection and try again.";

    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * Get memory turns based on user tier
 */
function getMemoryTurns(): number {
  const { aiTier } = useProfileStore.getState().profile;
  const limits = AI_CONFIG.TESTING_MODE
    ? AI_CONFIG.CURRENT_LIMITS
    : aiTier === 'premium'
    ? AI_CONFIG.PREMIUM_TIER
    : AI_CONFIG.FREE_TIER;

  return limits.conversationMemoryTurns;
}

/**
 * Get max tokens based on user tier
 */
function getMaxTokens(): number {
  const { aiTier } = useProfileStore.getState().profile;
  const limits = AI_CONFIG.TESTING_MODE
    ? AI_CONFIG.CURRENT_LIMITS
    : aiTier === 'premium'
    ? AI_CONFIG.PREMIUM_TIER
    : AI_CONFIG.FREE_TIER;

  return limits.maxTokensPerResponse;
}

/**
 * Get user's rate limit status
 */
export function getUserRateLimitStatus() {
  return getRateLimitStatus();
}

/**
 * Clear conversation history
 */
export function clearConversation() {
  const conversationManager = getConversationManager(getMemoryTurns());
  conversationManager.clearConversation();
  console.log('[AI Service] Conversation cleared');
}

/**
 * Get conversation stats
 */
export function getConversationStats() {
  const conversationManager = getConversationManager(getMemoryTurns());
  return conversationManager.getStats();
}
