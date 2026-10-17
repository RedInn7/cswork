import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/english/self-intro' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
const { createRoot, hydrateRoot } = await import('react-dom/client');
const { renderToString } = await import('react-dom/server');
const { EnglishDoneCheck, EnglishDoneCount, EnglishUnit } = await import('../components/english-unit.tsx');
const { englishUnit } = await import('../lib/interview-english.ts');
const { scramble } = await import('../lib/english-drill.ts');

const unit = englishUnit('self-intro');
let marks;
let posted = [];
globalThis.fetch = async (url, init = {}) => {
  const path = String(url);
  if (path === '/api/oj/marks?mark=done')
    return marks ? Response.json({ items: marks }) : Response.json({ error: 'Please sign in' }, { status: 401 });
  if (path === '/api/oj/marks' && init.method === 'POST') {
    posted.push(JSON.parse(init.body));
    return Response.json({ ok: true });
  }
  throw new Error(`unexpected ${path}`);
};
const spoken = [];
let recognizer;
const installSpeech = () => {
  globalThis.speechSynthesis = { speak: (u) => spoken.push(u), cancel: () => {} };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  dom.window.webkitSpeechRecognition = class {
    start() {
      recognizer = this;
    }
    stop() {
      this.onend?.();
    }
  };
};
const settle = () => new Promise((r) => setTimeout(r, 0));
// The marks request resolves over a few ticks.
const until = async (check) => {
  for (let i = 0; i < 50 && !check(); i++) await act(settle);
};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const click = (el) =>
  act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await settle();
  });
const type = (el, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
const blur = (el) => act(async () => el.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true })));
const button = (text, within = document) => [...within.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const solveAll = async () => {
  for (const [i, input] of $$('.eng-blank').entries()) await type(input, unit.drills.cloze[i].answers[0]);
  for (const [i, drill] of unit.drills.order.entries())
    for (let k = 0; k < drill.parts.length; k++) {
      const pool = $$('.eng-pool')[i];
      await click(button(drill.parts[k], pool));
    }
};

test('server render without speech, then hydration adds listen and shadow buttons', async () => {
  installSpeech();
  const container = document.getElementById('root');
  // The server render reports no speech (its snapshot), so the HTML carries no speech buttons.
  container.innerHTML = renderToString(createElement(EnglishUnit, { unit }));
  assert.equal(button('Listen'), undefined);
  assert.equal($$('.eng-phrase').length, unit.phrases.length);
  const errors = [];
  let root;
  await act(async () => {
    root = hydrateRoot(container, createElement(EnglishUnit, { unit }), { onRecoverableError: (e) => errors.push(e) });
    await settle();
  });
  assert.deepEqual(errors, []);
  assert.equal($$('.eng-phrase .eng-tool').length, unit.phrases.length * 2);
  // Shadowing is offered on the candidate's lines only; listening on every line.
  const candidate = unit.dialogue.filter((line) => line.who === 'C').length;
  assert.equal($$('.eng-script .eng-tool').length, unit.dialogue.length + candidate);
  await act(async () => root.unmount());
});

test('listen, play line by line, the English-only switch', async () => {
  installSpeech();
  spoken.length = 0;
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(createElement(EnglishUnit, { unit }));
    await settle();
  });
  // English readers start with English only; the switch brings the Chinese back.
  assert.equal($$('.eng-phrase .eng-zh').length, 0);
  await click($('.eng-switch input'));
  assert.equal($$('.eng-phrase .eng-zh').length, unit.phrases.length);
  await click(button('Listen', $('.eng-phrase')));
  assert.deepEqual([spoken[0].text, spoken[0].lang, spoken[0].rate], [unit.phrases[0].en, 'en-US', 0.95]);
  await click(button('Play line by line'));
  assert.equal(spoken.at(-1).text, unit.dialogue[0].en);
  assert.equal($('.eng-script li[aria-current]'), $$('.eng-script li')[0]);
  await act(async () => spoken.at(-1).onend());
  assert.equal(spoken.at(-1).text, unit.dialogue[1].en);
  assert.equal($('.eng-script li[aria-current]'), $$('.eng-script li')[1]);
  // A single line interrupts the run: the old line's end no longer advances it.
  const old = spoken.at(-1);
  await click(button('Listen', $$('.eng-script li')[3]));
  await act(async () => old.onend());
  assert.equal(spoken.at(-1).text, unit.dialogue[3].en);
  assert.equal($('.eng-script li[aria-current]'), null);
  await act(async () => root.unmount());
});

test('shadowing scores the attempt; nothing heard says so', async () => {
  installSpeech();
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(createElement(EnglishUnit, { unit }));
    await settle();
  });
  const card = $('.eng-phrase');
  await click(button('Shadow', card));
  assert.equal(recognizer.continuous, false);
  assert.equal(recognizer.lang, 'en-US');
  assert.equal(button('Stop', card).getAttribute('aria-pressed'), 'true');
  // Other shadow buttons wait their turn.
  assert.equal(button('Shadow', $$('.eng-phrase')[1]).disabled, true);
  const realNow = Date.now;
  const base = realNow();
  try {
    Date.now = () => base;
    await act(async () => recognizer.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'sure' }], { isFinal: false })] }));
    Date.now = () => base + 4_000;
    const said = "um sure I'll give you a quick overview of my background";
    await act(async () => recognizer.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: said }], { isFinal: true })] }));
  } finally {
    Date.now = realNow;
  }
  await act(async () => recognizer.onend());
  const score = card.querySelector('.eng-score').textContent;
  // 12 words ("I'll" is "I will") against the phrase's 11, all in order; 11 spoken words over 4 seconds; "um".
  assert.match(score, /Match 96% · very close/);
  assert.match(score, /About 165 words\/min/);
  assert.match(score, /1 filler\b/);
  assert.ok(button('Shadow', card));
  await click(button('Shadow', card));
  await act(async () => recognizer.onend());
  assert.match(card.querySelector('.eng-score').textContent, /Didn't catch anything/);
  await act(async () => root.unmount());
});

test('drills check as you answer; a guest finishing the unit keeps the tick in this browser', async () => {
  installSpeech();
  localStorage.clear();
  marks = null;
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(createElement(EnglishUnit, { unit }));
    await settle();
  });
  const [first] = $$('.eng-blank');
  await type(first, 'outline');
  await blur(first);
  assert.equal(first.closest('li').dataset.state, 'wrong');
  assert.equal(first.getAttribute('aria-invalid'), 'true');
  // A listed synonym, any case, is right as soon as it is typed.
  await type(first, 'Summary');
  assert.equal(first.closest('li').dataset.state, 'right');
  await click(button('Show answer', $$('.eng-drills li')[1]));
  assert.match($$('.eng-drills li')[1].textContent, /Answers: Before \/ Prior to/);
  // Order: the pool never starts in the answer's order; a wrong order can start over.
  const drill = unit.drills.order[0];
  const pool = () => $$('.eng-pool')[0];
  assert.deepEqual(
    [...pool().querySelectorAll('button')].map((b) => b.textContent),
    scramble(drill.parts).map((at) => drill.parts[at]),
  );
  for (const part of [...drill.parts].reverse()) await click(button(part, pool()));
  assert.match($$('.eng-pool')[0].closest('li').textContent, /Not in the right order/);
  await click(button('Start over', $$('.eng-pool')[0].closest('li')));
  assert.equal(pool().querySelectorAll('button').length, drill.parts.length);
  assert.equal(localStorage.getItem('cswork:english:done'), null);
  await solveAll();
  assert.match($('.eng-finish').textContent, /Every drill is right/);
  assert.equal($('.eng-finish input').checked, true);
  assert.deepEqual(JSON.parse(localStorage.getItem('cswork:english:done')), ['self-intro']);
  assert.match($('.eng-finish').textContent, /stays in this browser/);
  assert.deepEqual(posted, []);
  // Unticking by hand sticks.
  await click($('.eng-finish input'));
  assert.equal(localStorage.getItem('cswork:english:done'), null);
  await act(async () => root.unmount());
});

test("signed in: this browser's ticks move to the account; finishing posts the done mark", async () => {
  installSpeech();
  localStorage.setItem('cswork:english:done', JSON.stringify(['clarify', '../bad']));
  marks = [{ target: 'content:english/star' }, { target: 'problem:lc-1' }];
  posted = [];
  const root = createRoot(document.getElementById('root'));
  await act(async () => {
    // The unit list's progress widgets share the page's one marks request.
    root.render(
      createElement(
        'div',
        null,
        createElement(EnglishDoneCount, { slugs: ['self-intro', 'clarify', 'star', 'testing'] }),
        createElement('i', { id: 'star' }, createElement(EnglishDoneCheck, { slug: 'star' })),
        createElement('i', { id: 'testing' }, createElement(EnglishDoneCheck, { slug: 'testing' })),
        createElement(EnglishUnit, { unit }),
      ),
    );
    await settle();
  });
  await until(() => localStorage.getItem('cswork:english:done') === null);
  assert.deepEqual(posted, [{ target: 'content:english/clarify', mark: 'done', on: true }]);
  assert.equal(localStorage.getItem('cswork:english:done'), null);
  assert.equal($('.eng-finish input').checked, false);
  assert.match($('.eng-count').textContent, /^2 of 4 units done$/);
  assert.equal($('#star').textContent.trim(), 'Done');
  assert.equal($('#testing').textContent, '');
  await solveAll();
  await act(settle);
  assert.deepEqual(posted.at(-1), { target: 'content:english/self-intro', mark: 'done', on: true });
  assert.equal($('.eng-finish input').checked, true);
  assert.doesNotMatch($('.eng-finish').textContent, /stays in this browser/);
  assert.match($('.eng-count').textContent, /^3 of 4 units done$/);
  await act(async () => root.unmount());
});
