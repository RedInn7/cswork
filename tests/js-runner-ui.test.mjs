// lib/js-runner.ts and /frontend/js (components/js-workspace.tsx) in JSDOM. The sandbox is a hidden
// iframe with sandbox="allow-scripts" only (an opaque origin: no cookies, storage or site APIs) and a
// CSP without 'unsafe-eval'. JSDOM has no Workers or real sandboxing, so the iframe's script runs
// here in a vm with a fake Worker that runs the real worker source in another vm: harness, code and
// tests run end to end. Removing the iframe kills its worker; the browser's own enforcement of the
// sandbox and the CSP is checked by hand.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { resolveObjectURL } from 'node:buffer';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  editor:
    prefix +
    `export function JsEditor(p) {
      return React.createElement('textarea', { 'aria-label': 'code', value: p.value, onChange: (e) => p.onChange(e.target.value) });
    }`,
  markdown: prefix + `export const StatementMarkdown = ({ body, className }) => React.createElement('div', { className, 'data-markdown': '' }, body);`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};for(const [suffix,key] of [['/components/js-editor.tsx','editor'],['/components/statement-markdown.tsx','markdown']])if(u.endsWith(suffix))return {format:'module',source:mocks[key],shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/frontend/js/debounce' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** The real worker source in a vm "worker global"; `hang` makes the next workers never start. */
let hang = false;
class FakeWorker {
  constructor(url) {
    resolveObjectURL(url)
      .text()
      .then((source) => {
        if (hang) return;
        const scope = {
          setTimeout,
          clearTimeout,
          setInterval,
          clearInterval,
          postMessage: (data) => setTimeout(() => !this.terminated && this.onmessage?.({ data })),
        };
        scope.self = scope;
        vm.createContext(scope);
        try {
          vm.runInContext(source, scope, { filename: 'worker.js' });
        } catch (error) {
          const lineno = Number(/worker\.js:(\d+)/.exec(error.stack)?.[1]);
          setTimeout(() => !this.terminated && this.onerror?.({ message: `Uncaught ${error.name}: ${error.message}`, lineno, preventDefault() {} }));
        }
      });
  }
  terminate() {
    this.terminated = true;
  }
}
/** Stands in for the browser loading the iframe: its inline script runs with FakeWorker. */
const frames = [];
new dom.window.MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.tagName !== 'IFRAME') continue;
      frames.push(node);
      const scope = {
        Blob,
        URL,
        Worker: class extends FakeWorker {
          constructor(url) {
            super(url);
            node.worker = this;
          }
        },
        parent: {
          postMessage: (data) =>
            setTimeout(() => node.isConnected && window.dispatchEvent(new window.MessageEvent('message', { data, source: node.contentWindow }))),
        },
      };
      vm.createContext(scope);
      vm.runInContext(node.srcdoc.split('<script>')[1].replace('</script>', ''), scope);
    }
    for (const node of record.removedNodes) if (node.tagName === 'IFRAME') node.worker?.terminate();
  }
}).observe(document.body, { childList: true });

const { runJs, sandboxSource, JS_SANDBOX_CSP, MAX_LOG_LINES } = await import('../lib/js-runner.ts');
const { createRoot } = await import('react-dom/client');
const { JsWorkspace } = await import('../components/js-workspace.tsx');
const manifest = JSON.parse(readFileSync('lib/content/frontend-js.json', 'utf8'));
const debounce = manifest.problems.find((p) => p.slug === 'debounce');
const run = (code, scope = 'public', extra = {}) => runJs({ harness: manifest.harness, code, tests: debounce.tests, scope, ...extra }).done;

test('the sandbox is a hidden opaque-origin iframe whose CSP allows no eval and no network', async () => {
  hang = true;
  const started = runJs({ harness: manifest.harness, code: 'const s = "</script><img src=x onerror=alert(1)>";', tests: '', scope: 'all' });
  after(() => started.stop());
  const frame = document.querySelector('iframe');
  assert.equal(frame.getAttribute('sandbox'), 'allow-scripts');
  assert.equal(frame.hidden, true);
  assert.ok(frame.srcdoc.startsWith(`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${JS_SANDBOX_CSP}">`));
  assert.equal(JS_SANDBOX_CSP, "default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:");
  assert.doesNotMatch(JS_SANDBOX_CSP, /unsafe-eval|connect-src|allow-same-origin/);
  // The learner's code can't close the page's script early.
  assert.equal(frame.srcdoc.split('</script>').length, 2);
  assert.equal(sandboxSource('x').includes('new Worker(URL.createObjectURL(new Blob('), true);
  started.stop();
  assert.equal((await started.done).status, 'stopped');
  assert.equal(document.querySelector('iframe'), null);
});

test('Run checks the public cases, Submit all of them, with console output', async () => {
  hang = false;
  const code = `${debounce.solution}\nconsole.log('loaded', { ok: true }, [1, 2]);\nconsole.warn('careful');`;
  const open = await run(code);
  assert.equal(open.status, 'done');
  assert.equal(open.total, 2);
  assert.deepEqual(
    open.cases.map((c) => [c.public, c.pass]),
    [
      [true, true],
      [true, true],
    ],
  );
  assert.deepEqual(open.logs, [
    { level: 'log', text: 'loaded {ok: true} [1, 2]' },
    { level: 'warn', text: 'careful' },
  ]);
  const all = await run(code, 'all');
  assert.equal(all.total, debounce.cases.length);
  assert.equal(all.cases.length, all.total);
  assert.ok(all.cases.every((c) => c.pass));
  assert.equal(document.querySelector('iframe'), null);
});

test('a wrong answer fails its cases with the assertion messages', async () => {
  const result = await run(debounce.starter);
  assert.equal(result.status, 'done');
  assert.ok(result.cases.every((c) => !c.pass));
  assert.match(result.cases[0].error, /TypeError: debounced is not a function/);
});

test("a syntax error stops the run and points at the learner's line", async () => {
  const result = await run('function debounce(func) {\n  return oops oops;\n}');
  assert.equal(result.status, 'error');
  assert.match(result.error, /SyntaxError/);
  assert.equal(result.line, 2);
  assert.deepEqual(result.cases, []);
});

const problem = (slug) => manifest.problems.find((p) => p.slug === slug);
const runAll = (slug, code) => runJs({ harness: manifest.harness, code, tests: problem(slug).tests, scope: 'all' }).done;
const allPass = (result) => result.status === 'done' && result.total > 0 && result.cases.length === result.total && result.cases.every((c) => c.pass);

test('console.log works while a test has switched the built-in it relies on off', async () => {
  // array-map switches Array.prototype.map off, json-stringify JSON.stringify.
  const map = problem('array-map').solution.replace('const source', "console.log('x', [1], { a: 'b' });\n    const source");
  assert.ok(allPass(await runAll('array-map', map)));
  const json = problem('json-stringify').solution.replace('function write(key, v) {', "function write(key, v) {\n    console.log('v', { key }, [key]);");
  assert.ok(allPass(await runAll('json-stringify', json)));
});

test("the tests' own top-level names don't clash with the learner's, and the learner can't replace the harness", async () => {
  // object-create's tests declare const animal; the statement's example does too.
  assert.ok(allPass(await runAll('object-create', `${problem('object-create').solution}\nconst animal = {};`)));
  assert.ok(allPass(await runAll('get', `${problem('get').solution}\nconst data = { a: 1 };`)));
  assert.ok(allPass(await runAll('promise-all', `${problem('promise-all').solution}\nfunction later() {}`)));
  const shadowed = await runAll('object-create', `${problem('object-create').solution}\nfunction test() {}\nconst fn = 1;\nlet expect;`);
  assert.equal(shadowed.total, problem('object-create').cases.length);
  assert.ok(allPass(shadowed));
});

test('console output is capped', async () => {
  const result = await run(`${debounce.solution}\nfor (let i = 0; i < 500; i++) console.log(i);`);
  assert.equal(result.logs.length, MAX_LOG_LINES + 1);
  assert.equal(result.logs.at(-1).text, '…');
  assert.equal(result.logs[0].text, '0');
});

test('a run past the time limit is stopped, its iframe removed and its worker killed', async () => {
  hang = true;
  const result = await run(debounce.solution, 'public', { timeoutMs: 50 });
  hang = false;
  assert.equal(result.status, 'timeout');
  assert.equal(document.querySelector('iframe'), null);
  assert.equal(frames.at(-1).worker.terminated, true);
});

test('cases that finished before the time limit are kept', async () => {
  const tests = "test.public('fast', () => {}); test.public('slow', () => new Promise(() => {}));";
  const result = await runJs({ harness: manifest.harness, code: '', tests, scope: 'public', timeoutMs: 300 }).done;
  assert.equal(result.status, 'timeout');
  assert.equal(result.total, 2);
  assert.deepEqual(result.cases, [{ name: 'fast', public: true, pass: true }]);
});

// ---------------------------------------------------------------- the workspace
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ method: init.method ?? 'GET', url: String(url), body: init.body ? JSON.parse(init.body) : null });
  return Response.json(init.method === 'POST' ? {} : { items: [] });
};
const roots = [];
after(() => act(async () => roots.forEach((r) => r.unmount())));
const view = (p) => ({
  slug: p.slug,
  title: p.title.en,
  difficulty: p.difficulty,
  statement: p.statement.en,
  editorial: p.editorial.en,
  starter: p.starter,
  solution: p.solution,
  tests: p.tests,
  cases: p.cases,
});
async function mount(props = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () =>
    root.render(createElement(JsWorkspace, { problem: view(debounce), harness: manifest.harness, signedIn: true, next: { href: '/frontend/js/throttle', title: 'Throttle' }, ...props })),
  );
  return host;
}
const button = (host, text) => [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
async function type(field, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}
async function until(check, ms = 4000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await act(() => new Promise((r) => setTimeout(r, 20)));
  }
}

test('Submit with every case passing marks the problem done and opens the editorial', async () => {
  localStorage.clear();
  calls.length = 0;
  const host = await mount();
  assert.equal(host.querySelector('h1').textContent, debounce.title.en);
  assert.deepEqual(
    [...host.querySelectorAll('.fejs-public-cases li')].map((li) => li.textContent),
    debounce.cases.filter((c) => c.public).map((c) => c.name),
  );
  assert.equal(host.querySelector('textarea').value, debounce.starter);
  assert.equal(host.querySelector('.fejs-editorial [data-markdown]'), null);
  // The account's mark is checked once.
  assert.deepEqual(calls, [{ method: 'GET', url: '/api/oj/marks?target=content%3Afe-js%2Fdebounce&mark=done', body: null }]);

  await act(async () => button(host, 'Run').click());
  await until(() => host.querySelector('.fejs-summary')?.textContent.startsWith('Run: 0 / 2'));
  assert.equal(host.querySelectorAll('.fejs-cases li.is-fail').length, 2);

  await type(host.querySelector('textarea'), debounce.solution);
  await act(async () => button(host, 'Submit').click());
  await until(() => host.querySelector('.fejs-summary')?.textContent.includes(`${debounce.cases.length} / ${debounce.cases.length} passed`));
  assert.match(host.querySelector('.fejs-summary').textContent, /All passed: marked as solved/);
  await until(() => calls.length === 2);
  assert.deepEqual(calls[1], { method: 'POST', url: '/api/oj/marks', body: { target: 'content:fe-js/debounce', mark: 'done', on: true } });
  assert.ok(host.querySelector('.fejs-solved'));
  assert.equal(host.querySelector('.fejs-editorial h3').textContent, 'Reference solution');
  assert.deepEqual(JSON.parse(localStorage.getItem('cswork:fe-js:done')), ['debounce']);
  await until(() => localStorage.getItem('cswork:fe-js:debounce') === debounce.solution);
  assert.equal(host.querySelector('.fejs-next a').getAttribute('href'), '/frontend/js/throttle');
});

test('a run with no cases is not shown as passed', async () => {
  localStorage.clear();
  const host = await mount({ problem: { ...view(debounce), tests: '' } });
  await act(async () => button(host, 'Run').click());
  await until(() => host.querySelector('.fejs-summary')?.textContent.startsWith('Run: 0 / 0'));
  assert.ok(host.querySelector('.fejs-summary').classList.contains('fejs-bad'));
});

test('a saved draft comes back, the editorial asks first, and guests send nothing', async () => {
  localStorage.clear();
  localStorage.setItem('cswork:fe-js:debounce', '// my draft');
  calls.length = 0;
  const host = await mount({ signedIn: false });
  assert.equal(host.querySelector('textarea').value, '// my draft');
  assert.equal(host.querySelector('.fejs-solved'), null);
  await act(async () => button(host, 'Open it now').click());
  assert.ok(host.querySelector('.fejs-confirm'));
  await act(async () => button(host, 'Not yet').click());
  assert.equal(host.querySelector('.fejs-confirm'), null);
  await act(async () => button(host, 'Open it now').click());
  await act(async () => button(host, 'Open the editorial').click());
  assert.equal(host.querySelector('.fejs-editorial h3').textContent, 'Reference solution');
  assert.deepEqual(calls, []);
});

test('the /frontend list shows progress from this browser and the account', async () => {
  const { FrontendProblemList } = await import('../app/frontend/progress.tsx');
  localStorage.clear();
  localStorage.setItem('cswork:fe-js:done', JSON.stringify(['sleep']));
  globalThis.fetch = async () => Response.json({ items: [{ target: 'content:fe-js/once' }, { target: 'problem:lc-1' }] });
  const groups = manifest.groups.map((g) => ({
    key: g.key,
    title: g.en,
    items: manifest.problems.filter((p) => p.group === g.key).map((p) => ({ slug: p.slug, title: p.title.en, difficulty: p.difficulty })),
  }));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(createElement(FrontendProblemList, { groups, signedIn: true })));
  await until(() => host.querySelector('.fejs-progress').textContent.startsWith('2 / 40'));
  const solved = [...host.querySelectorAll('li')].filter((li) => li.querySelector('.fejs-done')).map((li) => li.querySelector('a').getAttribute('href'));
  assert.deepEqual(solved.sort(), ['/frontend/js/once', '/frontend/js/sleep']);
  assert.equal(host.querySelectorAll('.fejs-group').length, manifest.groups.length);
});
