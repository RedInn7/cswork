import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The module stubs of tests/pandas-workspace-ui.test.mjs; the editor stub hands the page a
// fake Monaco instance through onEditorMount and records its edits.
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  editor:
    prefix +
    `export function CodeEditor(p){React.useEffect(()=>{const ed={getSelection(){return {startLineNumber:1,startColumn:3,endLineNumber:1,endColumn:3};},executeEdits(source,edits){globalThis.sqlEdits.push(...edits);return true;},focus(){globalThis.sqlFocus++;}};return p.onEditorMount&&p.onEditorMount(ed,{});},[]);return React.createElement('textarea',{'aria-label':'test editor',value:p.value,onInput:e=>p.onChange(e.currentTarget.value)});} export function CodeDiff(){return null;}`,
  markdown: prefix + `export function LessonMarkdown({children,body}){return React.createElement('div',null,body||children);}`,
  panels:
    prefix +
    `export const Group=({children})=>React.createElement('div',null,children);export const Panel=Group;export const Separator=()=>null;export const useDefaultLayout=()=>({});export const usePanelRef=()=>React.useRef({expand(){},collapse(){},isCollapsed(){return false;}});`,
  dialog:
    prefix +
    `export const Dialog=({open,children})=>open?React.createElement('div',{role:'dialog'},children):null;export const DialogContent=({children})=>React.createElement('div',null,children);export const DialogDescription=DialogContent;export const DialogHeader=DialogContent;export const DialogTitle=DialogContent;`,
  alert:
    prefix +
    `export const AlertDialog=({open,children})=>open?React.createElement('div',{role:'alertdialog'},children):null;export const AlertDialogContent=({children})=>React.createElement('div',null,children);export const AlertDialogDescription=AlertDialogContent;export const AlertDialogHeader=AlertDialogContent;export const AlertDialogFooter=AlertDialogContent;export const AlertDialogTitle=AlertDialogContent;export const AlertDialogAction=({children,onClick})=>React.createElement('button',{onClick},children);export const AlertDialogCancel=AlertDialogAction;`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};export async function resolve(s,c,n){if(s==='react-resizable-panels')return {url:'mock:panels',shortCircuit:true};return n(s,c);}export async function load(u,c,n){if(u==='mock:panels')return {format:'module',source:mocks.panels,shortCircuit:true};if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};for(const [suffix,key] of [['/components/editor.tsx','editor'],['/components/lms-shared.tsx','markdown'],['/components/ui/dialog.tsx','dialog'],['/components/ui/alert-dialog.tsx','alert']])if(u.endsWith(suffix))return {format:'module',source:mocks[key],shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

// A SQL track problem: example tables as grids, a schema sidebar that inserts at the cursor,
// and under a finished submission its query plan and CTE previews as sql-peek runs.
test('the SQL workspace shows tables, inserts names and previews plans and CTEs', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.sqlEdits = [];
  globalThis.sqlFocus = 0;
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } = await import('../components/problem-workspace.tsx');
  const pkg = JSON.parse(readFileSync('content/sql-track/packages.json', 'utf8'))[0];
  const sample = pkg.cases.find((c) => !c.hidden);
  const statement = pkg.problem.translations.en;
  const problem = {
    ...pkg.problem,
    ...statement,
    sampleIn: sample.input,
    sampleOut: sample.expectedOutput,
    judgeAvailable: true,
    freeJudge: true,
  };
  const submitted = 'WITH m AS (SELECT id, name FROM employees WHERE manager_id IS NULL)\nSELECT * FROM m';
  const posts = [];
  const cancels = [];
  let queuedPeek = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (url.endsWith('/cancel')) return cancels.push(url), Response.json({ id: 'slow', status: 'cancelled' });
    if (url.endsWith('/submissions/slow')) return Response.json({ id: 'slow', status: 'queued' });
    if (queuedPeek && body?.mode === 'sql-peek') return posts.push(body), Response.json({ id: 'slow', status: 'queued' });
    if (url.endsWith('/submissions') && init.method === 'POST') {
      posts.push(body);
      const base = { problem_id: pkg.problem.id, language: 'sql', passed: 0, total: 1, created_at: Date.now() };
      if (body.mode !== 'sql-peek')
        return Response.json({ ...base, id: 's1', mode: body.mode, status: 'wrong_answer', code: submitted, cases: [{ ordinal: 0, status: 'wrong_answer', hidden: false, stdin: sample.input, expected: sample.expectedOutput, stdout: 'columns: 2\n' }] });
      // The judge sorts unordered rows as text: id 12 before id 3.
      const out = body.code.startsWith('EXPLAIN QUERY PLAN ')
        ? { stdout: 'columns: 4\n[12, 3, 0, "SCAN employees"]\n[3, 0, 0, "CO-ROUTINE m"]\n[20, 0, 0, "SCAN m"]\n', stderr: '' }
        : { stdout: 'columns: 2\n[1, "Ava"]\n[5, null]\n', stderr: '["id", "name"]\n' };
      return Response.json({ ...base, id: `p${posts.length}`, mode: 'run', status: 'finished', cases: [{ ordinal: 0, status: 'finished', hidden: false, stdin: body.stdin, ...out }] });
    }
    if (url.includes('/problem-stats/')) return Response.json({ acceptance: null, beats: null, votes: { up: 0, down: 0 }, vote: null });
    if (url.includes('/oj/posts?')) return Response.json({ solved: false, items: [], more: false });
    if (url.includes('/oj/marks')) return Response.json({ items: [] });
    if (url.includes('/submissions')) return Response.json({ items: [], nextCursor: null });
    if (url.includes('/status')) return Response.json({ available: true, languageVersions: { sql: 'SQLite 3.45' } });
    if (url.includes('/oj/ai/usage')) return Response.json({});
    return Response.json(problem);
  };
  const root = createRoot(document.getElementById('root'));
  const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 10))));
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const byText = (text, scope = document) => [...scope.querySelectorAll('button')].find((n) => n.textContent.includes(text));
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: { id: pkg.problem.id, title: statement.title, titleEn: statement.title, difficulty: '简单', tags: [], lessonId: '00-overview', courseId: 'gomall' },
          boot: { person: { id: 'student', role: 'student', verified: true }, courses: [], services: { ai: false, judge: true } },
          navigate() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();

    // The example: the employees table and the expected result as grids, the raw SQL folded away.
    const grids = $$('.cs-sql-sample .cs-sql-grid');
    assert.deepEqual(grids.map((g) => g.querySelector('figcaption strong').textContent), ['employees', 'Expected output']);
    const heads = [...grids[0].querySelectorAll('thead th')].map((th) => th.textContent);
    assert.equal(heads[0], 'idINTEGER · PK');
    assert.equal(heads[1], 'nameTEXT · NN');
    assert.equal(grids[0].querySelector('thead th[title="NULL: no manager"]')?.firstChild.textContent, 'manager_id');
    assert.ok(grids[0].querySelectorAll('td[data-null]').length > 0, 'NULLs are marked');
    assert.equal(grids[1].querySelector('thead th').textContent, '#1');
    assert.ok($('.cs-sql-sample details.cs-sql-raw summary').textContent.includes('Raw SQL'));

    // The schema sidebar inserts a column name at the cursor and gives the editor focus back.
    const schema = $('.cs-code-area[data-schema] > details.cs-sql-schema');
    assert.ok(schema?.open, 'open by default');
    await act(async () => byText('manager_id', schema).click());
    assert.deepEqual(globalThis.sqlEdits.at(-1), {
      range: { startLineNumber: 1, startColumn: 3, endLineNumber: 1, endColumn: 3 },
      text: 'manager_id',
      forceMoveMarkers: true,
    });
    assert.equal(globalThis.sqlFocus, 1);
    await act(async () => byText('employees', schema).click());
    assert.equal(globalThis.sqlEdits.at(-1).text, 'employees');
    // An initially open <details> fires 'toggle' too, maybe before the stored choice is read:
    // a toggle that reports the state the sidebar already has is not stored; a real one is.
    const KEY = 'cswork:sql-schema';
    localStorage.setItem(KEY, 'closed');
    await act(async () => schema.dispatchEvent(new window.Event('toggle')));
    assert.equal(localStorage.getItem(KEY), 'closed');
    assert.ok(schema.open);
    localStorage.setItem(KEY, 'open');
    schema.open = false;
    await settle();
    assert.equal(localStorage.getItem(KEY), 'closed');
    schema.open = true;
    await settle();
    assert.equal(localStorage.getItem(KEY), 'open');

    // Nothing to inspect before a submission; after one, a plan button and one per CTE.
    assert.equal($('.cs-sql-inspect'), null);
    await act(async () => byText('Submit', $('.cs-code-caption')).click());
    await settle();
    const inspect = $('.cs-sql-inspect');
    assert.ok(inspect);
    assert.deepEqual([...inspect.querySelectorAll('.cs-sql-inspect-actions button')].map((b) => b.textContent), ['Query plan', 'CTE m']);

    await act(async () => byText('Query plan', inspect).click());
    await settle();
    const peek = posts.at(-1);
    assert.equal(peek.mode, 'sql-peek');
    assert.equal(peek.language, 'sql');
    assert.equal(peek.stdin, sample.input);
    assert.equal(peek.code, `EXPLAIN QUERY PLAN ${submitted}`);
    // Rebuilt from parent ids in id order: the scan nests under its co-routine.
    const steps = [...inspect.querySelectorAll('.cs-sql-plan li > span')].map((s) => [s.textContent, s.dataset.plan ?? '']);
    assert.deepEqual(steps, [['CO-ROUTINE m', ''], ['SCAN employees', 'warn'], ['SCAN m', 'warn']]);
    assert.equal(inspect.querySelector('.cs-sql-plan > ul > li > ul > li > span').textContent, 'SCAN employees');
    assert.ok(inspect.querySelector('.cs-sql-plan-legend').textContent.includes('SEARCH … USING INDEX'));
    assert.equal(byText('Query plan', inspect).getAttribute('aria-pressed'), 'true');

    await act(async () => byText('CTE m', inspect).click());
    await settle();
    assert.match(posts.at(-1).code, /^-- cswork:names\nWITH m AS \(SELECT id, name FROM employees WHERE manager_id IS NULL\)\nSELECT \* FROM "m" LIMIT 50$/);
    const preview = inspect.querySelector('.cs-sql-grid');
    assert.deepEqual([...preview.querySelectorAll('thead th')].map((th) => th.textContent), ['id', 'name']);
    assert.equal(preview.querySelector('td[data-null]').textContent, 'NULL');
    assert.equal(inspect.querySelector('.cs-sql-plan'), null, 'one preview at a time');
    // Screen readers hear a short status, not the grid.
    const live = inspect.querySelector('[aria-live]');
    assert.equal(live.textContent, 'CTE m: 2 rows');
    assert.equal(live.querySelector('table'), null);

    // A replaced peek is cancelled on the server too: peeks share the learner's two judge slots.
    queuedPeek = true;
    await act(async () => byText('Query plan', inspect).click());
    await settle();
    assert.equal(live.textContent, 'Running…');
    queuedPeek = false;
    await act(async () => byText('CTE m', inspect).click());
    await settle();
    assert.deepEqual(cancels, ['/api/oj/submissions/slow/cancel']);
    assert.equal(live.textContent, 'CTE m: 2 rows');
    // Peeks are not the learner's runs: the result above still shows the submission.
    assert.equal(posts.filter((p) => p.mode === 'sql-peek').length, 4);

    // A sidebar folded on an earlier visit mounts folded and stays so; an example follows the
    // statement's language, not the site's.
    const { SqlSchema, SqlSample } = await import('../components/sql-workspace.tsx');
    localStorage.setItem(KEY, 'closed');
    const host = document.body.appendChild(document.createElement('div'));
    const second = createRoot(host);
    await act(async () =>
      second.render(
        createElement('div', null, [
          createElement(SqlSchema, { key: 'schema', input: sample.input, onInsert() {} }),
          createElement(SqlSample, { key: 'sample', input: sample.input, expected: sample.expectedOutput, english: false }),
        ]),
      ),
    );
    await settle();
    assert.equal(host.querySelector('details.cs-sql-schema').open, false);
    assert.equal(localStorage.getItem(KEY), 'closed');
    assert.equal([...host.querySelectorAll('.cs-sql-grid figcaption strong')].at(-1).textContent, '期望输出');
    assert.equal(host.querySelector('.cs-sql-raw summary').textContent, '原始 SQL 和输出');
    assert.match(host.querySelector('.cs-sql-grid figcaption span').textContent, /^\d+ 行$/);
    await act(async () => second.unmount());
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
