/**
 * Claude API Wrapper
 * Handles communication with Anthropic's Claude API
 * Includes caching, rate limiting, and error handling
 */

import { env } from '../../config/env';
import { AI_CONFIG, SYSTEM_PROMPT } from '../../config/ai';
import { useProfileStore } from '../../store/profile';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// Simple in-memory cache
const cache = new Map<string, { response: string; timestamp: number }>();

// Rate limiting state (per user)
const rateLimitState = {
  hourly: { count: 0, resetTime: Date.now() + 60 * 60 * 1000 },
  daily: { count: 0, resetTime: Date.now() + 24 * 60 * 60 * 1000 }
};

export type ClaudeMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ClaudeResponse = {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason: string;
};

export type ClaudeError = {
  error: string;
  type: 'rate_limit' | 'api_error' | 'network_error' | 'invalid_key';
  message: string;
};

/**
 * Call Claude API with rate limiting and caching
 */
export async function callClaude(
  messages: ClaudeMessage[],
  options?: {
    maxTokens?: number;
    temperature?: number;
    skipCache?: boolean;
  }
): Promise<ClaudeResponse | ClaudeError> {
  try {
    // CRITICAL: Enforce HAIKU-only policy to control costs
    const model = AI_CONFIG.API.MODEL;
    if (!model.includes('haiku')) {
      console.error('[Claude] BLOCKED: Attempted to use non-Haiku model:', model);
      throw new Error(
        `COST CONTROL: Only Haiku models are allowed. Attempted to use: ${model}. ` +
        `Haiku costs $420/month for 1000 users, while Sonnet costs $1,260/month (3x more). ` +
        `Change MODEL in src/config/ai.ts back to 'claude-3-5-haiku-20241022'.`
      );
    }

    // Check rate limits
    const rateLimitError = checkRateLimit();
    if (rateLimitError) {
      return rateLimitError;
    }

    // Check cache (unless explicitly skipped)
    if (!options?.skipCache) {
      const cached = getCachedResponse(messages);
      if (cached) {
        console.log('[Claude] Cache hit');
        return { content: cached, usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: 'cached' };
      }
    }

    // Validate API key
    const claudeKey = env.CLAUDE_API_KEY;
    if (!claudeKey || claudeKey === 'YOUR_CLAUDE_API_KEY_HERE') {
      return {
        error: 'Claude API key not configured',
        type: 'invalid_key',
        message: 'Please add your Claude API key to .env file'
      };
    }

    // Get tier limits
    const { aiTier } = useProfileStore.getState().profile;
    const limits = AI_CONFIG.TESTING_MODE
      ? AI_CONFIG.CURRENT_LIMITS
      : aiTier === 'premium'
      ? AI_CONFIG.PREMIUM_TIER
      : AI_CONFIG.FREE_TIER;

    const maxTokens = options?.maxTokens || limits.maxTokensPerResponse;
    const temperature = options?.temperature || AI_CONFIG.API.TEMPERATURE;

    console.log('[Claude] Calling API...', {
      messageCount: messages.length,
      maxTokens,
      tier: aiTier
    });

    // Make API request
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: AI_CONFIG.API.MODEL,
        max_tokens: maxTokens,
        temperature,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 429) {
        return {
          error: 'Rate limit exceeded',
          type: 'rate_limit',
          message: 'Too many requests. Please try again later.'
        };
      }

      if (response.status === 401) {
        return {
          error: 'Invalid API key',
          type: 'invalid_key',
          message: 'Your Claude API key is invalid. Please check your configuration.'
        };
      }

      return {
        error: `API error: ${response.status}`,
        type: 'api_error',
        message: errorData.error?.message || 'An error occurred while calling the API'
      };
    }

    const data = await response.json();

    // Extract response
    const content = data.content?.[0]?.text || '';
    const usage = {
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0
    };

    console.log('[Claude] Response received', {
      tokens: usage,
      cost: calculateCost(usage.input_tokens, usage.output_tokens)
    });

    // Update rate limits
    incrementRateLimit();

    // Cache the response
    cacheResponse(messages, content);

    return {
      content,
      usage,
      stop_reason: data.stop_reason || 'end_turn'
    };

  } catch (error: any) {
    console.error('[Claude] Error:', error);
    return {
      error: 'Network error',
      type: 'network_error',
      message: error.message || 'Failed to connect to Claude API'
    };
  }
}

/**
 * Check if user has exceeded rate limits
 */
function checkRateLimit(): ClaudeError | null {
  if (AI_CONFIG.TESTING_MODE) {
    return null; // No limits in testing mode
  }

  const now = Date.now();
  const { aiTier } = useProfileStore.getState().profile;
  const limits = aiTier === 'premium' ? AI_CONFIG.PREMIUM_TIER : AI_CONFIG.FREE_TIER;

  // Reset counters if expired
  if (now >= rateLimitState.hourly.resetTime) {
    rateLimitState.hourly = { count: 0, resetTime: now + 60 * 60 * 1000 };
  }
  if (now >= rateLimitState.daily.resetTime) {
    rateLimitState.daily = { count: 0, resetTime: now + 24 * 60 * 60 * 1000 };
  }

  // Check limits
  if (rateLimitState.hourly.count >= limits.messagesPerHour) {
    const minutesLeft = Math.ceil((rateLimitState.hourly.resetTime - now) / (60 * 1000));
    return {
      error: 'Hourly limit exceeded',
      type: 'rate_limit',
      message: `You've reached your hourly limit of ${limits.messagesPerHour} messages. Try again in ${minutesLeft} minutes.`
    };
  }

  if (rateLimitState.daily.count >= limits.messagesPerDay) {
    const hoursLeft = Math.ceil((rateLimitState.daily.resetTime - now) / (60 * 60 * 1000));
    return {
      error: 'Daily limit exceeded',
      type: 'rate_limit',
      message: `You've reached your daily limit of ${limits.messagesPerDay} messages. Try again in ${hoursLeft} hours.`
    };
  }

  return null;
}

/**
 * Increment rate limit counters
 */
function incrementRateLimit(): void {
  rateLimitState.hourly.count++;
  rateLimitState.daily.count++;
}

/**
 * Get rate limit status
 */
export function getRateLimitStatus(): {
  hourly: { used: number; limit: number; resetIn: number };
  daily: { used: number; limit: number; resetIn: number };
} {
  const { aiTier } = useProfileStore.getState().profile;
  const limits = AI_CONFIG.TESTING_MODE
    ? AI_CONFIG.CURRENT_LIMITS
    : aiTier === 'premium'
    ? AI_CONFIG.PREMIUM_TIER
    : AI_CONFIG.FREE_TIER;

  const now = Date.now();

  return {
    hourly: {
      used: rateLimitState.hourly.count,
      limit: limits.messagesPerHour,
      resetIn: Math.max(0, rateLimitState.hourly.resetTime - now)
    },
    daily: {
      used: rateLimitState.daily.count,
      limit: limits.messagesPerDay,
      resetIn: Math.max(0, rateLimitState.daily.resetTime - now)
    }
  };
}

/**
 * Generate cache key from messages
 */
function getCacheKey(messages: ClaudeMessage[]): string {
  return JSON.stringify(messages.map(m => ({ role: m.role, content: m.content })));
}

/**
 * Get cached response
 */
function getCachedResponse(messages: ClaudeMessage[]): string | null {
  const key = getCacheKey(messages);
  const cached = cache.get(key);

  if (!cached) return null;

  // Check if cache is expired (1 hour TTL)
  const isExpired = Date.now() - cached.timestamp > AI_CONFIG.API.CACHE_TTL_SECONDS * 1000;
  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return cached.response;
}

/**
 * Cache response
 */
function cacheResponse(messages: ClaudeMessage[], response: string): void {
  const key = getCacheKey(messages);
  cache.set(key, {
    response,
    timestamp: Date.now()
  });

  // Limit cache size to 100 entries
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

/**
 * Clear cache
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Calculate cost in USD
 */
function calculateCost(inputTokens: number, outputTokens: number): string {
  const inputCost = (inputTokens / 1_000_000) * 0.80; // $0.80 per million input tokens
  const outputCost = (outputTokens / 1_000_000) * 4.00; // $4.00 per million output tokens
  const total = inputCost + outputCost;
  return `$${total.toFixed(6)}`;
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  size: number;
  hitRate: number;
} {
  // This is a simplified version - in production you'd track hits/misses
  return {
    size: cache.size,
    hitRate: 0 // Would need to track this separately
  };
}
