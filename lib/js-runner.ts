/**
 * Runs a frontend JS problem's tests in the browser (practice only: no judge, points or rating).
 * A hidden srcdoc iframe with sandbox="allow-scripts" and no allow-same-origin has an opaque
 * origin, so the code can't read this site's cookies or storage or call its APIs; it owns a blob
 * Worker that runs lib/js-harness.js, the learner's code and the tests as one script. The CSP has
 * no 'unsafe-eval': the code is never eval'd, it is part of the worker's source. The worker posts
 * each case as it finishes; a run still going after timeoutMs is stopped by removing the iframe,
 * which destroys its worker (the parent can't reach the worker itself).
 */

/** The sandbox page's CSP, which its blob worker inherits: no network, no eval, no other scripts. */
export const JS_SANDBOX_CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:";
export const RUN_TIMEOUT_MS = 3000;
export const MAX_LOG_LINES = 200;
/** An async case that hasn't settled after this long fails on its own. */
const CASE_TIMEOUT_MS = 1000;

export type RunScope = 'public' | 'all';
export type CaseResult = { name: string; public: boolean; pass: boolean; error?: string };
export type LogLine = { level: string; text: string };
export type RunResult = {
  /** done: every case reported; timeout: stopped after timeoutMs; error: the script didn't start. */
  status: 'done' | 'timeout' | 'error' | 'stopped';
  cases: CaseResult[];
  /** How many cases the run had, once the tests registered (0 when the script failed first). */
  total: number;
  logs: LogLine[];
  /** A syntax error or a throw at the top level, or 'noworker' when Workers are unavailable. */
  error?: string;
  /** The learner's line for error, when it points into their code. */
  line?: number;
};

// Replaces console in the worker: each call becomes one line for the page, MAX_LOG_LINES at most.
// Array.from, not args.map: array-map's tests switch Array.prototype.map off.
const CONSOLE = `(() => {
  let lines = 0;
  const line = (level) => (...args) => {
    lines += 1;
    if (lines > ${MAX_LOG_LINES + 1}) return;
    const text = lines > ${MAX_LOG_LINES} ? '…' : Array.from(args, (a) => (typeof a === 'string' ? a : __jsHarness.format(a))).join(' ');
    self.postMessage({ type: 'log', level, text });
  };
  self.console = { log: line('log'), info: line('info'), debug: line('debug'), warn: line('warn'), error: line('error'), dir: line('log'), table: line('log') };
})();`;

/**
 * The tests run in their own scope with the harness's API as parameters, so their top-level names
 * (const animal, function own…) can't clash with the learner's and the learner's globals can't
 * replace test or expect. scripts/frontend-js/build.mjs wraps them the same way.
 */
const wrapTests = (tests: string) =>
  `(({ test, it, describe, expect, fn, useFakeTimers, useRealTimers, advanceTimersByTime, advanceTimersByTimeAsync, runAllTimers, flushPromises }) => {\n${tests}\n})(__jsHarness.api);`;

/** The worker's script and where the learner's code starts in it (1-based). */
export function workerSource(harness: string, code: string, tests: string, scope: RunScope) {
  const prelude = `${harness}\n${CONSOLE}\n`;
  const run = `self.postMessage({ type: 'start', total: __jsHarness.cases().filter((c) => ${scope === 'all'} || c.public).length });
__jsHarness
  .run({ only: ${JSON.stringify(scope)}, timeoutMs: ${CASE_TIMEOUT_MS}, report: (result) => self.postMessage({ type: 'case', result }) })
  .then(() => self.postMessage({ type: 'done' }));`;
  return {
    source: `${prelude}${code}\n;\n${wrapTests(tests)}\n${run}\n`,
    firstLine: prelude.split('\n').length,
    codeLines: code.split('\n').length,
  };
}

/**
 * The hidden iframe's page: it starts the worker from the source and relays the worker's messages
 * to the parent. "noworker" means Workers are unavailable; "error" carries an uncaught error.
 */
export function sandboxSource(source: string): string {
  // < keeps the source from closing the <script> early.
  const body = JSON.stringify(source).replace(/</g, '\\u003c');
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${JS_SANDBOX_CSP}"><script>
var worker;
try {
  worker = new Worker(URL.createObjectURL(new Blob([${body}], { type: "text/javascript" })));
} catch (error) {
  parent.postMessage({ type: "noworker" }, "*");
}
if (worker) {
  worker.onmessage = function (event) { parent.postMessage(event.data, "*"); };
  worker.onerror = function (event) {
    event.preventDefault();
    parent.postMessage({ type: "error", message: String(event.message), line: event.lineno }, "*");
  };
}
</script>`;
}

type Message = { type?: unknown; result?: Partial<CaseResult>; level?: unknown; text?: unknown; message?: unknown; line?: unknown; total?: unknown };

/**
 * Starts one run in a fresh sandbox. onUpdate hears the partial result after every message;
 * `done` settles once the run ends (all cases, timeout, an error before the cases, or stop()).
 */
export function runJs({
  harness,
  code,
  tests,
  scope,
  timeoutMs = RUN_TIMEOUT_MS,
  onUpdate,
}: {
  harness: string;
  code: string;
  tests: string;
  scope: RunScope;
  timeoutMs?: number;
  onUpdate?: (partial: RunResult) => void;
}): { done: Promise<RunResult>; stop: () => void } {
  const { source, firstLine, codeLines } = workerSource(harness, code, tests, scope);
  const result: RunResult = { status: 'done', cases: [], total: 0, logs: [] };
  let started = false;
  let settle: (value: RunResult) => void = () => {};
  const done = new Promise<RunResult>((resolve) => (settle = resolve));
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.title = 'JavaScript sandbox';
  frame.hidden = true;
  frame.srcdoc = sandboxSource(source);

  let ended = false;
  const end = (status: RunResult['status'], extra: Partial<RunResult> = {}) => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    window.removeEventListener('message', listen);
    frame.remove();
    settle({ ...result, cases: [...result.cases], logs: [...result.logs], status, ...extra });
  };
  // Messages come from the learner's code too: everything is read as plain strings and numbers.
  const listen = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data as Message | null;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'start') {
      started = true;
      result.total = Number(data.total) || 0;
    } else if (data.type === 'case' && data.result && typeof data.result === 'object') {
      const r = data.result;
      result.cases.push({
        name: String(r.name ?? '').slice(0, 300),
        public: r.public === true,
        pass: r.pass === true,
        ...(r.pass === true ? {} : { error: String(r.error ?? '').slice(0, 2000) }),
      });
    } else if (data.type === 'log') {
      if (result.logs.length <= MAX_LOG_LINES)
        result.logs.push({ level: String(data.level ?? 'log'), text: String(data.text ?? '').slice(0, 2000) });
    } else if (data.type === 'done') return end('done');
    else if (data.type === 'noworker') return end('error', { error: 'noworker' });
    else if (data.type === 'error') {
      const message = String(data.message ?? '').slice(0, 2000);
      const at = Number(data.line);
      const line = at >= firstLine && at < firstLine + codeLines ? at - firstLine + 1 : undefined;
      if (!started) return end('error', { error: message, ...(line ? { line } : {}) });
      if (result.logs.length <= MAX_LOG_LINES) result.logs.push({ level: 'error', text: `Uncaught ${message}` });
    }
    onUpdate?.({ ...result, cases: [...result.cases], logs: [...result.logs] });
  };
  window.addEventListener('message', listen);
  document.body.append(frame);
  const timer = setTimeout(() => end('timeout'), timeoutMs);
  return { done, stop: () => end('stopped') };
}

// ---------------------------------------------------------------- progress in this browser
export const draftKey = (slug: string) => `cswork:fe-js:${slug}`;
/** A member's "done" mark for a problem (user_marks), set after a full pass. */
export const markTarget = (slug: string) => `content:fe-js/${slug}`;
/** Problems this browser has passed in full (slugs), for guests and the /frontend list. */
export const DONE_KEY = 'cswork:fe-js:done';
export function readDone(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}
export function saveDone(slug: string) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...readDone(), slug])]));
  } catch {}
}
