import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';
register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

test('analytics makes no Google request before consent, tracks safe navigation, and revokes', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.org/?view=problems&email=private@example.com#invite=secret',
  });
  for (const name of [
    'window',
    'document',
    'location',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'localStorage',
  ]) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { Analytics } = await import('../components/analytics.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Analytics, { id: '' })));
  assert.equal(document.querySelector('script'), null);
  assert.equal(document.querySelector('button'), null);
  await act(async () =>
    root.render(createElement(Analytics, { id: 'G-ABC1234567' })),
  );
  assert.equal(document.querySelector('script'), null);
  const click = async (text) => {
    const button = [...document.querySelectorAll('button')].find((b) =>
      b.textContent.includes(text),
    );
    assert.ok(button, text);
    await act(async () => button.click());
  };
  await click('Decline');
  assert.equal(document.querySelector('script'), null);
  assert.equal(window.dataLayer, undefined);
  await click('Privacy');
  await click('Allow');
  assert.equal(document.querySelectorAll('script').length, 1);
  assert.equal(document.querySelector('script').referrerPolicy, 'no-referrer');
  const commands = () => window.dataLayer.map((args) => Array.from(args));
  const events = () => commands().filter((args) => args[0] === 'event');
  assert.equal(events().length, 1);
  assert.equal(events()[0][2].page_location, 'https://cswork.org/problems');
  const config = commands().find((args) => args[0] === 'config')[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  window.history.pushState(null, '', '/?view=problem&problem=secret-id');
  window.dispatchEvent(new Event('cswork:analytics-navigation'));
  window.dispatchEvent(new Event('cswork:analytics-navigation'));
  assert.equal(events().length, 2, 'same page category is deduplicated');
  window.history.pushState(null, '', '/?view=tickets&ticket=private-ticket');
  window.dispatchEvent(new Event('popstate'));
  assert.equal(events().length, 2, 'private page excluded');
  assert.doesNotMatch(
    JSON.stringify(commands()),
    /private@example|secret|private-ticket|invite=/,
  );
  document.cookie = '_ga=test; Path=/';
  await click('Privacy');
  // jsdom cannot navigate, but still proves the disable flag/cookie/script cleanup.
  await click('Decline');
  assert.equal(window['ga-disable-G-ABC1234567'], true);
  assert.equal(document.querySelector('script'), null);
  assert.doesNotMatch(document.cookie, /_ga=/);
  assert.equal(localStorage.getItem('cswork.analytics-consent.v1'), 'declined');
  await act(async () => root.unmount());
  dom.window.close();
});
