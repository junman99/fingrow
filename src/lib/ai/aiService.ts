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

    // Always use Claude to extract transaction details for better accuracy
    const extractionPrompt = `Extract transaction details from this query: "${query}"

Return ONLY a JSON object with these fields:
{
  "amount": number (required),
  "merchant": string (description/merchant name, extract the actual item/merchant, NOT words like "today" or "just now"),
  "category": string (one of: Food, Groceries, Transport, Fuel, Shopping, Entertainment, Bills, Utilities, Health, Fitness, Home, Education, Pets, Travel, Subscriptions, Gifts),
  "date": string ("today", "yesterday", or ISO date)
}

Examples:
Query: "I spent 5.7 for pizza just now"
{"amount": 5.7, "merchant": "Pizza", "category": "Food", "date": "today"}

Query: "Uber ride cost me $15 yesterday"
{"amount": 15, "merchant": "Uber", "category": "Transport", "date": "yesterday"}

Query: "I bought shoes for 119 today"
{"amount": 119, "merchant": "Shoes", "category": "Shopping", "date": "today"}`;

    const aiResult = await callClaude(
      [{ role: 'user', content: extractionPrompt }],
      { maxTokens: 200, temperature: 0.3 }
    );

    let extractedData: any = {
      amount: 0,
      merchant: 'Transaction',
      category: 'Shopping',
      date: 'today'
    };

    if (!('error' in aiResult)) {
      try {
        // Parse AI response
        const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          extractedData = {
            amount: parsed.amount,
            merchant: parsed.merchant || 'Transaction',
            category: parsed.category || 'Shopping',
            date: parsed.date || 'today'
          };
          console.log('[AI Service] AI extraction successful:', extractedData);
        }
      } catch (error) {
        console.error('[AI Service] Failed to parse AI extraction:', error);
        // Use fallback data
      }
    } else {
      console.error('[AI Service] AI extraction error:', aiResult.error);
      // Use fallback data
    }

    const confirmationMsg = conversationManager.addAssistantMessage(
      `I'll help you log that transaction. Please review the details and confirm.`,
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
      if (intent.directResponse === 'balance') {
        // Get total cash balance
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
