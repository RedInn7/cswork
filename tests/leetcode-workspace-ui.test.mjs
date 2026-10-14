import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const react = pathToFileURL(
  createRequire(import.meta.url).resolve('react'),
).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  editor:
    prefix +
    `export function CodeEditor(p){return React.createElement('textarea',{'aria-label':'test editor',value:p.value,onInput:e=>p.onChange(e.currentTarget.value)});} export function CodeDiff(){return null;}`,
  markdown:
    prefix +
    `export function LessonMarkdown({children,body}){return React.createElement('div',null,body||children);}`,
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

test('workspace uses official LeetCode defaults and preserves separate mode and language drafts', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.test/',
  });
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'localStorage',
    'sessionStorage',
    'navigator',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ProblemWorkspace } =
    await import('../components/problem-workspace.tsx');
  const { draftStorageKey } = await import('../lib/editor-settings.ts');
  const contract = JSON.parse(
    readFileSync(
      new URL('../lib/content/leetcode-contracts.json', import.meta.url),
      'utf8',
    ),
  ).problems['lc-1'];
  const templates = {
    python: contract.pythonTemplate,
    java: contract.templates.java,
  };
  const problem = {
    id: 'lc-1',
    courseId: 'gomall',
    lessonId: 'lesson',
    title: '两数之和',
    difficulty: '简单',
    tags: ['灵神题单', '数组'],
    description: 'DUPLICATE SUMMARY',
    input: 'ACM INPUT',
    output: 'ACM OUTPUT',
    explanation: '',
    hints: [],
    sampleIn: '4\n2 7 11 15\n9\n',
    sampleOut: '2\n0 1\n',
    languages: ['python', 'java'],
    translations: {
      en: {
        title: 'Two Sum',
        description: 'DUPLICATE SUMMARY',
        input: 'ACM INPUT',
        output: 'ACM OUTPUT',
        explanation: '',
        hints: [],
      },
    },
    codingModes: ['leetcode', 'acm'],
    leetcodeTemplates: templates,
    sourceStatement: {
      descriptionZh: 'COMPLETE ORIGINAL DESCRIPTION',
      descriptionEn: 'COMPLETE ORIGINAL DESCRIPTION',
      attribution: 'ATTRIBUTION MUST NOT SHOW',
      sourceUrl: 'https://leetcode.cn/problems/two-sum/',
    },
    curatedHint: { zh: 'ZH APPROACH', en: 'EN APPROACH' },
    // Eight company reports: six chips, then "+2".
    companies: ['Amazon', 'Meta', 'Uber', 'Apple', 'DoorDash', 'LinkedIn', 'Snap', 'Waymo'].map(
      (name, i) => ({ slug: name.toLowerCase(), name, rounds: [i ? 'Onsite' : 'Online Assessment'], oa: !i, count: i ? 1 : 3, last: '2026-09-14' }),
    ),
  };
  const historical = {
    id: 'old-acm',
    problemId: 'lc-1',
    language: 'python',
    codingMode: 'acm',
    code: 'print("historic ACM")',
    mode: 'judge',
    status: 'accepted',
    passed: 2,
    total: 2,
    created_at: 1,
    results: [],
    compileOutput: '',
  };
  const acmProblem = {
    ...problem,
    id: 'acm-1',
    codingModes: ['acm'],
    leetcodeTemplates: undefined,
    sourceStatement: undefined,
  };
  // Bootstrap's catalogue entry: the statement arrives with problems/:id.
  const summary = ({ id, title, translations, difficulty, tags, lessonId, courseId }) => ({
    id,
    title,
    titleEn: translations.en.title,
    difficulty,
    tags,
    lessonId,
    courseId,
  });
  const originalFetch = globalThis.fetch;
  let outcome = 'accepted';
  let acknowledgement = 'queued';
  let pendingReads = 0;
  let terminalReads = 0;
  let freshSubmission;
  let holdPost = false;
  let releasePost;
  let failWatch = false;
  let watchReads = 0;
  let statusReads = 0;
  let failDetailOnce = false;
  let submitted = 0;
  let progressEvents = 0;
  const navigations = [];
  window.addEventListener(
    'cswork:practice-progress-changed',
    () => progressEvents++,
  );
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/submissions') && init?.method === 'POST') {
      if (holdPost)
        await new Promise((resolve) => {
          releasePost = resolve;
        });
      const body = JSON.parse(init.body);
      freshSubmission = {
        ...historical,
        id: `fresh-${++submitted}`,
        mode: body.mode,
        status: outcome,
        // The Accepted dialog counts this AC on its own day.
        created_at: Date.now(),
      };
      freshSubmission.startedAt = freshSubmission.created_at + 40;
      freshSubmission.finishedAt = freshSubmission.created_at + 100;
      return Response.json({ id: freshSubmission.id, status: acknowledgement });
    }
    if (url.includes('/submissions/fresh-')) {
      if (failDetailOnce) {
        failDetailOnce = false;
        throw new TypeError('detail unavailable');
      }
      if (url.includes('?wait=1')) {
        watchReads++;
        if (failWatch) throw new TypeError('watch unavailable');
      }
      if (pendingReads-- > 0) {
        // The server finishes immediately after this in-flight snapshot.
        return Response.json({
          ...freshSubmission,
          status: 'judging',
          watchToken: 'pending-1',
        });
      }
      terminalReads++;
      return Response.json(freshSubmission);
    }
    if (url.includes('/submissions/old-acm')) return Response.json(historical);
    if (url.includes('/submissions'))
      return Response.json({ items: [historical], nextCursor: null });
    if (url.includes('/status') && ++statusReads)
      return Response.json({ available: true, languageVersions: {} });
    return Response.json(
      url.includes('/problems/acm-1') ? acmProblem : problem,
    );
  };
  localStorage.setItem(
    draftStorageKey('student', 'lc-1', 'python', 'acm'),
    'print("legacy ACM")',
  );
  const root = createRoot(document.getElementById('root'));
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  const button = (text) =>
    [...document.querySelectorAll('button')].find(
      (n) => n.textContent.trim() === text,
    );
  const editor = () => document.querySelector('[aria-label="test editor"]');
  const choose = async (label, value) => {
    const element = document.querySelector(`[aria-label="${label}"]`);
    assert.ok(element, label);
    await act(async () => {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
  };
  const edit = async (value) => {
    await act(async () => {
      editor().value = value;
      editor().dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const click = async (node) => {
    assert.ok(node);
    await act(async () => node.click());
    await settle();
  };
  try {
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          problem: summary(problem),
          boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
          navigate(path) {
            navigations.push(path);
          },
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    // A hidden tab (jsdom's default) skips judge health polls.
    assert.equal(statusReads, 0);
    assert.ok(button('Run').closest('.cs-code-caption'));
    assert.ok(button('Submit').closest('.cs-code-caption'));
    assert.equal(
      document.querySelector('.cs-workspace-header .cs-editor-run-actions'),
      null,
    );
    assert.equal(
      document.querySelector('.cs-workspace-header .cs-timer') !== null,
      true,
    );
    // Input templates are for ACM stdin programs only.
    assert.equal(
      document.querySelector('[aria-label="Use an input template"]') === null,
      true,
    );
    assert.equal(editor().value, templates.python);
    assert.match(
      document.querySelector('.cs-sample-pair').textContent,
      /nums = \[2,7,11,15\]/,
    );
    assert.match(
      document.querySelector('.cs-sample-pair').textContent,
      /target = 9/,
    );
    assert.match(
      document.querySelector('.cs-sample-pair').textContent,
      /\[0,1\]/,
    );
    // English site: the English statement is the default when it exists.
    assert.equal(
      document.querySelector('.cs-statement-heading h2').textContent,
      '1. Two Sum',
    );
    assert.ok(document.querySelector('.cs-statement-solved'));
    assert.equal(document.querySelector('#problem-topics'), null);
    await click(button('Topics'));
    assert.equal(document.querySelector('#problem-topics').textContent, '数组');
    await click(button('Topics'));
    const chips = () =>
      [...document.querySelectorAll('ul[aria-label="Asked at"] .cs-company-chip')].map((n) => n.textContent);
    assert.deepEqual(
      chips().slice(0, 2),
      ['AmazonOA×3 · 2026-09 (3 reports, latest 2026-09-14)', 'Meta×1 · 2026-09 (1 report, latest 2026-09-14)'],
      'compact frequency on screen, the full text for screen readers',
    );
    assert.deepEqual(
      [...document.querySelectorAll('ul[aria-label="Asked at"] .cs-company-name')].map((n) => n.textContent),
      ['Amazon', 'Meta', 'Uber', 'Apple', 'DoorDash', 'LinkedIn'],
    );
    await click(button('+2 more companies'));
    assert.equal(chips().length, 8);
    assert.ok(button('Less'));
    await choose('Statement language', 'zh');
    assert.equal(
      document.querySelector('.cs-statement-heading h2').textContent,
      '1. 两数之和',
    );
    assert.ok(button('Topics'), 'labels follow the site language');
    await choose('Statement language', 'en');
    assert.equal(
      document.querySelector('.cs-statement-heading h2').textContent,
      '1. Two Sum',
    );
    assert.equal(
      document.querySelector('[aria-label="Submission mode"]').value,
      'leetcode',
    );
    assert.match(document.body.textContent, /COMPLETE ORIGINAL DESCRIPTION/);
    assert.doesNotMatch(
      document.body.textContent,
      /DUPLICATE SUMMARY|ATTRIBUTION MUST NOT SHOW|返回课程|查看课程|展开提示/,
    );
    assert.doesNotMatch(document.body.textContent, /ACM INPUT|ACM OUTPUT/);
    // The Line 500 hint stays locked until a failed formal submission.
    assert.match(document.querySelector('.cs-route-hint').textContent, /Show anyway/);
    assert.doesNotMatch(document.body.textContent, /EN APPROACH/);
    await edit('# my LC draft');
    await choose('Submission mode', 'acm');
    assert.equal(editor().value, 'print("legacy ACM")');
    await edit('print("new ACM")');
    await choose('Submission mode', 'leetcode');
    assert.equal(editor().value, '# my LC draft');
    await choose('Programming language', 'java');
    assert.equal(editor().value, templates.java);
    await edit('// java LC draft');
    await choose('Programming language', 'python');
    assert.equal(editor().value, '# my LC draft');
    await click(document.querySelector('[aria-label="Reset to template"]'));
    await click(button('Replace'));
    assert.equal(editor().value, templates.python);
    await choose('Submission mode', 'acm');
    assert.equal(editor().value, 'print("new ACM")');
    await choose('Submission mode', 'leetcode');
    await click(button('Submissions'));
    await click(button('Code'));
    await click(button('Restore to editor'));
    await click(button('Replace'));
    assert.equal(
      document.querySelector('[aria-label="Submission mode"]').value,
      'acm',
    );
    assert.equal(editor().value, historical.code);
    await choose('Submission mode', 'leetcode');
    assert.equal(editor().value, templates.python);
    assert.equal(
      document.querySelector('.cs-accepted-banner'),
      null,
      'history must not celebrate',
    );
    // Analytics: a visible run reports judge_submit, then judge_result, once each.
    const events = [];
    window.gtag = (command, name, params) => events.push({ name, params });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    // Becoming visible checks judge health at once.
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await settle();
    assert.equal(statusReads, 1);
    globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
    await click(button('Run'));
    await settle();
    assert.deepEqual(
      events.map((event) => event.name),
      ['judge_submit', 'judge_result'],
    );
    assert.deepEqual(events[0].params, {
      mode: 'run',
      problem_id: 'lc-1',
      code_language: 'python',
    });
    const { duration_ms, ...result } = events[1].params;
    assert.ok(
      Number.isFinite(duration_ms) && duration_ms >= 0,
      'client latency',
    );
    assert.deepEqual(result, {
      mode: 'run',
      problem_id: 'lc-1',
      code_language: 'python',
      verdict: 'accepted',
      passed: 2,
      total: 2,
      server_ms: 100,
      queue_ms: 40,
    });
    delete window.gtag;
    delete document.visibilityState;
    assert.equal(
      document.querySelector('.cs-accepted-banner'),
      null,
      'sample runs must not celebrate',
    );
    outcome = 'wrong_answer';
    holdPost = true;
    await act(async () => button('Submit').click());
    assert.match(
      document.querySelector('.cs-submitting').textContent,
      /Submitting/,
    );
    assert.equal(
      document.querySelector('.cs-result-content'),
      null,
      'previous result is cleared while uploading',
    );
    holdPost = false;
    await act(async () => releasePost());
    assert.equal(document.querySelector('.cs-accepted-banner'), null);
    outcome = 'accepted';
    pendingReads = 1;
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
      // Flush the POST and initial pending GET without advancing polling time.
      await act(async () => {
        button('Submit').click();
      });
      assert.ok(
        document.querySelector('.cs-accepted-banner'),
        'completed watch response must render immediately without a 750ms polling delay',
      );
      const completedReadsBeforePoll = terminalReads;
      await act(async () => t.mock.timers.tick(3000));
      assert.equal(
        terminalReads,
        completedReadsBeforePoll,
        'terminal feedback must stop polling',
      );
    } finally {
      t.mock.timers.reset();
    }
    assert.match(
      document.querySelector('.cs-accepted-banner').textContent,
      /Accepted/,
    );
    assert.ok(
      document.querySelector('.cs-accepted-banner').closest('[role="dialog"]'),
      'formal AC must open a result dialog, not only an inline banner',
    );
    assert.equal(progressEvents, 1);
    assert.ok(watchReads > 0, 'active submission uses the watch endpoint');
    // This AC counts today before the bootstrap refresh; with no list to follow, go back.
    assert.equal(
      document.querySelector('.cs-accepted-banner').textContent.trim(),
      'AcceptedToday 1 / 3 · 1-day streakBack to problems',
    );
    await click(
      document.querySelector('[aria-label="Dismiss success message"]'),
    );
    await click(button('Description'));
    // The earlier Wrong Answer lit the hint for good, collapsed until asked.
    const hint = document.querySelector('.cs-route-hint[data-lit] details');
    assert.equal(hint.open, false);
    assert.match(hint.textContent, /EN APPROACH.*ZH APPROACH/);
    assert.equal(
      hint.querySelector('a').href,
      'https://leetcode.com/problems/two-sum/solutions/',
    );
    // A Chinese statement on the English site keeps English labels.
    await choose('Statement language', 'zh');
    assert.equal(
      document.querySelector('.cs-accepted-banner'),
      null,
      'dismissed feedback must not replay',
    );
    // A problem timer that ran puts its reading in the dialog and judge_accept.
    const timerKey = 'cswork:timer:student:lc-1';
    localStorage.setItem(
      timerKey,
      JSON.stringify({
        mode: 'up',
        minutes: 15,
        elapsed: 754_000,
        startedAt: null,
      }),
    );
    const accepts = [];
    window.gtag = (command, name, params) =>
      name === 'judge_accept' && accepts.push(params);
    acknowledgement = 'accepted';
    await click(button('Submit'));
    assert.match(
      document.querySelector('.cs-accepted-banner').textContent,
      /Accepted.*Solved in 12:34/,
    );
    assert.equal(accepts.length === 1 && accepts[0].seconds === 754, true);
    delete window.gtag;
    localStorage.removeItem(timerKey);
    assert.equal(progressEvents, 2);
    await click(
      document.querySelector('[aria-label="Dismiss success message"]'),
    );
    failWatch = true;
    pendingReads = 1;
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
      await act(async () => button('Submit').click());
      assert.equal(document.querySelector('.cs-accepted-banner'), null);
      await act(async () => t.mock.timers.tick(750));
      assert.ok(
        document.querySelector('.cs-accepted-banner'),
        'unavailable watch falls back to ordinary polling',
      );
    } finally {
      t.mock.timers.reset();
      failWatch = false;
    }
    await click(
      document.querySelector('[aria-label="Dismiss success message"]'),
    );
    failDetailOnce = true;
    t.mock.timers.enable({ apis: ['setTimeout'] });
    try {
      await act(async () => button('Submit').click());
      assert.equal(document.querySelector('.cs-accepted-banner'), null);
      await act(async () => t.mock.timers.tick(750));
      assert.ok(
        document.querySelector('.cs-accepted-banner'),
        'terminal POST receipt still retries missing details',
      );
      assert.equal(document.querySelector('.cs-inline-error'), null);
    } finally {
      t.mock.timers.reset();
    }
    sessionStorage.setItem('cswork:oj:active:student:lc-1', freshSubmission.id);
    // Reload on the Chinese site: Chinese statement and labels by default.
    localStorage.setItem('cswork:locale', 'zh');
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          key: 'reloaded',
          problem: summary(problem),
          boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    assert.equal(
      document.querySelector('.cs-accepted-banner'),
      null,
      'receipt prevents replay after reload',
    );
    assert.equal(
      document.querySelector('.cs-statement-heading h2').textContent,
      '1. 两数之和',
    );
    assert.ok(button('运行').closest('.cs-code-caption'));
    assert.ok(button('提交').closest('.cs-code-caption'));
    assert.ok(document.querySelector('[aria-label="题面语言"]'));
    // Without a failed submission, the hint opens only after a confirm.
    assert.equal(document.querySelector('.cs-route-hint details'), null);
    await click(button('仍要查看'));
    await click(button('查看提示'));
    assert.equal(document.querySelector('.cs-route-hint details').open, true);
    assert.match(
      document.querySelector('.cs-route-hint').textContent,
      /ZH APPROACH.*EN APPROACH/,
    );
    assert.equal(
      document.querySelector('.cs-route-hint a').href,
      'https://leetcode.cn/problems/two-sum/solutions/',
    );
    // An earlier failure the server counted lights it on load, collapsed.
    problem.hintEarned = true;
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          key: 'earned',
          problem: summary(problem),
          boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    assert.equal(
      document.querySelector('.cs-route-hint[data-lit] details').open,
      false,
    );
    // Exam mode (a running mock OA holding this problem) never shows hints.
    const examKey = 'cswork:mock:v1:student';
    const startedAt = Date.now() - 1000;
    localStorage.setItem(
      examKey,
      JSON.stringify({
        active: {
          id: 'exam-1', company: null, name: null, platform: null, preset: false,
          scoring: 'tests', source: 'lc', slots: ['easy'], ids: [problem.id],
          minutes: 60, skew: 0, createdAt: startedAt, startedAt,
        },
        history: [],
      }),
    );
    await act(async () =>
      root.render(
        createElement(ProblemWorkspace, {
          key: 'exam',
          mock: 'exam-1',
          problem: summary(problem),
          boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
          navigate() {},
          ask() {},
          refresh: async () => {},
        }),
      ),
    );
    await settle();
    assert.ok(document.querySelector('.cs-statement-heading'));
    // Booleans, not elements: a failing diff of a jsdom node exhausts the heap.
    assert.equal(document.querySelector('.cs-route-hint') === null, true);
    // The exam bar's clock replaces the problem timer.
    assert.equal(document.querySelector('.cs-timer') === null, true);
    assert.equal(document.querySelector('.cs-company-tags') === null, true, 'no company hints in a mock');
    localStorage.removeItem(examKey);
    delete problem.hintEarned;
    // ACM starters follow the statement language; untouched ones switch with it.
    const { starters, englishStarters } = await import('../lib/problems.ts');
    const renderAcm = (key) =>
      act(async () =>
        root.render(
          createElement(ProblemWorkspace, {
            key,
            problem: summary(acmProblem),
            boot: { person: { id: 'student', role: 'teacher' }, courses: [] },
            navigate() {},
            ask() {},
            refresh: async () => {},
          }),
        ),
      );
    await renderAcm('acm-zh');
    await settle();
    assert.equal(editor().value, starters.python);
    await choose('题面语言', 'en');
    assert.equal(editor().value, englishStarters.python);
    await choose('题面语言', 'zh');
    assert.equal(editor().value, starters.python);
    // The header switch; it also drops the per-problem statement pick.
    const { setLocale } = await import('../lib/i18n.ts');
    await act(async () => setLocale('en'));
    await renderAcm('acm-en');
    await settle();
    assert.equal(editor().value, englishStarters.python);
    // Templates are whole programs: an untouched starter is swapped, edits ask first.
    const { ACM_IO_TEMPLATES } = await import('../lib/acm-io-templates.ts');
    const [single, eof] = ACM_IO_TEMPLATES;
    await choose('Use an input template', 'eof');
    assert.equal(editor().value === eof.code.python, true);
    await edit('# mine');
    await choose('Use an input template', 'single');
    assert.equal(editor().value === '# mine', true);
    assert.match(
      document.querySelector('[role="alertdialog"]').textContent,
      /Switch to the "Single test case" template\?/,
    );
    await click(button('Replace'));
    assert.equal(editor().value === single.code.python, true);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
