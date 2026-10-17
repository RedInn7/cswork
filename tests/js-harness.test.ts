// lib/js-harness.js, the frontend JS problems' test harness, in Node's vm as the build runs it:
// matchers and deep equality, the fake clock, async cases and per-case timeouts, public filtering.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const harness = readFileSync('lib/js-harness.js', 'utf8');
type Result = { name: string; public: boolean; pass: boolean; error?: string };
type Harness = { run(options?: object): Promise<Result[]>; cases(): { name: string; public: boolean }[]; format(v: unknown): string };

/** Registers `tests` after the harness in a fresh context and runs them. */
async function run(tests: string, options: object = {}) {
  const context = vm.createContext({ setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(`${harness}\n${tests}`, context);
  const h = context.__jsHarness as Harness;
  const results = await h.run({ timeoutMs: 200, ...options });
  return { results, byName: Object.fromEntries(results.map((r) => [r.name, r])), harness: h, context };
}

test('matchers pass and fail with readable messages', async () => {
  const { byName } = await run(`
    test('toBe', () => { expect(1 + 1).toBe(2); expect(NaN).toBe(NaN); expect(0).not.toBe(-0); });
    test('toBe fails', () => { expect('a').toBe('b'); });
    test('toThrow', () => {
      expect(() => { throw new TypeError('bad input'); }).toThrow(TypeError);
      expect(() => { throw new Error('bad input'); }).toThrow('bad');
      expect(() => { throw new Error('bad input'); }).toThrow(/input$/);
      expect(() => 1).not.toThrow();
    });
    test('toThrow fails when nothing throws', () => { expect(() => 1).toThrow(); });
    test('closeTo and friends', () => {
      expect(0.1 + 0.2).toBeCloseTo(0.3);
      expect(1.004).not.toBeCloseTo(1.02, 2);
      expect([1, 2]).toHaveLength(2);
      expect('abc').toContain('b');
      expect(undefined).toBeUndefined();
      expect('x').toBeTruthy();
      expect(0).toBeFalsy();
      expect([]).toBeInstanceOf(Array);
    });
  `);
  assert.equal(byName.toBe.pass, true);
  assert.equal(byName['toBe fails'].error, 'expect(received).toBe\nExpected: "b"\nReceived: "a"');
  assert.equal(byName.toThrow.pass, true);
  assert.equal(byName['toThrow fails when nothing throws'].error, 'expect(received).toThrow\nNothing was thrown');
  assert.equal(byName['closeTo and friends'].pass, true, byName['closeTo and friends'].error);
});

test('toEqual compares deeply, like Jest', async () => {
  const { byName } = await run(`
    test('equal', () => {
      expect({ a: [1, { b: 2 }], c: undefined }).toEqual({ a: [1, { b: 2 }] });
      expect(new Map([[1, { x: 1 }]])).toEqual(new Map([[1, { x: 1 }]]));
      expect(new Set([1, 2])).toEqual(new Set([2, 1]));
      expect(new Date(5)).toEqual(new Date(5));
      expect([NaN]).toEqual([NaN]);
      const a = { name: 'a' }; a.self = a;
      const b = { name: 'a' }; b.self = b;
      expect(a).toEqual(b);
    });
    test('array is not object', () => { expect([1]).toEqual({ 0: 1 }); });
    test('different nested value', () => { expect({ a: { b: 1 } }).toEqual({ a: { b: 2 } }); });
    test('not', () => { expect({ a: 1 }).not.toEqual({ a: 1, b: 2 }); expect(new Date(1)).not.toEqual(new Date(2)); });
  `);
  assert.equal(byName.equal.pass, true, byName.equal.error);
  assert.equal(byName['array is not object'].pass, false);
  assert.match(byName['different nested value'].error!, /Expected: \{a: \{b: 2\}\}\nReceived: \{a: \{b: 1\}\}/);
  assert.equal(byName.not.pass, true);
});

test('mocks record calls and this', async () => {
  const { byName } = await run(`
    test('mock', () => {
      const spy = fn((a, b) => a + b);
      const obj = { spy };
      expect(obj.spy(1, 2)).toBe(3);
      spy('x');
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(1, 2);
      expect(spy).toHaveBeenLastCalledWith('x');
      expect(spy.contexts[0]).toBe(obj);
      expect(spy.calls).toEqual([[1, 2], ['x']]);
    });
    test('not a mock', () => { expect(() => {}).toHaveBeenCalled(); });
  `);
  assert.equal(byName.mock.pass, true, byName.mock.error);
  assert.match(byName['not a mock'].error!, /not a mock made with fn\(\)/);
});

test('the fake clock drives timers and Date.now, and each case starts on real timers', async () => {
  const { byName, context } = await run(`
    test('timeouts in order', () => {
      useFakeTimers();
      const order = [];
      const start = Date.now();
      setTimeout(() => order.push('b'), 20);
      setTimeout(() => order.push('a'), 10);
      const gone = setTimeout(() => order.push('never'), 15);
      clearTimeout(gone);
      setTimeout((x) => order.push(x), 20, 'c');
      advanceTimersByTime(19);
      expect(order).toEqual(['a']);
      advanceTimersByTime(1);
      expect(order).toEqual(['a', 'b', 'c']);
      expect(Date.now() - start).toBe(20);
    });
    test('intervals and nested timers', () => {
      useFakeTimers();
      let ticks = 0;
      const id = setInterval(() => { ticks += 1; if (ticks === 3) clearInterval(id); }, 10);
      let nested = false;
      setTimeout(() => setTimeout(() => (nested = true), 5), 5);
      advanceTimersByTime(100);
      expect(ticks).toBe(3);
      expect(nested).toBe(true);
    });
    test('runAllTimers', () => {
      useFakeTimers();
      let n = 0;
      setTimeout(() => { n += 1; setTimeout(() => (n += 1), 1000); }, 1000);
      runAllTimers();
      expect(n).toBe(2);
    });
    test('an endless interval stops runAllTimers', () => {
      useFakeTimers();
      setInterval(() => {}, 1);
      runAllTimers();
    });
    test('without useFakeTimers', () => { advanceTimersByTime(10); });
    test('the next case is on real timers again', () => { expect(Date.now() > 1700000000000 + 1e9).toBe(true); });
  `);
  for (const name of ['timeouts in order', 'intervals and nested timers', 'runAllTimers', 'the next case is on real timers again'])
    assert.equal(byName[name].pass, true, `${name}: ${byName[name].error}`);
  assert.match(byName['an endless interval stops runAllTimers'].error!, /more than 100000 timers/);
  assert.match(byName['without useFakeTimers'].error!, /call useFakeTimers\(\) first/);
  // The run leaves the real timers in place.
  assert.equal(context.setTimeout, setTimeout);
});

test('async cases: promises, the async clock, resolves / rejects and timeouts', async () => {
  const { byName } = await run(`
    test('awaits a promise chain across fake time', async () => {
      useFakeTimers();
      const later = (v, ms) => new Promise((r) => setTimeout(() => r(v), ms));
      let got = null;
      later(1, 100).then((v) => later(v + 1, 50)).then((v) => (got = v));
      await advanceTimersByTimeAsync(149);
      expect(got).toBe(null);
      await advanceTimersByTimeAsync(1);
      expect(got).toBe(2);
    });
    test('flushPromises runs pending callbacks', async () => {
      let done = false;
      Promise.resolve().then(() => Promise.resolve()).then(() => (done = true));
      await flushPromises();
      expect(done).toBe(true);
    });
    test('resolves and rejects', async () => {
      await expect(Promise.resolve([1])).resolves.toEqual([1]);
      await expect(Promise.reject(new RangeError('out'))).rejects.toThrow(RangeError);
      await expect(Promise.reject(new Error('nope'))).rejects.toThrow('nope');
      await expect(Promise.resolve(1)).resolves.not.toBe(2);
    });
    test('rejects fails on a resolved promise', async () => { await expect(Promise.resolve(5)).rejects.toThrow(); });
    test('a failed assertion after await', async () => { await null; expect(1).toBe(2); });
    test('a promise that never settles', () => new Promise(() => {}));
    test('a rejected case', () => Promise.reject(new TypeError('boom')));
  `);
  for (const name of ['awaits a promise chain across fake time', 'flushPromises runs pending callbacks', 'resolves and rejects'])
    assert.equal(byName[name].pass, true, `${name}: ${byName[name].error}`);
  assert.match(byName['rejects fails on a resolved promise'].error!, /expected the promise to reject, but it resolved to 5/);
  assert.match(byName['a failed assertion after await'].error!, /Expected: 2/);
  assert.equal(byName['a promise that never settles'].error, 'Error: timed out after 200 ms (a promise that never settles?)');
  assert.equal(byName['a rejected case'].error, 'TypeError: boom');
});

test('describe names cases, test.public marks them, and only: public runs those', async () => {
  const tests = `
    describe('group', () => {
      test.public('open', () => {});
      describe('inner', () => { test('hidden', () => { throw 'plain string'; }); });
    });
    it('alias', () => {});
  `;
  const all = await run(tests);
  // Objects from the vm realm: compared as JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(all.harness.cases())), [
    { name: 'group › open', public: true },
    { name: 'group › inner › hidden', public: false },
    { name: 'alias', public: false },
  ]);
  assert.equal(all.byName['group › inner › hidden'].error, 'plain string');
  const reported: string[] = [];
  const open = await run(tests, { only: 'public', report: (r: Result) => reported.push(r.name) });
  assert.deepEqual(Array.from(open.results, (r) => r.name), ['group › open']);
  assert.deepEqual(reported, ['group › open']);
});

test('format shows values compactly, cycles and deep nesting included', async () => {
  const { harness: h, context } = await run('');
  const value = vm.runInContext(`const a = { list: [1, 'x', null, undefined], m: new Map([[1, 2]]) }; a.self = a; a`, context);
  assert.equal(h.format(value), '{list: [1, "x", null, undefined], m: Map {1 => 2}, self: [Circular]}');
  const deep = vm.runInContext(`let d = 0; for (let i = 0; i < 20; i++) d = [d]; d`, context);
  assert.equal(h.format(deep), '[[[[[[[Array]]]]]]]');
  assert.equal(h.format(-0), '-0');
  assert.equal(h.format('a'.repeat(500)).length, 205);
});
