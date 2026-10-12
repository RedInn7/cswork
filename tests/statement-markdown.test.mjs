import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
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
