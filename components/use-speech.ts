'use client';

import { useEffect, useSyncExternalStore } from 'react';

const unchanging = () => () => {};

/**
 * Reading aloud with the browser's own speech synthesis, for the glossary and topic pages. It is
 * reported missing where the browser has none, and on the server, so a server-rendered page shows
 * the button after hydration.
 */
export function useSpeech(locale: 'zh' | 'en') {
  const canSpeak = useSyncExternalStore(unchanging, () => typeof speechSynthesis !== 'undefined', () => false);
  useEffect(
    () => () => {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
    [],
  );
  return {
    canSpeak,
    say: (text: string, { rate }: { rate?: number } = {}) => {
      if (!canSpeak) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale === 'zh' ? 'zh-CN' : 'en-US';
      if (rate) utterance.rate = rate;
      speechSynthesis.speak(utterance);
    },
  };
}
