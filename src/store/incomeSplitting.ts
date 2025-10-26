import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  IncomeSplittingConfig,
  IncomeSplit,
  CPFConfig,
  TaxConfig,
  OtherDeduction,
  CPF_RATES_2025,
  AgeBracket,
  SG_TAX_BRACKETS_2025,
  CPFSplitDetail,
} from '../types/incomeSplitting';
import { useAccountsStore } from './accounts';
import { useTxStore } from './transactions';

const STORAGE_KEY = 'fingrow:incomeSplitting:v1';
const HISTORY_STORAGE_KEY = 'fingrow:incomeSplittingHistory:v1';

// Default configuration
const DEFAULT_CPF_CONFIG: CPFConfig = {
  enabled: false,
  ageBracket: '55-below',
  employeeRate: 20,
  employerRate: 17,
  oaRate: 57.5,
  saRate: 17.5,
  maRate: 25,
  employerOaRate: 52.94,
  employerSaRate: 11.76,
  employerMaRate: 23.53,
  monthlyCeiling: 7400,
  annualCeiling: 102000,
  trackEmployer: false,
  paymentDate: 'salary-day',
};

const DEFAULT_TAX_CONFIG: TaxConfig = {
  enabled: false,
  frequency: 'annual',
  monthly: {
    amount: 0,
    deductionDay: 1,
    fromAccount: '',
  },
  annual: {
    estimatedAnnualIncome: 0,
    estimatedTax: 0,
    dueDate: '',
    fromAccount: '',
    reminderDaysBefore: 30,
  },
};

const DEFAULT_CONFIG: IncomeSplittingConfig = {
  enabled: false,
  triggerCategories: ['Salary'],
  cpf: DEFAULT_CPF_CONFIG,
  tax: DEFAULT_TAX_CONFIG,
  otherDeductions: [],
  takeHomeAccountId: '',
};

type State = {
  config: IncomeSplittingConfig;
  splitHistory: IncomeSplit[];
  isLoading: boolean;

  // Actions
  hydrate: () => Promise<void>;
  updateConfig: (partial: Partial<IncomeSplittingConfig>) => Promise<void>;
  updateCPF: (partial: Partial<CPFConfig>) => Promise<void>;
  updateTax: (partial: Partial<TaxConfig>) => Promise<void>;
  addDeduction: (deduction: OtherDeduction) => Promise<void>;
  updateDeduction: (id: string, partial: Partial<OtherDeduction>) => Promise<void>;
  removeDeduction: (id: string) => Promise<void>;

  // Auto-create CPF accounts
  createCPFAccounts: () => Promise<void>;

  // Process income split
  processIncomeSplit: (grossAmount: number, date: Date, category: string, note?: string) => Promise<IncomeSplit | null>;

  // Tax calculations
  calculateAnnualTax: (annualIncome: number) => number;
  estimateMonthlyTax: () => number;

  // Get split history
  getSplitHistory: () => IncomeSplit[];
  getSplitById: (id: string) => IncomeSplit | undefined;

  // CPF utilities
  getCPFRatesForAge: (ageBracket: AgeBracket) => void;
  calculateCPFCeiling: () => { monthlyUsed: number; annualUsed: number; remainingMonthly: number; remainingAnnual: number };

  // Reset
  reset: () => Promise<void>;
};

export const useIncomeSplittingStore = create<State>((set, get) => ({
  config: DEFAULT_CONFIG,
  splitHistory: [],
  isLoading: false,

  hydrate: async () => {
    try {
      set({ isLoading: true });
      const [configJson, historyJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(HISTORY_STORAGE_KEY),
      ]);

      if (configJson) {
        const config = JSON.parse(configJson);
        set({ config });
      }

      if (historyJson) {
        const splitHistory = JSON.parse(historyJson);
        set({ splitHistory });
      }
    } catch (error) {
      console.error('[IncomeSplitting] Hydrate error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  updateConfig: async (partial) => {
    const newConfig = { ...get().config, ...partial, updatedAt: new Date().toISOString() };
    set({ config: newConfig });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  },

  updateCPF: async (partial) => {
    const newCpf = { ...get().config.cpf, ...partial };
    await get().updateConfig({ cpf: newCpf });
  },

  updateTax: async (partial) => {
    const newTax = { ...get().config.tax, ...partial };
    await get().updateConfig({ tax: newTax });
  },

  addDeduction: async (deduction) => {
    const otherDeductions = [...get().config.otherDeductions, deduction];
    await get().updateConfig({ otherDeductions });
  },

  updateDeduction: async (id, partial) => {
    const otherDeductions = get().config.otherDeductions.map((d) =>
      d.id === id ? { ...d, ...partial } : d
    );
    await get().updateConfig({ otherDeductions });
  },

  removeDeduction: async (id) => {
    const otherDeductions = get().config.otherDeductions.filter((d) => d.id !== id);
    await get().updateConfig({ otherDeductions });
  },

  createCPFAccounts: async () => {
    const { config } = get();
    const accountsStore = useAccountsStore.getState();

    // First, migrate any existing CPF accounts from 'savings' to 'retirement'
    const cpfAccountNames = ['CPF Ordinary Account', 'CPF Special Account', 'CPF Medisave'];
    for (const name of cpfAccountNames) {
      const existing = accountsStore.accounts.find((a) => a.name === name);
      if (existing && existing.kind === 'savings') {
        await accountsStore.updateAccount(existing.id, { kind: 'retirement' });
      }
    }

    const accounts = [
      {
        name: 'CPF Ordinary Account',
        kind: 'retirement' as const,
        balance: 0,
        institution: 'CPF Board',
        includeInNetWorth: true,
        note: 'For housing, education, and approved investments',
      },
      {
        name: 'CPF Special Account',
        kind: 'retirement' as const,
        balance: 0,
        institution: 'CPF Board',
        includeInNetWorth: true,
        note: 'For retirement and approved investments',
      },
      {
        name: 'CPF Medisave',
        kind: 'retirement' as const,
        balance: 0,
        institution: 'CPF Board',
        includeInNetWorth: true,
        note: 'For healthcare and approved medical expenses',
      },
    ];

    const accountIds: string[] = [];

    for (const account of accounts) {
      // Check if account already exists
      const existing = accountsStore.accounts.find((a) => a.name === account.name);
      if (!existing) {
        await accountsStore.addAccount(account);
        // Find the newly created account
        const newAccount = accountsStore.accounts.find((a) => a.name === account.name);
        if (newAccount) {
          accountIds.push(newAccount.id);
        }
      } else {
        accountIds.push(existing.id);
      }
    }

    // Update config with account IDs
    await get().updateCPF({
      cpfOaAccountId: accountIds[0],
      cpfSaAccountId: accountIds[1],
      cpfMaAccountId: accountIds[2],
    });
  },

  processIncomeSplit: async (grossAmount, date, category, note) => {
    const { config, splitHistory } = get();

    if (!config.enabled || !config.triggerCategories.includes(category)) {
      return null;
    }

    const accountsStore = useAccountsStore.getState();
    const txStore = useTxStore.getState();

    // Calculate CPF
    let cpf: CPFSplitDetail = {
      employee: { oa: 0, sa: 0, ma: 0, total: 0 },
    };

    if (config.cpf.enabled) {
      const employeeContribution = Math.min(
        (grossAmount * config.cpf.employeeRate) / 100,
        (config.cpf.monthlyCeiling * config.cpf.employeeRate) / 100
      );

      cpf.employee = {
        oa: (employeeContribution * config.cpf.oaRate) / 100,
        sa: (employeeContribution * config.cpf.saRate) / 100,
        ma: (employeeContribution * config.cpf.maRate) / 100,
        total: employeeContribution,
      };

      if (config.cpf.trackEmployer) {
        const employerContribution = Math.min(
          (grossAmount * config.cpf.employerRate) / 100,
          (config.cpf.monthlyCeiling * config.cpf.employerRate) / 100
        );

        cpf.employer = {
          oa: (employerContribution * config.cpf.employerOaRate) / 100,
          sa: (employerContribution * config.cpf.employerSaRate) / 100,
          ma: (employerContribution * config.cpf.employerMaRate) / 100,
          total: employerContribution,
        };
      }
    }

    // Calculate tax
    let tax = 0;
    if (config.tax.enabled && config.tax.frequency === 'monthly') {
      tax = config.tax.monthly.amount;
    }

    // Calculate other deductions
    const otherDeductions = config.otherDeductions
      .filter((d) => d.enabled)
      .map((d) => ({
        name: d.name,
        amount: d.type === 'fixed' ? d.value : (grossAmount * d.value) / 100,
      }));

    const totalOtherDeductions = otherDeductions.reduce((sum, d) => sum + d.amount, 0);

    // Calculate net
    const netAmount = grossAmount - cpf.employee.total - tax - totalOtherDeductions;

    // Create split record
    const split: IncomeSplit = {
      id: `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: date.toISOString(),
      grossAmount,
      cpf,
      tax,
      otherDeductions,
      netAmount,
      transactionIds: [],
      source: category,
      note,
      createdAt: new Date().toISOString(),
    };

    // Create transactions
    const transactionIds: string[] = [];

    // 1. CPF transactions
    if (config.cpf.enabled && config.cpf.cpfOaAccountId && config.cpf.cpfSaAccountId && config.cpf.cpfMaAccountId) {
      // OA transaction
      await txStore.add({
        type: 'income',
        amount: cpf.employee.oa + (cpf.employer?.oa || 0),
        category: 'CPF Contribution',
        date: date.toISOString(),
        note: `CPF OA from ${category}${note ? ` - ${note}` : ''}`,
        account: accountsStore.accounts.find((a) => a.id === config.cpf.cpfOaAccountId)?.name || 'CPF Ordinary Account',
      });
      await accountsStore.updateAccountBalance(
        accountsStore.accounts.find((a) => a.id === config.cpf.cpfOaAccountId)?.name || 'CPF Ordinary Account',
        cpf.employee.oa + (cpf.employer?.oa || 0),
        false
      );

      // SA transaction
      await txStore.add({
        type: 'income',
        amount: cpf.employee.sa + (cpf.employer?.sa || 0),
        category: 'CPF Contribution',
        date: date.toISOString(),
        note: `CPF SA from ${category}${note ? ` - ${note}` : ''}`,
        account: accountsStore.accounts.find((a) => a.id === config.cpf.cpfSaAccountId)?.name || 'CPF Special Account',
      });
      await accountsStore.updateAccountBalance(
        accountsStore.accounts.find((a) => a.id === config.cpf.cpfSaAccountId)?.name || 'CPF Special Account',
        cpf.employee.sa + (cpf.employer?.sa || 0),
        false
      );

      // MA transaction
      await txStore.add({
        type: 'income',
        amount: cpf.employee.ma + (cpf.employer?.ma || 0),
        category: 'CPF Contribution',
        date: date.toISOString(),
        note: `CPF Medisave from ${category}${note ? ` - ${note}` : ''}`,
        account: accountsStore.accounts.find((a) => a.id === config.cpf.cpfMaAccountId)?.name || 'CPF Medisave',
      });
      await accountsStore.updateAccountBalance(
        accountsStore.accounts.find((a) => a.id === config.cpf.cpfMaAccountId)?.name || 'CPF Medisave',
        cpf.employee.ma + (cpf.employer?.ma || 0),
        false
      );
    }

    // 2. Tax transaction (if monthly)
    if (config.tax.enabled && config.tax.frequency === 'monthly' && tax > 0) {
      await txStore.add({
        type: 'expense',
        amount: tax,
        category: 'Income Tax',
        date: date.toISOString(),
        note: `Monthly tax withholding${note ? ` - ${note}` : ''}`,
        account: config.tax.monthly.fromAccount,
      });
      await accountsStore.updateAccountBalance(config.tax.monthly.fromAccount, tax, true);
    }

    // 3. Other deductions
    for (const deduction of otherDeductions) {
      const deductionConfig = config.otherDeductions.find((d) => d.name === deduction.name);
      if (deductionConfig && deduction.amount > 0) {
        await txStore.add({
          type: 'expense',
          amount: deduction.amount,
          category: deductionConfig.category || 'Other Deductions',
          date: date.toISOString(),
          note: `${deduction.name}${note ? ` - ${note}` : ''}`,
          account: deductionConfig.fromAccount || config.takeHomeAccountId,
        });
        await accountsStore.updateAccountBalance(
          deductionConfig.fromAccount || config.takeHomeAccountId,
          deduction.amount,
          true
        );
      }
    }

    // 4. Net salary transaction
    await txStore.add({
      type: 'income',
      amount: netAmount,
      category,
      date: date.toISOString(),
      note: `Net ${category}${note ? ` - ${note}` : ''}`,
      account: accountsStore.accounts.find((a) => a.id === config.takeHomeAccountId)?.name || '',
    });
    await accountsStore.updateAccountBalance(
      accountsStore.accounts.find((a) => a.id === config.takeHomeAccountId)?.name || '',
      netAmount,
      false
    );

    split.transactionIds = transactionIds;

    // Save to history
    const newHistory = [...splitHistory, split];
    set({ splitHistory: newHistory });
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));

    return split;
  },

  calculateAnnualTax: (annualIncome) => {
    let tax = 0;
    for (const bracket of SG_TAX_BRACKETS_2025) {
      if (annualIncome <= bracket.from) break;

      const taxableInBracket = Math.min(annualIncome, bracket.to) - bracket.from + 1;
      tax += (taxableInBracket * bracket.rate) / 100;
    }
    return Math.round(tax * 100) / 100;
  },

  estimateMonthlyTax: () => {
    const { config, splitHistory } = get();

    // Estimate annual income from last 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const recentSplits = splitHistory.filter(
      (s) => new Date(s.date) >= oneYearAgo
    );

    if (recentSplits.length === 0) return 0;

    const totalGross = recentSplits.reduce((sum, s) => sum + s.grossAmount, 0);
    const monthsOfData = recentSplits.length;

    const estimatedAnnual = (totalGross / monthsOfData) * 12;
    const annualTax = get().calculateAnnualTax(estimatedAnnual);

    return Math.round((annualTax / 12) * 100) / 100;
  },

  getSplitHistory: () => get().splitHistory,

  getSplitById: (id) => get().splitHistory.find((s) => s.id === id),

  getCPFRatesForAge: (ageBracket) => {
    const rates = CPF_RATES_2025.find((r) => r.ageBracket === ageBracket);
    if (rates) {
      get().updateCPF({
        ageBracket,
        employeeRate: rates.employeeRate,
        employerRate: rates.employerRate,
        oaRate: rates.oaRate,
        saRate: rates.saRate,
        maRate: rates.maRate,
        employerOaRate: rates.employerOaRate,
        employerSaRate: rates.employerSaRate,
        employerMaRate: rates.employerMaRate,
      });
    }
  },

  calculateCPFCeiling: () => {
    const { config, splitHistory } = get();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Current month
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthSplits = splitHistory.filter(
      (s) => new Date(s.date) >= monthStart && new Date(s.date).getMonth() === currentMonth
    );
    const monthlyUsed = monthSplits.reduce((sum, s) => sum + s.cpf.employee.total, 0);

    // Current year
    const yearStart = new Date(currentYear, 0, 1);
    const yearSplits = splitHistory.filter(
      (s) => new Date(s.date) >= yearStart && new Date(s.date).getFullYear() === currentYear
    );
    const annualUsed = yearSplits.reduce((sum, s) => sum + s.cpf.employee.total, 0);

    return {
      monthlyUsed,
      annualUsed,
      remainingMonthly: Math.max(0, config.cpf.monthlyCeiling - monthlyUsed),
      remainingAnnual: Math.max(0, config.cpf.annualCeiling - annualUsed),
    };
  },

  reset: async () => {
    set({ config: DEFAULT_CONFIG, splitHistory: [] });
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY),
      AsyncStorage.removeItem(HISTORY_STORAGE_KEY),
    ]);
  },
}));
