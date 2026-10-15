import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act, useState } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** IndexedDB in memory: one store, requests answered on the microtask queue. */
const stored = new Map();
const request = (run) => {
  const r = {};
  queueMicrotask(() => {
    r.result = run();
    r.onsuccess?.();
  });
  return r;
};
const store = {
  get: (k) => request(() => stored.get(k)),
  put: (v, k) => request(() => stored.set(k, v)),
  delete: (k) => request(() => stored.delete(k)),
  getAllKeys: () => request(() => [...stored.keys()]),
};
const db = { createObjectStore() {}, close() {}, transaction: () => ({ objectStore: () => store }) };
globalThis.indexedDB = {
  open: () => {
    const r = {};
    queueMicrotask(() => {
      r.result = db;
      r.onupgradeneeded?.();
      r.onsuccess?.();
    });
    return r;
  },
};

const { createRoot } = await import('react-dom/client');
const { MockReplay, useReplayRecorder } = await import('../components/mock-replay.tsx');
const { contestReplay, loadSession, pruneTracks, rememberContestRun, trackKey } = await import('../lib/mock-replay.ts');
const { mockStorageKey } = await import('../lib/mock-oa.ts');

const flush = async () => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
};
/**
 * Polls until done() holds, each wait in its own act() so React commits in between: a report
 * reads gzipped tracks, and gunzip runs on libuv's thread pool, so no fixed count of turns covers it.
 */
const until = async (done) => {
  for (let i = 0; i < 200 && !(await done()); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
};
const report = () => until(() => !!document.querySelector('#mock-replay-title'));

test('recording a running exam, then replaying it on the report', async () => {
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: 1_000_000 });
  const start = Date.now();
  const session = { id: 's1', ids: ['p1', 'p2'], minutes: 60, startedAt: start, skew: 0, slots: ['easy', 'hard'], createdAt: start };
  let setCode, onResult;
  function Recorder({ running }) {
    const [code, set] = useState('a');
    setCode = set;
    onResult = useReplayRecorder(running ? session : null, 'p1', code);
    return null;
  }
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(Recorder, { running: true })));
    await act(flush);
    await act(async () => setCode('ab'));
    await act(async () => mock.timers.tick(2000));
    await act(flush);
    // Unchanged for a while: nothing new is stored.
    await act(async () => mock.timers.tick(4000));
    const result = { problem_id: 'p1', id: 'sub-0001-aaaa-bbbb', created_at: start + 2500, mode: 'judge', status: 'wrong_answer', passed: 1, total: 3 };
    await act(async () => onResult.current(result));
    await act(async () => onResult.current(result));
    // A run from before the exam (recovered on load) is not part of it.
    await act(async () => onResult.current({ ...result, id: 'old-run', created_at: start - 60_000 }));
    await act(async () => setCode('abc'));
    // The exam ends (hand-in): the last edit is kept as it stops.
    await act(async () => root.render(createElement(Recorder, { running: false })));
    await act(flush);
    const [p1, p2] = await loadSession('s1', ['p1', 'p2']);
    assert.equal(p2, null);
    assert.deepEqual(p1.opens, [0]);
    assert.deepEqual(p1.frames.map((f) => f[3]), ['a', 'b', 'c']);
    assert.deepEqual(p1.frames.map((f) => f[0]), [0, 2000, 6000]);
    assert.equal(p1.events.length, 1);
    assert.equal(p1.events[0].t, 2500);
    assert.equal(p1.events[0].status, 'wrong_answer');
    assert.equal(stored.get(trackKey('s1', 'p1')) instanceof ArrayBuffer, true);

    // The report, ten minutes after the start.
    const finished = { ...session, finishedAt: start + 10 * 60_000 };
    await act(async () => root.render(createElement(MockReplay, { session: finished, title: (id) => `Title ${id}` })));
    await report();
    const $ = (s) => document.querySelector(s);
    assert.equal($('#mock-replay-title').textContent, 'Code replay');
    const marks = [...document.querySelectorAll('.mock-replay-marks button')];
    assert.equal(marks.length, 1);
    assert.equal(marks[0].dataset.tone, 'fail');
    assert.equal(marks[0].getAttribute('aria-label').includes('Q1 · Submit'), true);
    assert.equal($('.mock-replay-code code').textContent, 'a');
    assert.equal($('.mock-replay-code figcaption').textContent.includes('Title p1'), true);
    // Q2 has nothing recorded.
    const qs = [...document.querySelectorAll('.mock-replay-qs button')];
    assert.equal(qs[2].disabled, true);
    // Seek to the submission.
    await act(async () => marks[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    assert.equal($('.mock-replay-code code').textContent, 'ab');
    assert.equal($('.mock-replay-track input').value, '2500');
    // Play at 4x (the default): one second of play covers four of the exam.
    const play = $('.mock-replay-play');
    await act(async () => play.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    assert.equal(play.getAttribute('aria-label'), 'Pause');
    await act(async () => mock.timers.tick(1000));
    assert.equal($('.mock-replay-track input').value, '6500');
    assert.equal($('.mock-replay-code code').textContent, 'abc');
    const speeds = [...document.querySelectorAll('.mock-replay-speeds button')];
    assert.deepEqual(speeds.map((b) => b.getAttribute('aria-pressed')), ['false', 'true', 'false']);
    // The time split: all ten minutes on Q1, with the quiet stretch after 0:06 listed.
    const times = [...document.querySelectorAll('.mock-replay-time')].map((n) => n.textContent);
    assert.deepEqual(times, ['10:00', '00:00']);
    const pauses = [...document.querySelectorAll('.mock-replay-pauses li')].map((n) => n.textContent);
    assert.equal(pauses.length, 1);
    assert.equal(pauses[0].startsWith('00:06–10:00'), true);
  } finally {
    await act(async () => root.unmount());
    mock.timers.reset();
  }
});

test('a track over its size cap stops recording, and the report says so', async () => {
  const { randomBytes } = await import('node:crypto');
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: 2_000_000 });
  const start = Date.now();
  // Two questions share REPLAY_BYTES: each track may take half.
  const session = { id: 's-full', ids: ['p1', 'p2'], minutes: 60, startedAt: start, skew: 0, slots: ['easy', 'hard'], createdAt: start };
  let setCode;
  function Recorder({ running }) {
    const [code, set] = useState('a');
    setCode = set;
    useReplayRecorder(running ? session : null, 'p1', code);
    return null;
  }
  const saved = async () => (await loadSession('s-full', ['p1']))[0];
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(Recorder, { running: true })));
    await until(async () => (await saved())?.frames.length === 1);
    // A paste too big to keep, even gzipped.
    await act(async () => setCode(randomBytes(1_600_000).toString('base64')));
    await act(async () => mock.timers.tick(2000));
    await until(async () => (await saved())?.full === true);
    const track = await saved();
    assert.equal(track.full, true);
    assert.deepEqual(track.frames.map((f) => f[3]), ['a']);
    // Remounted (another question and back): nothing more is recorded.
    await act(async () => root.render(createElement(Recorder, { running: false })));
    await act(async () => root.render(createElement(Recorder, { running: true })));
    await act(async () => setCode('b'));
    await act(async () => mock.timers.tick(2000));
    await act(flush);
    assert.deepEqual((await saved()).opens, [0]);
    await act(async () => root.render(createElement(MockReplay, { session: { ...session, finishedAt: start + 60_000 }, title: (id) => id })));
    await report();
    assert.equal(document.querySelector('.mock-replay-code figcaption').textContent.includes('size cap'), true);
  } finally {
    await act(async () => root.unmount());
    mock.timers.reset();
  }
});

test('time away and long pastes are recorded for the self-check, and the report shows them', async () => {
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: 3_000_000 });
  const start = Date.now();
  const session = { id: 's-focus', ids: ['p1'], minutes: 60, startedAt: start, skew: 0, slots: ['easy'], createdAt: start };
  function Recorder({ running }) {
    useReplayRecorder(running ? session : null, 'p1', 'code');
    return null;
  }
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  const fire = (target, type) => target.dispatchEvent(new dom.window.Event(type));
  // Monaco's hidden textarea sits inside the editor host; the custom input does not.
  const editor = document.createElement('div');
  editor.className = 'cs-editor-host';
  editor.innerHTML = '<textarea></textarea>';
  const customInput = document.createElement('textarea');
  document.body.append(editor, customInput);
  const paste = (text, target = editor.firstChild) => {
    const event = new dom.window.Event('paste', { bubbles: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    target.dispatchEvent(event);
  };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(Recorder, { running: true })));
    await act(flush);
    // A blink of lost focus is not leaving.
    await act(async () => (mock.timers.tick(1000), fire(window, 'blur'), mock.timers.tick(300), fire(window, 'focus')));
    // Hidden, then blurred too: one stretch, closed by whichever comes back first.
    await act(async () => (mock.timers.tick(700), (visibility = 'hidden'), fire(document, 'visibilitychange'), fire(window, 'blur')));
    await act(async () => (mock.timers.tick(60_000), (visibility = 'visible'), fire(document, 'visibilitychange'), fire(window, 'focus')));
    await act(async () => (paste('x'.repeat(50)), paste('short'), paste('y'.repeat(80), customInput), paste('z'.repeat(80), document.body)));
    await act(async () => mock.timers.tick(2000));
    await act(async () => root.render(createElement(Recorder, { running: false })));
    await act(flush);
    const [track] = await loadSession('s-focus', ['p1']);
    assert.deepEqual(track.away, [[2000, 62_000]]);
    assert.deepEqual(track.pastes, [[62_000, 50]]);
    await act(async () => root.render(createElement(MockReplay, { session: { ...session, finishedAt: start + 600_000 }, title: (id) => id })));
    await report();
    const marks = [...document.querySelectorAll('.mock-replay-away li')];
    assert.equal(marks.length, 2);
    assert.equal(Number.parseFloat(marks[0].style.left).toFixed(3), '0.333');
    assert.equal(marks[1].className, 'mock-replay-paste');
    assert.equal(
      document.querySelector('.mock-replay-focus').textContent,
      'Left the page 1 time for 01:00 in all; 1 paste of over 40 characters.',
    );
  } finally {
    await act(async () => root.unmount());
    delete document.visibilityState;
    editor.remove();
    customInput.remove();
    mock.timers.reset();
  }
});

test('a contest run records on the server clock and replays its own window', async () => {
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: 4_000_000 });
  // The room started a minute ago by the server, which runs 5 seconds ahead of this browser.
  const skew = 5000;
  const me = { name: 'Amy', start: Date.now() + skew - 60_000, end: Date.now() + skew + 29 * 60_000 };
  const live = contestReplay('r1', me, ['p1', 'p2'], skew);
  let onResult;
  function Recorder({ running }) {
    onResult = useReplayRecorder(running ? live : null, 'p2', 'x');
    return null;
  }
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(Recorder, { running: true })));
    await act(flush);
    // Judged 30 seconds into the run, by the server's clock.
    await act(async () => onResult.current({ problem_id: 'p2', id: 'sub-contest-1', created_at: me.start + 30_000, mode: 'judge', status: 'accepted', passed: 2, total: 2 }));
    await act(async () => root.render(createElement(Recorder, { running: false })));
    await act(flush);
    const [p1, p2] = await loadSession(live.id, ['p1', 'p2']);
    assert.equal(p1, null);
    assert.deepEqual(p2.opens, [60_000]);
    assert.equal(p2.events[0].t, 30_000);
    // After the run, the room page rebuilds the session from the same window, without the skew.
    await act(async () =>
      root.render(
        createElement(MockReplay, { session: contestReplay('r1', me, ['p1', 'p2']), title: (id) => id, heading: 'My code replay', level: 2 }),
      ),
    );
    await report();
    const heading = document.querySelector('#mock-replay-title');
    assert.equal(heading.tagName, 'H2');
    assert.equal(heading.textContent, 'My code replay');
    // Its sub-headings follow it one level down: an h3 under the room's h2, not an h4.
    assert.deepEqual([...document.querySelectorAll('.mock-replay-split :is(h3, h4)')].map((h) => h.tagName), ['H3', 'H3']);
    assert.equal(document.querySelector('.mock-replay-clock').textContent, '00:00 / 30:00');
    assert.equal(document.querySelector('.mock-replay-marks button').dataset.tone, 'ac');
    // Another entrant of the room on this browser has nothing to replay.
    assert.deepEqual(await loadSession(contestReplay('r1', { ...me, name: 'Ben' }, []).id, ['p1', 'p2']), [null, null]);
  } finally {
    await act(async () => root.unmount());
    mock.timers.reset();
  }
});

test('a session that left every history on this browser loses its replay', async () => {
  stored.set(trackKey('kept', 'p1'), 'x');
  stored.set(trackKey('gone', 'p1'), 'x');
  localStorage.setItem(mockStorageKey('someone'), JSON.stringify({ active: null, history: [{ id: 'kept', ids: ['p1'], slots: ['easy'], minutes: 30, createdAt: 1, skew: 0 }] }));
  // Contest runs have no mock history: the last 20 this browser started recording stay.
  const run = (room) => contestReplay(room, { name: 'Amy', start: 0, end: 1 }, []).id;
  stored.set(trackKey(run('old'), 'p1'), 'x');
  // A display name may hold a ':' — the session is everything before the last one.
  const colon = contestReplay('r9', { name: 'Bob: CMU', start: 0, end: 1 }, []).id;
  rememberContestRun(colon);
  stored.set(trackKey(colon, 'lc-1'), 'x');
  await pruneTracks();
  assert.equal(stored.has(trackKey(colon, 'lc-1')), true, 'a listed run whose name has a colon');
  assert.equal(stored.has(trackKey('kept', 'p1')), true);
  assert.equal(stored.has(trackKey('gone', 'p1')), false);
  assert.equal(stored.has(trackKey('s1', 'p1')), false);
  assert.equal(stored.has(trackKey(run('r1'), 'p2')), true, 'recorded above, so listed');
  assert.equal(stored.has(trackKey(run('old'), 'p1')), false, 'never listed');
  for (let i = 0; i < 20; i++) rememberContestRun(run(`duel-${i}`));
  rememberContestRun('s2');
  assert.equal(JSON.parse(localStorage.getItem('cswork:contest-replays')).length, 20, 'a mock is not listed');
  await pruneTracks();
  assert.equal(stored.has(trackKey(run('r1'), 'p2')), false, '20 newer runs push it out');
});

test('a mock recorded before the focus self-check says so instead of counting zero', async () => {
  const session = { id: 's-v1', ids: ['p1'], minutes: 60, startedAt: 0, skew: 0, slots: ['easy'], createdAt: 0, finishedAt: 600_000 };
  stored.set(trackKey('s-v1', 'p1'), JSON.stringify({ v: 1, frames: [[0, 0, 0, 'x']], events: [], opens: [0] }));
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(MockReplay, { session, title: (id) => id })));
    await act(flush);
    assert.equal(document.querySelector('.mock-replay-away'), null);
    assert.match(document.querySelector('.mock-replay-focus').textContent, /before the focus self-check/);
  } finally {
    await act(async () => root.unmount());
  }
});
