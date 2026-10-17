import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
// Monaco stand-in that records its props; the language service records whether it was attached.
const mocks = {
  monaco:
    prefix +
    `export function Editor(p){
      globalThis.__editor = p;
      React.useEffect(() => {
        const off = { dispose() {} };
        p.onMount({
          addAction: () => off,
          onDidChangeCursorPosition: () => off,
          createContextKey: () => ({ set() {} }),
          getModel: () => ({}),
          focus() {},
          getAction: () => null,
          trigger() {},
        }, { KeyMod: { CtrlCmd: 1, Shift: 2 }, KeyCode: { Enter: 3, KeyS: 4 } });
      }, []);
      return React.createElement('textarea', { 'aria-label': 'test editor' });
    }`,
  intelligence: `export function attachIntelligence(){globalThis.__attached=(globalThis.__attached??0)+1;return {dispose(){}};}`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};for(const [suffix,key] of [['/components/monaco-client.ts','monaco'],['/components/monaco-intelligence.ts','intelligence']])if(u.endsWith(suffix))return {format:'module',source:mocks[key],shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

test('a bare editor is plain text with no completion, closing pairs, hovers, marks or language service', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  window.matchMedia = () => ({ matches: false });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { CodeEditor } = await import('../components/editor.tsx');
  const root = createRoot(document.getElementById('root'));
  const suggest = [];
  const render = (bare) =>
    act(async () =>
      root.render(
        createElement(CodeEditor, {
          key: String(bare),
          value: 'x = 1',
          language: 'python',
          problemId: 'lc-1',
          onChange() {},
          onSuggestReady: (fn) => suggest.push(fn),
          bare,
        }),
      ),
    );
  try {
    await render(false);
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    assert.equal(globalThis.__editor.language, 'python');
    assert.equal(globalThis.__editor.options.quickSuggestions.other, true);
    assert.equal(globalThis.__attached, 1);
    assert.equal(typeof suggest.at(-1), 'function');

    await render(true);
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    const { language, options } = globalThis.__editor;
    assert.equal(language, 'plaintext');
    assert.equal(options.quickSuggestions, false);
    assert.equal(options.suggestOnTriggerCharacters, false);
    assert.deepEqual(options.parameterHints, { enabled: false });
    assert.equal(options.wordBasedSuggestions, 'off');
    for (const key of ['autoClosingBrackets', 'autoClosingQuotes', 'autoClosingDelete', 'autoSurround', 'matchBrackets'])
      assert.equal(options[key], 'never', key);
    assert.deepEqual(options.hover, { enabled: 'off' });
    assert.equal(options.renderValidationDecorations, 'off');
    assert.equal(options.occurrencesHighlight, 'off');
    assert.equal(globalThis.__attached, 1, 'no language service for the bare editor');
    assert.equal(suggest.at(-1), null, 'nothing to trigger');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
