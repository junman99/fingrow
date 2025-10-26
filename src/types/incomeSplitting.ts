/**
 * Income Splitting & Paycheck Breakdown Types
 * Handles CPF, tax, and other deductions from gross salary
 */

export type AgeBracket = '55-below' | '56-60' | '61-65' | '66-70' | '70-above' | 'custom';

export type TaxFrequency = 'monthly' | 'annual';

export type CPFConfig = {
  enabled: boolean;
  ageBracket: AgeBracket;

  // Contribution rates (auto-calculated from age bracket or manual)
  employeeRate: number; // e.g., 20 for 20%
  employerRate: number; // e.g., 17 for 17%

  // Account allocation percentages (of employee contribution)
  oaRate: number; // Ordinary Account (e.g., 57.5% of employee contribution)
  saRate: number; // Special Account (e.g., 17.5%)
  maRate: number; // Medisave (e.g., 25%)

  // Employer allocation percentages
  employerOaRate: number;
  employerSaRate: number;
  employerMaRate: number;

  // CPF ceiling
  monthlyCeiling: number; // e.g., 7400 (SGD) as of Jan 2025
  annualCeiling: number; // e.g., 102000 (SGD)

  // Track employer contributions
  trackEmployer: boolean;

  // When CPF is credited (for transaction date)
  paymentDate: 'last-day' | 'first-day' | 'salary-day';

  // Auto-created account IDs (once created, we store references)
  cpfOaAccountId?: string;
  cpfSaAccountId?: string;
  cpfMaAccountId?: string;
};

export type MonthlyTaxConfig = {
  amount: number; // Fixed monthly amount
  deductionDay: number; // 1-31, day of month
  fromAccount: string; // Account ID or name
};

export type AnnualTaxConfig = {
  estimatedAnnualIncome: number; // Auto-calculated from salary history
  estimatedTax: number; // Auto-calculated using IRAS brackets
  manualTaxOverride?: number; // User can override the calculation
  dueDate: string; // ISO date string, e.g., "2026-04-18"
  fromAccount: string; // Account ID or name
  reminderDaysBefore: number; // e.g., 30 days before due date
  taxReserveAccountId?: string; // Optional: dedicated tax reserve account
};

export type TaxConfig = {
  enabled: boolean;
  frequency: TaxFrequency;
  monthly: MonthlyTaxConfig;
  annual: AnnualTaxConfig;
};

export type OtherDeduction = {
  id: string;
  name: string; // e.g., "Company Insurance", "Union Dues"
  type: 'fixed' | 'percentage';
  value: number; // dollar amount or percentage
  enabled: boolean;
  fromAccount?: string; // Optional: specific account to deduct from
  category?: string; // For transaction categorization
};

export type IncomeSplittingConfig = {
  enabled: boolean; // Master toggle for the entire feature

  // Which income category triggers auto-split (default: "Salary")
  triggerCategories: string[]; // e.g., ['Salary', 'Bonus']

  // Recurring paycheck settings
  recurring?: {
    enabled: boolean;
    frequency: 'monthly' | 'biweekly' | 'weekly';
    dayOfMonth?: number; // 1-31 for monthly
    dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
    biweeklyStartDate?: string; // ISO date for biweekly anchor
    amount: number; // Fixed paycheck amount
    autoRecord: boolean; // Automatically create the split on the recurring date
  };

  cpf: CPFConfig;
  tax: TaxConfig;
  otherDeductions: OtherDeduction[];

  // Account to receive net salary
  takeHomeAccountId: string;

  // Last updated timestamp
  updatedAt?: string;
};

export type CPFSplitDetail = {
  employee: {
    oa: number;
    sa: number;
    ma: number;
    total: number;
  };
  employer?: {
    oa: number;
    sa: number;
    ma: number;
    total: number;
  };
};

export type IncomeSplit = {
  id: string;
  date: string; // ISO date string
  grossAmount: number;

  // Breakdown
  cpf: CPFSplitDetail;
  tax: number; // Tax amount deducted (if monthly) or reserved (if annual)
  otherDeductions: Array<{ name: string; amount: number }>;
  netAmount: number;

  // Linked transactions
  transactionIds: string[]; // All created transactions for this split

  // Metadata
  source: string; // Original transaction category, e.g., "Salary"
  note?: string;
  createdAt: string;
};

// Singapore IRAS Tax Brackets (Year of Assessment 2025)
export type TaxBracket = {
  from: number;
  to: number;
  rate: number; // percentage
  fixedAmount: number; // cumulative tax for previous brackets
};

export const SG_TAX_BRACKETS_2025: TaxBracket[] = [
  { from: 0, to: 20000, rate: 0, fixedAmount: 0 },
  { from: 20001, to: 30000, rate: 2, fixedAmount: 0 },
  { from: 30001, to: 40000, rate: 3.5, fixedAmount: 200 },
  { from: 40001, to: 80000, rate: 7, fixedAmount: 550 },
  { from: 80001, to: 120000, rate: 11.5, fixedAmount: 3350 },
  { from: 120001, to: 160000, rate: 15, fixedAmount: 7950 },
  { from: 160001, to: 200000, rate: 18, fixedAmount: 13950 },
  { from: 200001, to: 240000, rate: 19, fixedAmount: 21150 },
  { from: 240001, to: 280000, rate: 19.5, fixedAmount: 28750 },
  { from: 280001, to: 320000, rate: 20, fixedAmount: 36550 },
  { from: 320001, to: 500000, rate: 22, fixedAmount: 44550 },
  { from: 500001, to: 1000000, rate: 23, fixedAmount: 84150 },
  { from: 1000001, to: Infinity, rate: 24, fixedAmount: 199150 },
];

// CPF Rate Tables (2025)
export type CPFRateTable = {
  ageBracket: AgeBracket;
  employeeRate: number;
  employerRate: number;
  oaRate: number; // % of employee contribution
  saRate: number;
  maRate: number;
  employerOaRate: number; // % of employer contribution
  employerSaRate: number;
  employerMaRate: number;
};

export const CPF_RATES_2025: CPFRateTable[] = [
  {
    ageBracket: '55-below',
    employeeRate: 20,
    employerRate: 17,
    oaRate: 57.5, // 11.5% of gross
    saRate: 17.5, // 3.5% of gross
    maRate: 25, // 5% of gross
    employerOaRate: 52.94, // 9% of gross
    employerSaRate: 11.76, // 2% of gross
    employerMaRate: 23.53, // 4% of gross
  },
  {
    ageBracket: '56-60',
    employeeRate: 17,
    employerRate: 15.5,
    oaRate: 44.12, // ~7.5% of gross
    saRate: 14.71, // ~2.5% of gross
    maRate: 41.18, // ~7% of gross
    employerOaRate: 48.39, // ~7.5% of gross
    employerSaRate: 12.90, // ~2% of gross
    employerMaRate: 25.81, // ~4% of gross
  },
  {
    ageBracket: '61-65',
    employeeRate: 11.5,
    employerRate: 12,
    oaRate: 30.43, // ~3.5% of gross
    saRate: 13.04, // ~1.5% of gross
    maRate: 56.52, // ~6.5% of gross
    employerOaRate: 33.33, // ~4% of gross
    employerSaRate: 8.33, // ~1% of gross
    employerMaRate: 25, // ~3% of gross
  },
  {
    ageBracket: '66-70',
    employeeRate: 9,
    employerRate: 10.5,
    oaRate: 22.22, // ~2% of gross
    saRate: 11.11, // ~1% of gross
    maRate: 66.67, // ~6% of gross
    employerOaRate: 28.57, // ~3% of gross
    employerSaRate: 9.52, // ~1% of gross
    employerMaRate: 23.81, // ~2.5% of gross
  },
  {
    ageBracket: '70-above',
    employeeRate: 6.5,
    employerRate: 7.5,
    oaRate: 15.38, // ~1% of gross
    saRate: 7.69, // ~0.5% of gross
    maRate: 76.92, // ~5% of gross
    employerOaRate: 20, // ~1.5% of gross
    employerSaRate: 6.67, // ~0.5% of gross
    employerMaRate: 20, // ~1.5% of gross
  },
];
