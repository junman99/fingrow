/**
 * Tool Executor
 * Executes tools requested by Claude and returns AGGREGATED data only
 * NO RAW DATA is sent to Claude - privacy preserved
 */

import { getSpendingData, getPortfolioData, getNetWorthData, getBudgetData, getStockDetails, getStockFundamentals } from './dataAggregator';
import type { ToolName, ToolInput } from './tools';
import { useInvestStore } from '../../store/invest';

export type ToolResult = {
  tool_use_id: string;
  content: string; // Aggregated summary ONLY
};

/**
 * Execute a tool requested by Claude
 * Returns aggregated summary - NO raw transaction/account data
 */
export function executeTool(
  toolName: ToolName,
  toolInput: any,
  toolUseId: string
): ToolResult {
  console.log('[ToolExecutor] Executing tool:', toolName, 'with input:', toolInput);

  try {
    switch (toolName) {
      case 'get_spending_data': {
        const input = toolInput as ToolInput['get_spending_data'];

        // Convert date strings to Date objects
        const startDate = new Date(input.start_date);
        const endDate = new Date(input.end_date);
        // Set end date to end of day
        endDate.setHours(23, 59, 59, 999);

        // Fetch aggregated data with custom date range (NO raw transactions)
        const data = getSpendingData(input.category, undefined, startDate, endDate);

        return {
          tool_use_id: toolUseId,
          content: data.summary
        };
      }

      case 'search_transactions': {
        const input = toolInput as ToolInput['search_transactions'];

        // Convert date strings to Date objects
        const startDate = new Date(input.start_date);
        const endDate = new Date(input.end_date);
        endDate.setHours(23, 59, 59, 999);

        // Get transactions from store
        const { useTxStore } = require('../../store/transactions');
        const { transactions = [] } = useTxStore.getState();

        // Search for matching transactions
        const searchLower = input.search_term?.toLowerCase() || '';
        const matches = transactions.filter((tx: any) => {
          if (!tx || !tx.date) return false;
          const txDate = new Date(tx.date);
          if (txDate < startDate || txDate > endDate) return false;
          if (input.category && tx.category?.toLowerCase() !== input.category.toLowerCase()) return false;

          // If no search term, match all (when category is provided)
          if (!input.search_term) return true;

          // Search in merchant/note/title fields
          const note = (tx.note || '').toLowerCase();
          const title = (tx.title || '').toLowerCase();

          return note.includes(searchLower) || title.includes(searchLower);
        });

        // Build results
        if (matches.length === 0) {
          const searchDesc = input.search_term ? `for "${input.search_term}"` : `in ${input.category || 'that category'}`;
          return {
            tool_use_id: toolUseId,
            content: `No transactions found ${searchDesc} in the specified date range.`
          };
        }

        // If listing by category (no search term), group by unique merchants
        if (!input.search_term && input.category) {
          const merchantCounts = new Map<string, number>();
          matches.forEach((tx: any) => {
            const merchant = tx.note || tx.title || 'Unknown';
            merchantCounts.set(merchant, (merchantCounts.get(merchant) || 0) + 1);
          });

          const merchantList = Array.from(merchantCounts.entries())
            .map(([merchant, count]) => `${merchant} (${count}x)`)
            .join(', ');

          return {
            tool_use_id: toolUseId,
            content: `Found ${matches.length} ${input.category} transactions: ${merchantList}`
          };
        }

        // For specific search term, return dates, amounts, AND accounts
        console.log('[ToolExecutor] Match details:', matches.map((tx: any) => ({
          note: tx.note,
          amount: tx.amount,
          account: tx.account,
          date: tx.date
        })));

        const details = matches.map((tx: any) => {
          const d = new Date(tx.date);
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          const amount = tx.amount ? `$${Math.abs(tx.amount).toFixed(2)}` : 'unknown amount';
          const account = tx.account ? ` using ${tx.account}` : '';
          return `${dateStr} at ${timeStr} (${amount}${account})`;
        }).join(', ');

        const summary = `Found ${matches.length} transaction${matches.length > 1 ? 's' : ''} for "${input.search_term}": ${details}`;

        return {
          tool_use_id: toolUseId,
          content: summary
        };
      }

      case 'get_portfolio_data': {
        const input = toolInput as ToolInput['get_portfolio_data'];
        const data = getPortfolioData(input.symbol);

        return {
          tool_use_id: toolUseId,
          content: data.summary
        };
      }

      case 'get_net_worth_data': {
        const data = getNetWorthData();

        return {
          tool_use_id: toolUseId,
          content: data.summary
        };
      }

      case 'get_budget_data': {
        const input = toolInput as ToolInput['get_budget_data'];
        const data = getBudgetData(input.category);

        return {
          tool_use_id: toolUseId,
          content: data.summary
        };
      }

      case 'get_stock_details': {
        const input = toolInput as ToolInput['get_stock_details'];
        const data = getStockDetails(input.symbol);

        return {
          tool_use_id: toolUseId,
          content: data.summary
        };
      }

      case 'get_stock_fundamentals': {
        const input = toolInput as ToolInput['get_stock_fundamentals'];
        const data = getStockFundamentals(input.symbol);

        return {
          tool_use_id: toolUseId,
          content: data.summary
        };
      }

      case 'add_to_watchlist': {
        const input = toolInput as ToolInput['add_to_watchlist'];
        const { addWatch, portfolios, activePortfolioId, refreshQuotes } = useInvestStore.getState();

        const symbolUpper = input.symbol.toUpperCase();
        const portfolioId = input.portfolio_id || activePortfolioId;

        if (!portfolioId) {
          return {
            tool_use_id: toolUseId,
            content: 'Error: No active portfolio found. Please select a portfolio first.'
          };
        }

        const portfolio = portfolios[portfolioId];
        if (!portfolio) {
          return {
            tool_use_id: toolUseId,
            content: `Error: Portfolio not found.`
          };
        }

        // Add to watchlist
        addWatch(symbolUpper, { portfolioId }).then(() => {
          // Trigger quote refresh in background
          refreshQuotes([symbolUpper]).catch(err => {
            console.error('[ToolExecutor] Failed to refresh quotes:', err);
          });
        });

        return {
          tool_use_id: toolUseId,
          content: `Added ${symbolUpper} to ${portfolio.name} watchlist. Fetching market data...`
        };
      }

      default:
        return {
          tool_use_id: toolUseId,
          content: `Error: Unknown tool "${toolName}"`
        };
    }
  } catch (error: any) {
    console.error('[ToolExecutor] Error executing tool:', error);
    return {
      tool_use_id: toolUseId,
      content: `Error: ${error.message || 'Tool execution failed'}`
    };
  }
}
