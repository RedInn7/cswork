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
 * Site language: English by default, Chinese on request. The choice lives in
 * localStorage; the API learns it from the X-Locale header (see lib/types.ts api()).
 * The cswork_locale cookie mirrors it so app/layout.tsx renders the first HTML in it.
 */
export type Locale = 'en' | 'zh';
const KEY = 'cswork:locale';
const listeners = new Set<() => void>();
// The switch made on this page, so it works even when storage is blocked.
let current: Locale | null = null;
// The language the server rendered in: hydration starts from it.
const ServerLocale = createContext<Locale>('en');

export function readLocale(): Locale {
  if (current) return current;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}
function writeCookie(locale: Locale) {
  try {
    document.cookie = `cswork_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Sandboxed frames have no cookies; the server then renders English.
  }
}
export function setLocale(locale: Locale) {
  current = locale;
  writeCookie(locale);
  try {
    localStorage.setItem(KEY, locale);
    // Problem statements follow the new site language again (their own toggle is a per-problem pick).
    localStorage.removeItem('cswork:problem:locale');
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
    // Chinese is rewritten every load because Safari expires script-set cookies after 7 days.
    if (chosen !== locale || chosen === 'zh') writeCookie(chosen);
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
