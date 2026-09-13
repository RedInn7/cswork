import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

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
  const { OaLibrary, OaMarkdown, OaEditorial } =
    await import('../components/oa-library.tsx');
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
    const companySelect = document.querySelector('select');
    await act(async () => {
      companySelect.value = 'amazon';
      companySelect.dispatchEvent(
        new dom.window.Event('change', { bubbles: true }),
      );
    });
    assert.match(requests.at(-1).url, /company=amazon/);
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
