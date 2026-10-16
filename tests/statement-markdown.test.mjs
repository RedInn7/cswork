import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { StatementMarkdown } from '../components/statement-markdown.tsx';
const render = body => new JSDOM(renderToStaticMarkup(React.createElement(StatementMarkdown, { body }))).window.document;
test('Chinese and English constraints render numeric powers, negative exponents and index expressions', () => {
  const doc = render('提示：`-10^{9} <= nums[i] <= 10^9`\n\nConstraints: `10^{-5}`, `O(n^{2})`, `2^{h}`, `a_{i+1}`, `x_{start}`.\n\nThe **2^{nd}** item has 2^10 choices.');
  assert.deepEqual([...doc.querySelectorAll('sup')].map(x => x.textContent), ['9','9','−5','2','h','nd','10']);
  assert.deepEqual([...doc.querySelectorAll('sub')].map(x => x.textContent), ['i+1','start']);
  assert.ok(!doc.body.textContent.includes('^{'));
});
test('code examples, XOR, identifiers, money and malformed scripts remain literal', () => {
  const source = 'int value = 10^9; // a_{i} and 2^{10}';
  const doc = render('```cpp\n' + source + '\n```\n\n`a ^ b` `a^2` `snake_case` `$1` `$3` `a_{，}` `a_{ }`');
  assert.equal(doc.querySelector('pre').textContent, source);
  assert.equal(doc.querySelectorAll('sup,sub').length, 0);
  for (const raw of ['a ^ b','a^2','snake_case','$1','$3','a_{，}','a_{ }']) assert.ok(doc.body.textContent.includes(raw));
});
test('example and constraint labels retain their heading semantics', () => {
  const doc = render('**Example 1:**\n\n**Constraints:**\n\n**示例 1：**\n\n**提示：**');
  assert.deepEqual([...doc.querySelectorAll('h3')].map(x => x.textContent), ['Example 1:', 'Constraints:', '示例 1：', '提示：']);
});
test('bold that ends in Chinese punctuation right before Chinese text still renders', () => {
  const doc = render('**进阶：**尝试设计时间复杂度为 O(n)、空间复杂度为 O(1) 的算法解决此问题。\n\n**空格：**读入字符串并丢弃无用的前导空格');
  assert.deepEqual([...doc.querySelectorAll('strong')].map(x => x.textContent), ['进阶：', '空格：']);
  assert.ok(!doc.body.textContent.includes('**'));
  assert.ok(doc.body.textContent.includes('进阶：尝试设计时间复杂度为 O(n)'));
});
test('the CJK rule never touches code', () => {
  const doc = render('`**k**` and `x**：**y`\n\n```py\nprint(2 ** 10)\n**进阶：**不变\n```');
  assert.equal(doc.querySelectorAll('strong').length, 0);
  assert.equal(doc.querySelector('pre').textContent, 'print(2 ** 10)\n**进阶：**不变');
});
test('a page may keep its own container classes', () => {
  const html = renderToStaticMarkup(React.createElement(StatementMarkdown, { body: 'x', className: 'prose-content lms-markdown' }));
  assert.match(html, /^<article class="prose-content lms-markdown">/);
});
test('imported spaces inside bold markers are repaired on either side', () => {
  const doc = render('请你**原地 **修改，只包含** 严格小于 **当前节点，需** 遵循如下规则**：');
  assert.deepEqual([...doc.querySelectorAll('strong')].map(x => x.textContent), ['原地', '严格小于', '遵循如下规则']);
  assert.ok(!doc.body.textContent.includes('**'));
});
test('imported bold artifacts are tidied outside code only', async () => {
  const { tidyImportedBold } = await import('../components/statement-markdown.tsx');
  const cases = [
    ['****示例 2:****', '**示例 2:**'],
    ['********提示：********', '**提示：**'],
    ['****进阶**：**', '**进阶：**'],
    ['- ****进阶：****如果允许调用', '- **进阶：**如果允许调用'],
    ['**示例**** 2:**', '**示例 2:**'],
    ['有一个元素出现了 **恰好 1 ****次**。', '有一个元素出现了 **恰好 1 次**。'],
    ['不含有重复字符的 **最长 子串**** **的长度', '不含有重复字符的 **最长 子串** 的长度'],
    ['最多****两次', '最多两次'],
    ['**示例 **2:****', '**示例 2:**'],
    ['two **non-empty** ****substrings**** `s[0..i]` and', 'two **non-empty** **substrings** `s[0..i]` and'],
    ['00000**1****1**0**1**', '00000**11**0**1**'],
    ['text **not match** the rules **', 'text **not match** the rules **'], // may close on the next line
    ['**\n\n![](x.png)\n\n**', '\n![](x.png)\n'],
    ['`a****b` 与 `** x **` 与 ** y **', '`a****b` 与 `** x **` 与 **y**'],
    ['```\n** a **\n****\n```', '```\n** a **\n****\n```'],
  ];
  for (const [raw, tidy] of cases) assert.equal(tidyImportedBold(raw), tidy, raw);
});

// Posts: playground links, spoilers, language tabs and math (statements get none of them).
register(
  `data:text/javascript,${encodeURIComponent(`export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);
const post = body => new JSDOM(renderToStaticMarkup(React.createElement(StatementMarkdown, { body, untrusted: true, diagrams: true }))).window.document;
test('post code blocks offer the playground; statements and other languages do not', () => {
  const body = '```python\nprint(1)\n```\n\n```text\nplain\n```';
  assert.equal(render(body).querySelectorAll('.cs-run-playground').length, 0);
  const doc = post(body);
  assert.deepEqual([...doc.querySelectorAll('.cs-run-playground')].map(x => x.textContent), ['Open in Playground']);
  assert.equal(doc.querySelectorAll('pre').length, 2);
});
test('a playground link opens the same code, and a link past the share limit is refused', async () => {
  const { playgroundHref, decodeShare, playgroundLanguage } = await import('../lib/playground-share.ts');
  const state = { language: 'cpp', code: '#include <cstdio>\nint main() { puts("hi"); }\n', stdin: '3\n' };
  const href = await playgroundHref(state);
  assert.match(href, /^\/playground#c=/);
  assert.deepEqual(await decodeShare(new URL(href, 'https://cswork.test').hash), state);
  let seed = 7;
  const noise = Array.from({ length: 60000 }, () => String.fromCharCode(33 + ((seed = (seed * 48271) % 2147483647) % 90))).join('');
  assert.equal(await playgroundHref({ language: 'python', code: noise, stdin: '' }), null);
  assert.deepEqual(['py', 'C++', 'golang', 'java', 'rust', 'constructor', ''].map(playgroundLanguage), ['python', 'cpp', 'go', 'java', null, null, null]);
});
test('spoiler fences fold closed under their title and render Markdown inside', () => {
  const doc = post('````spoiler Hint 1\nUse **two pointers**.\n\n```go\nfunc main() {}\n```\n````\n\n```spoiler\nanswer\n```');
  const [hint, plain] = doc.querySelectorAll('details.cs-spoiler');
  assert.equal(hint.hasAttribute('open'), false);
  assert.equal(hint.querySelector('summary').textContent, 'Hint 1');
  assert.equal(hint.querySelector('strong').textContent, 'two pointers');
  assert.equal(hint.querySelector('pre').textContent.trim(), 'func main() {}');
  assert.equal(hint.querySelectorAll('.cs-run-playground').length, 1);
  assert.equal(plain.querySelector('summary').textContent, 'Spoiler');
  assert.equal(render('```spoiler\nanswer\n```').querySelectorAll('details').length, 0);
  // A ```spoiler line never closes a fence: folds do not nest, so this is one fold, not a thousand.
  const deep = '```spoiler\n'.repeat(1000) + 'x\n```';
  assert.equal(post(deep).querySelectorAll('details').length, 1);
  const inner = post('````spoiler A\n```spoiler B\nx\n```\n````');
  assert.equal(inner.querySelectorAll('details').length, 1);
  assert.equal(inner.querySelector('details pre').textContent.trim(), 'x');
});
test('consecutive blocks in different languages become one tab set; others stay', () => {
  const doc = post('```python\nprint(1)\n```\n\n```cpp\nint main() {}\n```\n\n```java\nclass A {}\n```\n\ntext\n\n```go\nfunc main() {}\n```\n\n```python\na = 1\n```\n\n```python\nb = 2\n```');
  const groups = doc.querySelectorAll('.cs-code-tabs');
  assert.equal(groups.length, 2);
  const tabs = [...groups[0].querySelectorAll('[role="tab"]')];
  assert.deepEqual(tabs.map(x => x.textContent), ['Python 3', 'C++', 'Java']);
  assert.deepEqual(tabs.map(x => x.getAttribute('aria-selected')), ['true', 'false', 'false']);
  const panels = [...groups[0].querySelectorAll('[role="tabpanel"]')];
  assert.deepEqual(panels.map(x => x.hidden), [false, true, true]);
  assert.equal(panels[1].getAttribute('aria-labelledby'), tabs[1].id);
  assert.equal(panels[1].querySelector('pre').textContent.trim(), 'int main() {}');
  // go then python merge; the second python starts over and stands alone.
  assert.deepEqual([...groups[1].querySelectorAll('[role="tab"]')].map(x => x.textContent), ['Go', 'Python 3']);
  assert.equal(doc.querySelectorAll('pre').length, 6);
  assert.equal(render('```python\na\n```\n\n```cpp\nb\n```').querySelectorAll('[role="tablist"]').length, 0);
});
test('a post renders TeX once KaTeX loads, keeps money as text, and its links carry the code', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'navigator', 'localStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { decodeShare } = await import('../lib/playground-share.ts');
  const root = createRoot(document.getElementById('root'));
  const body = 'Time is $O(n^2)$; it costs $5 和 $10, or $3-$4.\n\n$$ x^2 $$\n\n```python\nprint(input())\n```\n\n```go\nfunc main() {}\n```';
  await act(async () => root.render(React.createElement(StatementMarkdown, { body, untrusted: true })));
  try {
    for (let i = 0; i < 100 && !document.querySelector('.katex'); i++)
      await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    const tex = [...document.querySelectorAll('.katex annotation')].map(x => x.textContent.trim());
    assert.deepEqual(tex, ['O(n^2)', 'x^2'], 'spaces inside one-line $$ … $$ are display math, not money');
    assert.ok(document.body.textContent.includes('it costs $5 和 $10, or $3-$4.'));
    assert.ok(document.querySelector('article').classList.contains('cs-untrusted'), 'a post clips math that paints outside it');
    const href = document.querySelector('.cs-run-playground a').getAttribute('href');
    assert.deepEqual(await decodeShare(new URL(href, 'https://cswork.test').hash), { language: 'python', code: 'print(input())\n', stdin: '' });
    assert.equal(document.querySelector('.cs-run-playground a').target, '_blank');
    // Arrow keys move between language tabs and focus the new one.
    const tabs = () => [...document.querySelectorAll('[role="tab"]')];
    await act(async () => tabs()[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    assert.deepEqual(tabs().map(x => x.getAttribute('aria-selected')), ['false', 'true']);
    assert.equal(document.activeElement, tabs()[1]);
    assert.deepEqual([...document.querySelectorAll('[role="tabpanel"]')].map(x => x.hidden), [true, false]);
  } finally {
    act(() => root.unmount());
  }
});
test('server-rendered library pages offer the playground and fold member spoilers', async () => {
  const { PublicLibraryMarkdown } = await import('../app/library/markdown.tsx');
  const page = (body, ugc) => new JSDOM(renderToStaticMarkup(React.createElement(PublicLibraryMarkdown, { body, math: false, ugc }))).window.document;
  const body = '```java\nclass Main {}\n```\n\n```sql\nselect 1\n```\n\n```spoiler Answer\nUse a **heap**.\n```';
  const own = page(body, false);
  assert.equal(own.querySelectorAll('.cs-run-playground').length, 1);
  assert.equal(own.querySelectorAll('details').length, 0);
  const member = page(body, true);
  assert.equal(member.querySelectorAll('.cs-run-playground').length, 1);
  const spoiler = member.querySelector('details.cs-spoiler');
  assert.equal(spoiler.hasAttribute('open'), false);
  assert.equal(spoiler.querySelector('summary').textContent, 'Answer');
  assert.equal(spoiler.querySelector('strong').textContent, 'heap');
  assert.equal(page('```spoiler\n'.repeat(1000) + 'x\n```', true).querySelectorAll('details').length, 1);
  // A member's math renders on the public thread too (in a spoiler as well), and money stays text.
  const tex = new JSDOM(
    renderToStaticMarkup(React.createElement(PublicLibraryMarkdown, { body: 'It is $O(n^2)$; it costs $5 和 $10.\n\n```spoiler\n$x^2$\n```', math: true, ugc: true })),
  ).window.document;
  assert.deepEqual([...tex.querySelectorAll('.katex annotation')].map((x) => x.textContent.trim()), ['O(n^2)', 'x^2']);
  assert.ok(tex.body.textContent.includes('it costs $5 和 $10.'));
  // The thread's meta description drops code blocks, so a spoiler stays out of search results.
  const { plainExcerpt } = await import('../lib/community.ts');
  assert.equal(plainExcerpt('Try it.\n\n```spoiler Answer\nUse a **heap**.\n```\n\nGood luck'), 'Try it. Good luck');
  assert.equal(plainExcerpt('a\n````md\n```\nin\n```\n````\nb ~~~\nx'), 'a b');
  // A whole post body runs through it on the server: a run of fence marks must not backtrack.
  for (const body of ['`'.repeat(20000), '~'.repeat(20000), '```a'.repeat(5000), '```\n'.repeat(5000)]) {
    const start = performance.now();
    plainExcerpt(body);
    assert.ok(performance.now() - start < 50, `${JSON.stringify(body.slice(0, 4))}… took too long`);
  }
});
