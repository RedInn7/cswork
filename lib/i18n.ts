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
import { asLanguage, htmlLang, type Language, type Locale } from './language';
export { asLanguage, htmlLang, LANGUAGES, type Language, type Locale } from './language';
const KEY = 'cswork:locale';
const listeners = new Set<() => void>();
// The switch made on this page, so it works even when storage is blocked.
let current: Language | null = null;
// The language the server rendered in: hydration starts from it.
const ServerLanguage = createContext<Language>('zh');

export function readLanguage(): Language {
  if (current) return current;
  try {
    return asLanguage(typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null);
  } catch {
    return 'zh';
  }
}
export function readLocale(): Locale {
  return readLanguage() === 'en' ? 'en' : 'zh';
}
function writeCookie(locale: Language) {
  try {
    document.cookie = `cswork_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Sandboxed frames have no cookies; the server then renders Chinese.
  }
}
export function setLocale(locale: Language) {
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
  return useLanguage() === 'en' ? 'en' : 'zh';
}
/** t('中文', 'English'): pick the text for the current site language. */
export function useT() {
  const locale = useLocale();
  return useCallback((zh: string, en: string) => (locale === 'zh' ? zh : en), [locale]);
}
