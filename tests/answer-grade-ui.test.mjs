import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

// CSS is a no-op.
register(
  `data:text/javascript,${encodeURIComponent(
    "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { createRoot } = await import('react-dom/client');
const { TryFirst } = await import('../components/try-first.tsx');
const { StoryBank } = await import('../components/story-bank.tsx');

const settle = (ms = 10) => act(async () => new Promise((r) => setTimeout(r, ms)));
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
async function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
const feedback = { score: 3, covered: ['Names the trade-off'], missing: ['Eviction under load'], tighter: 'Use LRU with a map and a list.' };
// `left`: what each ai/usage call answers in turn (the last repeats); `busy`: grading answers 429.
function server({ ai = true, left = [5], busy = false } = {}) {
  const graded = [];
  let asked = 0;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/api/oj/ai/usage'))
      return ai
        ? Response.json({ grade: left[Math.min(asked++, left.length - 1)], bonus: 0 })
        : Response.json({ error: 'Endpoint not found' }, { status: 404 });
    if (u.endsWith('/api/oj/ai/grade')) {
      const body = JSON.parse(init.body);
      graded.push(body);
      if (busy) return Response.json({ error: 'Too many requests. Try again shortly' }, { status: 429 });
      return Response.json({ feedback: body.story ? { ...feedback, specificity: 'Concrete enough.', measurableResult: 'Has p99.', iVsWe: 'Clear.', fitsTwoMinutes: true } : feedback, remaining: 4, limit: 5, bonus: 0 });
    }
    if (init.method === 'PUT') return Response.json({ updatedAt: 9 });
    if (u.includes('prefix=story')) return Response.json({ items: [] });
    if (u.includes('target=')) return Response.json({ body: '', updatedAt: null });
    throw new Error(`unexpected ${u}`);
  };
  return graded;
}
const long = 'I would evict the least recently used entry, keeping a hash map from key to node and a doubly linked list.';

test('try first: AI feedback appears once the answer is long enough, and the reference stays closed', async () => {
  const graded = server();
  let revealed = 0;
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(createElement(TryFirst, { userId: 'u1', target: 'content:interview_question/cache', revealed: false, onReveal: () => revealed++ })),
  );
  await settle();
  assert.equal(!!button('AI feedback on my answer'), false, 'nothing for a short answer');
  await type(document.querySelector('.ip-try-input'), long);
  await settle();
  assert.equal(document.querySelector('.ip-grade-go small').textContent, '5 left today');
  await act(async () => button('AI feedback on my answer').click());
  await settle();
  assert.deepEqual(graded, [{ target: 'content:interview_question/cache', answer: long, locale: 'en' }]);
  const result = document.querySelector('.ip-grade-result');
  assert.equal(result.querySelector('.ip-grade-score').textContent, '3/4 · Mostly there');
  assert.equal(result.textContent.includes('Eviction under load') && result.textContent.includes('Use LRU with a map'), true);
  assert.equal(document.activeElement, result, 'the feedback takes focus');
  assert.equal(revealed, 0, 'the reference answer stays closed');
  assert.equal(document.querySelector('.ip-grade-go small').textContent, '4 left today');
  await act(async () => root.unmount());
});

test('try first: no button without AI, for guests or for targets the server cannot grade', async () => {
  for (const [props, ai] of [
    [{ userId: 'u1', target: 'content:interview_question/cache' }, false],
    [{ userId: null, target: 'content:interview_question/cache', local: { value: long, onChange() {} } }, true],
    [{ userId: 'u1', target: 'content:course_chapter/lld' }, true],
    // A drawn mock interview question with no reference answer.
    [{ userId: 'u1', target: 'content:interview_question/bare', gradeable: false }, true],
  ]) {
    server({ ai });
    const root = createRoot(document.getElementById('root'));
    await act(async () => root.render(createElement(TryFirst, { revealed: false, onReveal() {}, ...props })));
    await settle();
    if (props.userId) await type(document.querySelector('.ip-try-input'), long);
    await settle();
    assert.equal(!!button('AI feedback on my answer'), false, props.target);
    await act(async () => root.unmount());
  }
});

test('story bank: a story goes with the behavioral question typed beside it, and STAR notes come back', async () => {
  const graded = server();
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(StoryBank, { userId: 'u1' })));
  await settle();
  await act(async () => button('New story').click());
  await type(document.querySelector('.ip-field input'), 'Checkout latency');
  await type(document.querySelector('[data-field="situation"] textarea'), 'Checkout timed out under holiday load.');
  await type(document.querySelector('[data-field="action"] textarea'), 'I profiled it and added a read-through cache with a short TTL.');
  await type(document.querySelector('[data-field="result"] textarea'), 'p99 fell from 2s to 300ms.');
  await settle();
  const question = document.querySelector('.ip-grade input[list]');
  await type(question, 'Tell me about a time you improved performance');
  await act(async () => button('AI feedback on my answer').click());
  await settle();
  assert.deepEqual(graded[0], {
    story: {
      title: 'Checkout latency',
      situation: 'Checkout timed out under holiday load.',
      task: '',
      action: 'I profiled it and added a read-through cache with a short TTL.',
      result: 'p99 fell from 2s to 300ms.',
    },
    question: 'Tell me about a time you improved performance',
    locale: 'en',
  });
  const notes = document.querySelector('.ip-grade-result .ip-star').textContent;
  assert.equal(notes.includes('Has p99.') && notes.includes('Fits in two minutes?') && notes.includes('Yes, at about 140 words'), true);
  // A story has no reference answer to defer to.
  assert.equal(document.querySelector('.ip-grade-result').textContent.includes('reference answer'), false);
  await act(async () => root.unmount());
});

test('a 429 asks what is left: the per-minute limit keeps the button, a spent day turns it off', async () => {
  for (const [left, label, off] of [
    [5, '5 left today', false],
    [0, "You've used today's feedback. Come back tomorrow", true],
  ]) {
    server({ left: [5, left], busy: true });
    const root = createRoot(document.getElementById('root'));
    await act(async () =>
      root.render(createElement(TryFirst, { userId: 'u1', target: 'content:interview_question/cache', revealed: false, onReveal() {} })),
    );
    await settle();
    await type(document.querySelector('.ip-try-input'), long);
    await settle();
    await act(async () => button('AI feedback on my answer').click());
    await settle();
    assert.equal(document.querySelector('.ip-grade-go small').textContent, label);
    assert.equal(button('AI feedback on my answer').disabled, off);
    assert.equal(document.querySelector('.ip-grade [role="alert"]').textContent, 'Too many requests. Try again shortly');
    await act(async () => root.unmount());
  }
});
