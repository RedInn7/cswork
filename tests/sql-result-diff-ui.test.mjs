import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

// The judge result panel draws a SQL case's expected and actual result sets as one diffed table.
test('a failed SQL case shows the result diff; other languages and error output do not', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'navigator', 'localStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SubmissionResult } = await import('../components/oj-results.tsx');
  const root = createRoot(document.getElementById('root'));
  const expected = 'columns: 2\n["Ava", 12000]\n["Ben", 9000]\n["Dev", null]\n';
  const submission = (language, stdout) => ({
    id: `s-${language}-${stdout.length}`,
    problem_id: 'sql-01',
    language,
    mode: 'judge',
    status: 'wrong_answer',
    passed: 0,
    total: 1,
    created_at: 1,
    cases: [{ ordinal: 0, status: 'wrong_answer', hidden: false, stdin: 'CREATE TABLE t (x);', expected, stdout }],
  });
  const render = (value) =>
    act(async () => root.render(createElement(SubmissionResult, { submission: value })));
  try {
    await render(submission('sql', 'columns: 2\n["Ava", 12000]\n["Ben", "9000"]\n["Eve", 1]\n["Dev", null]\n'));
    const diff = document.querySelector('.cs-sql-diff');
    assert.ok(!!diff);
    const rows = [...diff.querySelectorAll('tbody tr')];
    assert.deepEqual(
      rows.map((row) => row.getAttribute('data-diff')),
      [null, 'expected', 'actual', 'extra', null],
    );
    // The changed cell is marked, and text that reads like the number is quoted.
    assert.deepEqual(
      [...rows[2].querySelectorAll('td[data-mark]')].map((td) => td.textContent),
      ['"9000"'],
    );
    assert.equal(rows[1].querySelector('td[data-mark]').textContent, '9000');
    assert.equal(rows[4].querySelectorAll('td[data-null]').length, 1);
    assert.equal(rows[4].querySelector('td[data-null]').textContent, 'NULL');
    assert.match(diff.querySelector('figcaption').textContent, /Expected 3 rows, got 4: 0 missing, 1 extra, 1 different/);
    // Screen readers hear what each marked row is.
    assert.equal(rows[3].querySelector('th .sr-only').textContent, 'Extra');
    assert.deepEqual(
      [...diff.querySelectorAll('thead th[scope="col"]')].map((th) => th.textContent),
      ['Diff', 'Col 1', 'Col 2'],
    );
    // The raw text stays beside it.
    assert.ok(document.body.textContent.includes('Your output'));

    await render(submission('sql', 'columns: 2\n["Ava", 12000]\n["Ben", 9000]\n["Dev", null]\n'));
    assert.match(document.querySelector('.cs-sql-diff figcaption').textContent, /3 rows, identical/);

    // An SQL error is not a result: no table.
    await render(submission('sql', 'SQL 错误 / SQL error: no such column: nope'));
    assert.equal(!!document.querySelector('.cs-sql-diff'), false);
    // Other languages keep the plain blocks.
    await render(submission('python', expected));
    assert.equal(!!document.querySelector('.cs-sql-diff'), false);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
