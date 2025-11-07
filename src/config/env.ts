/**
 * Environment Configuration
 *
 * This file provides a secure way to access API keys and secrets.
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a .env file in the project root (it's already in .gitignore)
 * 2. Add your API keys to .env:
 *    FMP_API_KEY=your_new_fmp_key_here
 *    CLAUDE_API_KEY=your_new_claude_key_here
 * 3. NEVER commit the .env file to git
 */

import Constants from 'expo-constants';

/**
 * Type-safe environment variables
 */
interface EnvironmentConfig {
  FMP_API_KEY: string;
  CLAUDE_API_KEY: string;
  OPENAI_API_KEY: string;
  FINNHUB_API_KEY?: string; // Optional - user may not have Finnhub
}

/**
 * Get environment variable with fallback and validation
 */
function getEnvVar(key: keyof EnvironmentConfig, required: boolean = true): string | undefined {
  // Try expo-constants first (for EAS builds and expo environment)
  const expoValue = Constants.expoConfig?.extra?.[key];
  if (expoValue && typeof expoValue === 'string') {
    return expoValue;
  }

  // Fallback to process.env (for local development)
  const processValue = process.env[key];
  if (processValue && typeof processValue === 'string') {
    return processValue;
  }

  // If no value found and required, throw a helpful error
  if (required) {
    throw new Error(
      `Missing required environment variable: ${key}\n\n` +
      `Please create a .env file in the project root and add:\n` +
      `${key}=your_${key.toLowerCase()}_here\n\n` +
      `For local development, run: npx expo start --clear\n` +
      `For EAS builds, add to eas.json env section.`
    );
  }

  return undefined;
}

/**
 * Validate that a key looks correct (basic sanity check)
 */
function validateKey(key: string, keyName: string, expectedPrefix?: string): void {
  if (key.length < 10) {
    console.warn(`Warning: ${keyName} looks too short. Please verify it's correct.`);
  }

  if (expectedPrefix && !key.startsWith(expectedPrefix)) {
    console.warn(
      `Warning: ${keyName} doesn't start with expected prefix "${expectedPrefix}". ` +
      `Please verify it's correct.`
    );
  }
}

/**
 * Environment configuration with lazy loading and validation
 */
class Environment {
  private _fmpApiKey: string | null = null;
  private _claudeApiKey: string | null = null;
  private _openaiApiKey: string | null = null;
  private _finnhubApiKey: string | null | undefined = undefined; // undefined = not loaded yet, null = not provided

  get FMP_API_KEY(): string {
    if (!this._fmpApiKey) {
      this._fmpApiKey = getEnvVar('FMP_API_KEY')!;
      validateKey(this._fmpApiKey, 'FMP_API_KEY');
    }
    return this._fmpApiKey;
  }

  get CLAUDE_API_KEY(): string {
    if (!this._claudeApiKey) {
      this._claudeApiKey = getEnvVar('CLAUDE_API_KEY')!;
      validateKey(this._claudeApiKey, 'CLAUDE_API_KEY', 'sk-ant-');
    }
    return this._claudeApiKey;
  }

  get OPENAI_API_KEY(): string {
    if (!this._openaiApiKey) {
      this._openaiApiKey = getEnvVar('OPENAI_API_KEY')!;
      validateKey(this._openaiApiKey, 'OPENAI_API_KEY', 'sk-');
    }
    return this._openaiApiKey;
  }

  get FINNHUB_API_KEY(): string | null {
    if (this._finnhubApiKey === undefined) {
      const key = getEnvVar('FINNHUB_API_KEY', false); // Optional key
      this._finnhubApiKey = key || null;
      if (this._finnhubApiKey) {
        validateKey(this._finnhubApiKey, 'FINNHUB_API_KEY');
      }
    }
    return this._finnhubApiKey;
  }

  /**
   * Check if all required environment variables are available
   * Use this for early validation on app startup
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Access each key to trigger validation
      this.FMP_API_KEY;
    } catch (error) {
      errors.push(`FMP_API_KEY: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      this.CLAUDE_API_KEY;
    } catch (error) {
      errors.push(`CLAUDE_API_KEY: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      this.OPENAI_API_KEY;
    } catch (error) {
      errors.push(`OPENAI_API_KEY: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get a sanitized version of keys for logging (shows only first/last 4 chars)
   */
  getSanitizedKeys(): Record<string, string> {
    const sanitize = (key: string): string => {
      if (key.length < 12) return '***';
      return `${key.slice(0, 4)}...${key.slice(-4)}`;
    };

    return {
      FMP_API_KEY: this._fmpApiKey ? sanitize(this._fmpApiKey) : 'not loaded',
      CLAUDE_API_KEY: this._claudeApiKey ? sanitize(this._claudeApiKey) : 'not loaded',
      OPENAI_API_KEY: this._openaiApiKey ? sanitize(this._openaiApiKey) : 'not loaded',
      FINNHUB_API_KEY: this._finnhubApiKey ? sanitize(this._finnhubApiKey) : 'not provided',
    };
  }
}

/**
 * Singleton instance
 */
export const env = new Environment();

/**
 * Optional: Validate environment on app startup
 * Call this in App.tsx or index.tsx to catch configuration errors early
 */
export function validateEnvironment(): void {
  const result = env.validate();

  if (!result.valid) {
    console.error('❌ Environment validation failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Environment configuration is invalid. Please check your .env file.');
  }

  console.log('✅ Environment validation passed');
  console.log('   Keys loaded:', env.getSanitizedKeys());
}
