// The review session: a flip deck graded from the keyboard, keys in a field left alone, a running
// mock exam closing it, then the due multiple-choice question and the coding reviews.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    "export async function resolve(s,c,n){if(s==='next/link')return {url:'data:text/javascript,export default function Link(){return null}',shortCircuit:true};return n(s,c);}" +
      "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="root"></div></body></html>', { url: 'https://cswork.test/?view=review-session' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'localStorage', 'navigator', 'location', 'history', 'getComputedStyle'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
localStorage.setItem('cswork:locale', 'en');
const { createRoot } = await import('react-dom/client');
const { ReviewSession, clipSource } = await import('../components/review-session.tsx');
const { mockStorageKey } = await import('../lib/mock-oa.ts');

const bank = JSON.parse(readFileSync('lib/content/oa-mcq.json', 'utf8')).questions;
const mcq = bank.find((q) => q.id === 'mcq-os-1');
const today = Math.floor(Date.now() / 86_400_000);
const settle = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const press = (key, target = window) =>
  act(async () => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const card = (front, back) => JSON.stringify({ v: 1, front, back, tags: ['dp'] });

const notes = {
  'card:': [
    { target: 'card:aaaaaaaaaaaa', body: card('What is a monotonic stack?', 'A stack kept sorted') },
    { target: 'card:bbbbbbbbbbbb', body: card('Kadane?', 'Best sum ending here') },
  ],
  'recall:cards': '',
  'recall:ideas': '',
  'recall:queue': '',
  'mcq:answers': JSON.stringify({ [mcq.id]: [1, today - 5, 0] }),
  'pref:review': '',
};
const puts = [];
let history = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url), 'https://cswork.test');
  const target = u.searchParams.get('target');
  if (init.method === 'PUT') {
    const { body } = JSON.parse(init.body);
    puts.push([target, body]);
    notes[target] = body;
    return Response.json({ target, body, updatedAt: 1 });
  }
  if (u.pathname === '/api/oj/notes' && u.searchParams.get('prefix')) return Response.json({ items: notes[u.searchParams.get('prefix')] });
  if (u.pathname === '/api/oj/notes') return Response.json({ target, body: notes[target] ?? '', updatedAt: null });
  if (u.pathname === '/api/oj/history') return Response.json({ items: history });
  if (u.pathname === '/api/oj/mcq/questions')
    return Response.json({ items: [{ id: mcq.id, section: mcq.section, topic: mcq.topic, answer: mcq.answer, text: mcq.en }] });
  return Response.json({ error: 'nope' }, { status: 404 });
};
const boot = { person: { id: 'u1' }, problems: [{ id: 'lc-1', title: '两数之和', titleEn: 'Two Sum' }] };

test('a running mock exam closes the whole session', async () => {
  localStorage.setItem(
    mockStorageKey('u1'),
    JSON.stringify({ active: { id: 'm1', ids: ['lc-1'], slots: [], minutes: 90, createdAt: Date.now(), startedAt: Date.now() }, history: [] }),
  );
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(ReviewSession, { boot, navigate() {} })));
  await settle();
  assert.match(document.querySelector('[role="status"]').textContent, /mock exam is in progress/);
  assert.equal(document.querySelector('[role="tablist"]'), null);
  assert.equal(document.querySelector('.rs-card'), null);
  await act(async () => root.unmount());
  localStorage.removeItem(mockStorageKey('u1'));
});

test('Space flips, 1/2/3 grade into recall:cards; keys typed into a field do nothing', async () => {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(ReviewSession, { boot, navigate() {} })));
  await settle();
  assert.match(document.querySelector('.rs-plan').textContent, /2 cards · 1 multiple-choice · 0 coding/);
  assert.equal(document.querySelector('.rs-front').textContent, 'What is a monotonic stack?');
  assert.equal(document.querySelector('.rs-back'), null);
  // In a field, Space is typing.
  const field = document.createElement('input');
  document.body.append(field);
  field.focus();
  await press(' ', field);
  assert.equal(document.querySelector('.rs-back'), null);
  await press('3', field);
  assert.equal(puts.length, 0);
  field.remove();
  // 3 before the flip grades nothing.
  await press('3');
  assert.equal(puts.length, 0);
  await press(' ');
  assert.equal(document.querySelector('.rs-back').textContent, 'A stack kept sorted');
  await press('3');
  await settle();
  assert.deepEqual(puts.at(-1)[0], 'recall:cards');
  assert.deepEqual(JSON.parse(puts.at(-1)[1]).items, { 'card:aaaaaaaaaaaa': [1, today, ''] });
  assert.equal(document.querySelector('.rs-front').textContent, 'Kadane?');
  await press(' ');
  await press('1');
  await settle();
  assert.deepEqual(JSON.parse(notes['recall:cards']).items['card:bbbbbbbbbbbb'], [0, today, '']);

  // Then the due multiple-choice question: answered, saved over the latest review.
  assert.ok(document.querySelector('.oa-mcq-item'));
  const right = document.querySelectorAll('.oa-mcq-choices input')[mcq.answer[0]];
  await act(async () => right.click());
  await act(async () => button('Submit').click());
  await settle();
  const review = JSON.parse(notes['mcq:answers']);
  assert.equal(review[mcq.id][0], 2, 'a right answer to a due question moves up a box');
  assert.equal(review[mcq.id][1], today);
  await act(async () => button('Continue').click());
  assert.match(document.querySelector('.rs-done').textContent, /knew 1 · partly 0 · didn't know 1/);
  assert.match(document.querySelector('.rs-done').textContent, /1 of 1 right/);
  await act(async () => root.unmount());
});

test('coding reviews open in a new tab and tick off once accepted today', async () => {
  notes['card:'] = [];
  notes['mcq:answers'] = '';
  const DAY = 86_400_000;
  const solved = Date.now() - 10 * DAY;
  const item = (acAt) => ({
    problemId: 'lc-1', attempts: acAt.length, firstAt: solved, lastAt: acAt.at(-1), firstAcAt: solved, failuresBeforeAc: 0,
    lastStatus: 'accepted', languages: ['python'], acAt, help: 'none', solveSeconds: null, whiteboard: null, brute: false, stop: null,
  });
  history = [item([solved])];
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(ReviewSession, { boot, navigate() {} })));
  await settle();
  const link = document.querySelector('.rs-list a');
  assert.equal(link.textContent, 'Two Sum');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(document.querySelector('.rs-list li').hasAttribute('data-done'), false);
  history = [item([solved, Date.now()])];
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  await act(async () => document.dispatchEvent(new dom.window.Event('visibilitychange')));
  await settle();
  assert.equal(document.querySelector('.rs-list li').hasAttribute('data-done'), true);
  await act(async () => button('Finish').click());
  assert.match(document.querySelector('.rs-done').textContent, /Coding: 1 of 1 accepted today/);
  await act(async () => root.unmount());
});

test('cards & excerpts: a new card is checked and saved as its own note; excerpts list with their source', async () => {
  notes['card:'] = [{ target: 'card:aaaaaaaaaaaa', body: card('Old card', 'Back') }];
  notes['clip:'] = [{ target: 'clip:concept/two-pointers', body: '> both ends\n> — [Two Pointers](/library/concept/two-pointers)\n', updatedAt: 1 }];
  notes['recall:cards'] = JSON.stringify({ v: 1, items: { 'card:aaaaaaaaaaaa': [4, today - 40, ''] } });
  puts.length = 0;
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(ReviewSession, { boot, navigate() {}, tab: 'cards' })));
  await settle();
  assert.match(document.querySelector('#rs-cards-title').textContent, /My cards \(1 of 200\)/);
  assert.match(document.querySelector('.rs-list li').textContent, /Old card.*Mastered · #dp/);
  assert.equal(document.querySelector('.rs-clip a').getAttribute('href'), '/library/concept/two-pointers');
  assert.equal(document.querySelector('.rs-snippet').textContent, 'both ends', 'the quote without its citation');
  await act(async () => button('New card').click());
  await settle();
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog, 'the editor opens');
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set;
  const [front, back] = dialog.querySelectorAll('textarea');
  // Empty front: refused before any request.
  await act(async () => dialog.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.match(dialog.querySelector('[role="alert"]').textContent, /front is required/);
  assert.equal(puts.length, 0);
  await act(async () => {
    setter.call(front, 'Why does Dijkstra fail with negative edges?');
    front.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    setter.call(back, 'A settled node can still get cheaper');
    back.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await act(async () => dialog.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  await settle();
  assert.equal(puts.length, 1);
  assert.match(puts[0][0], /^card:[a-z0-9]{12}$/);
  assert.deepEqual(JSON.parse(puts[0][1]), { v: 1, front: 'Why does Dijkstra fail with negative edges?', back: 'A settled node can still get cheaper', tags: [] });
  assert.match(document.querySelector('#rs-cards-title').textContent, /My cards \(2 of 200\)/);
  await act(async () => root.unmount());
});

test('a saved excerpt links back to the page its quote cites', () => {
  assert.deepEqual(clipSource('> a\n> — [Two Pointers](/library/concept/two-pointers)\n'), { title: 'Two Pointers', href: '/library/concept/two-pointers' });
  assert.equal(clipSource('> — [x](https://evil.test)'), null);
  assert.equal(clipSource('> — [x](//evil.test/a)'), null);
});
