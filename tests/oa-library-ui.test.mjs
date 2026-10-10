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
  const click = async (text) =>
    act(async () =>
      [...document.querySelectorAll('button')]
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
  };
  try {
    await act(async () => root.render(createElement(OaLibrary)));
    assert.match(document.body.textContent, /正在加载 OA/);
    await answer(requests[0], {
      items: [item],
      total: 1,
      page: 1,
      pageSize: 30,
      companies: [{ slug: 'amazon', name: 'Amazon', count: 1 }],
      source: { name: 'OA Master' },
    });
    assert.match(document.body.textContent, /SQL/);
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
      /全部公司/,
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
      /没有匹配/,
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
    assert.match(document.body.textContent, /运行样例、提交代码/);
    assert.equal(
      document.querySelector('[aria-expanded]').getAttribute('aria-expanded'),
      'false',
    );
    await click('查看题解');
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
    await click('复制代码');
    assert.equal(copied, 'return 2;');
    assert.equal(document.querySelectorAll('select option').length, 2);
    assert.equal(document.querySelectorAll('.oa-code code').length, 2);
    await click('复制代码 2');
    assert.equal(copied, 'return 3;');
    await click('收起题解');
    assert.doesNotMatch(document.body.textContent, /Reference explanation/);
    await click('返回 OA');
    await click('Test OA');
    const stale = requests.at(-1);
    await click('返回 OA');
    assert.equal(stale.signal.aborted, true);
    await answer(stale, {
      ...item,
      statement: 'STALE CONTENT',
      contentHash: 'def',
    });
    assert.doesNotMatch(document.body.textContent, /STALE CONTENT/);
    await click('Amazon');
    assert.match(requests.at(-1).url, /company=amazon/);
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
    await act(async () => requests.at(-1).resolve({ ok: false, status: 503 }));
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /加载失败/,
    );
    await click('重试');
    await answer(requests.at(-1), {
      items: [],
      total: 0,
      page: 1,
      pageSize: 30,
      companies: [{ slug: 'amazon', name: 'Amazon', count: 1 }],
      source: { name: 'OA Master' },
    });
    assert.match(document.body.textContent, /没有找到匹配题目/);
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
      /查看题解|开始练习|评测准备中/,
    );
    await click('进入四阶段综合练习');
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
    assert.match(document.body.textContent, /评测准备中/);
    assert.doesNotMatch(document.body.textContent, /开始练习|查看题解/);
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
