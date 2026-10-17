/**
 * Jest-style test harness for the frontend JS problems (content/frontend-js/<slug>/tests.js), with
 * no dependencies. One plain script, run in two places: the browser's sandboxed worker
 * (lib/js-runner.ts) and Node's vm (scripts/frontend-js/build.mjs, tests/js-harness.test.ts). The
 * learner's code and the tests follow it in the same script, so it never needs eval.
 *
 * Globals: test, test.public (cases shown on Run), describe, expect, fn, useFakeTimers,
 * useRealTimers, advanceTimersByTime, advanceTimersByTimeAsync, runAllTimers, flushPromises, and
 * __jsHarness.run / .cases / .format / .api for the runner. The runner passes .api to the tests as
 * parameters (lib/js-runner.ts wrapTests), so the learner's own globals can't replace it.
 */
((root) => {
  'use strict';
  const real = {
    setTimeout: root.setTimeout,
    clearTimeout: root.clearTimeout,
    setInterval: root.setInterval,
    clearInterval: root.clearInterval,
    now: root.Date.now,
  };
  // Some tests switch built-ins off; format (console.log's too) must not depend on them.
  const stringify = JSON.stringify;
  const cases = [];
  const scope = [];

  const add = (name, body, open) => cases.push({ name: [...scope, String(name)].join(' › '), body, public: open });
  const test = (name, body) => add(name, body, false);
  test.public = (name, body) => add(name, body, true);
  const describe = (name, body) => {
    scope.push(String(name));
    try {
      body();
    } finally {
      scope.pop();
    }
  };

  // ---------------------------------------------------------------- formatting and equality
  function format(value, seen = []) {
    if (typeof value === 'string') return stringify(value.length > 200 ? `${value.slice(0, 200)}...` : value);
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
    if (typeof value === 'bigint') return `${value}n`;
    if (typeof value === 'symbol') return value.toString();
    if (value === null || typeof value !== 'object') return Object.is(value, -0) ? '-0' : String(value);
    if (seen.includes(value)) return '[Circular]';
    if (seen.length >= 6) return Array.isArray(value) ? '[Array]' : '[Object]';
    const inner = (item) => format(item, [...seen, value]);
    let out;
    if (value instanceof Error) out = `${value.name}: ${value.message}`;
    else if (value instanceof Date) out = Number.isNaN(value.getTime()) ? 'Invalid Date' : `Date(${value.toISOString()})`;
    else if (value instanceof RegExp) out = String(value);
    else if (Array.isArray(value)) out = `[${Array.from(value, inner).join(', ')}]`;
    else if (value instanceof Map) out = `Map {${Array.from(value, ([k, v]) => `${inner(k)} => ${inner(v)}`).join(', ')}}`;
    else if (value instanceof Set) out = `Set {${Array.from(value, inner).join(', ')}}`;
    else if (typeof value.then === 'function') out = 'Promise {}';
    else {
      const proto = Object.getPrototypeOf(value);
      const name = proto && proto !== Object.prototype && proto.constructor ? `${proto.constructor.name} ` : '';
      out = `${name}{${Array.from(Object.keys(value), (key) => `${key}: ${inner(value[key])}`).join(', ')}}`;
    }
    return out.length > 300 ? `${out.slice(0, 297)}...` : out;
  }

  const tag = (value) => Object.prototype.toString.call(value);
  /** Jest's toEqual: recursive, ignores undefined properties and prototypes (not array vs object). */
  function equals(a, b, stack = []) {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || tag(a) !== tag(b)) return false;
    for (const [x, y] of stack) if (x === a) return y === b;
    const eq = (x, y) => equals(x, y, [...stack, [a, b]]);
    if (a instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp) return String(a) === String(b);
    if (a instanceof Error && (a.name !== b.name || a.message !== b.message)) return false;
    if (a instanceof Map) return a.size === b.size && Array.from(a).every(([k, v]) => b.has(k) && eq(v, b.get(k)));
    if (a instanceof Set) return a.size === b.size && Array.from(a).every((x) => b.has(x) || Array.from(b).some((y) => eq(x, y)));
    if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => eq(x, b[i]));
    const keys = (o) =>
      Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort();
    const ka = keys(a);
    const kb = keys(b);
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && eq(a[k], b[k]));
  }

  // ---------------------------------------------------------------- expect
  function fail(message) {
    const error = new Error(message);
    error.name = 'AssertionError';
    throw error;
  }
  function matchers(actual, negate, label) {
    // detail is a function: a large value is formatted only when the check fails.
    const check = (pass, what, detail) => {
      if (pass === negate) fail(`expect(${label})${negate ? '.not' : ''}.${what}\n${detail()}`);
    };
    const calls = () => {
      if (!actual || !Array.isArray(actual.calls)) fail(`expect(${label}): not a mock made with fn()`);
      return actual.calls;
    };
    const exp = (value) => () => `Expected: ${negate ? 'not ' : ''}${format(value)}\nReceived: ${format(actual)}`;
    const got = (prefix = '') => () => `${prefix}Received: ${format(actual)}`;
    return {
      toBe: (expected) => check(Object.is(actual, expected), 'toBe', exp(expected)),
      toEqual: (expected) => check(equals(actual, expected), 'toEqual', exp(expected)),
      toBeCloseTo: (expected, digits = 2) => check(Math.abs(actual - expected) < 10 ** -digits / 2, 'toBeCloseTo', exp(expected)),
      toBeTruthy: () => check(!!actual, 'toBeTruthy', got()),
      toBeFalsy: () => check(!actual, 'toBeFalsy', got()),
      toBeUndefined: () => check(actual === undefined, 'toBeUndefined', got()),
      toBeInstanceOf: (type) => check(actual instanceof type, 'toBeInstanceOf', got(`Expected an instance of ${type.name}\n`)),
      toContain: (item) => check(actual != null && actual.includes(item), 'toContain', exp(item)),
      toHaveLength: (n) => check(actual != null && actual.length === n, 'toHaveLength', got(`Expected length: ${n}\n`)),
      toThrow: (expected) => {
        // Under .rejects the received value is the rejection reason itself.
        let thrown = label === 'rejection';
        let error = actual;
        if (!thrown) {
          if (typeof actual !== 'function') fail('expect(received).toThrow: received is not a function');
          try {
            actual();
          } catch (caught) {
            thrown = true;
            error = caught;
          }
        }
        const message = error && error.message !== undefined ? String(error.message) : String(error);
        const pass =
          thrown &&
          (expected === undefined ||
            (typeof expected === 'string' && message.includes(expected)) ||
            (expected instanceof RegExp && expected.test(message)) ||
            (typeof expected === 'function' && error instanceof expected));
        check(pass, 'toThrow', () =>
          thrown ? `Thrown: ${format(error)}\nExpected: ${negate ? 'not ' : ''}${format(expected)}` : 'Nothing was thrown',
        );
      },
      toHaveBeenCalled: () => check(calls().length > 0, 'toHaveBeenCalled', () => `Calls: ${calls().length}`),
      toHaveBeenCalledTimes: (n) =>
        check(calls().length === n, 'toHaveBeenCalledTimes', () => `Expected calls: ${n}\nReceived calls: ${calls().length}`),
      toHaveBeenCalledWith: (...args) =>
        check(
          calls().some((call) => equals(call, args)),
          'toHaveBeenCalledWith',
          () => `Expected: ${format(args)}\nCalls: ${format(calls())}`,
        ),
      toHaveBeenLastCalledWith: (...args) => {
        const list = calls();
        check(list.length > 0 && equals(list[list.length - 1], args), 'toHaveBeenLastCalledWith', () => `Expected: ${format(args)}\nCalls: ${format(list)}`);
      },
    };
  }
  /** .resolves / .rejects: every matcher waits for the promise, then checks its value or reason. */
  function settled(promise, negate, wantReject) {
    const api = {};
    for (const name of Object.keys(matchers(undefined, false, ''))) {
      api[name] = (...args) =>
        Promise.resolve(promise).then(
          (value) => {
            if (wantReject) fail(`expected the promise to reject, but it resolved to ${format(value)}`);
            matchers(value, negate, 'resolved')[name](...args);
          },
          (reason) => {
            if (!wantReject) fail(`expected the promise to resolve, but it rejected with ${format(reason)}`);
            matchers(reason, negate, 'rejection')[name](...args);
          },
        );
    }
    return api;
  }
  function expect(actual) {
    return {
      ...matchers(actual, false, 'received'),
      not: matchers(actual, true, 'received'),
      resolves: { ...settled(actual, false, false), not: settled(actual, true, false) },
      rejects: { ...settled(actual, false, true), not: settled(actual, true, true) },
    };
  }

  /** A mock function: records each call's arguments (mock.calls) and this (mock.contexts). */
  function fn(impl) {
    const mock = function (...args) {
      mock.calls.push(args);
      mock.contexts.push(this);
      return impl ? impl.apply(this, args) : undefined;
    };
    mock.calls = [];
    mock.contexts = [];
    mock.mockImplementation = (next) => {
      impl = next;
      return mock;
    };
    return mock;
  }

  // ---------------------------------------------------------------- fake timers
  let clock = null;
  const LOOP_LIMIT = 100000;
  const schedule =
    (repeat) =>
    (callback, ms, ...args) => {
      const delay = Math.max(0, Number(ms) || 0);
      const id = ++clock.seq;
      clock.timers.set(id, { id, at: clock.now + delay, every: repeat ? Math.max(1, delay) : 0, callback, args });
      return id;
    };
  const cancel = (id) => clock?.timers.delete(id);
  function useFakeTimers() {
    useRealTimers();
    clock = { now: 1700000000000, seq: 0, timers: new Map() };
    root.setTimeout = schedule(false);
    root.setInterval = schedule(true);
    root.clearTimeout = root.clearInterval = cancel;
    root.Date.now = () => clock.now;
  }
  function useRealTimers() {
    clock = null;
    Object.assign(root, {
      setTimeout: real.setTimeout,
      clearTimeout: real.clearTimeout,
      setInterval: real.setInterval,
      clearInterval: real.clearInterval,
    });
    root.Date.now = real.now;
  }
  const needClock = (what) => {
    if (!clock) throw new Error(`${what}: call useFakeTimers() first`);
  };
  /** The earliest pending timer due by `until` (ties in scheduling order), or null. */
  function nextTimer(until) {
    let best = null;
    for (const timer of clock.timers.values())
      if (timer.at <= until && (!best || timer.at < best.at || (timer.at === best.at && timer.id < best.id))) best = timer;
    return best;
  }
  function fire(timer) {
    clock.now = Math.max(clock.now, timer.at);
    if (timer.every) timer.at += timer.every;
    else clock.timers.delete(timer.id);
    if (typeof timer.callback === 'function') timer.callback(...timer.args);
  }
  function advanceTimersByTime(ms) {
    needClock('advanceTimersByTime');
    const until = clock.now + Math.max(0, ms);
    for (let n = 0, timer; (timer = nextTimer(until)); n++) {
      if (n >= LOOP_LIMIT) throw new Error(`advanceTimersByTime: more than ${LOOP_LIMIT} timers fired`);
      fire(timer);
    }
    clock.now = until;
  }
  function runAllTimers() {
    needClock('runAllTimers');
    for (let n = 0, timer; (timer = nextTimer(Infinity)); n++) {
      if (n >= LOOP_LIMIT) throw new Error(`runAllTimers: more than ${LOOP_LIMIT} timers fired (an interval never cleared?)`);
      fire(timer);
    }
  }
  /** Lets every pending promise callback run: resolves on a real macrotask. */
  const flushPromises = () => new Promise((resolve) => real.setTimeout.call(root, resolve, 0));
  /** advanceTimersByTime that flushes promise callbacks before and after each timer. */
  async function advanceTimersByTimeAsync(ms) {
    needClock('advanceTimersByTimeAsync');
    const until = clock.now + Math.max(0, ms);
    await flushPromises();
    for (let n = 0; clock; n++) {
      const timer = nextTimer(until);
      if (!timer) {
        clock.now = Math.max(clock.now, until);
        break;
      }
      if (n >= LOOP_LIMIT) throw new Error(`advanceTimersByTimeAsync: more than ${LOOP_LIMIT} timers fired`);
      fire(timer);
      await flushPromises();
    }
    await flushPromises();
  }

  // ---------------------------------------------------------------- running
  const describeError = (error) =>
    error && error.message !== undefined ? (error.name === 'AssertionError' ? '' : `${error.name}: `) + error.message : String(error);
  /** Settles to null when body passes, or to its error; an async body gets timeoutMs. */
  function attempt(body, timeoutMs) {
    return new Promise((resolve) => {
      let value;
      try {
        value = body();
      } catch (error) {
        return resolve(error ?? new Error(String(error)));
      }
      if (!value || typeof value.then !== 'function') return resolve(null);
      const timer = real.setTimeout.call(root, () => resolve(new Error(`timed out after ${timeoutMs} ms (a promise that never settles?)`)), timeoutMs);
      value.then(
        () => {
          real.clearTimeout.call(root, timer);
          resolve(null);
        },
        (error) => {
          real.clearTimeout.call(root, timer);
          resolve(error ?? new Error(String(error)));
        },
      );
    });
  }
  /**
   * Runs the registered cases one by one (only the public ones when only === 'public'). Each
   * starts on real timers. report(result) hears every case as it finishes; the promise resolves
   * to all results.
   */
  async function run({ only = 'all', timeoutMs = 1000, report } = {}) {
    const results = [];
    for (const c of cases.filter((item) => only !== 'public' || item.public)) {
      useRealTimers();
      const started = real.now();
      const error = await attempt(c.body, timeoutMs);
      useRealTimers();
      const result = { name: c.name, public: c.public, pass: !error, ms: real.now() - started };
      if (error) result.error = describeError(error);
      results.push(result);
      report?.(result);
    }
    return results;
  }

  const api = { test, it: test, describe, expect, fn, useFakeTimers, useRealTimers, advanceTimersByTime, advanceTimersByTimeAsync, runAllTimers, flushPromises };
  Object.assign(root, {
    ...api,
    // api: what the tests get as parameters (wrapTests), so the learner's globals can't replace it.
    __jsHarness: { run, format, api, cases: () => cases.map((c) => ({ name: c.name, public: c.public })) },
  });
})(globalThis);
