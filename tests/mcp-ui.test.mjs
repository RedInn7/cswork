import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=account' });
dom.window.localStorage.setItem('cswork:locale', 'en'); // UI copy below is the English site
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'PointerEvent',
  'KeyboardEvent',
  'FocusEvent',
  'getComputedStyle',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] ?? dom.window.MouseEvent });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
const { createRoot } = await import('react-dom/client');
const { ApiTokenSettings } = await import('../components/api-tokens.tsx');
const { McpView } = await import('../app/mcp/view.tsx');

const wait = (ms = 5) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
function type(input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

test('/mcp shows the download, Claude Code and Cursor setup in either language', () => {
  const en = renderToStaticMarkup(createElement(McpView, { zh: false }));
  assert.ok(en.includes('curl -fsSL https://cswork.org/mcp/cswork-mcp.mjs -o ~/.cswork/cswork-mcp.mjs'));
  assert.ok(en.includes('claude mcp add --transport stdio cswork'));
  assert.ok(en.includes('CSWORK_TOKEN=cswork_pat_your_token'));
  assert.ok(en.includes('~/.cursor/mcp.json'));
  assert.ok(en.includes('&quot;mcpServers&quot;'));
  for (const tool of ['get_daily_problem', 'search_problems', 'get_problem', 'run_code', 'submit_code', 'get_submission'])
    assert.ok(en.includes(`<code>${tool}</code>`), tool);
  assert.ok(en.includes('href="/?view=account"'));
  assert.ok(en.includes('lang="en"'));
  const zh = renderToStaticMarkup(createElement(McpView, { zh: true }));
  assert.ok(zh.includes('在 Claude Code 和 Cursor 里练题'));
  assert.ok(zh.includes('lang="zh-CN"'));
  // One h1, then steps and sections as h2.
  assert.equal(zh.match(/<h1/g).length, 1);
});

test('the account card creates a token, shows it once and revokes with confirmation', async () => {
  const calls = [];
  let items = [{ id: 't1', name: 'Old laptop', createdAt: Date.UTC(2026, 9, 1), lastUsedAt: null }];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    calls.push({ path, body: init.body ? JSON.parse(init.body) : undefined });
    if (path === 'oj/tokens' && !init.body) return Response.json({ items });
    if (path === 'oj/tokens') {
      const item = { id: 't2', name: JSON.parse(init.body).name, createdAt: Date.now(), lastUsedAt: null };
      items = [item, ...items];
      return Response.json({ token: `cswork_pat_${'z'.repeat(43)}`, item }, { status: 201 });
    }
    if (path === 'oj/tokens/t1/revoke') return Response.json({ ok: true });
    throw new Error(`unexpected ${path}`);
  };
  const confirm = dom.window.confirm;
  try {
    document.body.innerHTML = '<div id="root"></div>';
    const root = createRoot(document.getElementById('root'));
    await act(async () => root.render(createElement(ApiTokenSettings)));
    await wait();
    assert.ok(document.body.textContent.includes('Old laptop'));
    assert.ok(document.body.textContent.includes('Never used'));
    assert.ok(document.querySelector('a[href="/mcp"]') !== null);
    assert.ok(document.querySelector('.pat-fresh') === null);

    await act(async () => type(document.querySelector('.pat-create input'), '  Claude Code  '));
    await act(async () => document.querySelector('form.pat-form').requestSubmit());
    await wait();
    assert.deepEqual(calls.at(-1), { path: 'oj/tokens', body: { name: 'Claude Code' } });
    const secret = document.querySelector('.pat-secret input');
    assert.equal(secret.value, `cswork_pat_${'z'.repeat(43)}`);
    assert.equal(secret.readOnly, true);
    assert.ok(document.querySelector('.pat-fresh output') !== null);
    assert.equal(document.querySelectorAll('.pat-list .service-row').length, 2);
    assert.equal(document.querySelector('.pat-create input').value, '');

    // Declining the confirmation sends nothing.
    dom.window.confirm = () => false;
    await act(async () => document.querySelector('button[aria-label="Revoke Old laptop"]').click());
    await wait();
    assert.equal(calls.filter((c) => c.path.endsWith('/revoke')).length, 0);
    dom.window.confirm = () => true;
    await act(async () => document.querySelector('button[aria-label="Revoke Old laptop"]').click());
    await wait();
    assert.ok(calls.some((c) => c.path === 'oj/tokens/t1/revoke'));
    assert.ok(!document.body.textContent.includes('Old laptop'));
    assert.ok(button('Copy') !== undefined);
    await act(async () => root.unmount());
  } finally {
    globalThis.fetch = original;
    dom.window.confirm = confirm;
  }
});
