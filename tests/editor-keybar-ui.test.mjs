import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
// Monaco stand-in: records trigger() and hands the test the focus/blur listeners.
const mocks = {
  monaco:
    prefix +
    `export function Editor(p){
      React.useEffect(() => {
        const state = globalThis.__monaco;
        const off = { dispose() {} };
        p.onMount({
          addAction: () => off,
          onDidChangeCursorPosition: () => off,
          onDidFocusEditorText: (fn) => { state.focus = fn; return off; },
          onDidBlurEditorText: (fn) => { state.blur = fn; return off; },
          createContextKey: () => ({ set() {} }),
          getModel: () => null,
          trigger: (...call) => state.calls.push(call),
        }, { KeyMod: { CtrlCmd: 1, Shift: 2 }, KeyCode: { Enter: 3, KeyS: 4 } });
      }, []);
      return React.createElement('textarea', { 'aria-label': 'test editor' });
    }`,
  vim: 'export function initVimMode(){return {dispose(){}};}',
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};for(const [suffix,key] of [['/components/monaco-client.ts','monaco'],['/components/vendor/monaco-vim/index.js','vim']])if(u.endsWith(suffix))return {format:'module',source:mocks[key],shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

test('touch screens get a symbol row above the keyboard while the code has focus', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  let coarse = true;
  window.matchMedia = (query) => ({ matches: query === '(pointer: coarse)' && coarse });
  // A 300px keyboard: the visual viewport is 500 of the layout viewport's 800.
  const viewport = new dom.window.EventTarget();
  Object.assign(viewport, { height: 500, offsetTop: 0 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { CodeEditor } = await import('../components/editor.tsx');
  const { defaultEditorSettings } = await import('../lib/editor-settings.ts');
  const root = createRoot(document.getElementById('root'));
  const render = async (keymap = 'default') => {
    globalThis.__monaco = { calls: [] };
    await act(async () =>
      root.render(
        createElement(CodeEditor, {
          key: keymap + coarse,
          value: '',
          language: 'python',
          onChange() {},
          settings: { ...defaultEditorSettings, theme: 'light', keymap },
        }),
      ),
    );
    // The Monaco runtime is a dynamic import; let it resolve and mount.
    for (let i = 0; i < 5 && !document.querySelector('[aria-label="test editor"]'); i++)
      await act(() => new Promise((r) => setTimeout(r, 10)));
    assert.ok(document.querySelector('[aria-label="test editor"]'));
    return globalThis.__monaco;
  };
  const bar = () => document.querySelector('.cs-symbol-bar');
  const key = (label) => [...bar().querySelectorAll('button')].find((b) => b.textContent === label);
  try {
    let monaco = await render();
    assert.equal(bar(), null, 'no row until the editor has focus');
    await act(async () => monaco.focus());
    assert.equal(bar().getAttribute('role'), 'toolbar');
    assert.equal(bar().style.bottom, '300px');
    const labels = [...bar().querySelectorAll('button')].map((b) => b.textContent);
    for (const symbol of ['Tab', '(', ')', '[', ']', '{', '}', ':', ';', '=', '"', "'", '<', '>', '+', '-', '*', '/', '_', ',', '.', '←', '→'])
      assert.ok(labels.includes(symbol), symbol);

    // Pressing a key keeps focus in the editor, so the soft keyboard stays up.
    const down = new dom.window.Event('pointerdown', { bubbles: true, cancelable: true });
    key('(').dispatchEvent(down);
    assert.equal(down.defaultPrevented, true);
    await act(async () => {
      for (const label of ['(', 'Tab', '←', '→', labels.at(-1)]) key(label).click();
    });
    assert.deepEqual(monaco.calls, [
      ['keyboard', 'type', { text: '(' }],
      ['keyboard', 'tab', null],
      ['keyboard', 'cursorLeft', null],
      ['keyboard', 'cursorRight', null],
      ['keyboard', 'undo', null],
    ]);

    // Follows the keyboard as it closes.
    viewport.height = 800;
    await act(async () => viewport.dispatchEvent(new dom.window.Event('resize')));
    assert.equal(bar().style.bottom, '0px');
    await act(async () => monaco.blur());
    assert.equal(bar(), null);

    monaco = await render('vim');
    await act(async () => monaco.focus());
    assert.equal(bar(), null, 'Vim users keep their own keys');

    coarse = false;
    monaco = await render();
    assert.equal(monaco.focus, undefined, 'desktops never even track focus');
    assert.equal(bar(), null);
  } finally {
    await act(async () => root.unmount());
  }
});
