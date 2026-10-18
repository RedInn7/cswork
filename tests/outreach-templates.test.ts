// Outreach message templates (lib/content/outreach-templates.ts): eleven, each in both languages with
// the same known placeholders, and filled in without touching what was left blank; and the guide
// chapter checklists (lib/content/career-checklists.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, OUTREACH_TEMPLATES, PLACEHOLDERS, placeholdersIn } from '../lib/content/outreach-templates';

const CJK = /[㐀-鿿]/;

void test('eleven templates, each in Chinese and English with only known placeholders, the same in both', () => {
  assert.equal(OUTREACH_TEMPLATES.length, 11);
  assert.equal(new Set(OUTREACH_TEMPLATES.map((t) => t.id)).size, 11);
  for (const t of OUTREACH_TEMPLATES) {
    for (const [zh, en] of [t.title, t.tip, [t.zh.subject, t.en.subject], [t.zh.body, t.en.body]]) {
      assert.ok(CJK.test(zh), `${t.id}: ${zh}`);
      assert.ok(en.trim() && !CJK.test(en), `${t.id}: ${en}`);
    }
    const used = (lang: 'zh' | 'en') => placeholdersIn(`${t[lang].subject}\n${t[lang].body}`).sort();
    for (const key of used('zh')) assert.ok(Object.hasOwn(PLACEHOLDERS, key), `${t.id}: {${key}}`);
    assert.deepEqual(used('zh'), used('en'), t.id);
    // Signed by the learner, addressed to someone.
    assert.ok(t.en.body.includes('{name}') && t.en.body.trimEnd().endsWith('{myName}'), t.id);
  }
  // The offer negotiation ones link to the offer comparison.
  assert.deepEqual(
    OUTREACH_TEMPLATES.filter((t) => t.offer).map((t) => t.id),
    ['counter-competing', 'counter-no-competing'],
  );
});

void test('the expedite request names the other offer and its deadline, and no money', () => {
  const t = OUTREACH_TEMPLATES.find((x) => x.id === 'expedite')!;
  for (const lang of ['zh', 'en'] as const) {
    const text = `${t[lang].subject}\n${t[lang].body}`;
    assert.ok(placeholdersIn(text).includes('otherCompany') && placeholdersIn(text).includes('deadline'), lang);
    assert.doesNotMatch(text, /[$¥€£\d]|薪|salary|compensation/i, lang);
  }
  assert.equal(t.offer, undefined, 'not a negotiation');
});

void test('filling replaces what was given and keeps the rest visible', () => {
  assert.equal(
    fillTemplate('Hi {name}, {role} at {company}. {unknown} {myName}', { name: ' Sam ', company: 'Acme', role: '' }),
    'Hi Sam, {role} at Acme. {unknown} {myName}',
  );
  // Replacement text is taken literally.
  assert.equal(fillTemplate('{company}', { company: '$& {name}' }), '$& {name}');
  assert.equal(fillTemplate('{toString} {constructor}', {}), '{toString} {constructor}');
});

void test('guide checklists: seven chapters, 8–15 bilingual items each with a stable unique id', async () => {
  const { CAREER_CHECKLISTS } = await import('../lib/content/career-checklists');
  const { guideChapter } = await import('../lib/career-guide');
  assert.deepEqual(Object.keys(CAREER_CHECKLISTS), ['resume', 'referrals', 'online-assessment', 'phone-screen', 'onsite', 'offer', 'internship']);
  for (const [slug, items] of Object.entries(CAREER_CHECKLISTS)) {
    assert.ok(guideChapter(slug), slug);
    assert.ok(items.length >= 8 && items.length <= 15, `${slug}: ${items.length}`);
    assert.equal(new Set(items.map((i) => i.id)).size, items.length, slug);
    for (const item of items) {
      assert.match(item.id, /^[a-z0-9-]+$/);
      for (const [zh, en] of [item.text, item.detail]) {
        assert.ok(CJK.test(zh), `${slug}/${item.id}: ${zh}`);
        assert.ok(en.trim() && !CJK.test(en), `${slug}/${item.id}: ${en}`);
      }
      if (item.href) assert.match(item.href, /^\/(?!\/)/);
    }
  }
});
