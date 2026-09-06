'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { CodingMode } from '@/lib/coding-mode';
import type { Language } from '@/lib/problems';
import { ojRequest } from '@/lib/oj-client';

type IdlePrecompileOptions = {
  enabled: boolean;
  userId: string;
  problemId: string;
  language: Language;
  codingMode: CodingMode;
  code: string;
  template: string;
};

const IDLE_MS = 2500;
const REQUEST_INTERVAL_MS = 12000;
const QUEUED_REMEMBER_MS = 30000;
const CACHED_REMEMBER_MS = 4 * 60 * 1000;
const REMEMBER_LIMIT = 8;
// Keep the request budget when navigating between problem workspaces in the
// same page. Only timestamps are shared; draft text stays inside each hook.
const attemptsByPage = new WeakMap<Document, Map<string, number>>();

// Only used to avoid compiling an untouched/comment-only template. The request
// always sends the exact editor text; this never transforms submitted code.
function comparable(code: string) {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/\s+/g, '');
}

/** Quietly warm the compiler cache; never run code or create a submission. */
export function useIdlePrecompile({
  enabled,
  userId,
  problemId,
  language,
  codingMode,
  code,
  template,
}: IdlePrecompileOptions) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const remembered = useRef(new Map<string, number>());
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    request.current?.abort();
    request.current = null;
  }, []);

  useEffect(() => {
    const meaningful = comparable(code);
    if (
      !enabled ||
      !userId ||
      userId === 'guest' ||
      language === 'python' ||
      !meaningful ||
      meaningful === comparable(template)
    ) {
      cancel();
      return;
    }
    const key = JSON.stringify([userId, problemId, language, codingMode, code]);
    let attempts = attemptsByPage.get(document);
    if (!attempts) {
      attempts = new Map<string, number>();
      attemptsByPage.set(document, attempts);
    }
    const lastAttempts = attempts;
    const schedule = () => {
      cancel();
      if (document.visibilityState !== 'visible') return;
      const until = remembered.current.get(key);
      if (until !== undefined && until > Date.now()) return;
      remembered.current.delete(key);
      const send = () => {
        timer.current = null;
        if (document.visibilityState !== 'visible') return;
        const lastAttempt = lastAttempts.get(userId);
        const wait =
          lastAttempt === undefined
            ? 0
            : lastAttempt + REQUEST_INTERVAL_MS - Date.now();
        if (wait > 0) {
          timer.current = setTimeout(send, wait);
          return;
        }
        // Count attempts, including aborted/rate-limited requests, against the
        // local budget. A later edit replaces this timer with the latest draft.
        lastAttempts.delete(userId);
        lastAttempts.set(userId, Date.now());
        while (lastAttempts.size > REMEMBER_LIMIT) {
          const oldest = lastAttempts.keys().next().value;
          if (oldest !== undefined) lastAttempts.delete(oldest);
        }
        const controller = new AbortController();
        request.current = controller;
        void ojRequest<{ status: 'queued' | 'cached' | 'skipped' }>(
          'precompile',
          { problemId, language, code, codingMode },
          controller.signal,
        )
          .then((result) => {
            if (
              controller.signal.aborted ||
              (result.status !== 'queued' && result.status !== 'cached')
            )
              return;
            remembered.current.delete(key);
            remembered.current.set(
              key,
              Date.now() +
                (result.status === 'cached'
                  ? CACHED_REMEMBER_MS
                  : QUEUED_REMEMBER_MS),
            );
            while (remembered.current.size > REMEMBER_LIMIT) {
              const oldest = remembered.current.keys().next().value;
              if (oldest !== undefined) remembered.current.delete(oldest);
            }
          })
          .catch(() => {
            // Optional acceleration: a rejection, rate limit or unavailable
            // worker must not interrupt editing or cause a background retry loop.
          })
          .finally(() => {
            if (request.current === controller) request.current = null;
          });
      };
      const lastAttempt = lastAttempts.get(userId);
      const delay = Math.max(
        IDLE_MS,
        lastAttempt === undefined
          ? 0
          : lastAttempt + REQUEST_INTERVAL_MS - Date.now(),
      );
      timer.current = setTimeout(send, delay);
    };
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
      document.removeEventListener('visibilitychange', schedule);
      cancel();
    };
  }, [
    enabled,
    userId,
    problemId,
    language,
    codingMode,
    code,
    template,
    cancel,
  ]);

  // Call synchronously before a foreground run/submit, without waiting for the
  // pending-state render. Aborting a request does not cancel a server submission.
  return cancel;
}
