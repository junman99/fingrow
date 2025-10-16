export type CurrencyMeta = {
  code: string;
  name: string;
  symbol: string;
  regions?: string[];
};

export const currencies: CurrencyMeta[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', regions: ['United States', 'Global'] },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', regions: ['Singapore'] },
  { code: 'EUR', name: 'Euro', symbol: '€', regions: ['Eurozone'] },
  { code: 'GBP', name: 'British Pound', symbol: '£', regions: ['United Kingdom'] },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', regions: ['Japan'] },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', regions: ['Australia'] },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', regions: ['Canada'] },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', regions: ['Hong Kong'] },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', regions: ['Malaysia'] },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', regions: ['Indonesia'] },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', regions: ['India'] },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', regions: ['China'] },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', regions: ['New Zealand'] },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', regions: ['Switzerland'] },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', regions: ['South Korea'] },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', regions: ['Thailand'] },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', regions: ['Philippines'] },
  { code: 'VND', name: 'Vietnamese Đồng', symbol: '₫', regions: ['Vietnam'] },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', regions: ['Taiwan'] },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', regions: ['Sweden'] },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', regions: ['Norway'] },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', regions: ['Denmark'] },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', regions: ['Brazil'] },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', regions: ['Mexico'] },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', regions: ['South Africa'] },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', regions: ['United Arab Emirates'] },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', regions: ['Saudi Arabia'] },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', regions: ['Bahrain'] },
  { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼', regions: ['Qatar'] },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', regions: ['Turkey'] },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', regions: ['Poland'] },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', regions: ['Hungary'] },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', regions: ['Czech Republic'] },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', regions: ['Argentina'] },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', regions: ['Chile'] },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', regions: ['Colombia'] },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', regions: ['Peru'] },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', regions: ['Nigeria'] },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', regions: ['Kenya'] },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£', regions: ['Egypt'] },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', regions: ['Israel'] },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', regions: ['Pakistan'] },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', regions: ['Bangladesh'] },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', regions: ['Sri Lanka'] },
  { code: 'MMK', name: 'Burmese Kyat', symbol: 'Ks', regions: ['Myanmar'] },
  { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', regions: ['Cambodia'] },
  { code: 'LAK', name: 'Lao Kip', symbol: '₭', regions: ['Laos'] }
];

export function findCurrency(code: string) {
  return currencies.find(c => c.code === code.toUpperCase());
}
