import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
// CSS is a no-op here, and next/link (aliased by the bundler) is a stub: these parts render no links.
register(
  `data:text/javascript,${encodeURIComponent(
    "export async function resolve(s,c,n){if(s==='next/link')return {url:'data:text/javascript,export default function Link(){return null}',shortCircuit:true};return n(s,c);}" +
      "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);
const { FeedbackCard, FeedbackLink } = await import('../components/mock-interview.tsx');

const item = (id, title) => ({
  id, type: 'coding_question', slug: id, title, company: null, role: null, round: null, difficulty: null, problem: null,
  math: false, principles: [], question: 'Q', hints: '', followUps: '', rubric: '', solution: '',
});
const data = {
  seed: 'k3x9q2ab',
  rerolls: [],
  template: { id: 'phone', name: ['SWE 电话面', 'SWE phone screen'] },
  slots: [
    { kind: 'behavioral', minutes: 5, similar: false, pool: 80, item: item('b1', 'Tell me about a conflict') },
    { kind: 'coding', minutes: 25, similar: false, pool: 80, item: item('c1', 'Merge intervals') },
  ],
};
const query = { template: 'phone', set: 'k3x9q2ab' };
const feedback = {
  seed: 'k3x9q2ab',
  rerolls: [],
  rubric: { communication: 4, coding: 2 },
  verdict: 'yes',
  strengths: 'Asked about <empty> input first',
  improvements: 'Say the complexity out loud',
  questions: [{ rating: 3, note: 'Clear STAR story' }, { rating: null, note: '' }],
};
const card = (props) =>
  renderToStaticMarkup(createElement(FeedbackCard, { data, query, feedback, broken: false, saved: false, onSave: () => true, ...props }));

test('the candidate sees the verdict, rubric, notes and each question with its rating', () => {
  const html = card();
  assert.ok(html.includes('aria-labelledby="mi-fb-kicker mi-fb-title"'));
  assert.ok(/id="mi-fb-title"[^>]*>.*Lean hire/.test(html));
  assert.ok(html.includes('>3.0<'));
  assert.ok(/<dt>Communication<\/dt><dd><span class="mi-pips" data-n="4">/.test(html));
  assert.ok(/<dt>Testing<\/dt><dd><span class="mi-muted">Not scored/.test(html));
  // Notes are text, never markup.
  assert.ok(html.includes('Asked about &lt;empty&gt; input first'));
  assert.ok(/Tell me about a conflict<\/p><p class="mi-fb-q-note">Clear STAR story<\/p><\/div><span class="mi-pips" data-n="3">/.test(html));
  assert.ok(/Merge intervals<\/p><\/div><span class="mi-muted">Not scored/.test(html));
  assert.ok(/role="status"/.test(html));
  assert.ok(html.includes('Save to my sessions'));
  assert.equal(html.includes('different set'), false);
});

test('a saved card says where it lives; another set and a broken link are flagged', () => {
  assert.ok(card({ saved: true }).includes('Recent sessions'));
  assert.ok(card({ query: { ...query, rr: '1' } }).includes('different set'));
  const broken = card({ feedback: null, broken: true });
  assert.ok(/role="alert"[^>]*>.*incomplete or damaged/.test(broken));
  assert.equal(broken.includes('mi-fb-title'), false);
});

test('the interviewer gets a create-link button, a notes switch and a cut warning for long notes', () => {
  globalThis.location = { origin: 'https://cswork.org', hash: '' };
  const run = (notes) => ({
    phase: 'run', index: 0, since: null, elapsed: [], shown: {},
    ratings: { 0: 3 }, notes, rubric: { testing: 2 }, verdict: 'strong-yes', strengths: 'ok',
  });
  const short = renderToStaticMarkup(createElement(FeedbackLink, { data, query, run: run({ 1: 'fine' }) }));
  assert.ok(short.includes('Create feedback link'));
  assert.ok(/<input type="checkbox" checked=""/.test(short));
  assert.ok(/role="status"/.test(short));
  assert.equal(short.includes('too long for a link'), false);
  const long = renderToStaticMarkup(createElement(FeedbackLink, { data, query, run: run({ 1: '很长的记录'.repeat(500) }) }));
  assert.ok(long.includes('too long for a link'));
});
