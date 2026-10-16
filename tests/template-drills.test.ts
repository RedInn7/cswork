import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commentStart, routeTemplates, TEMPLATE_LANGS } from '../lib/route-templates';
import {
  BLANK_MAX,
  ORDER_MAX,
  blankDrill,
  blankRight,
  blankSpan,
  normalizeExpr,
  orderDrill,
  orderRight,
  sameLine,
  stripComments,
  type Blank,
} from '../lib/template-drills';

void test('every template in every language makes an ordering drill that puts back together', () => {
  for (const t of routeTemplates)
    for (const [lang] of TEMPLATE_LANGS)
      for (const seed of [1, 2, 3]) {
        const at = `${t.slug}/${lang}/${seed}`;
        const d = orderDrill(t.code[lang], lang, seed);
        assert(d.lines.length >= 6 && d.lines.length <= ORDER_MAX, at);
        assert(d.lines.every((line) => line.trim()), at);
        assert.deepEqual([...d.start].sort((a, b) => a - b), d.lines.map((_, i) => i), at);
        assert(!orderRight(d.lines, d.start), `${at}: starts shuffled`);
        assert(orderRight(d.lines, d.lines.map((_, i) => i)), at);
        // The drill is the comment-free template, in order.
        assert.deepEqual([...d.before, ...d.lines, ...d.after].filter((l) => l.trim()), stripComments(t.code[lang], lang).filter((l) => l.trim()), at);
        assert.deepEqual(orderDrill(t.code[lang], lang, seed), d, 'seeded');
      }
});

void test('every template in every language makes a fill-in drill whose answers come from the code', () => {
  for (const t of routeTemplates)
    for (const [lang] of TEMPLATE_LANGS) {
      const at = `${t.slug}/${lang}`;
      const lines = blankDrill(t.code[lang], lang, 7);
      const blanks = lines.filter((l): l is Blank => typeof l !== 'string');
      assert(blanks.length >= 1 && blanks.length <= BLANK_MAX, at);
      const source = t.code[lang].split('\n');
      for (const b of blanks) {
        assert(b.answer.trim().length > 1, at);
        assert.equal(b.answer, b.answer.trim(), `${at}: ${b.answer}`);
        const line = b.before + b.answer + b.after;
        assert(source.some((s) => s.startsWith(line)), `${at}: ${line}`);
        assert(blankRight(b, ` ${b.answer.replace(/ /g, '  ')} `), at);
        assert(!blankRight(b, `${b.answer}x`), at);
      }
      // No comment survives to give the answer away.
      assert(lines.every((l) => typeof l !== 'string' || commentStart(l, lang) < 0), at);
    }
});

void test('key lines: conditions, mid and return, in each language', () => {
  const blank = (line: string, lang: Parameters<typeof blankSpan>[1]) => {
    const at = blankSpan(line, lang);
    return at && line.slice(...at);
  };
  assert.equal(blank('    while lo < hi:', 'python'), 'lo < hi');
  assert.equal(blank('    for i in range(1, n + 1):', 'python'), 'range(1, n + 1)');
  assert.equal(blank('    for x in nums:', 'python'), null);
  assert.equal(blank('        mid = (lo + hi) // 2', 'python'), '(lo + hi) // 2');
  assert.equal(blank('    return w', 'python'), 'w');
  assert.equal(blank('        if (w < k || nums[w - k] != x) nums[w++] = x;', 'cpp'), 'w < k || nums[w - k] != x');
  assert.equal(blank('        int mid = lo + (hi - lo) / 2;', 'java'), 'lo + (hi - lo) / 2');
  assert.equal(blank('    for (int i = 0; i < n; i++) {', 'java'), 'i < n');
  assert.equal(blank('    for (int x : nums)', 'cpp'), null);
  assert.equal(blank('    } else if (a[i] > t) {', 'cpp'), 'a[i] > t');
  assert.equal(blank('\tfor i := 0; i < len(a); i++ {', 'go'), 'i < len(a)');
  assert.equal(blank('\tif v, ok := seen[x]; ok {', 'go'), 'ok');
  assert.equal(blank('\tfor lo < hi {', 'go'), 'lo < hi');
  assert.equal(blank('\tfor _, x := range nums {', 'go'), null);
  assert.equal(blank('\treturn lo', 'go'), 'lo');
  assert.equal(blank('\tif mid == x {', 'go'), 'mid == x');
});

void test('spacing never decides a line or a blank; indentation does', () => {
  assert(sameLine('    w += 1', '    w  +=   1'));
  assert(!sameLine('    w += 1', '        w += 1'));
  assert.equal(normalizeExpr(' lo  <  hi '), 'lo<hi');
  assert.equal(normalizeExpr('not  stack'), 'not stack');
  assert.equal(normalizeExpr('i in range( n )'), 'i in range(n)');
  // Two identical lines may trade places.
  assert(orderRight(['}', 'x', '}'], [2, 1, 0]));
});
