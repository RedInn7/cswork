// The visa timeline page: the plan comes back from this browser's storage, edits are saved there
// only, every step links its official source, and a blocked storage still leaves a working page.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const KEY = 'cswork:visa-timeline';
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/career/visa-timeline' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'localStorage'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { VisaTimeline } = await import('../components/visa-timeline.tsx');

const mount = async (zh = false) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(VisaTimeline, { zh })));
  return { host, unmount: () => act(async () => root.unmount()) };
};
const type = async (field, value) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};

test('the server render has the form and the sourced rules, and no dates of anyone', () => {
  const html = renderToStaticMarkup(createElement(VisaTimeline, { zh: true }));
  const doc = new JSDOM(html).window.document;
  assert.ok(doc.querySelectorAll('input[type="date"]').length >= 8);
  const rules = [...doc.querySelectorAll('.visa-rules li')];
  assert.equal(rules.length, 6);
  for (const li of rules) {
    assert.match(li.querySelector('a').getAttribute('href'), /^https:\/\/www\.uscis\.gov\//);
    assert.equal(li.querySelector('a').getAttribute('rel'), 'noopener noreferrer');
    assert.match(li.querySelector('small').textContent, /核实于 \d{4}-\d{2}-\d{2}/);
  }
  assert.equal(doc.querySelector('.visa-events'), null);
});

test('a saved plan comes back, edits stay in this browser, and Clear forgets them', async () => {
  localStorage.setItem(KEY, JSON.stringify({ programEnd: '2099-05-15' }));
  const { host, unmount } = await mount();
  assert.match(host.querySelector('.visa-next').textContent, /days to the next deadline: Last day to file for OPT.*2099-07-14/);
  assert.ok(host.querySelector('.visa-events li[data-severity="deadline"] a[href^="https://www.uscis.gov/"]'));
  const [, optStart] = host.querySelectorAll('input[type="date"]');
  await type(optStart, '2099-07-01');
  assert.deepEqual(JSON.parse(localStorage.getItem(KEY)), { programEnd: '2099-05-15', optStart: '2099-07-01' });
  assert.ok([...host.querySelectorAll('.visa-events time')].some((t) => t.textContent === '2099-09-28'));
  await act(async () => host.querySelector('.resume-actions button').click());
  assert.equal(localStorage.getItem(KEY), null);
  assert.ok(host.querySelector('.visa-empty'));
  await unmount();
});

test('blocked storage still renders and plans', async () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError');
    },
  });
  try {
    const { host, unmount } = await mount(true);
    await type(host.querySelector('input[type="date"]'), '2099-05-15');
    assert.match(host.querySelector('.visa-next').textContent, /距离下一个截止日还有 \d+ 天/);
    await unmount();
  } finally {
    Object.defineProperty(globalThis, 'localStorage', real);
  }
});
