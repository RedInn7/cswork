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
 * Site language: Chinese by default, English on request. Problem statements and titles stay
 * English whatever the site language (see problem-workspace.tsx, lib/problems.ts). The choice lives in
 * localStorage; the API learns it from the X-Locale header (see lib/types.ts api()).
 * The cswork_locale cookie mirrors it so app/layout.tsx renders the first HTML in it.
 */
export type Locale = 'en' | 'zh';
const KEY = 'cswork:locale';
const listeners = new Set<() => void>();
// The switch made on this page, so it works even when storage is blocked.
let current: Locale | null = null;
// The language the server rendered in: hydration starts from it.
const ServerLocale = createContext<Locale>('zh');

export function readLocale(): Locale {
  if (current) return current;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}
function writeCookie(locale: Locale) {
  try {
    document.cookie = `cswork_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Sandboxed frames have no cookies; the server then renders Chinese.
  }
}
export function setLocale(locale: Locale) {
  current = locale;
  writeCookie(locale);
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    // Private mode: the switch still applies to this page view.
  }
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  for (const listener of listeners) listener();
}
/** Root layout wrapper; `locale` is what the server read from the cookie. */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  useEffect(() => {
    const chosen = readLocale();
    // Readers from before the cookie only have localStorage: their next load renders right.
    // English is rewritten every load because Safari expires script-set cookies after 7 days.
    if (chosen !== locale || chosen === 'en') writeCookie(chosen);
  }, [locale]);
  return createElement(ServerLocale, { value: locale }, children);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useLocale(): Locale {
  const serverLocale = useContext(ServerLocale);
  return useSyncExternalStore(subscribe, readLocale, () => serverLocale);
}
/** t('中文', 'English'): pick the text for the current site language. */
export function useT() {
  const locale = useLocale();
  return useCallback((zh: string, en: string) => (locale === 'zh' ? zh : en), [locale]);
}
