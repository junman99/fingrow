/**
 * Logo.dev API Configuration
 * Get your free API token at: https://logo.dev
 * Free tier: 10,000 requests/month
 */

export const LOGODEV_CONFIG = {
  // Add your Logo.dev API token here
  apiToken: 'pk_V8HXY7DcSSe7jYGeRKW-tA', // TODO: Add your token from logo.dev

  // Cache duration for ticker logos (30 days in milliseconds)
  cacheDuration: 30 * 24 * 60 * 60 * 1000,

  // Base URLs
  tickerLogoUrl: (ticker: string, token: string) =>
    `https://img.logo.dev/ticker/${ticker.toUpperCase()}?token=${token}&size=128`,
};

export const isLogoDevEnabled = () => {
  return LOGODEV_CONFIG.apiToken && LOGODEV_CONFIG.apiToken.length > 0;
};
