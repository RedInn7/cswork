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
  // Experiences list by interview date; the order tabs switch to newly shared, popular or trending ones.
  assert.match(document.querySelector('.ct-list-head').textContent, /most recent first \(interview date, else the original post's\)/);
  const orders = [...document.querySelectorAll('.ct-sorts button')];
  assert.deepEqual(orders.map((b) => b.textContent), ['Recent interviews', 'Newly shared', 'Popular', 'Trending']);
  assert.equal(orders[0].getAttribute('aria-pressed'), 'true');
  await act(async () => orders[1].click());
  assert.deepEqual(navigations.at(-1), ['experiences', { type: 'experience', sort: 'new' }]);
  // Member posts by authors with a verified address.
  await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Verified authors only')).click());
  assert.deepEqual(navigations.at(-1), ['experiences', { type: 'experience', verified: '1' }]);
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

test('question cards: counts, curated badge, seniority, curated filter and popular order', async () => {
  const question = (slug, o) => ({
    ...experience(slug), type: 'interview_question', round: null, curated: false,
    stats: { answers: 0, ups: 0, asked: null, practised: null }, ...o,
  });
  globalThis.fetch = async () =>
    Response.json({
      items: [
        question('q1', { curated: true, stats: { answers: 3, ups: 1, asked: { n: 2, last: '2026-09' }, practised: null } }),
        question('q2', { type: 'coding_question', stats: { answers: 0, ups: 0, asked: null, practised: 41 } }),
        question('q3'),
      ],
      total: 3, page: 1, pageSize: 20,
      facets: {
        companies: [], companyTotal: 0, roles: [], categories: [], difficulties: [], rounds: [],
        seniorities: [facet('Senior', 2)], total: 3,
      },
    });
  const navigations = [];
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(createElement(ContentList, { section: 'questions', params: { sort: 'popular' }, navigate: (...a) => navigations.push(a) })),
  );
  await settle();
  const [q1, q2, q3] = document.querySelectorAll('.ct-card');
  assert.equal(q1.querySelector('.ct-curated').textContent.trim(), 'Curated');
  assert.deepEqual([...q1.querySelectorAll('.ct-stats span')].map((n) => n.textContent), ['Asked 2026-09 · 2 learners', '3 answers', '1 upvote']);
  assert.deepEqual([...q2.querySelectorAll('.ct-stats span')].map((n) => n.textContent), ['41 solved it']);
  assert.equal(q3.querySelector('.ct-stats'), null, 'nothing to count, no line');
  assert.equal(q2.querySelector('.ct-curated'), null);
  assert.match(document.querySelector('.ct-list-head').textContent, /most popular first/);
  const orders = [...document.querySelectorAll('.ct-sorts button')];
  assert.deepEqual(orders.map((b) => [b.textContent, b.getAttribute('aria-pressed')]), [['Latest', 'false'], ['Popular', 'true'], ['Trending', 'false']]);
  await act(async () => orders[2].click());
  assert.deepEqual(navigations.at(-1), ['questions', { type: 'questions', sort: 'hot' }]);
  assert.ok([...document.querySelectorAll('option')].some((o) => o.textContent === 'Senior · 2'));
  await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Curated only')).click());
  assert.deepEqual(navigations.at(-1), ['questions', { type: 'questions', sort: 'popular', curated: '1' }]);
  assert.equal([...document.querySelectorAll('button')].some((b) => b.textContent.includes('Verified authors')), false, 'experiences only');
  await act(async () => root.unmount());
});

test('detail actions: upvote, a teacher\'s curated pick and "I was asked this too"', async () => {
  const posts = [];
  globalThis.fetch = async (url, init) => {
    if (init?.method === 'POST') {
      posts.push([String(url), JSON.parse(init.body)]);
      return Response.json(JSON.parse(init.body));
    }
    if (String(url).includes('/api/oj/marks')) return Response.json({ items: [{ target: 'content:interview_question/q1', mark: 'up', createdAt: 1 }] });
    if (String(url).includes('/api/oj/reports')) return Response.json({ problemId: 'q:q1', months: 6, total: 4, last: '2026-09', companies: [], mine: [] });
    return Response.json({
      ...experience('q1'), type: 'interview_question', round: null, curated: false,
      stats: { answers: 0, ups: 3, asked: null, practised: null },
      body: 'Question body.', updatedAt: null, extra: {}, dupOf: null, practice: null, relations: [], companyPractice: null,
    });
  };
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      createElement(ContentDetail, { params: { type: 'interview_question', slug: 'q1' }, navigate: () => {}, problemIds: [], userId: 'u1', teacher: true }),
    ),
  );
  await settle();
  const actions = document.querySelector('.ct-actions');
  const helpful = [...actions.querySelectorAll('button')].find((b) => b.textContent.includes('Helpful'));
  assert.equal(helpful.getAttribute('aria-pressed'), 'true');
  assert.equal(helpful.querySelector('.ct-actions-count').textContent, '3');
  await act(async () => helpful.click());
  await settle();
  assert.deepEqual(posts.at(-1), ['/api/oj/marks', { target: 'content:interview_question/q1', mark: 'up', on: false }]);
  assert.equal(helpful.querySelector('.ct-actions-count').textContent, '2', 'the own vote leaves the count');
  await act(async () => [...actions.querySelectorAll('button')].find((b) => b.textContent.includes('Curate')).click());
  await settle();
  assert.deepEqual(posts.at(-1), ['/api/oj/marks', { target: 'content:interview_question/q1', mark: 'curated', on: true }]);
  const asked = actions.querySelector('.cs-asked');
  assert.match(asked.textContent, /I was asked this too4/);
  await act(async () => root.unmount());
});

test('"I was asked this too" on a coding question only when its judge problem opens here', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/oj/reports')) return Response.json({ problemId: 'lc-146', months: 6, total: 0, last: null, companies: [], mine: [] });
    return Response.json({
      ...experience('lru'), type: 'coding_question', round: null, curated: false,
      stats: { answers: 0, ups: 0, asked: null, practised: null },
      body: 'Question body.', updatedAt: null, extra: {}, dupOf: null, practice: 'lc-146', relations: [], companyPractice: null,
    });
  };
  const root = createRoot(document.getElementById('root'));
  const render = (problemIds) =>
    act(async () =>
      root.render(createElement(ContentDetail, { params: { type: 'coding_question', slug: 'lru' }, navigate: () => {}, problemIds, userId: 'u1' })),
    );
  await render([]);
  await settle();
  assert.equal(document.querySelector('.cs-asked'), null, 'mapped but not judge-ready: a report would be refused');
  await render(['lc-146']);
  await settle();
  assert.ok(document.querySelector('.ct-actions .cs-asked'));
  await act(async () => root.unmount());
});

test('switching the type tab clears seniority, and the algorithm tab the order', async () => {
  globalThis.fetch = async () =>
    Response.json({ items: [], total: 0, page: 1, pageSize: 20, facets: null });
  const navigations = [];
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      createElement(ContentList, {
        section: 'resources',
        params: { type: 'guide', seniority: 'Senior', sort: 'popular' },
        navigate: (...a) => navigations.push(a),
      }),
    ),
  );
  await settle();
  const tab = (name) => [...document.querySelectorAll('.rd-segment button')].find((b) => b.textContent === name);
  await act(async () => tab('Concepts').click());
  assert.deepEqual(navigations.at(-1), ['resources', { type: 'concept', sort: 'popular' }]);
  await act(async () => tab('Algorithms').click());
  assert.deepEqual(navigations.at(-1), ['resources', { type: 'algorithm' }], 'tutorials keep syllabus order');
  await act(async () => root.unmount());
});
