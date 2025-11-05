/**
 * Country-specific configurations for global app support
 * Handles retirement systems, tax structures, and regional settings
 */

export type CountryCode = 'SG' | 'MY' | 'US' | 'UK' | 'AU' | 'CA' | 'OTHER';

export type RetirementContribution = {
  employee: number | ((gross: number, age: number) => number);
  employer: number | ((gross: number, age: number) => number);
  ceiling?: number; // Monthly salary ceiling
  limit?: number; // Annual contribution limit
};

export type CountryConfig = {
  code: CountryCode;
  name: string;
  flag: string;
  currency: string;
  investmentCurrency: string; // Suggested investment currency
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';

  retirement: {
    name: string;
    displayName: string;
    enabled: boolean;
    accountTypes: string[];
    contributions?: RetirementContribution;
    note?: string;
  };

  tax?: {
    note?: string;
    // Simple estimation - not meant to be tax advice
    estimator?: (annualGross: number) => number;
  };
};

export const COUNTRY_CONFIGS: Record<CountryCode, CountryConfig> = {
  SG: {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    currency: 'SGD',
    investmentCurrency: 'USD',
    dateFormat: 'DD/MM/YYYY',

    retirement: {
      name: 'CPF',
      displayName: 'Central Provident Fund',
      enabled: true,
      accountTypes: ['Ordinary Account', 'Special Account', 'Medisave Account'],

      contributions: {
        employee: (gross: number, age: number) => {
          if (age <= 55) return 0.20;
          if (age <= 60) return 0.16;
          if (age <= 65) return 0.09;
          return 0.07;
        },
        employer: (gross: number, age: number) => {
          if (age <= 55) return 0.17;
          if (age <= 60) return 0.13;
          if (age <= 65) return 0.09;
          return 0.075;
        },
        ceiling: 6800, // Monthly ordinary wage ceiling
      }
    },

    tax: {
      note: 'Estimated personal income tax only',
      estimator: (annualGross: number) => {
        // Simplified Singapore tax brackets (2024)
        if (annualGross <= 20000) return 0;
        if (annualGross <= 30000) return (annualGross - 20000) * 0.02;
        if (annualGross <= 40000) return 200 + (annualGross - 30000) * 0.035;
        if (annualGross <= 80000) return 550 + (annualGross - 40000) * 0.07;
        if (annualGross <= 120000) return 3350 + (annualGross - 80000) * 0.115;
        if (annualGross <= 160000) return 7950 + (annualGross - 120000) * 0.15;
        if (annualGross <= 200000) return 13950 + (annualGross - 160000) * 0.18;
        if (annualGross <= 240000) return 21150 + (annualGross - 200000) * 0.19;
        if (annualGross <= 280000) return 28750 + (annualGross - 240000) * 0.195;
        if (annualGross <= 320000) return 36550 + (annualGross - 280000) * 0.20;
        return 44550 + (annualGross - 320000) * 0.22;
      }
    }
  },

  MY: {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    currency: 'MYR',
    investmentCurrency: 'USD',
    dateFormat: 'DD/MM/YYYY',

    retirement: {
      name: 'EPF',
      displayName: 'Employees Provident Fund',
      enabled: true,
      accountTypes: ['EPF Account'],

      contributions: {
        employee: 0.11,
        employer: (gross: number) => gross > 5000 ? 0.13 : 0.12,
      }
    },

    tax: {
      note: 'Estimated personal income tax only',
      estimator: (annualGross: number) => {
        // Simplified Malaysia tax brackets
        if (annualGross <= 5000) return 0;
        if (annualGross <= 20000) return (annualGross - 5000) * 0.01;
        if (annualGross <= 35000) return 150 + (annualGross - 20000) * 0.03;
        if (annualGross <= 50000) return 600 + (annualGross - 35000) * 0.08;
        if (annualGross <= 70000) return 1800 + (annualGross - 50000) * 0.13;
        if (annualGross <= 100000) return 4400 + (annualGross - 70000) * 0.21;
        return 10700 + (annualGross - 100000) * 0.24;
      }
    }
  },

  US: {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    currency: 'USD',
    investmentCurrency: 'USD',
    dateFormat: 'MM/DD/YYYY',

    retirement: {
      name: '401(k)',
      displayName: '401(k) / IRA',
      enabled: true,
      accountTypes: ['401(k)', 'Traditional IRA', 'Roth IRA', 'SEP IRA'],

      contributions: {
        employee: 0, // Custom - user enters
        employer: 0, // Custom - usually 3-6% match
        limit: 23000, // 2024 annual limit for 401(k)
      },
      note: 'Contribution rates vary by employer. Enter your specific rates in the income breakdown.'
    },

    tax: {
      note: 'Federal tax estimate only. State and local taxes not included.',
      estimator: (annualGross: number) => {
        // Simplified federal tax - Single filer 2024
        if (annualGross <= 11600) return annualGross * 0.10;
        if (annualGross <= 47150) return 1160 + (annualGross - 11600) * 0.12;
        if (annualGross <= 100525) return 5426 + (annualGross - 47150) * 0.22;
        if (annualGross <= 191950) return 17168.5 + (annualGross - 100525) * 0.24;
        if (annualGross <= 243725) return 39110.5 + (annualGross - 191950) * 0.32;
        if (annualGross <= 609350) return 55678.5 + (annualGross - 243725) * 0.35;
        return 183647.5 + (annualGross - 609350) * 0.37;
      }
    }
  },

  UK: {
    code: 'UK',
    name: 'United Kingdom',
    flag: '🇬🇧',
    currency: 'GBP',
    investmentCurrency: 'GBP',
    dateFormat: 'DD/MM/YYYY',

    retirement: {
      name: 'Pension',
      displayName: 'Workplace Pension',
      enabled: true,
      accountTypes: ['Workplace Pension', 'SIPP', 'Personal Pension'],

      contributions: {
        employee: 0.05, // Minimum under auto-enrollment
        employer: 0.03, // Minimum under auto-enrollment
      },
      note: 'Minimum rates shown. Actual rates may vary by employer.'
    },

    tax: {
      note: 'Estimated income tax and National Insurance',
      estimator: (annualGross: number) => {
        // Simplified UK tax (2024/25 tax year)
        const personalAllowance = 12570;
        const basicRateLimit = 50270;
        const higherRateLimit = 125140;

        let tax = 0;
        if (annualGross > personalAllowance) {
          const basicRate = Math.min(annualGross - personalAllowance, basicRateLimit - personalAllowance);
          tax += basicRate * 0.20;

          if (annualGross > basicRateLimit) {
            const higherRate = Math.min(annualGross - basicRateLimit, higherRateLimit - basicRateLimit);
            tax += higherRate * 0.40;
          }

          if (annualGross > higherRateLimit) {
            tax += (annualGross - higherRateLimit) * 0.45;
          }
        }

        // Add NI (simplified)
        if (annualGross > 12570) {
          tax += Math.min(annualGross - 12570, 50270 - 12570) * 0.12;
          if (annualGross > 50270) {
            tax += (annualGross - 50270) * 0.02;
          }
        }

        return tax;
      }
    }
  },

  AU: {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    currency: 'AUD',
    investmentCurrency: 'AUD',
    dateFormat: 'DD/MM/YYYY',

    retirement: {
      name: 'Super',
      displayName: 'Superannuation',
      enabled: true,
      accountTypes: ['Superannuation Fund', 'SMSF'],

      contributions: {
        employee: 0, // Optional salary sacrifice
        employer: 0.115, // 11.5% mandatory (2024)
      },
      note: 'Employer contribution is mandatory. Employee contributions are optional.'
    },

    tax: {
      note: 'Estimated income tax only (excluding Medicare levy)',
      estimator: (annualGross: number) => {
        // Simplified Australian tax brackets 2024
        if (annualGross <= 18200) return 0;
        if (annualGross <= 45000) return (annualGross - 18200) * 0.19;
        if (annualGross <= 120000) return 5092 + (annualGross - 45000) * 0.325;
        if (annualGross <= 180000) return 29467 + (annualGross - 120000) * 0.37;
        return 51667 + (annualGross - 180000) * 0.45;
      }
    }
  },

  CA: {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    currency: 'CAD',
    investmentCurrency: 'CAD',
    dateFormat: 'DD/MM/YYYY',

    retirement: {
      name: 'RRSP',
      displayName: 'RRSP / Pension',
      enabled: true,
      accountTypes: ['RRSP', 'TFSA', 'Workplace Pension'],

      contributions: {
        employee: 0, // Varies - user enters
        employer: 0, // Varies - user enters
        limit: 31560, // 2024 RRSP limit
      },
      note: 'RRSP contribution limit is 18% of previous year income up to the annual maximum.'
    },

    tax: {
      note: 'Federal tax estimate only. Provincial taxes not included.',
      estimator: (annualGross: number) => {
        // Simplified Canadian federal tax 2024
        if (annualGross <= 55867) return annualGross * 0.15;
        if (annualGross <= 111733) return 8380.05 + (annualGross - 55867) * 0.205;
        if (annualGross <= 173205) return 19829.62 + (annualGross - 111733) * 0.26;
        if (annualGross <= 246752) return 35811.30 + (annualGross - 173205) * 0.29;
        return 57143.52 + (annualGross - 246752) * 0.33;
      }
    }
  },

  OTHER: {
    code: 'OTHER',
    name: 'Other',
    flag: '🌍',
    currency: 'USD',
    investmentCurrency: 'USD',
    dateFormat: 'DD/MM/YYYY',

    retirement: {
      name: 'Retirement',
      displayName: 'Retirement Account',
      enabled: false,
      accountTypes: ['Retirement Account'],
      note: 'Manual entry required. Auto-calculation not available for your country. Help us add your country!'
    },

    tax: {
      note: 'Manual entry required. We don\'t have tax data for your country yet.'
    }
  }
};

export const COUNTRY_OPTIONS = [
  { code: 'SG' as CountryCode, label: '🇸🇬 Singapore' },
  { code: 'MY' as CountryCode, label: '🇲🇾 Malaysia' },
  { code: 'US' as CountryCode, label: '🇺🇸 United States' },
  { code: 'UK' as CountryCode, label: '🇬🇧 United Kingdom' },
  { code: 'AU' as CountryCode, label: '🇦🇺 Australia' },
  { code: 'CA' as CountryCode, label: '🇨🇦 Canada' },
  { code: 'OTHER' as CountryCode, label: '🌍 Other' },
];

export function getCountryConfig(code: CountryCode): CountryConfig {
  return COUNTRY_CONFIGS[code] || COUNTRY_CONFIGS.OTHER;
}

export function calculateRetirementContribution(
  config: CountryConfig,
  monthlyGross: number,
  age: number = 30
): { employee: number; employer: number } {
  if (!config.retirement.enabled || !config.retirement.contributions) {
    return { employee: 0, employer: 0 };
  }

  const { employee, employer, ceiling } = config.retirement.contributions;

  // Apply ceiling if exists
  const applicableGross = ceiling ? Math.min(monthlyGross, ceiling) : monthlyGross;

  // Calculate employee contribution
  let employeeAmount = 0;
  if (typeof employee === 'function') {
    employeeAmount = applicableGross * employee(applicableGross, age);
  } else {
    employeeAmount = applicableGross * employee;
  }

  // Calculate employer contribution
  let employerAmount = 0;
  if (typeof employer === 'function') {
    employerAmount = applicableGross * employer(applicableGross, age);
  } else {
    employerAmount = applicableGross * employer;
  }

  return {
    employee: Math.round(employeeAmount * 100) / 100,
    employer: Math.round(employerAmount * 100) / 100
  };
}

export function estimateMonthlyTax(config: CountryConfig, monthlyGross: number): number {
  if (!config.tax?.estimator) return 0;

  const annualGross = monthlyGross * 12;
  const annualTax = config.tax.estimator(annualGross);

  return Math.round((annualTax / 12) * 100) / 100;
}
