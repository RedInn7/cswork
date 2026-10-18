// components/template-drill.tsx in a browser: swap lines back into order by tapping, fill the
// blanks, switch language or template, get a fresh drill, and write a template from memory
// (diffed, run on a stubbed judge, and graded into the recall queue).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The lazy editor is a textarea here; stylesheets are empty modules.
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const editorMock = `import React from ${JSON.stringify(react)}; export function CodeEditor(p){return React.createElement('textarea',{'aria-label':'test editor',value:p.value,onInput:e=>p.onChange(e.currentTarget.value)});}`;
register(
  `data:text/javascript,${encodeURIComponent(`const editor=${JSON.stringify(editorMock)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};if(u.endsWith('/components/editor.tsx'))return {format:'module',source:editor,shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const window = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/topics/binary-search' }).window;
for (const name of ['window', 'document', 'location', 'localStorage', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'CustomEvent', 'HTMLDetailsElement', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { TemplateDrill, RECALL_TIMES_KEY } = await import('../components/template-drill.tsx');
const { CODE_LANG_KEY, TemplateLangMemory } = await import('../components/template-lang-memory.tsx');
const { orderDrill, blankDrill } = await import('../lib/template-drills.ts');
const { templateFor, variantsFor, TEMPLATE_LANGS } = await import('../lib/route-templates.ts');
const { DRIVERS } = await import('../lib/route-template-drivers.ts');
const { RECALL_KEY, parseRecall } = await import('../lib/recall.ts');
const { createRoot } = await import('react-dom/client');

const slug = 'binary-search';
const { code } = templateFor(slug);
const templates = [
  { id: 'main', label: 'Main template', code, driver: DRIVERS[slug] },
  ...variantsFor(slug).map((v) => ({ id: v.id, label: v.pattern.en, code: v.code, driver: v.driver })),
];
const props = (extra = {}) => ({ slug, title: 'Binary search', templates, langs: TEMPLATE_LANGS, zh: false, signedIn: false, ...extra });
const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
const said = () => document.querySelector('.topics-drill-actions output').textContent;
// React tracks an input's value; set it through the prototype setter so onChange fires.
const type = (input, value) => {
  const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
};
/** Lets lazy imports, fetches and timers settle until `done()` holds. */
async function until(done, what) {
  for (let i = 0; i < 100 && !done(); i++) await act(() => new Promise((r) => setTimeout(r, 10)));
  assert.ok(done(), `waited for ${what}`);
}
const editor = () => document.querySelector('[aria-label="test editor"]');
/** The code as a learner writes it from memory: no comments, no docstrings. */
const bare = (source) => source.replace(/  # .*$/gm, '').replace(/^ *""".*"""\n/gm, '');

test('ordering: tap two lines to swap them until the template reads in order', async () => {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(TemplateDrill, props())));
  const drill = orderDrill(code.python, 'python', 1);
  const lines = () => [...document.querySelectorAll('.topics-drill-lines button')];
  assert.equal(lines().length, drill.lines.length);
  await act(async () => button('Check').click());
  assert.match(said(), /still out of place/);
  assert(lines().some((b) => b.dataset.state === 'wrong'));
  // Selection sort by taps: put the line that belongs at i into slot i.
  const now = [...drill.start];
  for (let i = 0; i < now.length; i++) {
    const j = now.indexOf(i);
    if (j === i) continue;
    await act(async () => lines()[j].click());
    assert.equal(lines()[j].getAttribute('aria-pressed'), 'true');
    await act(async () => lines()[i].click());
    [now[i], now[j]] = [now[j], now[i]];
  }
  await act(async () => button('Check').click());
  assert.equal(said(), 'All lines are in order.');
  assert(lines().every((b) => b.dataset.state === 'right' && b.querySelector('.sr-only').textContent === 'In place: '));

  // Another language starts a fresh drill on that language's template, and is remembered.
  await act(async () => button('Go').click());
  assert.equal(lines().length, orderDrill(code.go, 'go', 1).lines.length);
  assert.equal(said(), '');
  assert.equal(localStorage.getItem(CODE_LANG_KEY), 'go');
  // Another template: the drill is cut from that variant.
  const variant = templates[1];
  await act(async () => button(variant.label).click());
  assert.equal(button(variant.label).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(lines().map((b) => b.textContent).sort(), orderDrill(variant.code.go, 'go', 1).lines.sort());
  await act(async () => root.unmount());
  localStorage.clear();
});

test('blanks: typing the cut expressions, spacing aside, is right; Show answers fills them in', async () => {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(TemplateDrill, props({ zh: true }))));
  await act(async () => button('填空题').click());
  const holes = blankDrill(code.python, 'python', 1).filter((l) => typeof l !== 'string');
  const inputs = () => [...document.querySelectorAll('.topics-drill-code input')];
  assert.equal(inputs().length, holes.length);
  assert.equal(inputs()[0].getAttribute('aria-label'), '第 1 空');
  await act(async () => button('检查').click());
  assert.match(said(), /还有 \d+ 个不对/);
  assert.equal(inputs()[0].getAttribute('aria-invalid'), 'true');
  // Each blank gets a ✓ / ✗ and words, not just a border colour.
  const marks = () => [...document.querySelectorAll('.topics-drill-code .topics-drill-mark .sr-only')].map((m) => m.textContent);
  assert.deepEqual(marks(), holes.map(() => '不对'));
  for (const [i, hole] of holes.entries()) await act(async () => type(inputs()[i], ` ${hole.answer.replace(/ /g, '   ')} `));
  await act(async () => button('检查').click());
  assert.equal(said(), '全部填对了。');
  assert.deepEqual(marks(), holes.map(() => '对'));
  // A new drill clears the answers.
  await act(async () => button('换一题').click());
  assert(inputs().every((input) => input.value === ''));
  await act(async () => button('显示答案').click());
  const fresh = blankDrill(code.python, 'python', 2).filter((l) => typeof l !== 'string');
  assert.deepEqual(inputs().map((input) => input.value), fresh.map((h) => h.answer));
  assert(inputs().every((input) => input.readOnly));
  assert.equal(marks().length, 0, 'shown answers are not graded');
  await act(async () => root.unmount());
});

test('the remembered language opens first; a language picked elsewhere on the page follows', async () => {
  localStorage.setItem(CODE_LANG_KEY, 'java');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(TemplateDrill, props())));
  assert.equal(button('Java').getAttribute('aria-pressed'), 'true');
  await act(async () => window.dispatchEvent(new window.CustomEvent('cswork:code-lang', { detail: 'cpp' })));
  assert.equal(button('C++').getAttribute('aria-pressed'), 'true');
  // Not a template language: ignored.
  await act(async () => window.dispatchEvent(new window.CustomEvent('cswork:code-lang', { detail: 'rust' })));
  assert.equal(button('C++').getAttribute('aria-pressed'), 'true');
  await act(async () => root.unmount());
  localStorage.clear();
});

test('recall signed out: the page code blurs, the diff grades it, and a right answer files a tpl: card', async () => {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(TemplateDrill, props())));
  await act(async () => button('Write from memory').click());
  assert.ok(document.body.hasAttribute('data-template-recall'));
  await until(editor, 'the editor');
  assert.equal(editor().value, '');
  assert.ok(button('Compare lines').disabled, 'nothing to check yet');
  // A slip: one line left out. Shown in the diff, nothing filed.
  const ref = code.python;
  await act(async () => type(editor(), ref.replace('            lo = mid + 1\n', '')));
  await act(async () => button('Compare lines').click());
  assert.match(said(), /1 line differs/);
  assert.match(said(), /Not added/);
  const missing = [...document.querySelectorAll('.topics-recall-diff li[data-op="missing"]')];
  assert.equal(missing.length, 1);
  assert.equal(missing[0].querySelector('code').textContent.trim(), 'lo = mid + 1');
  assert.equal(missing[0].querySelector('.sr-only').textContent, 'Missing: ');
  assert.equal(localStorage.getItem(RECALL_KEY), null);
  // Written out in full (comments and docstrings aside): known, filed in this browser, timed.
  await act(async () => button('Start over').click());
  assert.equal(editor().value, '');
  assert.notEqual(bare(ref), ref.replace(/  # .*$/gm, ''), 'the reference has docstrings to leave out');
  await act(async () => type(editor(), bare(ref)));
  await act(() => new Promise((r) => setTimeout(r, 1100)));
  await act(async () => button('Compare lines').click());
  assert.match(said(), /Every line matches/);
  await until(() => localStorage.getItem(RECALL_KEY), 'the recall card');
  const card = parseRecall(localStorage.getItem(RECALL_KEY)).items['tpl:binary-search/main'];
  assert.equal(card[0], 1);
  assert.equal(card[2], 'Binary search · Main template');
  const times = JSON.parse(localStorage.getItem(RECALL_TIMES_KEY))['binary-search/main/python'];
  assert.ok(times.best >= 1000 && times.last === times.best);
  await act(async () => button('Put in order').click());
  assert.ok(!document.body.hasAttribute('data-template-recall'));
  await act(async () => root.unmount());
  localStorage.clear();
});

test('recall signed in: ?drill=recall opens a variant, the judge runs its driver, pass and fail grade the card', async () => {
  const variant = templates[1];
  window.history.replaceState(null, '', `/topics/${slug}?drill=recall&v=${variant.id}`);
  let stdout = variant.driver.expected;
  let status = 'accepted';
  let putFails = false;
  const runs = [];
  const puts = [];
  globalThis.fetch = async (url, init = {}) => {
    const reply = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url === '/api/oj/playground/run') {
      runs.push(JSON.parse(init.body));
      return reply({ id: 'run-1', status: 'queued' });
    }
    if (url.startsWith('/api/oj/submissions/run-1?')) return reply({ id: 'run-1', status, mode: 'run', cases: [{ ordinal: 1, status: 'accepted', stdout: `${stdout}\n` }] });
    if (url.startsWith('/api/oj/notes?target=')) {
      if (init.method === 'PUT') {
        if (putFails) return new Response('{}', { status: 500 });
        puts.push(JSON.parse(JSON.parse(init.body).body));
        return reply({ ok: true });
      }
      return reply({ body: puts.length ? JSON.stringify(puts.at(-1)) : '' });
    }
    throw new Error(`unexpected ${url}`);
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(TemplateDrill, props({ signedIn: true }))));
  await until(editor, 'the editor');
  assert.equal(button('Write from memory').getAttribute('aria-pressed'), 'true');
  assert.equal(button(variant.label).getAttribute('aria-pressed'), 'true');
  // Written without its comments and docstrings, it still matches the template line for line.
  const written = bare(variant.code.python);
  await act(async () => type(editor(), written));
  await act(async () => button('Run and check').click());
  await until(() => puts.length === 1, 'the account note');
  // The program sent is the variant plus its driver, as Python.
  assert.equal(runs[0].language, 'python');
  assert.ok(runs[0].code.startsWith(written) && runs[0].code.includes(variant.driver.python));
  assert.match(said(), /Passed this stop's tests\. Every line matches.*Saved as known/);
  assert.deepEqual(puts[0].items[`tpl:${slug}/${variant.id}`].slice(0, 1), [1]);
  // The judge itself failed: not the learner's fault, so only the diff grades and the card keeps its box.
  status = 'system_error';
  await act(async () => button('Start over').click());
  await act(async () => type(editor(), written));
  await act(async () => button('Run and check').click());
  await until(() => puts.length === 2, 'the diff-only grade');
  assert.match(said(), /tests could not run, so only the line diff counts.*Saved as known/);
  assert.equal(document.querySelector('.topics-recall-error').textContent, 'System Error');
  assert.equal(document.querySelector('.topics-recall-output'), null);
  assert.deepEqual(puts[1].items[`tpl:${slug}/${variant.id}`].slice(0, 1), [1]);
  // A wrong answer from the judge: shown against the expected output, back to box 0.
  status = 'accepted';
  stdout = '0';
  await act(async () => button('Start over').click());
  await act(async () => type(editor(), written));
  await act(async () => button('Run and check').click());
  await until(() => puts.length === 3, 'the third grade');
  assert.match(said(), /does not match/);
  assert.match(said(), /not known, back tomorrow/);
  assert.deepEqual(puts[2].items[`tpl:${slug}/${variant.id}`].slice(0, 1), [0]);
  assert.ok(document.querySelector('.topics-recall-output').textContent.includes(variant.driver.expected.split('\n')[0]));
  // The account note cannot be written: says so instead of claiming it saved.
  putFails = true;
  await act(async () => button('Start over').click());
  await act(async () => type(editor(), written));
  await act(async () => button('Run and check').click());
  await until(() => /Couldn't save/.test(said()), 'the failed save');
  assert.doesNotMatch(said(), /saved as not known/);
  await act(async () => root.unmount());
  delete globalThis.fetch;
  window.history.replaceState(null, '', `/topics/${slug}`);
});

test('TemplateLangMemory opens the remembered language in every group and remembers the one opened', async () => {
  localStorage.setItem(CODE_LANG_KEY, 'go');
  const group = (name) =>
    ['python', 'cpp', 'java', 'go'].map((lang, i) =>
      createElement('details', { key: lang, name, 'data-lang': lang, open: i === 0 }, createElement('summary', null, lang)),
    );
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      createElement(
        'section',
        { id: 'tpl' },
        createElement(TemplateLangMemory),
        ...group('topic-code'),
        createElement('details', { id: 'variant-two', key: 'v' }, createElement('summary', null, 'two'), ...group('topic-code-two')),
        createElement('a', { href: '#variant-two', key: 'a' }, 'two'),
      ),
    ),
  );
  const section = document.getElementById('tpl');
  const open = () => [...section.querySelectorAll('details[data-lang]')].filter((d) => d.open).map((d) => d.dataset.lang);
  assert.deepEqual(open(), ['go', 'go']);
  assert.equal(section.dataset.codeLang, 'go');
  // The reader opens Java in one group: every group follows and the choice is stored.
  const java = section.querySelector('details[name="topic-code-two"][data-lang="java"]');
  await act(async () => {
    java.open = true;
    java.dispatchEvent(new window.Event('toggle'));
  });
  assert.deepEqual(open(), ['java', 'java']);
  assert.equal(localStorage.getItem(CODE_LANG_KEY), 'java');
  // A #variant- link opens that variant (jsdom fires hashchange a task later, as browsers do).
  await act(async () => {
    const changed = new Promise((r) => window.addEventListener('hashchange', r, { once: true }));
    window.location.hash = '#variant-two';
    await changed;
  });
  assert.ok(document.getElementById('variant-two').open);
  // Closed again, then its link clicked once more: the hash does not change, the click opens it.
  document.getElementById('variant-two').open = false;
  await act(async () => section.querySelector('a[href="#variant-two"]').click());
  assert.equal(window.location.hash, '#variant-two');
  assert.ok(document.getElementById('variant-two').open);
  await act(async () => root.unmount());
  localStorage.clear();
  window.history.replaceState(null, '', `/topics/${slug}`);
});
