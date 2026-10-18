'use client';
import { useEffect, useRef } from 'react';

/** The code language a reader last picked; the same key as the lesson code tabs. */
export const CODE_LANG_KEY = 'cswork:code-tabs:lang';
/** Sent on window when it changes, so every code group on the page follows. */
export const CODE_LANG_EVENT = 'cswork:code-lang';

export function readCodeLang() {
  try {
    return localStorage.getItem(CODE_LANG_KEY);
  } catch {
    return null;
  }
}
export function saveCodeLang(lang: string) {
  try {
    localStorage.setItem(CODE_LANG_KEY, lang);
  } catch {
    /* Blocked storage: the choice lasts for this page only. */
  }
  window.dispatchEvent(new window.CustomEvent(CODE_LANG_EVENT, { detail: lang }));
}
/** The language an event carries (a string or `{ lang }`), else the stored one. */
export function eventLang(event: Event) {
  const detail = (event as CustomEvent<unknown>).detail;
  if (typeof detail === 'string') return detail;
  const lang = (detail as { lang?: unknown } | null)?.lang;
  return typeof lang === 'string' ? lang : readCodeLang();
}

/**
 * For the element it sits in: opens the remembered language in every `details[data-lang]` group
 * (the server renders Python open) and marks it `data-code-lang`, remembers the language a reader
 * opens, and opens the `details` a `#variant-…` link points at.
 */
export function TemplateLangMemory() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = mark.current?.parentElement;
    if (!root) return;
    const groups = () => [...root.querySelectorAll<HTMLDetailsElement>('details[data-lang]')];
    const apply = (lang: string | null) => {
      const all = groups();
      if (!lang || !all.some((d) => d.dataset.lang === lang)) return;
      root.dataset.codeLang = lang;
      for (const d of all) d.open = d.dataset.lang === lang;
    };
    const openTarget = () => {
      const id = /^#(variant-[a-z0-9-]+)$/.exec(location.hash)?.[1];
      const target = id && document.getElementById(id);
      if (target instanceof HTMLDetailsElement && root.contains(target)) target.open = true;
    };
    // Opening a group's language picks it everywhere; apply()'s own opens match and stop there.
    const onToggle = (event: Event) => {
      const d = event.target;
      if (d instanceof HTMLDetailsElement && d.open && d.dataset.lang && d.dataset.lang !== root.dataset.codeLang)
        saveCodeLang(d.dataset.lang);
    };
    const onLang = (event: Event) => apply(eventLang(event));
    apply(readCodeLang());
    openTarget();
    // toggle does not bubble: listen in the capture phase.
    root.addEventListener('toggle', onToggle, true);
    window.addEventListener(CODE_LANG_EVENT, onLang);
    window.addEventListener('hashchange', openTarget);
    return () => {
      root.removeEventListener('toggle', onToggle, true);
      window.removeEventListener(CODE_LANG_EVENT, onLang);
      window.removeEventListener('hashchange', openTarget);
    };
  }, []);
  return <span ref={mark} hidden />;
}
