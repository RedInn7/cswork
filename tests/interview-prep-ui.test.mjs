import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

// CSS is a no-op; next/link (aliased by the bundler) is a stub.
register(
  `data:text/javascript,${encodeURIComponent(
    "export async function resolve(s,c,n){if(s==='next/link')return {url:'data:text/javascript,export default function Link(){return null}',shortCircuit:true};return n(s,c);}" +
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
const { ContentDetail } = await import('../components/content-library.tsx');
const { StoryBank } = await import('../components/story-bank.tsx');

const settle = (ms = 10) => act(async () => new Promise((r) => setTimeout(r, ms)));
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
const click = (label) => act(async () => button(label).click());
async function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
const body = [
  '# Tell me about a time you disagreed with a teammate',
  '',
  'Walk through the conflict and how it ended.',
  '',
  '### What a Strong Answer Covers',
  '- SECRET-RUBRIC: a specific disagreement with stakes',
].join('\n');
const question = {
  type: 'interview_question', slug: 'disagree-1', title: 'Disagreeing with a teammate', summary: null,
  company: { slug: 'amazon', name: 'Amazon' }, role: null, category: 'Behavioral & Leadership', difficulty: null,
  round: null, seniority: null, tags: [], publishedAt: null, partial: false,
  body, updatedAt: null, extra: {}, relations: [], dupOf: null, practice: null, companyPractice: null,
};
const storyNote = (id, story) => ({ target: `story:${id}`, body: JSON.stringify({ questions: [], ...story }), updatedAt: 5 });

test('question page: the rubric stays closed until the learner writes or insists; picks a story', async () => {
  const puts = [];
  let answer = '';
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/api/content/item')) return Response.json(question);
    if (u.includes('prefix=story')) {
      return Response.json({
        items: [
          storyNote('s1', { title: 'Launch slip', competencies: ['failure'] }),
          storyNote('s2', { title: 'Schema fight', competencies: ['conflict'], situation: 'Two teams, one schema.' }),
        ],
      });
    }
    if (init.method === 'PUT') {
      puts.push([decodeURIComponent(u.split('target=')[1]), JSON.parse(init.body).body]);
      return Response.json({ updatedAt: 9 });
    }
    if (u.includes('target=content')) return Response.json({ body: answer, updatedAt: answer ? 1 : null });
    throw new Error(`unexpected ${u}`);
  };
  const root = createRoot(document.getElementById('root'));
  const render = () =>
    act(async () =>
      root.render(createElement(ContentDetail, { params: { type: 'interview_question', slug: 'disagree-1' }, navigate() {}, problemIds: [], userId: 'u1' })),
    );
  await render();
  await settle();
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), false, 'the rubric is hidden at first');
  assert.equal(document.body.textContent.includes('Walk through the conflict'), true);
  // Insisting asks once to try first, then opens.
  await click('Show the answer');
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), false);
  assert.equal(document.body.textContent.includes('Write a few lines first?'), true);
  await click("OK, I'll try first");
  assert.equal(document.activeElement?.classList.contains('ip-try-input'), true, 'focus goes to the answer box');
  await type(document.querySelector('.ip-try-input'), 'I would set up a design review');
  assert.equal(!!button('Compare with the reference answer'), true);
  await click('Compare with the reference answer');
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), true);
  await settle(900);
  assert.deepEqual(puts.at(-1), ['content:interview_question/disagree-1', 'I would set up a design review']);

  // The conflict story fits this question and comes first; picking it saves the question on it.
  const select = document.querySelector('.ip-pick-select');
  assert.equal(select.querySelector('optgroup').label, 'Fits this question');
  assert.equal(select.querySelector('optgroup option').textContent.startsWith('Schema fight'), true);
  await act(async () => {
    select.value = 's2';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await settle();
  const [target, saved] = puts.at(-1);
  assert.equal(target, 'story:s2');
  assert.deepEqual(JSON.parse(saved).questions, [{ key: 'interview_question/disagree-1', title: 'Disagreeing with a teammate', company: 'Amazon' }]);
  assert.equal(document.body.textContent.includes('Review this story'), true);
  await act(async () => root.unmount());

  // An answer written on an earlier visit counts as trying: the rubric opens on load.
  answer = 'my earlier answer';
  const again = createRoot(document.getElementById('root'));
  await act(async () =>
    again.render(createElement(ContentDetail, { params: { type: 'interview_question', slug: 'disagree-1' }, navigate() {}, problemIds: [], userId: 'u1' })),
  );
  await settle();
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), true);
  await act(async () => again.unmount());
});

test('story bank: writes a story with STAR parts and competencies, lists it, exports Markdown', async () => {
  const puts = [];
  const items = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (init.method === 'PUT') {
      const target = decodeURIComponent(u.split('target=')[1]);
      puts.push([target, init.body ? JSON.parse(init.body).body : '']);
      return Response.json({ updatedAt: Date.UTC(2026, 9, 14) });
    }
    if (u.includes('prefix=story')) return Response.json({ items });
    throw new Error(`unexpected ${u}`);
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(StoryBank, { userId: 'u1' })));
  await settle();
  assert.equal(document.body.textContent.includes('No stories yet'), true);
  assert.equal(button('Export Markdown').disabled, true);
  await click('New story');
  await type(document.querySelector('.ip-field input'), 'Schema fight');
  const action = document.querySelector('[data-field="action"] textarea');
  await type(action, 'I wrote both designs up and ran a review');
  assert.equal(document.querySelector('[data-field="action"] .ip-count').textContent, '9 words');
  const chip = [...document.querySelectorAll('.ip-chip')].find((l) => l.textContent === 'Conflict');
  await act(async () => chip.querySelector('input').click());
  await act(async () => document.querySelector('#ip-editor').requestSubmit());
  await settle();
  const [target, saved] = puts.at(-1);
  assert.equal(target.startsWith('story:'), true);
  assert.deepEqual(JSON.parse(saved).competencies, ['conflict']);
  assert.equal(JSON.parse(saved).action, 'I wrote both designs up and ran a review');
  const row = document.querySelector('.ip-table tbody tr');
  assert.equal(row.textContent.includes('Schema fight'), true);
  assert.equal(row.textContent.includes('Conflict'), true);
  assert.equal(document.querySelector('.ip-editor-state').textContent, 'Saved');

  // Export: one Markdown download with the story in it.
  let blob = null;
  let downloaded = '';
  dom.window.URL.createObjectURL = (b) => ((blob = b), 'blob:x');
  dom.window.URL.revokeObjectURL = () => {};
  globalThis.URL.createObjectURL = dom.window.URL.createObjectURL;
  globalThis.URL.revokeObjectURL = dom.window.URL.revokeObjectURL;
  dom.window.HTMLAnchorElement.prototype.click = function () {
    downloaded = this.download;
  };
  await click('Export Markdown');
  assert.equal(downloaded, 'star-stories.md');
  assert.equal((await blob.text()).includes('## Schema fight'), true);
  await act(async () => root.unmount());
});

test('solo mock interview: the answer box comes before the reveal; behavioral slots offer a story', async () => {
  const { MockInterview } = await import('../components/mock-interview.tsx');
  const item = {
    id: 'iq-1', type: 'interview_question', slug: 'disagree-1', title: 'Disagreeing with a teammate', company: null, role: null,
    round: null, difficulty: null, problem: null, math: false, principles: [], question: 'Tell me about a conflict.',
    hints: '', followUps: '', rubric: 'SECRET-RUBRIC', solution: '',
  };
  const set = { seed: 'k3x9', rerolls: [], template: { id: 'behavioral', name: ['行为面', 'BQ'] }, slots: [{ kind: 'behavioral', minutes: 8, similar: false, pool: 80, item }] };
  const query = { template: 'behavioral', set: 'k3x9' };
  // A sitting already past the plan, so the runner shows.
  localStorage.setItem(
    'cswork:mock-interview:runs',
    JSON.stringify({ [`solo:${new URLSearchParams(query)}`]: { phase: 'run', index: 0, since: null, elapsed: [], notes: {}, ratings: {}, shown: {}, started: true, at: Date.now() } }),
  );
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/content/mock')) return Response.json(set);
    if (u.includes('prefix=story')) return Response.json({ items: [] });
    if (u.includes('target=content')) return Response.json({ body: '', updatedAt: null });
    throw new Error(`unexpected ${u}`);
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(MockInterview, { params: query, navigate() {}, problemIds: [], userId: 'u1' })));
  await settle();
  assert.equal(!!document.querySelector('.ip-pick'), true, 'which story would you tell?');
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), false);
  await click('Show the answer');
  await click('Show it anyway');
  assert.equal(document.body.textContent.includes('SECRET-RUBRIC'), true);
  await act(async () => root.unmount());
});

test('a guest answer is saved to the account on sign-in, or offered against the saved one', async () => {
  const { TryFirst } = await import('../components/try-first.tsx');
  const puts = [];
  let saved = '';
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (init.method === 'PUT') {
      puts.push(JSON.parse(init.body).body);
      return Response.json({ updatedAt: 9 });
    }
    if (u.includes('target=content')) return Response.json({ body: saved, updatedAt: saved ? 1 : null });
    throw new Error(`unexpected ${u}`);
  };
  // Question page (no local copy): typed as a guest, then signed in without a reload.
  const root = createRoot(document.getElementById('root'));
  const view = (userId) =>
    act(async () => root.render(createElement(TryFirst, { userId, target: 'content:interview_question/q9', revealed: false, onReveal() {} })));
  await view(null);
  await type(document.querySelector('.ip-try-input'), 'guest outline');
  await view('u1');
  await settle();
  assert.equal(document.querySelector('.ip-try-input').value === 'guest outline', true, 'still on screen after sign-in');
  assert.deepEqual(puts, ['guest outline']);
  await act(async () => root.unmount());

  // Solo mock interview (kept in the run as a guest), with a different answer already saved: the learner picks.
  saved = 'answer from last week';
  puts.length = 0;
  let run = 'run notes';
  const again = createRoot(document.getElementById('root'));
  const solo = (userId) =>
    act(async () =>
      again.render(
        createElement(TryFirst, {
          userId, target: 'content:interview_question/q9', revealed: false, onReveal() {},
          local: { value: run, onChange: (v) => (run = v) },
        }),
      ),
    );
  await solo(null);
  await solo('u1');
  await settle();
  assert.equal(document.querySelector('.ip-try-input').value === 'answer from last week', true);
  assert.equal(document.body.textContent.includes("Use this device's version"), true);
  await click("Use this device's version");
  await settle(900);
  assert.deepEqual(puts, ['run notes']);
  await act(async () => again.unmount());
});

test('story picks and editor saves build on the stories as stored now; switching asks first', async () => {
  const puts = [];
  // What the server holds; the test changes it behind the page's back, as another tab would.
  const server = {
    s1: { title: 'Launch slip', competencies: ['conflict'], situation: 'OLD' },
    s2: { title: 'Schema fight', competencies: ['conflict'] },
  };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/api/content/item')) return Response.json(question);
    if (init.method === 'PUT') {
      const id = decodeURIComponent(u.split('target=')[1]).slice('story:'.length);
      const story = JSON.parse(JSON.parse(init.body).body);
      puts.push([id, story]);
      server[id] = story;
      return Response.json({ updatedAt: 9 });
    }
    if (u.includes('prefix=story')) return Response.json({ items: Object.entries(server).map(([id, s]) => storyNote(id, s)) });
    if (u.includes('target=content')) return Response.json({ body: '', updatedAt: null });
    throw new Error(`unexpected ${u}`);
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(createElement(ContentDetail, { params: { type: 'interview_question', slug: 'disagree-1' }, navigate() {}, problemIds: [], userId: 'u1' })),
  );
  await settle();
  server.s1 = { ...server.s1, situation: 'EDITED IN THE BANK' };
  const select = document.querySelector('.ip-pick-select');
  await act(async () => {
    select.value = 's1';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await settle();
  assert.equal(puts.at(-1)[1].situation, 'EDITED IN THE BANK', 'the pick does not write back the stale copy');
  await act(async () => root.unmount());

  // The bank: open s2, type without saving, then click s1: asked first; saying no keeps the text.
  let asked = 0;
  globalThis.confirm = () => (asked++, false);
  const bank = createRoot(document.getElementById('root'));
  await act(async () => bank.render(createElement(StoryBank, { userId: 'u1' })));
  await settle();
  await click('Schema fight');
  await type(document.querySelector('[data-field="action"] textarea'), 'unsaved action');
  await click('Launch slip');
  assert.equal(asked, 1);
  assert.equal(document.querySelector('[data-field="action"] textarea').value === 'unsaved action', true);

  // Meanwhile a question page picked s2 for another question; saving here keeps that link.
  const link = { key: 'interview_question/other', title: 'Other', company: null };
  server.s2 = { ...server.s2, questions: [link] };
  await act(async () => document.querySelector('#ip-editor').requestSubmit());
  await settle();
  const [id, story] = puts.at(-1);
  assert.equal(id, 's2');
  assert.equal(story.action, 'unsaved action');
  assert.deepEqual(story.questions, [link]);
  // Saved now: switching no longer asks.
  await click('Launch slip');
  assert.equal(asked, 1);
  assert.equal(document.querySelector('.ip-field input').value === 'Launch slip', true);
  await act(async () => bank.unmount());
});

test('story bank: themes interviews asked about with no story yet, each one a click from a new story', async () => {
  const retro = (company, themes) => ({
    target: `retro:0b5f8c1e-1f2a-4c3d-9e8f-123456789abc/${company.toLowerCase()}`,
    body: JSON.stringify({ company, stage: 'onsite', at: 1, score: 2, questions: [], stuck: '', themes }),
    updatedAt: 1,
  });
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('prefix=story')) return Response.json({ items: [storyNote('s1', { title: 'Schema fight', competencies: ['conflict'] })] });
    if (u.includes('prefix=retro')) return Response.json({ items: [retro('Acme', ['conflict', 'failure']), retro('Beta', ['failure', 'Dive Deep'])] });
    throw new Error(`unexpected ${u}`);
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(StoryBank, { userId: 'u1' })));
  await settle();
  const section = document.querySelector('.ip-missing');
  assert.equal(section.querySelector('h2').textContent, 'Asked in interviews, no story yet');
  assert.deepEqual(
    [...section.querySelectorAll('li')].map((li) => [...li.children].map((c) => c.textContent)),
    [['Failure', 'Acme, Beta', 'Write one Failure'], ['Dive Deep', 'Beta', 'Write one Dive Deep']],
  );
  await act(async () => section.querySelector('button').click());
  const chip = [...document.querySelectorAll('#ip-editor .ip-chip')].find((l) => l.textContent === 'Failure');
  assert.equal(chip.querySelector('input').checked, true);
  await act(async () => root.unmount());
});
