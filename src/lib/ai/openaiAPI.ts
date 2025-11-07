/**
 * OpenAI API Wrapper
 * Handles communication with OpenAI's API
 * Includes caching, rate limiting, and error handling
 */

import { env } from '../../config/env';
import { AI_CONFIG, SYSTEM_PROMPT } from '../../config/ai';

const API_URL = 'https://api.openai.com/v1/chat/completions';

// Simple in-memory cache
const cache = new Map<string, { response: any; timestamp: number }>();

// Rate limiting state (per user)
const rateLimitState = {
  hourly: { count: 0, resetTime: Date.now() + 60 * 60 * 1000 },
  daily: { count: 0, resetTime: Date.now() + 24 * 60 * 60 * 1000 }
};

export type AIMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; [key: string]: any }>;
};

export type AIResponse = {
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: any;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason: string;
};

export type AIError = {
  error: string;
  type: 'rate_limit' | 'api_error' | 'network_error' | 'invalid_key';
  message: string;
};

/**
 * Convert our tools format to OpenAI format
 */
function convertToolsToOpenAI(tools: any[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));
}

/**
 * Convert OpenAI response to our standard format
 */
function convertOpenAIResponse(openaiResponse: any): AIResponse {
  const choice = openaiResponse.choices[0];
  const message = choice.message;

  const content: AIResponse['content'] = [];

  // Handle text content
  if (message.content) {
    content.push({
      type: 'text',
      text: message.content
    });
  }

  // Handle tool calls
  if (message.tool_calls) {
    for (const toolCall of message.tool_calls) {
      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments)
      });
    }
  }

  return {
    content,
    usage: {
      input_tokens: openaiResponse.usage.prompt_tokens,
      output_tokens: openaiResponse.usage.completion_tokens
    },
    stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'stop'
  };
}

/**
 * Call OpenAI API
 */
export async function callOpenAI(
  messages: AIMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
    skipCache?: boolean;
    tools?: Array<any>;
  }
): Promise<AIResponse | AIError> {
  try {
    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        error: 'API key not configured',
        type: 'invalid_key',
        message: 'OpenAI API key is missing. Please add OPENAI_API_KEY to your environment.'
      };
    }

    // Check rate limits
    const rateLimitError = checkRateLimit();
    if (rateLimitError) {
      return rateLimitError;
    }

    // Build request
    const requestBody: any = {
      model: AI_CONFIG.API.MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => {
          // Handle different content types
          if (typeof m.content === 'string') {
            return { role: m.role, content: m.content };
          }

          // Handle array content (tool calls and tool results)
          if (Array.isArray(m.content)) {
            // Check if this is a tool use response from assistant
            if (m.role === 'assistant') {
              const toolCalls = m.content
                .filter((c: any) => c.type === 'tool_use')
                .map((c: any) => ({
                  id: c.id,
                  type: 'function',
                  function: {
                    name: c.name,
                    arguments: JSON.stringify(c.input)
                  }
                }));

              const textContent = m.content.find((c: any) => c.type === 'text')?.text || null;

              return {
                role: 'assistant',
                content: textContent,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined
              };
            }

            // Handle tool results from user
            if (m.role === 'user') {
              const toolResults = m.content.filter((c: any) => c.type === 'tool_result');
              if (toolResults.length > 0) {
                // OpenAI expects tool results as separate messages with role="tool"
                // We'll return them differently - need to flatten this
                return toolResults.map((result: any) => ({
                  role: 'tool',
                  tool_call_id: result.tool_use_id,
                  content: result.content
                }));
              }
            }
          }

          return { role: m.role, content: JSON.stringify(m.content) };
        })
      ].flat(), // Flatten to handle tool result arrays
      max_tokens: options?.maxTokens || 1000,
      temperature: options?.temperature || 0.8
    };

    // Add tools if provided
    if (options?.tools && options.tools.length > 0) {
      requestBody.tools = convertToolsToOpenAI(options.tools);
      requestBody.tool_choice = 'auto';
    }

    console.log('[OpenAI] Calling API with model:', AI_CONFIG.API.MODEL);
    console.log('[OpenAI] Request messages count:', requestBody.messages.length);
    console.log('[OpenAI] Has tools:', !!requestBody.tools);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OpenAI] API error:', response.status, response.statusText);
      console.error('[OpenAI] Error details:', JSON.stringify(errorData, null, 2));

      if (response.status === 429) {
        return {
          error: 'Rate limit exceeded',
          type: 'rate_limit',
          message: 'Too many requests. Please try again later.'
        };
      }

      return {
        error: 'API error',
        type: 'api_error',
        message: errorData.error?.message || `HTTP ${response.status}`
      };
    }

    const data = await response.json();

    // Update rate limits
    updateRateLimit();

    // Convert to standard format
    const standardResponse = convertOpenAIResponse(data);

    console.log('[OpenAI] Success -', standardResponse.usage.input_tokens, 'input tokens,',
                standardResponse.usage.output_tokens, 'output tokens');

    return standardResponse;

  } catch (error: any) {
    console.error('[OpenAI] Network error:', error);
    return {
      error: 'Network error',
      type: 'network_error',
      message: error.message || 'Failed to connect to OpenAI'
    };
  }
}

function checkRateLimit(): AIError | null {
  const now = Date.now();
  const limits = AI_CONFIG.CURRENT_LIMITS;

  // Reset counters if time window expired
  if (now >= rateLimitState.hourly.resetTime) {
    rateLimitState.hourly = { count: 0, resetTime: now + 60 * 60 * 1000 };
  }
  if (now >= rateLimitState.daily.resetTime) {
    rateLimitState.daily = { count: 0, resetTime: now + 24 * 60 * 60 * 1000 };
  }

  // Check limits
  if (rateLimitState.hourly.count >= limits.messagesPerHour) {
    return {
      error: 'Hourly limit exceeded',
      type: 'rate_limit',
      message: `You've reached your hourly limit of ${limits.messagesPerHour} messages. Try again in ${Math.ceil((rateLimitState.hourly.resetTime - now) / 60000)} minutes.`
    };
  }

  if (rateLimitState.daily.count >= limits.messagesPerDay) {
    return {
      error: 'Daily limit exceeded',
      type: 'rate_limit',
      message: `You've reached your daily limit of ${limits.messagesPerDay} messages. Try again tomorrow.`
    };
  }

  return null;
}

function updateRateLimit() {
  rateLimitState.hourly.count++;
  rateLimitState.daily.count++;
}

export function getRateLimitStatus() {
  const limits = AI_CONFIG.CURRENT_LIMITS;
  return {
    hourly: {
      used: rateLimitState.hourly.count,
      limit: limits.messagesPerHour,
      remaining: limits.messagesPerHour - rateLimitState.hourly.count
    },
    daily: {
      used: rateLimitState.daily.count,
      limit: limits.messagesPerDay,
      remaining: limits.messagesPerDay - rateLimitState.daily.count
    }
  };
}
