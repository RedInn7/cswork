'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
// The AI interviewer's "read aloud" switch, kept per browser.
const SPEAK = 'cswork:mock-interview:speak';
const unchanging = () => () => {};
const engine = () => {
  const w = window as unknown as Record<string, (new () => Recognition) | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * The browser's own speech: reading aloud (speechSynthesis) and dictation (SpeechRecognition,
 * prefixed in Chrome and Safari). Each is reported missing where the browser has none, and on
 * the server, so a server-rendered page shows the buttons after hydration. Used by the AI mock
 * interview and the interview English units (components/english-unit.tsx).
 * `continuous: false` stops listening after one utterance.
 */
export function useSpeech(
  locale: 'zh' | 'en',
  onText: (text: string, ms: number, gap: number) => void,
  { continuous = true }: { continuous?: boolean } = {},
) {
  const lang = locale === 'zh' ? 'zh-CN' : 'en-US';
  const canSpeak = useSyncExternalStore(unchanging, () => typeof speechSynthesis !== 'undefined', () => false);
  const Engine = useSyncExternalStore(unchanging, engine, () => null);
  const [speak, setSpeak] = useState(() => {
    try {
      return localStorage.getItem(SPEAK) === 'true';
    } catch {
      return false;
    }
  });
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const heard = useRef(onText);
  // oxlint-disable-next-line react/react-compiler -- The latest callback, read only in the recognizer's events.
  heard.current = onText;
  useEffect(
    () => () => {
      recognition.current?.stop();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
    [],
  );
  return {
    canSpeak,
    speak,
    toggleSpeak: () => {
      const next = !speak;
      setSpeak(next);
      try {
        localStorage.setItem(SPEAK, JSON.stringify(next));
      } catch {
        // Not saved; the switch still applies on this page.
      }
      if (!next) speechSynthesis.cancel();
    },
    /** Reads `text` aloud when the switch is on, or always with `always` (a "listen" button). */
    say: (text: string, { rate, always = false, onEnd }: { rate?: number; always?: boolean; onEnd?: () => void } = {}) => {
      if (!canSpeak || !(speak || always)) return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      if (rate) utterance.rate = rate;
      if (onEnd) {
        utterance.onend = onEnd;
        // A line that fails (no voice, synthesis-failed) fires error instead of end; a cancelled one was stopped on purpose.
        utterance.onerror = (e) => {
          if (e.error !== 'interrupted' && e.error !== 'canceled') onEnd();
        };
      }
      speechSynthesis.speak(utterance);
    },
    hush: () => {
      if (canSpeak) speechSynthesis.cancel();
    },
    canListen: !!Engine,
    listening,
    toggleListen: () => {
      if (recognition.current) return recognition.current.stop();
      if (!Engine) return;
      const r = new Engine();
      r.lang = lang;
      r.continuous = continuous;
      // Interim results only time when each utterance began; the text is the final one's. Timed per
      // utterance, not per result index: Chrome splits one utterance's interim text over several
      // results and merges them into one final, so an index can outlive its utterance.
      r.interimResults = true;
      let began: number | null = null;
      let lastEnd = 0;
      r.onresult = (e) => {
        const now = Date.now();
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (!e.results[i].isFinal) {
            began ??= now;
            continue;
          }
          const from = began ?? now;
          began = null;
          heard.current(e.results[i][0].transcript.trim(), now - from, lastEnd ? Math.max(0, from - lastEnd) : 0);
          lastEnd = now;
        }
      };
      r.onend = () => {
        recognition.current = null;
        setListening(false);
      };
      recognition.current = r;
      setListening(true);
      try {
        r.start();
      } catch {
        r.onend?.();
      }
    },
  };
}
