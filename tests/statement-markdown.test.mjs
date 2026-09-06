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
