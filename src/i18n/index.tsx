import React, { createContext, useContext, useState, useEffect } from 'react';
import { th, TranslationKey } from './th';
import { en } from './en';
import { Language } from '../types';

export const translations = { th, en };

export type TranslateFunction = {
  (key: TranslationKey, params?: Record<string, string | number>): string;
  [key: string]: any;
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslateFunction;
  formatCurrency: (amount: number) => string;
  formatDate: (dateStr: string | number | Date) => string;
  formatTime: (dateStr: string | number | Date) => string;
  useBuddhistYear: boolean;
  setUseBuddhistYear: (val: boolean) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('th');
  const [useBuddhistYear, setUseBuddhistYear] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem('tonys_kitchen_lang') as Language;
    if (saved === 'th' || saved === 'en') {
      setLanguageState(saved);
    }
    const savedBy = localStorage.getItem('tonys_kitchen_buddhist_year');
    if (savedBy !== null) {
      setUseBuddhistYear(savedBy === 'true');
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('tonys_kitchen_lang', lang);
  };

  const handleSetUseBuddhistYear = (val: boolean) => {
    setUseBuddhistYear(val);
    localStorage.setItem('tonys_kitchen_buddhist_year', String(val));
  };

  const currentDict = translations[language] || translations.th;

  // Function callable t(key, params) and object accessible t[key]
  const tFunction = ((key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = (currentDict as any)[key] ?? (translations.th as any)[key] ?? String(key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  }) as TranslateFunction;

  // Attach properties for t.propertyName access
  const t = new Proxy(tFunction, {
    get(target, prop: string) {
      if (prop in target) {
        return (target as any)[prop];
      }
      return (currentDict as any)[prop] ?? (translations.th as any)[prop] ?? prop;
    },
  });

  const formatCurrency = (amount: number): string => {
    const val = Number.isFinite(amount) ? amount : 0;
    return `฿${val.toLocaleString(language === 'th' ? 'th-TH' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateInput: string | number | Date): string => {
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);

      if (language === 'th' && useBuddhistYear) {
        const thaiMonths = [
          'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
          'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];
        const day = d.getDate();
        const month = thaiMonths[d.getMonth()];
        const year = d.getFullYear() + 543;
        return `${day} ${month} ${year}`;
      }

      return d.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(dateInput);
    }
  };

  const formatTime = (dateInput: string | number | Date): string => {
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString(language === 'th' ? 'th-TH' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        formatCurrency,
        formatDate,
        formatTime,
        useBuddhistYear,
        setUseBuddhistYear: handleSetUseBuddhistYear,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
