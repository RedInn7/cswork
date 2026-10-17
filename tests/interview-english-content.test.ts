import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLANK, checkCloze, checkOrder, normalize, scramble } from '../lib/english-drill';
import { englishUnit, englishUnits } from '../lib/interview-english';

const CJK = /[一-鿿]/;
const english = (text: string, where: string) => {
  assert.ok(text.trim() && !CJK.test(text), `${where}: English text`);
};
const chinese = (text: string, where: string) => assert.ok(CJK.test(text), `${where}: Chinese text`);
const pair = (value: { zh: string; en: string } | undefined, where: string) => {
  assert.ok(value, where);
  chinese(value.zh, `${where}.zh`);
  english(value.en, `${where}.en`);
};

void test('twelve units with unique, URL-safe slugs', () => {
  assert.equal(englishUnits.length, 12);
  assert.equal(new Set(englishUnits.map((unit) => unit.slug)).size, 12);
  for (const unit of englishUnits) {
    assert.match(unit.slug, /^[a-z]+(?:-[a-z]+)*$/);
    assert.equal(englishUnit(unit.slug), unit);
  }
  assert.equal(englishUnit('nope'), undefined);
});

void test('every unit has its fields, in both languages', () => {
  for (const unit of englishUnits) {
    const at = unit.slug;
    pair(unit.title, `${at}.title`);
    pair(unit.blurb, `${at}.blurb`);
    if (unit.them) pair(unit.them, `${at}.them`);
    assert.ok(unit.phrases.length >= 8 && unit.phrases.length <= 12, `${at}: 8-12 phrases`);
    unit.phrases.forEach((phrase, i) => {
      english(phrase.en, `${at}.phrases[${i}].en`);
      chinese(phrase.zh, `${at}.phrases[${i}].zh`);
      pair(phrase.note, `${at}.phrases[${i}].note`);
    });
    assert.equal(new Set(unit.phrases.map((phrase) => normalize(phrase.en))).size, unit.phrases.length, `${at}: no repeated phrase`);
    assert.ok(unit.dialogue.length >= 6 && unit.dialogue.length <= 10, `${at}: a 6-10 line dialogue`);
    unit.dialogue.forEach((line, i) => {
      assert.ok(line.who === 'I' || line.who === 'C', `${at}.dialogue[${i}].who`);
      english(line.en, `${at}.dialogue[${i}].en`);
      chinese(line.zh, `${at}.dialogue[${i}].zh`);
    });
    assert.deepEqual(new Set(unit.dialogue.map((line) => line.who)), new Set(['I', 'C']), `${at}: both sides speak`);
    assert.ok(unit.drills.cloze.length >= 3 && unit.drills.order.length >= 1, `${at}: drills`);
  }
});

void test('every cloze has exactly one blank and answers that fill it', () => {
  for (const unit of englishUnits)
    unit.drills.cloze.forEach((cloze, i) => {
      const at = `${unit.slug}.cloze[${i}]`;
      assert.equal(cloze.en.split(BLANK).length, 2, `${at}: exactly one ${BLANK}`);
      assert.doesNotMatch(cloze.en, /____/, `${at}: a blank of three underscores`);
      english(cloze.en.replace(BLANK, 'x'), at);
      chinese(cloze.zh, `${at}.zh`);
      assert.ok(cloze.answers.length > 0, `${at}: answers`);
      for (const answer of cloze.answers) {
        english(answer, `${at}: answer`);
        assert.ok(normalize(answer), `${at}: answer "${answer}" is more than punctuation`);
        assert.equal(checkCloze(answer, cloze.answers), true);
      }
    });
});

void test('every order drill has three or more distinct parts', () => {
  for (const unit of englishUnits)
    unit.drills.order.forEach((order, i) => {
      const at = `${unit.slug}.order[${i}]`;
      assert.ok(order.parts.length >= 3, `${at}: three or more parts`);
      assert.equal(new Set(order.parts.map(normalize)).size, order.parts.length, `${at}: parts read differently`);
      order.parts.forEach((part) => english(part, at));
      chinese(order.zh, `${at}.zh`);
    });
});

const orders = (parts: string[]): string[][] =>
  parts.length < 2 ? [parts] : parts.flatMap((part, i) => orders(parts.toSpliced(i, 1)).map((rest) => [part, ...rest]));

void test('every other accepted order uses the same parts, and the pool never starts in an accepted order', () => {
  for (const unit of englishUnits)
    unit.drills.order.forEach((order, i) => {
      const at = `${unit.slug}.order[${i}]`;
      for (const sentence of order.also ?? []) {
        english(sentence, `${at}.also`);
        assert.notEqual(normalize(sentence), normalize(order.parts.join(' ')), `${at}: "${sentence}" is not the sentence itself`);
        assert.ok(
          orders(order.parts).some((parts) => normalize(parts.join(' ')) === normalize(sentence)),
          `${at}: "${sentence}" is the parts in another order`,
        );
      }
      const pool = scramble(order.parts, order.also).map((k) => order.parts[k]);
      assert.equal(checkOrder(pool, order.parts, order.also), false, `${at}: the pool is not an answer`);
    });
});
