import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { secureStorage } from '@/lib/secureStorage';

import { hiTranslations, localeTags } from './translations';

import type { AppLocale } from './translations';
import type { ReactNode } from 'react';

export const LANGUAGE_KEY = 'nirmaan.language';

type LocalizationContextValue = {
  locale: AppLocale;
  localeTag: string;
  saving: boolean;
  error: string | null;
  setLocale(locale: AppLocale): Promise<void>;
  t(source: string): string;
};

let currentLocale: AppLocale = 'en';

function translate(source: string, locale: AppLocale) {
  if (locale === 'en') return source;
  const exact = hiTranslations[source];
  if (exact) return exact;

  const patterns: [RegExp, (...matches: string[]) => string][] = [
    [
      /^(\d+) (minute|minutes|hour|hours|day|days) ago$/,
      (_all, count, unit) => {
        const label = unit.startsWith('minute')
          ? 'मिनट'
          : unit.startsWith('hour')
            ? 'घंटे'
            : 'दिन';
        return `${count} ${label} पहले`;
      },
    ],
    [
      /^Timeline\. Planned (.+) to (.+)\.(?: Baseline (.+) to (.+)\.)?(?: Accepted (.+) to (.+)\.| Accepted start not recorded\.)?$/,
      (
        _all,
        plannedStart,
        plannedFinish,
        baselineStart,
        baselineFinish,
        actualStart,
        actualFinish,
      ) =>
        `समयरेखा। नियोजित ${plannedStart} से ${plannedFinish}।${baselineStart ? ` बेसलाइन ${baselineStart} से ${baselineFinish}।` : ''}${actualStart ? ` स्वीकृत ${actualStart} से ${actualFinish}।` : ' स्वीकृत शुरुआत दर्ज नहीं है।'}`,
    ],
    [
      /^(Hide|Show) schedule details for (.+)$/,
      (_all, action, id) =>
        `${action === 'Hide' ? 'छिपाएँ' : 'दिखाएँ'} ${id} का कार्यक्रम विवरण`,
    ],
    [
      /^(.+): (\d+) of (\d+) activities complete$/,
      (_all, discipline, complete, planned) =>
        `${discipline}: ${planned} में से ${complete} गतिविधियाँ पूर्ण`,
    ],
    [/^Filter history to (.+)$/, (_all, id) => `इतिहास को ${id} तक सीमित करें`],
    [
      /^(Hide|Show) audit references for (.+)$/,
      (_all, action, id) =>
        `${id} के ऑडिट संदर्भ ${action === 'Hide' ? 'छिपाएँ' : 'दिखाएँ'}`,
    ],
    [
      /^Activity (.+) is unavailable in the active schedule$/,
      (_all, id) => `गतिविधि ${id} सक्रिय कार्यक्रम में उपलब्ध नहीं है`,
    ],
    [/^Activity (.+)$/, (_all, id) => `गतिविधि ${id}`],
    [/^Recorded reply: (.+)$/, (_all, reply) => `दर्ज उत्तर: ${reply}`],
    [/^Match score (.+)$/, (_all, score) => `मिलान स्कोर ${score}`],
    [/^Language (.+)$/, (_all, language) => `भाषा ${language}`],
    [/^Voice level (\d+)%$/, (_all, level) => `आवाज़ का स्तर ${level}%`],
    [
      /^Edit caption for photo (\d+)$/,
      (_all, position) => `फ़ोटो ${position} का विवरण संपादित करें`,
    ],
    [
      /^Open original (audio|photo|evidence): (.+)$/,
      (_all, kind, file) =>
        `मूल ${kind === 'audio' ? 'ऑडियो' : kind === 'photo' ? 'फ़ोटो' : 'साक्ष्य'} खोलें: ${file}`,
    ],
    [/^Quantity: (.+)$/, (_all, quantity) => `मात्रा: ${quantity}`],
    [/^Select (.+)$/, (_all, project) => `${project} चुनें`],
    [/^Selected photo (\d+)$/, (_all, position) => `चयनित फ़ोटो ${position}`],
    [
      /^Caption for photo (\d+)$/,
      (_all, position) => `फ़ोटो ${position} का विवरण`,
    ],
    [/^(\d+) (file|files)$/, (_all, count) => `${count} फ़ाइल`],
    [
      /^(.+) Your entered details remain here\.$/,
      (_all, error) =>
        `${translate(error, locale)} आपके दर्ज किए गए विवरण यहीं सुरक्षित हैं।`,
    ],
  ];
  for (const [pattern, replacement] of patterns) {
    const match = source.match(pattern);
    if (match) return replacement(...match);
  }
  return source;
}

const defaultValue: LocalizationContextValue = {
  locale: 'en',
  localeTag: localeTags.en,
  saving: false,
  error: null,
  async setLocale() {},
  t(source) {
    return source;
  },
};

const LocalizationContext = createContext(defaultValue);

export function isAppLocale(value: string | null): value is AppLocale {
  return value === 'en' || value === 'hi';
}

export function getActiveLocaleTag() {
  return localeTags[currentLocale];
}

export function translateText(source: string, locale = currentLocale) {
  return translate(source, locale);
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('en');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    currentLocale = 'en';
    void secureStorage
      .getItem(LANGUAGE_KEY)
      .then((stored) => {
        if (active && isAppLocale(stored)) {
          currentLocale = stored;
          setLocaleState(stored);
        }
      })
      .catch(() => {
        // English remains a safe, usable fallback when preference storage fails.
        currentLocale = 'en';
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      locale,
      localeTag: localeTags[locale],
      saving,
      error,
      async setLocale(nextLocale) {
        if (nextLocale === locale || saving) return;
        setSaving(true);
        setError(null);
        try {
          await secureStorage.setItem(LANGUAGE_KEY, nextLocale);
          currentLocale = nextLocale;
          setLocaleState(nextLocale);
        } catch {
          setError(
            translate(
              'Language preference could not be saved. Try again.',
              locale,
            ),
          );
        } finally {
          setSaving(false);
        }
      },
      t(source) {
        return translate(source, locale);
      },
    }),
    [error, locale, saving],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  return useContext(LocalizationContext);
}
