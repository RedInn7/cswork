import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_ID, newCardId, parseCard, splitTags, toAnki, toCsv } from '../lib/recall-cards';

const card = (extra: Record<string, unknown> = {}) => JSON.stringify({ v: 1, front: 'Q', back: 'A', tags: [], ...extra });

void test('a card keeps its link on this site: no other host, no script', () => {
  assert.deepEqual(parseCard(card({ src: { href: '/topics/two-pointers', title: 'Two pointers' } }))?.src, {
    href: '/topics/two-pointers',
    title: 'Two pointers',
  });
  for (const href of ['//evil.test/x', '/\\evil.test', 'javascript:alert(1)', 'https://evil.test/', 'topics/x', '/a b'])
    assert.equal(parseCard(card({ src: { href, title: 'x' } })), null, href);
  assert.equal(parseCard(card({ src: { href: '/x', title: 'x', extra: 1 } })), null);
});

void test('sizes, tags and shape are checked', () => {
  assert.ok(parseCard(card({ front: '字'.repeat(2000), back: 'b'.repeat(2000) })));
  assert.equal(parseCard(card({ front: '字'.repeat(2001) })), null);
  assert.equal(parseCard(card({ back: 'b'.repeat(2001) })), null);
  assert.equal(parseCard(card({ front: '  ' })), null, 'a front is required');
  assert.ok(parseCard(card({ back: '' })), 'a back may be empty');
  assert.ok(parseCard(card({ tags: ['dp', '动态规划', 'lc:1'] })));
  assert.equal(parseCard(card({ tags: Array.from({ length: 9 }, (_, i) => `t${i}`) })), null);
  assert.equal(parseCard(card({ tags: ['two words'] })), null);
  assert.equal(parseCard(card({ v: 2 })), null);
  assert.equal(parseCard(card({ extra: true })), null);
  for (const raw of ['', 'null', '[]', 'not json', undefined]) assert.equal(parseCard(raw), null);
  assert.deepEqual(splitTags('dp, greedy  动态规划 bad! dp'), ['dp', 'greedy', '动态规划']);
  const id = newCardId();
  assert.match(`card:${id}`, CARD_ID);
  assert.notEqual(id, newCardId());
});

void test('Anki: header, HTML-escaped fields, tabs and newlines made safe', () => {
  const text = toAnki([{ front: 'a<b> & c\td', back: 'line 1\nline 2\r\nline 3', tags: ['dp', 'cswork'] }]);
  assert.equal(text, '#separator:tab\n#html:true\n#tags column:3\na&lt;b&gt; &amp; c d\tline 1<br>line 2<br>line 3\tdp cswork\n');
});

void test('CSV: BOM, RFC 4180 quoting and no formulas', () => {
  const text = toCsv([
    { front: '=SUM(A1)', back: 'say "hi", ok', tags: [] },
    { front: '-1', back: 'two\nlines', tags: ['@x'] },
    { front: '+1', back: 'plain', tags: ['a', 'b'] },
  ]);
  assert.equal(
    text,
    '﻿Front,Back,Tags\r\n\'=SUM(A1),"say ""hi"", ok",\r\n\'-1,"two\nlines",\'@x\r\n\'+1,plain,a b\r\n',
  );
});
