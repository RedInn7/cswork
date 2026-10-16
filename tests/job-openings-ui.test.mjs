// Openings on the page (app/company/jobs.tsx) and "Add to tracker": the posting links out with
// rel noopener noreferrer nofollow, the add link carries company, role and link, and the tracker
// (components/application-tracker.tsx) opens a filled-in Saved card from them, saved only on
// confirm, with the address cleaned and a non-https link dropped.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/', virtualConsole: new VirtualConsole() });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, get: () => dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { OpeningList, trackerAddPath } = await import('../app/company/jobs.tsx');
const { ApplicationTracker } = await import('../components/application-tracker.tsx');

const opening = {
  id: 'greenhouse:stripe:1',
  companySlug: 'stripe',
  title: 'Software Engineer, New Grad',
  location: 'Seattle, WA',
  url: 'https://stripe.com/jobs/search?gh_jid=1',
  kind: 'new-grad',
  postedAt: Date.UTC(2026, 9, 1, 12),
};

test('an opening links out to the posting and to a filled-in tracker card', () => {
  const doc = new JSDOM(
    renderToStaticMarkup(createElement(OpeningList, { items: [opening, { ...opening, id: 'x', kind: 'intern', postedAt: null, location: '' }], names: new Map([['stripe', 'Stripe']]), zh: false, withCompany: true })),
  ).window.document;
  const [first, second] = doc.querySelectorAll('li');
  const out = first.querySelector('.job-openings-title');
  assert.equal(out.getAttribute('href'), opening.url);
  assert.equal(out.getAttribute('rel'), 'noopener noreferrer nofollow');
  assert.equal(first.querySelector('.job-openings-facts a').getAttribute('href'), '/company/stripe#jobs');
  assert.equal(first.querySelector('[data-kind]').textContent, 'New grad');
  assert.equal(first.querySelector('time').getAttribute('datetime'), '2026-10-01');
  const add = first.querySelector('.job-openings-add');
  // The visible label starts its accessible name; the role tells the rows' buttons apart.
  assert.equal(add.textContent, 'Add to tracker: Software Engineer, New Grad');
  const target = new URL(add.getAttribute('href'), 'https://cswork.test');
  assert.equal(target.pathname, '/career/tracker');
  assert.deepEqual(Object.fromEntries(target.searchParams), { add: '1', company: 'Stripe', role: opening.title, link: opening.url });
  assert.equal(add.getAttribute('href'), trackerAddPath('Stripe', opening));
  assert.equal(second.querySelector('[data-kind]').textContent, 'Intern');
  assert.equal(second.querySelector('time'), null);
});

const posted = [];
globalThis.fetch = async (url, init = {}) => {
  const key = `${init.method ?? 'GET'} ${String(url)}`;
  if (key === 'GET /api/oj/applications') return Response.json({ items: [], max: 300 });
  if (key === 'GET /api/oj/reports/companies') return Response.json({ items: [] });
  if (key === 'POST /api/oj/applications') {
    const body = JSON.parse(init.body);
    posted.push(body);
    return Response.json({ item: { id: 'n', companySlug: '', createdAt: 1, updatedAt: 1, links: null, ...body } });
  }
  return Response.json({ error: 'no route' }, { status: 404 });
};

async function open(query) {
  dom.reconfigure({ url: `https://cswork.test/career/tracker?${query}` });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(ApplicationTracker, { zh: false })));
  await act(async () => {});
  return { host, root };
}

test('the tracker opens the add form filled in, at Saved, and saves only on confirm', async () => {
  const { host, root } = await open(new URLSearchParams({ add: '1', company: 'Stripe', role: opening.title, link: opening.url }));
  assert.equal(location.search, '', 'the address is cleaned');
  assert.equal(location.pathname, '/career/tracker');
  const form = host.querySelector('form');
  assert.ok(form, 'the add form is open');
  const [company, role] = form.querySelectorAll('input');
  assert.equal(company.value, 'Stripe');
  assert.equal(role.value, opening.title);
  assert.equal(form.querySelector('input[type="url"]').value, opening.url);
  assert.equal(form.querySelector('select').value, 'saved');
  assert.equal(document.activeElement, company);
  assert.equal(posted.length, 0, 'nothing is saved before the learner confirms');
  await act(async () => form.requestSubmit());
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0], { company: 'Stripe', role: opening.title, stage: 'saved', appliedAt: null, oaDeadline: null, interviewAt: null, referral: '', link: opening.url, notes: '' });
  assert.equal(host.querySelector('form'), null);
  await act(async () => root.unmount());
});

test('a non-https link is dropped, and without add=1 nothing opens', async () => {
  let view = await open(new URLSearchParams({ add: '1', company: 'Acme', role: 'Intern', link: 'javascript:alert(1)' }));
  assert.equal(view.host.querySelector('input[type="url"]').value, '');
  await act(async () => view.root.unmount());
  view = await open(new URLSearchParams({ add: '1', company: 'Acme', link: 'http://example.com/j' }));
  assert.equal(view.host.querySelector('input[type="url"]').value, '');
  await act(async () => view.root.unmount());
  view = await open(new URLSearchParams({ company: 'Acme' }));
  assert.equal(view.host.querySelector('form'), null);
  assert.equal(location.search, '?company=Acme', 'an address without add=1 is left alone');
  await act(async () => view.root.unmount());
});
