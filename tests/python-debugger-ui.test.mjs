import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolveObjectURL } from 'node:buffer';
import vm from 'node:vm';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
// Monaco stand-in: records decorations and lets the test click the gutter.
const mocks = {
  editor:
    prefix +
    `export function CodeEditor(p){
      React.useEffect(() => {
        const state = globalThis.__monaco = { decorations: [], options: {}, actions: [] };
        const editor = {
          updateOptions: (o) => Object.assign(state.options, o),
          createDecorationsCollection: () => ({ set: (list) => { state.decorations = list; } }),
          onMouseDown: (fn) => { state.mouse = fn; return { dispose() {} }; },
          addAction: (a) => { state.actions.push(a); return { dispose() {} }; },
          getPosition: () => ({ lineNumber: 2 }),
          revealLineInCenterIfOutsideViewport: (line) => { state.revealed = line; },
        };
        const monaco = {
          Range: class { constructor(line) { this.startLineNumber = line; } },
          editor: { MouseTargetType: { GUTTER_GLYPH_MARGIN: 2, GUTTER_LINE_NUMBERS: 3, CONTENT_TEXT: 6 } },
          KeyCode: { F9: 68 },
        };
        return p.onEditorMount && p.onEditorMount(editor, monaco);
      }, []);
      return React.createElement('textarea', { 'aria-label': 'test editor', readOnly: true, value: p.value });
    } export function CodeDiff(){return null;}`,
  dialog:
    prefix +
    `export const Dialog=({open,children})=>open?React.createElement('div',{role:'dialog'},children):null;
     export const DialogContent=({children,onKeyDown,className})=>React.createElement('div',{onKeyDown,className},children);
     export const DialogDescription=({children})=>React.createElement('p',null,children);
     export const DialogTitle=({children})=>React.createElement('h2',null,children);`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};for(const [suffix,key] of [['/components/editor.tsx','editor'],['/components/ui/dialog.tsx','dialog']])if(u.endsWith(suffix))return {format:'module',source:mocks[key],shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

/**
 * The real worker source in a vm "worker global", with Pyodide mocked by this machine's
 * CPython running the same tracer. `gate` holds the download; `broken` fails it.
 */
let gate;
let broken = false;
const workers = [];
class FakeWorker {
  constructor(url) {
    workers.push(this);
    this.ready = resolveObjectURL(url)
      .text()
      .then((source) => {
        let tracer = '';
        let request = '';
        const pyodide = {
          globals: { set: (_name, value) => (request = value) },
          runPython: (code) => {
            if (!code.startsWith('_cswork_debug')) return void (tracer = code);
            const run = spawnSync('python3', ['-I', '-c', `${tracer}\nimport sys\nsys.stdout.write(_cswork_debug(sys.stdin.read()))`], {
              input: request,
              encoding: 'utf8',
            });
            return run.stdout;
          },
        };
        const scope = {
          fetch() {},
          importScripts() {
            if (broken) throw new Error('NetworkError');
            scope.loadPyodide = () => gate.promise.then(() => pyodide);
          },
          postMessage: (data) => setTimeout(() => !this.terminated && this.onmessage?.({ data })),
        };
        scope.self = scope;
        vm.createContext(scope);
        vm.runInContext(source, scope);
        return scope;
      });
  }
  postMessage(data) {
    this.ready.then((scope) => scope.onmessage({ data }));
  }
  terminate() {
    this.terminated = true;
  }
}
const open = () => {
  let release;
  const promise = new Promise((resolve) => (release = resolve));
  gate = { promise, release };
};

async function mount(props) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/playground' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage', 'navigator', 'location', 'history'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.Worker = FakeWorker;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { DebugButton } = await import('../components/python-debugger-button.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(DebugButton, props)));
  return root;
}
const settle = (ms = 60) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
const status = () => document.querySelector('.pydbg-status').textContent;
const where = () => document.querySelector('.pydbg-where').textContent;
const vars = () => Object.fromEntries([...document.querySelectorAll('.pydbg-panel tr')].map((row) => [row.querySelector('th').firstChild.textContent, row.querySelector('td').textContent]));
const click = (text) => act(async () => button(text).click());

const factorial = ['n = int(input())', 'def f(x):', '    if x <= 1:', '        return 1', '    return x * f(x - 1)', 'print(f(n))', 'print("done")'].join('\n');

test('other languages get a note instead of the button', async () => {
  const root = await mount({ language: 'cpp', code: '', stdin: '', mode: 'acm' });
  try {
    assert.equal(document.body.textContent.includes('Step debugging: Python only'), true);
    assert.equal(button('Debug') === undefined, true);
  } finally {
    await act(async () => root.unmount());
  }
});

test('opening downloads the runtime, then the trace replays with breakpoints, stepping and the slider', async () => {
  open();
  const root = await mount({ language: 'python', code: factorial, stdin: '3\n', mode: 'acm' });
  try {
    assert.equal(workers.length, 0);
    await click('Debug');
    await settle();
    // Lazy: the worker (and Pyodide) start only once the debugger opens.
    assert.equal(workers.length, 1);
    assert.equal(status().includes('Downloading the Python runtime (about 12 MB'), true);
    assert.equal(document.querySelector('.pydbg-status progress') !== null, true);
    assert.equal(button('Step over').disabled, true);

    await act(async () => gate.release());
    await settle(400);
    assert.equal(status().includes('14 steps'), true);
    assert.equal(where(), 'Step 1 / 14 · line 1 · main');
    assert.equal(globalThis.__monaco.options.glyphMargin, true);
    const current = () => globalThis.__monaco.decorations.find((d) => d.options.isWholeLine);
    assert.equal(current().range.startLineNumber, 1);

    // A gutter click sets a breakpoint; a click in the text does not.
    await act(async () => globalThis.__monaco.mouse({ target: { type: 6, position: { lineNumber: 5 } } }));
    await act(async () => globalThis.__monaco.mouse({ target: { type: 3, position: { lineNumber: 4 } } }));
    const breaks = globalThis.__monaco.decorations.filter((d) => d.options.glyphMarginClassName.includes('pydbg-glyph-break'));
    assert.deepEqual(breaks.map((d) => d.range.startLineNumber), [4]);

    await click('Continue');
    assert.equal(where(), 'Step 9 / 14 · line 4 · f');
    assert.deepEqual(vars(), { x: '1' });
    assert.equal(document.querySelectorAll('.pydbg-stack li').length, 4);
    assert.equal(current().options.glyphMarginClassName, 'pydbg-glyph-here pydbg-glyph-break');
    assert.equal(globalThis.__monaco.revealed, 4);

    await click('Step into');
    assert.equal(where(), 'Step 10 / 14 · line 4 · f · return');
    assert.equal(vars().Returns, '1');
    // Step over from inside f(1)'s caller chain returns to the shallower frame.
    await click('Step over');
    assert.equal(where(), 'Step 11 / 14 · line 5 · f · return');
    assert.equal(vars().Returns, '2');

    const slider = document.querySelector('input[type="range"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(slider, '12');
      slider.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assert.equal(where(), 'Step 13 / 14 · line 7 · main');
    assert.equal(document.querySelector('.pydbg-stdout').textContent, '6\n');
    await click('Back');
    assert.equal(where(), 'Step 12 / 14 · line 5 · f · return');
    await act(async () =>
      document.querySelector('.pydbg').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'F5', bubbles: true })),
    );
    assert.equal(where(), 'Step 14 / 14 · line 7 · main · return');
    assert.equal(document.querySelector('.pydbg-stdout').textContent, '6\ndone\n');
    await click('Reset');
    assert.equal(where(), 'Step 1 / 14 · line 1 · main');

    // F9 (the Monaco action) toggles the breakpoint on the cursor line.
    await act(async () => globalThis.__monaco.actions.find((a) => a.id === 'cswork.debug.breakpoint').run());
    assert.equal(globalThis.__monaco.decorations.some((d) => d.range.startLineNumber === 2 && !d.options.isWholeLine), true);
  } finally {
    await act(async () => root.unmount());
  }
  assert.equal(workers.at(-1).terminated, true);
});

test('LeetCode mode calls the template method and reports what it returned or why it could not', async () => {
  open();
  gate.release();
  const code = 'class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        seen = {}\n        for i, x in enumerate(nums):\n            if target - x in seen:\n                return [seen[target - x], i]\n            seen[x] = i\n';
  const template = 'from typing import *\n\nclass Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        pass';
  const root = await mount({ language: 'python', code, stdin: '[2,7,11,15]\n9', mode: 'leetcode', template });
  try {
    await click('Debug');
    await settle(400);
    assert.equal(document.body.textContent.includes('passed to Solution.twoSum()'), true);
    await click('Continue');
    assert.equal(document.querySelector('.pydbg-result').textContent, 'Returned: [0,1]');

    // Another input from inside the dialog: not JSON, so a plain stdin run with a note.
    const input = document.querySelector('.pydbg-input textarea');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'nums = [2,7]');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await click('Run again');
    await settle(400);
    assert.equal(status().includes('Each input line must be one JSON value'), true);
    assert.equal(workers.length, 2);
  } finally {
    await act(async () => root.unmount());
  }
});

test("a runtime that can't download shows an alert, and Retry starts over", async () => {
  open();
  gate.release();
  broken = true;
  const root = await mount({ language: 'python', code: 'x = 1\n', stdin: '', mode: 'acm' });
  try {
    await click('Debug');
    await settle(100);
    assert.equal(document.querySelector('.pydbg-failed[role="alert"]').textContent.includes("Couldn't download the Python runtime"), true);
    assert.equal(workers.at(-1).terminated, true);
    broken = false;
    await click('Retry');
    await settle(400);
    assert.equal(status().includes('2 steps'), true);
  } finally {
    await act(async () => root.unmount());
  }
});

test('a syntax error marks its line and leaves nothing to step through', async () => {
  open();
  gate.release();
  const root = await mount({ language: 'python', code: 'x = 1\ny = (\n', stdin: '', mode: 'acm' });
  try {
    await click('Debug');
    await settle(400);
    assert.equal(status().includes('Line 2: SyntaxError'), true);
    assert.equal(button('Continue').disabled, true);
    assert.equal(
      globalThis.__monaco.decorations.some((d) => d.range.startLineNumber === 2 && d.options.className === 'pydbg-line-error'),
      true,
    );
  } finally {
    await act(async () => root.unmount());
  }
});
