'use client';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

/**
 * Site language: Simplified Chinese by default, Traditional Chinese or English on request.
 * Traditional is Simplified text converted in the page (lib/traditional.ts), so code keeps
 * one zh string and `Locale` stays 'zh' for it. Problem statements and titles stay
 * English whatever the site language (see problem-workspace.tsx, lib/problems.ts). The choice lives in
 * localStorage; the API learns it from the X-Locale header (see lib/types.ts api()).
 * The cswork_locale cookie mirrors it so app/layout.tsx renders the first HTML in it.
 */
import { asLanguage, htmlLang, languagePath, localeOf, splitLanguagePath, type Language, type Locale } from './language';
export { asLanguage, htmlLang, LANGUAGES, type Language, type Locale } from './language';
const KEY = 'cswork:locale';
const listeners = new Set<() => void>();
// The switch made on this page, so it works even when storage is blocked.
let current: Language | null = null;
// The language the server rendered in: hydration starts from it.
const ServerLanguage = createContext<Language>('zh');

/** The language in the address (/en/oa): on those pages it is the language, whatever was chosen before. */
const pathLanguage = () => (typeof location === 'undefined' ? null : splitLanguagePath(location.pathname).language);

export function readLanguage(): Language {
  if (current) return current;
  const fromPath = pathLanguage();
  if (fromPath) return fromPath;
  try {
    return asLanguage(typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null);
  } catch {
    return 'zh';
  }
}
export function readLocale(): Locale {
  return localeOf(readLanguage());
}
function writeCookie(locale: Language) {
  try {
    document.cookie = `cswork_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Sandboxed frames have no cookies; the server then renders Chinese.
  }
}
function remember(locale: Language) {
  writeCookie(locale);
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    // Private mode: the cookie still carries it.
  }
}
export function setLocale(locale: Language) {
  // On a language URL the switch goes to the same page in the other language.
  if (pathLanguage()) {
    remember(locale);
    const { path } = splitLanguagePath(location.pathname);
    return location.assign(languagePath(locale, path) + location.search + location.hash);
  }
  // Converted text can't be turned back to Simplified in place: leaving Traditional reloads.
  const reload = readLanguage() === 'zh-Hant' && locale !== 'zh-Hant';
  current = locale;
  writeCookie(locale);
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    // Private mode: the switch still applies to this page view.
  }
  if (reload) return location.reload();
  document.documentElement.lang = htmlLang(locale);
  for (const listener of listeners) listener();
}
/** Root layout wrapper; `locale` is what the server read from the cookie. */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Language;
  children: ReactNode;
}) {
  useEffect(() => {
    const chosen = readLanguage();
    // Arriving on a language URL chooses it for the unprefixed pages its links lead to.
    if (pathLanguage()) return remember(chosen);
    // Readers from before the cookie only have localStorage: their next load renders right.
    // Non-default choices are rewritten every load because Safari expires script-set cookies after 7 days.
    if (chosen !== locale || chosen !== 'zh') writeCookie(chosen);
  }, [locale]);
  const language = useSyncExternalStore(subscribe, readLanguage, () => locale);
  useEffect(() => {
    if (language !== 'zh-Hant') return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import('./traditional').then(({ convertPage }) => {
      if (!cancelled) stop = convertPage();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [language]);
  return createElement(ServerLanguage, { value: locale }, children);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useLanguage(): Language {
  const serverLanguage = useContext(ServerLanguage);
  return useSyncExternalStore(subscribe, readLanguage, () => serverLanguage);
}
export function useLocale(): Locale {
  return localeOf(useLanguage());
}
/** t('中文', 'English'): pick the text for the current site language. */
export function useT() {
  const locale = useLocale();
  return useCallback((zh: string, en: string) => (locale === 'zh' ? zh : en), [locale]);
}
