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
import { AI_TOOLS } from './tools';
import { executeTool } from './toolExecutor';

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

  // Get conversation manager
  const conversationManager = getConversationManager(getMemoryTurns());

  // NO MORE INTENT CLASSIFICATION - let GPT-4o Mini handle everything
  const intent: Intent = {
    type: IntentType.SPENDING_QUERY,
    confidence: 'high',
    needsAI: true,
    params: {}
  };

  // Check if this is a transaction logging request (has amount like "$5" or "5.31")
  const hasAmount = /\$?\s*\d+(?:\.\d{1,2})?/.test(query);
  const isTransactionLog = hasAmount && /(?:spent|paid|bought|purchased|add|log|for)/i.test(query);

  // Step 2: Handle transaction logging with AI-powered extraction
  if (isTransactionLog) {
    conversationManager.addUserMessage(query, { intent });

    console.log('[AI Service] Using AI extraction for transaction...');

    // Get user's accounts for matching (include ALL accounts - cash, credit, investment, etc.)
    const { accounts } = useAccountsStore.getState();
    const accountNames = accounts?.map(acc => `${acc.name} (${acc.kind})`) || [];

    // Get current time for context
    const now = new Date();
    const currentHour = now.getHours();

    // Always use Claude to extract transaction details for better accuracy
    const extractionPrompt = `Extract transaction details from the user's query and return ONLY the JSON object, nothing else.

Query: "${query}"

Context:
- Current time: ${now.toLocaleString()}
- Current hour: ${currentHour}
- Available accounts: ${accountNames.join(', ')}

Extract:
1. AMOUNT (required number)
2. MERCHANT (what they bought, e.g., "Pizza", "McDonald's" - NOT the account name)
3. CATEGORY: Food, Groceries, Transport, Fuel, Shopping, Entertainment, Bills, Utilities, Health, Fitness, Home, Education, Pets, Travel, Subscriptions, Gifts
4. TIME (convert "afternoon"→15:00, "lunch"→12:30, "morning"→09:00, "just now"→${currentHour}:00)
5. ACCOUNT (match name from available accounts, exclude (type), or null)

Return ONLY this JSON (no markdown, no text before or after):
{"amount": number, "merchant": string, "category": string, "time": string, "account": string|null}

Examples:
"5.31 for pizza" → {"amount": 5.31, "merchant": "Pizza", "category": "Food", "time": "${currentHour}:00", "account": null}
"$12 at McDonald's using Trust card" → {"amount": 12, "merchant": "McDonald's", "category": "Food", "time": "${currentHour}:00", "account": "Trust"}`;

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
        // Extract text from response (OpenAI returns array, we need string)
        const textContent = Array.isArray(aiResult.content)
          ? aiResult.content.find((c: any) => c.type === 'text')?.text || ''
          : aiResult.content;

        console.log('[AI Service] Raw AI response:', textContent);

        // Parse AI response - handle both raw JSON and JSON in markdown blocks
        let jsonText = textContent.trim();

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
          console.error('[AI Service] No JSON found in response:', textContent);
        }
      } catch (error) {
        console.error('[AI Service] Failed to parse AI extraction:', error);
        console.error('[AI Service] Raw response was:', textContent);
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

  // NO MORE directResponse or aggregatedData - GPT-4o Mini handles everything via tools

  // Step 3: Build context and call GPT-4o Mini
  conversationManager.addUserMessage(query, { intent });

  // Get conversation history
  const contextMessages = conversationManager.getContextMessages();

  // Build messages for API
  const messages: ClaudeMessage[] = contextMessages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  console.log('[AI Service] Calling API with', messages.length, 'messages');
  console.log('[AI Service] Last 3 messages:', contextMessages.slice(-3).map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content.substring(0, 100) : '[complex]'
  })));

  // Step 4: Call API with tool support
  const result = await callClaude(messages, {
    skipCache: options?.skipCache,
    maxTokens: getMaxTokens(),
    temperature: AI_CONFIG.API.TEMPERATURE,
    tools: AI_TOOLS // Enable tool calling
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
        metadata: { intent, error: true }
      }
    };
  }

  // Step 8: Handle tool use (if Claude requests data)
  const claudeResponse = result as ClaudeResponse;
  const toolUseBlocks = claudeResponse.content.filter((c: any) => c.type === 'tool_use');

  if (toolUseBlocks.length > 0) {
    console.log('[AI Service] Claude requested', toolUseBlocks.length, 'tools');

    // Execute all requested tools
    const toolResults = toolUseBlocks.map((toolUse: any) => {
      const result = executeTool(toolUse.name, toolUse.input, toolUse.id);
      console.log('[AI Service] Tool result:', result);
      return result;
    });

    // Add assistant message with tool use to conversation history
    conversationManager.addAssistantMessage('[Using tools to fetch data]', {
      toolCalls: toolUseBlocks.map((t: any) => ({ name: t.name, input: t.input }))
    });

    // Add assistant message with tool use to API messages
    messages.push({
      role: 'assistant',
      content: claudeResponse.content
    });

    // Add tool results to API messages
    messages.push({
      role: 'user',
      content: toolResults.map(r => ({
        type: 'tool_result',
        tool_use_id: r.tool_use_id,
        content: r.content
      }))
    });

    // Add tool results to conversation history for context
    const toolResultsSummary = toolResults.map(r => `${r.content.substring(0, 200)}...`).join('\n');
    conversationManager.addUserMessage(`[Tool results: ${toolResultsSummary}]`, {
      toolResults: true
    });

    // Call Claude again with tool results
    const finalResult = await callClaude(messages, {
      skipCache: true, // Don't cache tool-based responses
      maxTokens: getMaxTokens(),
      temperature: AI_CONFIG.API.TEMPERATURE,
      tools: AI_TOOLS
    });

    if ('error' in finalResult) {
      const errorResponse = formatErrorResponse(finalResult);
      return {
        message: {
          id: Date.now().toString(),
          role: 'assistant',
          content: errorResponse,
          timestamp: Date.now(),
          metadata: { intent, error: true }
        }
      };
    }

    // Extract final text response
    const finalResponse = finalResult as ClaudeResponse;
    const textContent = finalResponse.content.find((c: any) => c.type === 'text')?.text || 'No response';

    const assistantMsg = conversationManager.addAssistantMessage(textContent, {
      usage: finalResponse.usage,
      toolUsed: true
    });

    return {
      message: {
        id: assistantMsg.id,
        role: 'assistant',
        content: textContent,
        timestamp: assistantMsg.timestamp,
        metadata: {
          intent,
          usage: finalResponse.usage,
          toolUsed: true
        }
      }
    };
  }

  // Step 9: No tool use - process text response
  const textContent = claudeResponse.content.find((c: any) => c.type === 'text')?.text || '';
  const assistantMsg = conversationManager.addAssistantMessage(textContent, {
    usage: claudeResponse.usage,
    cached: claudeResponse.stop_reason === 'cached'
  });

  const aiMessage: AIMessage = {
    id: assistantMsg.id,
    role: 'assistant',
    content: textContent,
    timestamp: assistantMsg.timestamp,
    metadata: {
      intent,
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
