import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ContentDetail, ContentList } = await import('../components/content-library.tsx');

const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));
const text = () => document.body.textContent;
const facet = (value, n) => ({ value, label: value, n });
const experience = (slug, o) => ({
  type: 'experience', slug, title: `Experience ${slug}`, summary: null, company: { slug: 'uber', name: 'Uber' },
  role: 'Software Engineer', category: null, difficulty: null, round: 'Onsite', seniority: null, tags: [],
  publishedAt: '2026-09-04T23:06:02.280Z', partial: false, result: null, rounds: [], interviewDate: null, ...o,
});

test('experience rows show outcome, rounds and interview month; the Offer quick filter', async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return Response.json({
      items: [
        experience('a', { result: 'Rejected', rounds: ['Online Assessment', 'Onsite'], interviewDate: '2026-03-13' }),
        experience('b'),
      ],
      total: 2, page: 1, pageSize: 20,
      facets: {
        companies: [facet('uber', 2)], companyTotal: 1, roles: [], categories: [], difficulties: [], rounds: [],
        results: [facet('Rejected', 1), facet('Offer', 1)], total: 2,
      },
    });
  };
  const navigations = [];
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(createElement(ContentList, { section: 'experiences', params: {}, navigate: (...a) => navigations.push(a) })),
  );
  await settle();
  const [first, second] = document.querySelectorAll('.ct-card');
  assert.equal(first.querySelector('.ct-result').textContent, 'Rejected');
  assert.equal(first.querySelector('.ct-result').dataset.tone, 'bad');
  assert.ok(first.textContent.includes('OA → Onsite'));
  assert.ok(first.textContent.includes('Interviewed 2026-03'));
  // Rounds replace the single round; collection dates are not shown for experiences.
  assert.equal(first.textContent.includes('2026-09-04'), false);
  assert.equal(second.querySelector('.ct-result') === null, true, 'no outcome, no badge');
  assert.equal(second.textContent.includes('Onsite'), true, 'without rounds the round still shows');
  // The outcome menu labels values; the quick filter toggles result=Offer.
  assert.ok([...document.querySelectorAll('option')].some((o) => o.textContent === 'Offer · 1'));
  const offers = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Offers only'));
  assert.equal(offers.getAttribute('aria-pressed'), 'false');
  await act(async () => offers.click());
  assert.deepEqual(navigations.at(-1), ['experiences', { type: 'experience', result: 'Offer' }]);
  await act(async () =>
    root.render(createElement(ContentList, { section: 'experiences', params: { result: 'Offer' }, navigate: () => {} })),
  );
  await settle();
  assert.match(requests.at(-1), /result=Offer/);
  await act(async () => root.unmount());
});

test('detail: practice card for the company and judge-ready relations first', async () => {
  globalThis.fetch = async () =>
    Response.json({
      ...experience('a', { result: 'Offer', rounds: ['Onsite'] }),
      body: 'Body text.', updatedAt: null, extra: {}, dupOf: null, practice: null,
      relations: [
        { kind: 'question', type: 'interview_question', slug: 'q1', title: 'Talk about a project', company_name: 'Uber', difficulty: null, problem: null },
        { kind: 'question', type: 'coding_question', slug: 'q2', title: 'Coin change', company_name: 'Uber', difficulty: 'medium', problem: 'lc-322' },
      ],
      companyPractice: {
        slug: 'uber', name: 'Uber', oaReady: 7, mock: 'uber', hub: true,
        top: [
          { id: 'lc-146', number: 146, titleZh: 'LRU 缓存', titleEn: 'LRU Cache', count: 3 },
          { id: 'lc-999', number: 999, titleZh: '不可见', titleEn: 'Not openable', count: 1 },
        ],
      },
    });
  const navigations = [];
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      createElement(ContentDetail, {
        params: { type: 'experience', slug: 'a' },
        navigate: (...a) => navigations.push(a),
        problemIds: ['lc-146', 'lc-322'],
      }),
    ),
  );
  await settle();
  const card = document.querySelector('.ct-practice');
  assert.ok(card);
  assert.equal(card.querySelector('h2').textContent, 'Uber');
  assert.ok(card.textContent.includes('7judge-ready OA problems'));
  assert.equal(card.querySelector('a[href="/company/uber"]') !== null, true);
  // Only problems this visitor can open are listed.
  assert.deepEqual([...card.querySelectorAll('.ct-practice-lc li')].map((li) => li.querySelector('.ct-practice-title').textContent), ['LRU Cache']);
  await act(async () => card.querySelector('.ct-practice-cta').click());
  assert.deepEqual(navigations.at(-1), ['mock', { company: 'uber' }]);
  const related = [...document.querySelectorAll('.ct-related-item')];
  assert.ok(related[0].textContent.includes('Coin change') && related[0].textContent.includes('Judge-ready'));
  assert.equal(related[1].textContent.includes('Judge-ready'), false);
  assert.equal(document.querySelector('.ct-result').textContent, 'Offer');
  await act(async () => root.unmount());
});
