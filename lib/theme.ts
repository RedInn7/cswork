'use client';
import { useSyncExternalStore } from 'react';

import {
  THEME_COOKIE,
  THEME_KEY,
  type Theme,
  type ThemePreference,
} from './theme-script';

const listeners = new Set<() => void>();

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Storage blocked: fall back to the cookie the server saw.
  }
  if (typeof document === 'undefined') return 'system';
  const cookie = new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark|system)`).exec(document.cookie);
  return (cookie?.[1] as ThemePreference | undefined) ?? 'system';
}

/** The theme on screen right now (what the inline script applied). */
export function currentTheme(): Theme {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Private mode: the cookie still carries it.
  }
  try {
    document.cookie = `${THEME_COOKIE}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Sandboxed frames have no cookies.
  }
  // The inline script's own apply(), so the page and the first paint agree on the rules.
  (window as { __cswTheme?: () => void }).__cswTheme?.();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readThemePreference, () => 'system');
}
