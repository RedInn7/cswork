/**
 * Jest-style test harness for the frontend JS problems (content/frontend-js/<slug>/tests.js), with
 * no dependencies. One plain script, run in two places: the browser's sandboxed worker
 * (lib/js-runner.ts) and Node's vm (scripts/frontend-js/build.mjs, tests/js-harness.test.ts). The
 * learner's code and the tests follow it in the same script, so it never needs eval.
 *
 * Globals: test, test.public (cases shown on Run), describe, expect, fn, useFakeTimers,
 * useRealTimers, advanceTimersByTime, advanceTimersByTimeAsync, runAllTimers, flushPromises, and
 * __jsHarness.run / __jsHarness.format for the runner.
 */
(function (root) {
  'use strict';
  var real = {
    setTimeout: root.setTimeout,
    clearTimeout: root.clearTimeout,
    setInterval: root.setInterval,
    clearInterval: root.clearInterval,
    now: root.Date.now,
  };
  var cases = [];
  var scope = [];

  function add(name, body, open) {
    cases.push({ name: scope.concat(String(name)).join(' › '), body: body, public: open });
  }
  function test(name, body) {
    add(name, body, false);
  }
  test.public = function (name, body) {
    add(name, body, true);
  };
  function describe(name, body) {
    scope.push(String(name));
    try {
      body();
    } finally {
      scope.pop();
    }
  }

  // ---------------------------------------------------------------- formatting and equality
  function format(value, seen) {
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'function') return '[Function ' + (value.name || 'anonymous') + ']';
    if (typeof value === 'bigint') return value + 'n';
    if (typeof value === 'symbol') return value.toString();
    if (value === null || typeof value !== 'object') return Object.is(value, -0) ? '-0' : String(value);
    seen = seen || [];
    if (seen.indexOf(value) >= 0) return '[Circular]';
    seen = seen.concat([value]);
    var inner = function (item) {
      return format(item, seen);
    };
    var out;
    if (value instanceof Error) out = value.name + ': ' + value.message;
    else if (value instanceof Date) out = isNaN(value) ? 'Invalid Date' : 'Date(' + value.toISOString() + ')';
    else if (value instanceof RegExp) out = String(value);
    else if (Array.isArray(value)) out = '[' + value.map(inner).join(', ') + ']';
    else if (value instanceof Map)
      out = 'Map {' + Array.from(value, function (pair) { return inner(pair[0]) + ' => ' + inner(pair[1]); }).join(', ') + '}';
    else if (value instanceof Set) out = 'Set {' + Array.from(value, inner).join(', ') + '}';
    else if (typeof value.then === 'function') out = 'Promise {}';
    else {
      var proto = Object.getPrototypeOf(value);
      var name = proto && proto !== Object.prototype && proto.constructor ? proto.constructor.name + ' ' : '';
      out = name + '{' + Object.keys(value).map(function (key) { return key + ': ' + inner(value[key]); }).join(', ') + '}';
    }
    return out.length > 300 ? out.slice(0, 297) + '...' : out;
  }

  var tag = function (value) {
    return Object.prototype.toString.call(value);
  };
  /** Jest's toEqual: recursive, ignores undefined properties and prototypes (not array vs object). */
  function equals(a, b, stack) {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || tag(a) !== tag(b)) return false;
    stack = stack || [];
    for (var i = 0; i < stack.length; i++) if (stack[i][0] === a) return stack[i][1] === b;
    stack = stack.concat([[a, b]]);
    var eq = function (x, y) {
      return equals(x, y, stack);
    };
    if (a instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp) return String(a) === String(b);
    if (a instanceof Error && (a.name !== b.name || a.message !== b.message)) return false;
    if (a instanceof Map)
      return a.size === b.size && Array.from(a).every(function (pair) { return b.has(pair[0]) && eq(pair[1], b.get(pair[0])); });
    if (a instanceof Set)
      return a.size === b.size && Array.from(a).every(function (x) { return b.has(x) || Array.from(b).some(function (y) { return eq(x, y); }); });
    if (Array.isArray(a)) return a.length === b.length && a.every(function (x, j) { return eq(x, b[j]); });
    var keys = function (o) {
      return Object.keys(o).filter(function (k) { return o[k] !== undefined; }).sort();
    };
    var ka = keys(a);
    var kb = keys(b);
    return ka.length === kb.length && ka.every(function (k, j) { return k === kb[j] && eq(a[k], b[k]); });
  }

  // ---------------------------------------------------------------- expect
  function fail(message) {
    var error = new Error(message);
    error.name = 'AssertionError';
    throw error;
  }
  function matchers(actual, negate, label) {
    var check = function (pass, what, detail) {
      if (pass === negate) fail('expect(' + label + ')' + (negate ? '.not' : '') + '.' + what + '\n' + detail);
    };
    var calls = function () {
      if (!actual || !Array.isArray(actual.calls)) fail('expect(' + label + '): not a mock made with fn()');
      return actual.calls;
    };
    var exp = function (value) {
      return 'Expected: ' + (negate ? 'not ' : '') + format(value) + '\nReceived: ' + format(actual);
    };
    var api = {
      toBe: function (expected) {
        check(Object.is(actual, expected), 'toBe', exp(expected));
      },
      toEqual: function (expected) {
        check(equals(actual, expected), 'toEqual', exp(expected));
      },
      toBeCloseTo: function (expected, digits) {
        var limit = Math.pow(10, -(digits === undefined ? 2 : digits)) / 2;
        check(Math.abs(actual - expected) < limit, 'toBeCloseTo', exp(expected));
      },
      toBeTruthy: function () {
        check(!!actual, 'toBeTruthy', 'Received: ' + format(actual));
      },
      toBeFalsy: function () {
        check(!actual, 'toBeFalsy', 'Received: ' + format(actual));
      },
      toBeUndefined: function () {
        check(actual === undefined, 'toBeUndefined', 'Received: ' + format(actual));
      },
      toBeInstanceOf: function (type) {
        check(actual instanceof type, 'toBeInstanceOf', 'Expected an instance of ' + type.name + '\nReceived: ' + format(actual));
      },
      toContain: function (item) {
        check(actual != null && actual.indexOf(item) >= 0, 'toContain', exp(item));
      },
      toHaveLength: function (n) {
        check(actual != null && actual.length === n, 'toHaveLength', 'Expected length: ' + n + '\nReceived: ' + format(actual));
      },
      toThrow: function (expected) {
        var thrown = label === 'rejection';
        var error = actual;
        if (!thrown) {
          if (typeof actual !== 'function') fail('expect(received).toThrow: received is not a function');
          try {
            actual();
          } catch (caught) {
            thrown = true;
            error = caught;
          }
        }
        var message = error && error.message !== undefined ? String(error.message) : String(error);
        var pass =
          thrown &&
          (expected === undefined ||
            (typeof expected === 'string' && message.indexOf(expected) >= 0) ||
            (expected instanceof RegExp && expected.test(message)) ||
            (typeof expected === 'function' && error instanceof expected));
        check(pass, 'toThrow', thrown ? 'Thrown: ' + format(error) + '\nExpected: ' + (negate ? 'not ' : '') + format(expected) : 'Nothing was thrown');
      },
      toHaveBeenCalled: function () {
        check(calls().length > 0, 'toHaveBeenCalled', 'Calls: ' + calls().length);
      },
      toHaveBeenCalledTimes: function (n) {
        check(calls().length === n, 'toHaveBeenCalledTimes', 'Expected calls: ' + n + '\nReceived calls: ' + calls().length);
      },
      toHaveBeenCalledWith: function () {
        var args = Array.prototype.slice.call(arguments);
        var pass = calls().some(function (call) { return equals(call, args); });
        check(pass, 'toHaveBeenCalledWith', 'Expected: ' + format(args) + '\nCalls: ' + format(calls()));
      },
      toHaveBeenLastCalledWith: function () {
        var args = Array.prototype.slice.call(arguments);
        var list = calls();
        check(list.length > 0 && equals(list[list.length - 1], args), 'toHaveBeenLastCalledWith', 'Expected: ' + format(args) + '\nCalls: ' + format(list));
      },
    };
    return api;
  }
  /** .resolves / .rejects: every matcher waits for the promise, then checks its value or reason. */
  function settled(promise, negate, wantReject) {
    var names = Object.keys(matchers(undefined, false, ''));
    var api = {};
    names.forEach(function (name) {
      api[name] = function () {
        var args = arguments;
        return Promise.resolve(promise).then(
          function (value) {
            if (wantReject) fail('expected the promise to reject, but it resolved to ' + format(value));
            var m = matchers(value, negate, 'resolved');
            m[name].apply(m, args);
          },
          function (reason) {
            if (!wantReject) fail('expected the promise to resolve, but it rejected with ' + format(reason));
            var m = matchers(reason, negate, 'rejection');
            m[name].apply(m, args);
          },
        );
      };
    });
    return api;
  }
  function expect(actual) {
    var api = matchers(actual, false, 'received');
    api.not = matchers(actual, true, 'received');
    api.resolves = settled(actual, false, false);
    api.rejects = settled(actual, false, true);
    api.resolves.not = settled(actual, true, false);
    api.rejects.not = settled(actual, true, true);
    return api;
  }

  /** A mock function: records each call's arguments (mock.calls) and this (mock.contexts). */
  function fn(impl) {
    var mock = function () {
      var args = Array.prototype.slice.call(arguments);
      mock.calls.push(args);
      mock.contexts.push(this);
      return impl ? impl.apply(this, args) : undefined;
    };
    mock.calls = [];
    mock.contexts = [];
    mock.mockImplementation = function (next) {
      impl = next;
      return mock;
    };
    return mock;
  }

  // ---------------------------------------------------------------- fake timers
  var clock = null;
  var LOOP_LIMIT = 100000;
  function schedule(repeat) {
    return function (callback, ms) {
      var args = Array.prototype.slice.call(arguments, 2);
      var delay = Math.max(0, Number(ms) || 0);
      var id = ++clock.seq;
      clock.timers[id] = { id: id, at: clock.now + delay, every: repeat ? Math.max(1, delay) : 0, callback: callback, args: args };
      return id;
    };
  }
  function cancel(id) {
    if (clock) delete clock.timers[id];
  }
  function useFakeTimers() {
    useRealTimers();
    clock = { now: 1700000000000, seq: 0, timers: {} };
    root.setTimeout = schedule(false);
    root.setInterval = schedule(true);
    root.clearTimeout = root.clearInterval = cancel;
    root.Date.now = function () {
      return clock.now;
    };
  }
  function useRealTimers() {
    clock = null;
    root.setTimeout = real.setTimeout;
    root.clearTimeout = real.clearTimeout;
    root.setInterval = real.setInterval;
    root.clearInterval = real.clearInterval;
    root.Date.now = real.now;
  }
  function needClock(what) {
    if (!clock) throw new Error(what + ': call useFakeTimers() first');
  }
  /** The earliest pending timer due by `until` (ties in scheduling order), or null. */
  function nextTimer(until) {
    var best = null;
    for (var key in clock.timers) {
      var timer = clock.timers[key];
      if (timer.at <= until && (!best || timer.at < best.at || (timer.at === best.at && timer.id < best.id))) best = timer;
    }
    return best;
  }
  function fire(timer) {
    clock.now = Math.max(clock.now, timer.at);
    if (timer.every) timer.at += timer.every;
    else delete clock.timers[timer.id];
    if (typeof timer.callback === 'function') timer.callback.apply(null, timer.args);
  }
  function advanceTimersByTime(ms) {
    needClock('advanceTimersByTime');
    var until = clock.now + Math.max(0, ms);
    for (var n = 0, timer; (timer = nextTimer(until)); n++) {
      if (n >= LOOP_LIMIT) throw new Error('advanceTimersByTime: more than ' + LOOP_LIMIT + ' timers fired');
      fire(timer);
    }
    clock.now = until;
  }
  function runAllTimers() {
    needClock('runAllTimers');
    for (var n = 0, timer; (timer = nextTimer(Infinity)); n++) {
      if (n >= LOOP_LIMIT) throw new Error('runAllTimers: more than ' + LOOP_LIMIT + ' timers fired (an interval never cleared?)');
      fire(timer);
    }
  }
  /** Lets every pending promise callback run: resolves on a real macrotask. */
  function flushPromises() {
    return new Promise(function (resolve) {
      real.setTimeout.call(root, resolve, 0);
    });
  }
  /** advanceTimersByTime that flushes promise callbacks before and after each timer. */
  function advanceTimersByTimeAsync(ms) {
    needClock('advanceTimersByTimeAsync');
    var until = clock.now + Math.max(0, ms);
    var n = 0;
    var step = function () {
      if (!clock) return undefined;
      var timer = nextTimer(until);
      if (!timer) {
        clock.now = Math.max(clock.now, until);
        return flushPromises();
      }
      if (++n > LOOP_LIMIT) throw new Error('advanceTimersByTimeAsync: more than ' + LOOP_LIMIT + ' timers fired');
      fire(timer);
      return flushPromises().then(step);
    };
    return flushPromises().then(step);
  }

  // ---------------------------------------------------------------- running
  /**
   * Runs the registered cases one by one (only the public ones when only === 'public'). Each
   * starts on real timers; an async case gets timeoutMs. report(result) hears every case as it
   * finishes; the promise resolves to all results.
   */
  function run(options) {
    options = options || {};
    var chosen = cases.filter(function (c) {
      return options.only !== 'public' || c.public;
    });
    var results = [];
    var limit = options.timeoutMs || 1000;
    var index = 0;
    var finish = function (c, started, error) {
      useRealTimers();
      var result = { name: c.name, public: c.public, pass: !error, ms: real.now() - started };
      if (error) result.error = error && error.message !== undefined ? (error.name === 'AssertionError' ? '' : error.name + ': ') + error.message : String(error);
      results.push(result);
      if (options.report) options.report(result);
    };
    var next = function () {
      if (index >= chosen.length) return Promise.resolve(results);
      var c = chosen[index++];
      var started = real.now();
      useRealTimers();
      return new Promise(function (resolve) {
        var value;
        try {
          value = c.body();
        } catch (error) {
          return resolve(error || new Error(String(error)));
        }
        if (!value || typeof value.then !== 'function') return resolve(null);
        var timer = real.setTimeout.call(root, function () {
          resolve(new Error('timed out after ' + limit + ' ms (a promise that never settles?)'));
        }, limit);
        value.then(
          function () {
            real.clearTimeout.call(root, timer);
            resolve(null);
          },
          function (error) {
            real.clearTimeout.call(root, timer);
            resolve(error || new Error(String(error)));
          },
        );
      }).then(function (error) {
        finish(c, started, error);
        return next();
      });
    };
    return next();
  }

  root.test = test;
  root.it = test;
  root.describe = describe;
  root.expect = expect;
  root.fn = fn;
  root.useFakeTimers = useFakeTimers;
  root.useRealTimers = useRealTimers;
  root.advanceTimersByTime = advanceTimersByTime;
  root.advanceTimersByTimeAsync = advanceTimersByTimeAsync;
  root.runAllTimers = runAllTimers;
  root.flushPromises = flushPromises;
  root.__jsHarness = {
    run: run,
    format: format,
    cases: function () {
      return cases.map(function (c) {
        return { name: c.name, public: c.public };
      });
    },
  };
})(globalThis);
