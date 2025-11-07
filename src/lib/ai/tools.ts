/**
 * AI Tool Definitions
 * Defines what data Claude can request (but NOT the raw data itself)
 */

export const AI_TOOLS = [
  {
    name: "get_spending_data",
    description: "Get aggregated spending data for a specific date range. Returns total spent, top categories, and transaction count (NO raw transaction details).",
    input_schema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format"
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format"
        },
        category: {
          type: "string",
          description: "Optional category filter: Food, Groceries, Transport, Fuel, Shopping, Entertainment, Bills, Utilities, Health, Fitness, Home, Education, Pets, Travel, Subscriptions, Gifts",
          optional: true
        }
      },
      required: ["start_date", "end_date"]
    }
  },
  {
    name: "search_transactions",
    description: "Search for specific transactions by merchant name, item, or description. Can also list ALL transactions in a category. Returns merchant names with counts (NO amounts). Use when user asks 'what subscriptions?', 'which restaurants?', 'how many times did I buy X?'.",
    input_schema: {
      type: "object",
      properties: {
        search_term: {
          type: "string",
          description: "Merchant name or item to search for (e.g., 'Starbucks', 'pizza', 'toast'). OPTIONAL - if omitted with category, returns ALL merchants in that category.",
          optional: true
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format"
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format"
        },
        category: {
          type: "string",
          description: "Category filter (e.g., 'Subscriptions', 'Food', 'Transport'). When used without search_term, lists ALL merchants in category.",
          optional: true
        }
      },
      required: ["start_date", "end_date"]
    }
  },
  {
    name: "get_portfolio_data",
    description: "Get aggregated portfolio data. Returns total value, total gain/loss, and top holdings (NO raw transaction history).",
    input_schema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Optional stock symbol to filter by (e.g., AAPL, TSLA)",
          optional: true
        }
      }
    }
  },
  {
    name: "get_net_worth_data",
    description: "Get user's current net worth breakdown. Returns total assets, liabilities, and net worth (NO account details).",
    input_schema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_budget_data",
    description: "Get budget status for current month. Returns budget amount, spent amount, and remaining (NO transaction details).",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional category to check budget for",
          optional: true
        }
      }
    }
  },
  {
    name: "get_stock_details",
    description: "Get detailed information about a specific stock holding. Returns purchase history (all lots with dates, prices, quantities), average cost, total shares, current value, gain/loss, and first investment date. Only works for stocks user owns.",
    input_schema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock symbol (e.g., AAPL, TSLA, BTC-USD)"
        }
      },
      required: ["symbol"]
    }
  },
  {
    name: "get_stock_fundamentals",
    description: "Get company fundamentals and market data for a stock. Returns company name, sector, P/E ratio, market cap, dividend yield, 52-week high/low, beta, etc. Only works for stocks in user's watchlist or holdings.",
    input_schema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock symbol (e.g., AAPL, TSLA)"
        }
      },
      required: ["symbol"]
    }
  },
  {
    name: "add_to_watchlist",
    description: "Add a stock to user's watchlist. This will fetch and cache market data for the stock. Ask user which portfolio to add to if they have multiple portfolios.",
    input_schema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock symbol to add (e.g., NVDA, AAPL)"
        },
        portfolio_id: {
          type: "string",
          description: "Portfolio ID to add the stock to. If not provided, adds to active portfolio.",
          optional: true
        }
      },
      required: ["symbol"]
    }
  }
];

export type ToolName = "get_spending_data" | "search_transactions" | "get_portfolio_data" | "get_net_worth_data" | "get_budget_data" | "get_stock_details" | "get_stock_fundamentals" | "add_to_watchlist";

export type ToolInput = {
  get_spending_data: {
    start_date: string;
    end_date: string;
    category?: string;
  };
  search_transactions: {
    search_term?: string;
    start_date: string;
    end_date: string;
    category?: string;
  };
  get_portfolio_data: {
    symbol?: string;
  };
  get_net_worth_data: {};
  get_budget_data: {
    category?: string;
  };
  get_stock_details: {
    symbol: string;
  };
  get_stock_fundamentals: {
    symbol: string;
  };
  add_to_watchlist: {
    symbol: string;
    portfolio_id?: string;
  };
};
