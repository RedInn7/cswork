import Redis from 'ioredis';

/**
 * Wakes web requests waiting on a submission (settleSubmission, waitForSubmission) as soon
 * as the worker commits a state change, in place of reading SQLite every 10ms. The worker
 * publishes the submission id here (oj-worker notify); SQLite stays the source of truth, so
 * a message only says "read again" and a lost one costs at most one fallback poll.
 */
export const VERDICT_CHANNEL = `${process.env.OJ_QUEUE_NAME || 'cswork-judge-v1'}:changed`;
/** Without a live subscription: the old one-read-per-tick polling. */
export const TICK_MS = 10;
/** With one: a backstop read in case a message was lost (a reconnect, a publish that failed). */
export const BACKSTOP_MS = 250;

const waiters = new Map<string, Set<() => void>>();
let subscriber: Redis | undefined;
let live = false;

/** Wakes this process's waiters on the submission; the worker reaches every web process through Redis. */
export function wakeSubmission(id: string) {
  for (const wake of waiters.get(id) ?? []) wake();
}

function subscribe() {
  // The web process gets Redis like judgeReady; OJ_EVENTS_URL may name a subscribe-only user.
  const url = process.env.OJ_EVENTS_URL || process.env.REDIS_URL;
  if (subscriber || !url) return;
  subscriber = new Redis(url, { maxRetriesPerRequest: null, connectTimeout: 5000 });
  subscriber.on('message', (_channel: string, id: string) => wakeSubmission(id));
  // ioredis resubscribes on reconnect before 'ready'; until then waiters poll every tick.
  subscriber.on('ready', () => (live = true));
  subscriber.on('close', () => (live = false));
  subscriber.on('error', () => (live = false));
  subscriber.subscribe(VERDICT_CHANNEL).then(
    () => (live = true),
    () => (live = false),
  );
}

/** How long a waiter may sleep before reading SQLite again. */
export const pollMs = () => (live ? BACKSTOP_MS : TICK_MS);

/**
 * Register before the caller's first read: a change committed between that read and wait()
 * still wakes it. close() in a finally.
 */
export function submissionWaiter(id: string) {
  subscribe();
  let woken = false;
  let release: (() => void) | undefined;
  const wake = () => {
    woken = true;
    release?.();
  };
  let set = waiters.get(id);
  if (!set) waiters.set(id, (set = new Set()));
  set.add(wake);
  return {
    /** Until a change to this submission or `ms`, whichever is first; throws once aborted. */
    async wait(ms: number, signal: AbortSignal) {
      signal.throwIfAborted();
      if (!woken)
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', done);
            release = undefined;
            resolve();
          };
          const timer = setTimeout(done, ms);
          signal.addEventListener('abort', done, { once: true });
          release = done;
        });
      woken = false;
      signal.throwIfAborted();
    },
    close() {
      set.delete(wake);
      if (!set.size) waiters.delete(id);
    },
  };
}
