import React from 'react';
import { View, Text } from 'react-native';

// Mapping from currency code to flag emoji
const currencyToFlag: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  AUD: '🇦🇺',
  CAD: '🇨🇦',
  CHF: '🇨🇭',
  CNY: '🇨🇳',
  SEK: '🇸🇪',
  NZD: '🇳🇿',
  SGD: '🇸🇬',
  HKD: '🇭🇰',
  NOK: '🇳🇴',
  KRW: '🇰🇷',
  TRY: '🇹🇷',
  INR: '🇮🇳',
  MXN: '🇲🇽',
  BRL: '🇧🇷',
  ZAR: '🇿🇦',
  RUB: '🇷🇺',
  DKK: '🇩🇰',
  PLN: '🇵🇱',
  TWD: '🇹🇼',
  THB: '🇹🇭',
  MYR: '🇲🇾',
  IDR: '🇮🇩',
  HUF: '🇭🇺',
  CZK: '🇨🇿',
  ILS: '🇮🇱',
  CLP: '🇨🇱',
  PHP: '🇵🇭',
  AED: '🇦🇪',
  COP: '🇨🇴',
  SAR: '🇸🇦',
  VND: '🇻🇳',
  ARS: '🇦🇷',
  EGP: '🇪🇬',
  PKR: '🇵🇰',
  BDT: '🇧🇩',
  NGN: '🇳🇬',
  QAR: '🇶🇦',
  KES: '🇰🇪',
  PEN: '🇵🇪',
  LKR: '🇱🇰',
  MMK: '🇲🇲',
  KHR: '🇰🇭',
  LAK: '🇱🇦',
  BHD: '🇧🇭',
};

type CurrencyFlagProps = {
  currencyCode: string;
  size?: number;
};

export const CurrencyFlag: React.FC<CurrencyFlagProps> = ({ currencyCode, size = 32 }) => {
  const flag = currencyToFlag[currencyCode.toUpperCase()];

  return (
    <Text style={{ fontSize: size }}>
      {flag || '🏳️'}
    </Text>
  );
};
