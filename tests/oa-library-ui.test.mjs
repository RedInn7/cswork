import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('company logo manifest uses existing inert local SVGs with recorded sources', async () => {
  const { companyLogos, companyInitials } =
    await import('../lib/oa-company-brands.ts');
  const attribution = ['README.md', 'SOURCES.md']
    .map((file) => readFileSync(resolve('public/company-logos', file), 'utf8'))
    .join('\n');
  assert.ok(Object.keys(companyLogos).length >= 50);
  for (const [slug, asset] of Object.entries(companyLogos)) {
    assert.match(asset, /^\/company-logos\/[a-z0-9]+\.svg$/);
    const svg = readFileSync(resolve('public' + asset), 'utf8');
    assert.ok(Buffer.byteLength(svg) <= 60 * 1024, asset);
    assert.match(svg, /^<svg\s/);
    assert.doesNotMatch(
      svg,
      /<(?:script|foreignObject|image|use|style)\b|\bon\w+\s*=|(?:href|src)\s*=|<!ENTITY|https?:\/\/(?!www\.w3\.org\/)/i,
    );
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.ok(attribution.includes('| ' + slug + ' |'));
  }
  assert.equal(
    readdirSync(resolve('public/company-logos')).filter((file) =>
      file.endsWith('.svg'),
    ).length,
    new Set(Object.values(companyLogos)).size,
  );
  for (const required of ['google', 'meta', 'uber'])
    assert.ok(companyLogos[required]);
  assert.equal(companyInitials('Amazon'), 'AM');
  assert.equal(companyInitials('IBM'), 'IBM');
  assert.equal(companyInitials('Jane Street'), 'JS');
  assert.equal(companyInitials(''), '?');
});

test('OA library reveals solutions only on request, supports language/copy and cancels stale detail', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://cswork.test/',
  });
  const saved = new Map();
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'navigator',
    'location',
    'history',
  ]) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  }
  const originalFetch = globalThis.fetch;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const requests = [];
  globalThis.fetch = (url, options) =>
    new Promise((resolve) =>
      requests.push({ url, signal: options.signal, resolve }),
    );
  const { createRoot } = await import('react-dom/client');
  const {
    OaLibrary,
    OaMarkdown,
    OaEditorial,
    OaCompanyBadge,
    CompanyIdentity,
  } = await import('../components/oa-library.tsx');
  const root = createRoot(document.getElementById('root'));
  const answer = async (request, body) =>
    act(async () => request.resolve({ ok: true, json: async () => body }));
  // Problem rows are links (/oa/<company>/<id>); the rest are buttons.
  const click = async (text) =>
    act(async () =>
      [...document.querySelectorAll('button, a.oa-row')]
        .find((button) => button.textContent.includes(text))
        .click(),
    );
  const item = {
    id: 'amazon-1',
    companySlug: 'amazon',
    companyName: 'Amazon',
    number: 1,
    title: 'Test OA',
    sourceUrl: 'https://oamaster.com/company/amazon',
    languages: ['python', 'java', 'cpp', 'sql'],
    judgeStatus: 'ready',
    judgeProblemId: 'amazon-1',
    difficulty: '中等',
    difficultyEstimated: true,
    topics: ['greedy-scheduling', 'simulation'],
  };
  try {
    await act(async () => root.render(createElement(OaLibrary)));
    assert.match(document.body.textContent, /Loading OA/);
    await answer(requests[0], {
      items: [item],
      total: 1,
      page: 1,
      pageSize: 30,
      companies: [{ slug: 'amazon', name: 'Amazon', count: 1 }],
      topics: [
        { slug: 'greedy-scheduling', count: 1 },
        { slug: 'simulation', count: 1 },
      ],
      source: { name: 'OA Master' },
    });
    assert.match(document.body.textContent, /SQL/);
    // Estimated topics as chips, an estimated difficulty marked ≈, and the topic menu with counts.
    assert.deepEqual(
      [...document.querySelectorAll('.oa-row .oa-title small')].map((chip) => chip.textContent),
      ['SQL', 'Greedy', 'Simulation'],
    );
    assert.match(document.querySelector('.oa-row .oa-difficulty').textContent, /^≈Estimated Medium$/);
    assert.match(document.querySelector('.study-result-summary').textContent, /AI-estimated/);
    assert.deepEqual(
      [...document.querySelectorAll('.oa-topic-filter option')].map((option) => option.textContent),
      ['All topics', 'Greedy (1)', 'Simulation (1)'],
    );
    assert.equal(
      document.querySelector('a.oa-row').getAttribute('href'),
      '/oa/amazon/amazon-1',
    );
    assert.match(document.body.textContent, /1 practice-ready OA problem/);
    assert.match(
      document.querySelector('.oa-company-caption').textContent,
      /practice-ready/,
    );
    assert.equal(
      document
        .querySelector('.oa-company-nav button')
        .getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(
      document.querySelector('.oa-row .oa-company-name').textContent,
      'Amazon',
    );
    assert.match(
      document.querySelector('.oa-company-sidebar').textContent,
      /All companies/,
    );
    assert.ok(
      document.querySelector('.oa-company-search input[type="search"]'),
    );
    const companySearch = document.querySelector('.oa-company-search input');
    const inputValue = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      'value',
    ).set;
    await act(async () => {
      inputValue.call(companySearch, 'not-a-company');
      companySearch.dispatchEvent(
        new dom.window.Event('input', { bubbles: true }),
      );
    });
    assert.equal(
      document.querySelectorAll('.oa-company-options button').length,
      0,
    );
    assert.match(
      document.querySelector('.oa-company-options').textContent,
      /No matching/,
    );
    assert.equal(
      requests.length,
      1,
      'company name search is local, not a question request',
    );
    await act(async () => {
      inputValue.call(companySearch, '');
      companySearch.dispatchEvent(
        new dom.window.Event('input', { bubbles: true }),
      );
    });
    await click('Test OA');
    await answer(requests[1], {
      ...item,
      statement: '# Problem\n\nFind answer.',
      contentHash: 'abc',
    });
    assert.equal(requests.length, 2);
    assert.match(document.body.textContent, /Run the examples, submit your code/);
    assert.equal(
      document.querySelector('[aria-expanded]').getAttribute('aria-expanded'),
      'false',
    );
    await click('View solution');
    assert.match(requests[2].url, /\/solution$/);
    await answer(requests[2], {
      explanation: 'Reference explanation',
      solutions: [
        { language: 'python', code: 'print(1)' },
        { language: 'java', code: 'return 2;' },
        { language: 'java', code: 'return 3;' },
      ],
    });
    assert.match(document.body.textContent, /Reference explanation/);
    const select = document.querySelector('select');
    await act(async () => {
      select.value = 'java';
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(
      document.querySelector('.oa-code code').textContent,
      'return 2;',
    );
    let copied;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value) => {
          copied = value;
        },
      },
    });
    await click('Copy code');
    assert.equal(copied, 'return 2;');
    assert.equal(document.querySelectorAll('select option').length, 2);
    assert.equal(document.querySelectorAll('.oa-code code').length, 2);
    await click('Copy code 2');
    assert.equal(copied, 'return 3;');
    await click('Hide solution');
    assert.doesNotMatch(document.body.textContent, /Reference explanation/);
    await click('Back to OA');
    await click('Test OA');
    const stale = requests.at(-1);
    await click('Back to OA');
    assert.equal(stale.signal.aborted, true);
    await answer(stale, {
      ...item,
      statement: 'STALE CONTENT',
      contentHash: 'def',
    });
    assert.doesNotMatch(document.body.textContent, /STALE CONTENT/);
    await click('Amazon');
    assert.match(requests.at(-1).url, /company=amazon/);
    // Filters are mirrored into the address bar without adding history entries.
    assert.equal(new URL(location.href).searchParams.get('company'), 'amazon');
    assert.equal(
      document
        .querySelector('.oa-company-options button')
        .getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(
      document.querySelector('.oa-company-mobile select').value,
      'amazon',
    );
    const topicSelect = document.querySelector('.oa-topic-filter select');
    await act(async () => {
      topicSelect.value = 'simulation';
      topicSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(
      new URL(requests.at(-1).url, 'https://cswork.test').searchParams.get('topic'),
      'simulation',
    );
    assert.equal(new URL(location.href).searchParams.get('topic'), 'simulation');
    await act(async () => {
      topicSelect.value = '';
      topicSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(new URL(location.href).searchParams.get('topic'), null);
    await act(async () => requests.at(-1).resolve({ ok: false, status: 503 }));
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /Failed to load/,
    );
    await click('Retry');
    await answer(requests.at(-1), {
      items: [],
      total: 0,
      page: 1,
      pageSize: 30,
      companies: [{ slug: 'amazon', name: 'Amazon', count: 1 }],
      source: { name: 'OA Master' },
    });
    assert.match(document.body.textContent, /No matching problems/);
    await act(async () => {
      const mobileSelect = document.querySelector('.oa-company-mobile select');
      mobileSelect.value = '';
      mobileSelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true }),
      );
    });
    assert.equal(
      new URL(requests.at(-1).url, 'https://cswork.test').searchParams.get(
        'company',
      ),
      '',
    );
    assert.equal(
      document
        .querySelector('.oa-company-nav button')
        .getAttribute('aria-pressed'),
      'true',
    );
    let relatedNavigation;
    await act(async () =>
      root.render(
        createElement(OaLibrary, {
          key: 'related-practice',
          navigate: (...args) => {
            relatedNavigation = args;
          },
        }),
      ),
    );
    const stage = {
      ...item,
      id: 'oa-stripe-14',
      title: 'Payment Intent Part 2',
      companySlug: 'stripe',
      companyName: 'Stripe',
      judgeStatus: 'reading_only',
      judgeProblemId: undefined,
    };
    await answer(requests.at(-1), {
      items: [stage],
      total: 1,
      page: 1,
      pageSize: 30,
      companies: [{ slug: 'stripe', name: 'Stripe', count: 1 }],
      source: { name: 'OA Master' },
    });
    await click('Payment Intent Part 2');
    await answer(requests.at(-1), {
      ...stage,
      statement: 'UPDATE rule',
      contentHash: 'stage-hash',
      relatedPractice: {
        problemId: 'oa-stripe-17',
        title: 'Payment Intent 四阶段综合练习',
        description:
          '本阶段包含在四阶段综合练习中；本阶段未单独评测。综合练习使用带时间戳的命令。',
      },
    });
    assert.match(document.body.textContent, /本阶段未单独评测/);
    assert.match(document.body.textContent, /带时间戳/);
    assert.doesNotMatch(
      document.body.textContent,
      /View solution|Start practicing|Judging isn't ready/,
    );
    await click('Practice all four stages');
    assert.deepEqual(relatedNavigation, [
      'problem',
      { problem: 'oa-stripe-17' },
    ]);
    await act(async () =>
      root.render(
        createElement(OaMarkdown, {
          body: '<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n[good](https://oamaster.com/)\n\n![tracking](https://evil.test/tracker)',
        }),
      ),
    );
    assert.equal(document.querySelector('script'), null);
    assert.equal(document.querySelector('img'), null);
    assert.equal(document.querySelectorAll('a').length, 1);
    assert.equal(document.querySelector('a').rel, 'noopener noreferrer');
    let navigation;
    await act(async () =>
      root.render(
        createElement(OaLibrary, {
          navigate: (...args) => {
            navigation = args;
          },
        }),
      ),
    );
    await answer(requests.at(-1), {
      items: [
        item,
        {
          ...item,
          id: 'pending',
          title: 'Pending OA',
          judgeStatus: 'reading_only',
          judgeProblemId: undefined,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 30,
      companies: [],
      source: { name: 'OA Master' },
    });
    await click('Test OA');
    assert.deepEqual(navigation, ['problem', { problem: item.id }]);
    await click('Pending OA');
    await answer(requests.at(-1), {
      ...item,
      id: 'pending',
      judgeStatus: 'reading_only',
      statement: 'Pending statement',
    });
    assert.match(document.body.textContent, /Judging isn't ready/);
    assert.doesNotMatch(document.body.textContent, /Start practicing|View solution/);
    await click('Back to OA');
    navigation = undefined;
    // A modified click is the browser's (new tab), not an in-app navigation.
    await act(async () =>
      document.querySelector('a.oa-row').dispatchEvent(
        new dom.window.MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      ),
    );
    assert.equal(navigation, undefined);
    // Filters restore from the URL; a merged slug resolves to its company.
    history.replaceState(
      null,
      '',
      '/?view=problems&library=oa&company=barclay&page=2&ready=0&topic=hash-counting',
    );
    await act(async () =>
      root.render(createElement(OaLibrary, { key: 'from-url' })),
    );
    const restored = new URL(requests.at(-1).url, 'https://cswork.test')
      .searchParams;
    assert.deepEqual(
      [restored.get('company'), restored.get('page'), restored.get('ready'), restored.get('topic')],
      ['barclays', '2', '0', 'hash-counting'],
    );
    // Before its counts arrive, the chosen topic is still the selected option.
    assert.equal(document.querySelector('.oa-topic-filter select').value, 'hash-counting');
    history.replaceState(null, '', '/?view=problems&library=oa&topic=not-a-topic');
    await act(async () =>
      root.render(createElement(OaLibrary, { key: 'bad-topic' })),
    );
    assert.equal(
      new URL(requests.at(-1).url, 'https://cswork.test').searchParams.get('topic'),
      '',
    );
    await act(async () =>
      root.render(createElement(OaEditorial, { problemId: 'oa-google-1' })),
    );
    assert.match(requests.at(-1).url, /oa-google-1\/solution$/);
    await answer(requests.at(-1), {
      explanation: '## 正确性证明\n每条边恰好计数一次。',
      solutions: [{ language: 'python', code: 'print(9)' }],
    });
    assert.match(document.body.textContent, /正确性证明/);
    assert.match(document.body.textContent, /print\(9\)/);
    await act(async () =>
      root.render(createElement(OaCompanyBadge, { problemId: 'oa-acme-1' })),
    );
    assert.doesNotMatch(document.body.textContent, /Acme/);
    await answer(requests.at(-1), {
      id: 'oa-acme-1',
      companyName: 'Acme Incorporated',
    });
    assert.equal(
      document.querySelector('.oa-workspace-company .oa-company-name')
        .textContent,
      'Acme Incorporated',
    );
    await act(async () =>
      root.render(createElement(OaCompanyBadge, { problemId: 'oa-other-1' })),
    );
    assert.doesNotMatch(document.body.textContent, /Acme Incorporated/);
    const staleIdentity = requests.at(-1);
    await act(async () =>
      root.render(createElement(OaCompanyBadge, { problemId: 'oa-third-1' })),
    );
    assert.equal(staleIdentity.signal.aborted, true);
    await answer(staleIdentity, {
      id: 'oa-other-1',
      companyName: 'Stale Company',
    });
    assert.doesNotMatch(document.body.textContent, /Stale Company/);
    await answer(requests.at(-1), {
      id: 'oa-third-1',
      companyName: 'Third Company',
    });
    assert.match(document.body.textContent, /Third Company/);
    await act(async () =>
      root.render(
        createElement(CompanyIdentity, { slug: 'google', name: 'Google' }),
      ),
    );
    assert.equal(
      document.querySelector('img').getAttribute('src'),
      '/company-logos/google.svg',
    );
    assert.equal(document.querySelector('img').getAttribute('alt'), '');
    assert.equal(
      document.querySelector('.oa-company-logo').getAttribute('aria-hidden'),
      'true',
    );
    assert.equal(
      document.querySelector('.oa-company-name').textContent,
      'Google',
    );
    await act(async () =>
      document
        .querySelector('img')
        .dispatchEvent(new dom.window.Event('error')),
    );
    assert.equal(document.querySelector('img'), null);
    assert.equal(
      document.querySelector('.oa-company-initials').textContent,
      'GO',
    );
    await act(async () =>
      root.render(
        createElement(CompanyIdentity, {
          slug: 'not-a-brand',
          name: 'Real Company',
        }),
      ),
    );
    assert.equal(document.querySelector('img'), null);
    assert.equal(
      document.querySelector('.oa-company-name').textContent,
      'Real Company',
    );
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    dom.window.close();
  }
});

test('OA list: new-this-week banner, progress and newest-first filters in the URL, and Pick one', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://cswork.test/?view=problems&library=oa&status=todo',
  });
  const saved = new Map();
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'navigator', 'location', 'history']) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  }
  const originalFetch = globalThis.fetch;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const requests = [];
  globalThis.fetch = (url, options) =>
    new Promise((resolve) => requests.push({ url, signal: options.signal, resolve }));
  const { createRoot } = await import('react-dom/client');
  const { OaLibrary } = await import('../components/oa-library.tsx');
  const root = createRoot(document.getElementById('root'));
  const answer = async (request, body) => act(async () => request.resolve({ ok: true, json: async () => body }));
  const params = (request) => new URL(request.url, 'https://cswork.test').searchParams;
  const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const change = async (select, value) =>
    act(async () => {
      select.value = value;
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  const page = (o = {}) => ({
    items: [
      {
        id: 'oa-acme-1', companySlug: 'acme', companyName: 'Acme', number: 1, title: 'Fresh OA',
        sourceUrl: 'https://oamaster.com/docs/companies/acme', languages: ['python'],
        judgeStatus: 'ready', judgeProblemId: 'oa-acme-1', topics: [], addedAt: Date.UTC(2026, 9, 12),
      },
    ],
    total: 1, page: 1, pageSize: 30, companies: [{ slug: 'acme', name: 'Acme', count: 1, ready: 1 }],
    source: { name: 'OA Master' }, newThisWeek: 3, signedIn: true, ...o,
  });
  let navigation;
  try {
    await act(async () => root.render(createElement(OaLibrary, { navigate: (...args) => (navigation = args) })));
    // A progress filter from a link is sent and kept.
    assert.equal(params(requests[0]).get('status'), 'todo');
    await answer(requests[0], page());
    assert.match(button('added this week').textContent, /3 practice-ready OA problems added this week/);
    const status = document.querySelector('.oa-status-filter select');
    assert.ok(status && status.value === 'todo');
    assert.equal(document.querySelectorAll('.oa-added').length, 0, 'dates only in the newest-first list');
    await change(status, 'solved');
    assert.equal(params(requests.at(-1)).get('status'), 'solved');
    assert.equal(new URL(location.href).searchParams.get('status'), 'solved');
    await answer(requests.at(-1), page());
    // The banner opens the newest list with every other filter cleared.
    await act(async () => button('Acme').click());
    assert.equal(params(requests.at(-1)).get('company'), 'acme');
    await act(async () => button('added this week').click());
    const newest = params(requests.at(-1));
    assert.deepEqual(
      [newest.get('sort'), newest.get('status'), newest.get('company'), newest.get('ready')],
      ['new', '', '', '1'],
    );
    assert.equal(new URL(location.href).searchParams.get('sort'), 'new');
    await answer(requests.at(-1), page());
    assert.ok(button('added this week').getAttribute('aria-pressed') === 'true');
    assert.match(document.querySelector('.oa-added').textContent, /Added 2026-10-12/);
    assert.match(document.querySelector('.study-result-summary').textContent, /newest first/);
    // Pick one asks for a random problem under the same filters and opens it.
    await act(async () => button('Pick one').click());
    const pick = params(requests.at(-1));
    assert.deepEqual([pick.get('random'), pick.get('sort')], ['1', 'new']);
    assert.ok(button('Pick one').disabled);
    await answer(requests.at(-1), page({ random: 'oa-acme-7' }));
    assert.deepEqual(navigation, ['problem', { problem: 'oa-acme-7' }]);
    await act(async () => button('Pick one').click());
    await answer(requests.at(-1), page({ random: null }));
    assert.match(document.querySelector('.oa-pick-message').textContent, /No unsolved practice-ready problem/);
    // Guests see no progress menu and no banner when nothing is new.
    await act(async () => root.render(createElement(OaLibrary, { key: 'guest' })));
    await answer(requests.at(-1), page({ signedIn: false, newThisWeek: 0 }));
    assert.equal(document.querySelector('.oa-status-filter'), null);
    assert.equal(document.querySelector('.oa-new-banner'), null);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    dom.window.close();
  }
});
