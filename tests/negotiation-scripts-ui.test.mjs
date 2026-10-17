// /career/negotiation (components/negotiation-scripts.tsx): pick a script, reply step by step with
// no score on screen, then read every step scored and explained; ?s=<id> opens a script directly,
// and a negotiation shows its written offer but never the company's floor.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/career/negotiation' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { NegotiationScripts } = await import('../components/negotiation-scripts.tsx');
const { SCRIPTS } = await import('../lib/content/negotiation-scripts.ts');
const { SCENARIOS, scenarioSetting } = await import('../lib/server/roleplay-scenarios.ts');

const settings = Object.fromEntries(SCRIPTS.map((s) => [s.scenario, scenarioSetting(s.scenario)]));
const root = createRoot(document.getElementById('root'));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const click = (el) => act(async () => el.click());
const button = (text) => $$('button').find((b) => b.textContent.includes(text));

test('a run: no score until the end, then each step scored, explained and compared', async () => {
  await act(async () => root.render(createElement(NegotiationScripts, { zh: false, settings })));
  assert.deepEqual($$('h2').map((h) => h.textContent), ['Recruiter screen', 'Offer negotiation']);
  assert.deepEqual($$('.negotiation-list').map((l) => l.querySelectorAll('button').length), [1, 4]);

  await click(button('Asked for your number on a first call'));
  assert.equal(location.search, '?s=salary-ask');
  assert.match($('.negotiation-setting').textContent, /Cloud division of a large public tech company/);
  assert.equal($('.negotiation-offer'), null, 'a recruiter screen hides the planned offer');
  const log = $('[role="log"]');
  assert.equal(log.getAttribute('aria-live'), 'polite');
  assert.match(log.textContent, /about twenty minutes/);
  assert.equal($$('.negotiation-choices > li > button').length, 4);
  assert.equal(document.activeElement, $('#negotiation-title'), 'step 1 starts at the title, before the setting');

  for (let step = 0; step < 5; step++) {
    assert.equal($('.negotiation-score'), null, 'no score mid-run');
    await click($('.negotiation-choices button'));
    if (step === 0) assert.equal(document.activeElement, $('#negotiation-reply'), 'later steps focus the step heading');
  }
  assert.equal($('.negotiation-choices'), null);
  assert.equal(document.activeElement, $('#negotiation-score'));
  assert.equal($('.negotiation-total').textContent, '10 / 10');
  assert.match($('.negotiation-verdict').textContent, /^Solid/);
  assert.equal($$('[role="log"] [data-who="you"]').length, 5);
  assert.match(log.textContent, /technical phone screen/, 'the recruiter’s last word');
  const review = $$('.negotiation-review > li');
  assert.equal(review.length, 5);
  assert.match(review[0].textContent, /Your reply: I finish my master's/);
  assert.equal(review[0].querySelectorAll('details li').length, 3, 'the other three replies');
  assert.match(review[0].querySelector('details').textContent, /0 \/ 2/);
  assert.equal($('.negotiation-result a').getAttribute('href'), '/english/recruiter');

  await click(button('Start over'));
  assert.equal($$('.negotiation-choices button').length, 4);
  assert.equal(document.activeElement, $('#negotiation-title'));
  for (let step = 0; step < 5; step++) await click($$('.negotiation-choices button')[1]);
  assert.equal($('.negotiation-total').textContent, '0 / 10');
  assert.match($('.negotiation-verdict').textContent, /^Several/);

  await click(button('Choose another script'));
  assert.equal(location.search, '');
  assert.equal($$('.negotiation-list button').length, 5);
  assert.equal(document.activeElement, $('h2'));
  await act(async () => root.render(createElement('div')));
});

test('?s= opens a negotiation with its written offer, and no floor anywhere on the page', async () => {
  history.replaceState(null, '', '/career/negotiation?s=competing-offer');
  await act(async () => root.render(createElement(NegotiationScripts, { zh: true, settings })));
  assert.equal($('#negotiation-title').textContent, '用竞争 offer 争取更好的条件');
  assert.equal($('.negotiation-offer caption').textContent, '书面 offer');
  assert.deepEqual(
    $$('.negotiation-offer td').map((td) => td.textContent),
    ['$150,000', '$0', '$160,000', '$30,000'],
  );
  assert.equal(document.activeElement, document.body, 'no focus jump on load');
  const hidden = SCENARIOS.find((x) => x.id === 'neg-cloud-newgrad');
  for (const text of [...hidden.notes, ...hidden.concessions.flat()]) assert.ok(!document.body.textContent.includes(text), text);
  assert.doesNotMatch(document.body.textContent, /(?<![\d,])(220|60),000|22 万|(?<![\d.])6 万/, 'the floor’s stock and sign-on');
  await act(async () => root.render(createElement('div')));
  history.replaceState(null, '', '/career/negotiation?s=nope');
  await act(async () => root.render(createElement(NegotiationScripts, { zh: true, settings })));
  assert.equal($$('.negotiation-list button').length, 5, 'an unknown id shows the list');
  await act(async () => root.render(createElement('div')));
});
