import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import zh from './locales/zh.json';

const LANGUAGE_KEY = '@fingrow:language';

const resources = {
  en: { translation: en },
  zh: { translation: zh },
};

// Initialize with system language or fallback to English
const initI18n = async () => {
  let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

  // If no saved language, check if we should use system language
  if (!savedLanguage) {
    const systemLanguage = Localization.locale.split('-')[0];
    // Only auto-detect Chinese, otherwise default to English
    savedLanguage = systemLanguage === 'zh' ? 'zh' : 'en';
  }

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'en',
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false,
      },
    });
};

export const changeLanguage = async (language: string) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
  if (i18n.changeLanguage) {
    await i18n.changeLanguage(language);
  }
};

export const getCurrentLanguage = () => i18n.language;

export const isSystemLanguage = async () => {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
  return saved === 'system';
};

export const setSystemLanguage = async () => {
  await AsyncStorage.setItem(LANGUAGE_KEY, 'system');
  const systemLanguage = Localization.locale.split('-')[0];
  const targetLanguage = systemLanguage === 'zh' ? 'zh' : 'en';
  if (i18n.changeLanguage) {
    await i18n.changeLanguage(targetLanguage);
  }
};

initI18n();

export default i18n;
