import { useCallback, useSyncExternalStore } from 'react';

/**
 * Site language: English by default, Chinese on request. The choice lives in
 * localStorage; the API learns it from the X-Locale header (see lib/types.ts api()).
 */
export type Locale = 'en' | 'zh';
const KEY = 'cswork:locale';
const listeners = new Set<() => void>();

export function readLocale(): Locale {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}
export function setLocale(locale: Locale) {
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    // Private mode: the switch still applies to this page view.
  }
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, readLocale, () => 'en');
}
/** t('中文', 'English'): pick the text for the current site language. */
export function useT() {
  const locale = useLocale();
  return useCallback((zh: string, en: string) => (locale === 'zh' ? zh : en), [locale]);
}
