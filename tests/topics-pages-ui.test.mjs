// /topics and /topics/<stop> render on the server without request context (the pages
// only resolve the locale); check structure, links, JSON-LD and accessibility hooks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';

// The quiz reuses the OA MCQ cards, which import their stylesheet.
register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);

const { TopicView, TopicsIndexView, topicCopy } = await import('../app/topics/views.tsx');
const { TOPIC_STOPS, topicStop } = await import('../app/topics/stops.ts');
const { variantsFor } = await import('../lib/route-templates.ts');

const render = (element) =>
  new JSDOM(`<main>${renderToStaticMarkup(element)}</main>`).window.document;
const ldJson = (doc) =>
  [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));

test('the index lists all 35 stops in order, grouped into labelled route strips', () => {
  for (const zh of [true, false]) {
    const doc = render(createElement(TopicsIndexView, { zh }));
    const links = [...doc.querySelectorAll('.topics-line a')];
    assert.equal(links.length, 35);
    assert.ok(links.every((a, i) => a.getAttribute('href') === `/topics/${TOPIC_STOPS[i].slug}`));
    assert.equal(doc.querySelectorAll('h1').length, 1);
    const sections = [...doc.querySelectorAll('section.topics-group')];
    assert.equal(sections.length, 6);
    assert.ok(sections.every((s) => doc.getElementById(s.getAttribute('aria-labelledby')) !== null));
    // Stop numbers are decorative; the name carries a screen-reader prefix instead.
    assert.ok(links.every((a) => a.querySelector('.topics-no').getAttribute('aria-hidden') === 'true'));
    assert.ok(links.every((a) => a.querySelector('.sr-only') !== null));
    const [crumbs, list] = ldJson(doc);
    assert.equal(crumbs['@type'], 'BreadcrumbList');
    assert.equal(list.itemListElement.length, 35);
    assert.ok(list.itemListElement[0].url === 'https://cswork.org/topics/array-foundations');
  }
});

test('a stop page shows points, pitfalls, four languages with one open, and links back to Line 500', () => {
  const stop = topicStop('binary-search');
  assert.ok(stop);
  for (const zh of [true, false]) {
    const doc = render(createElement(TopicView, { stop, zh }));
    assert.equal(doc.querySelector('h1').textContent, zh ? stop.title : stop.titleEn);
    assert.equal(doc.querySelectorAll('.topics-points li').length, 3);
    assert.equal(doc.querySelectorAll('.topics-pitfalls li').length, 3);
    assert.ok(doc.querySelector('.topics-points li').textContent === (zh ? stop.points[0].zh : stop.points[0].en));
    const details = [...doc.querySelectorAll('details.topics-code[name="topic-code"]')];
    assert.equal(details.length, 4);
    assert.ok(details.every((d) => d.getAttribute('name') === 'topic-code'));
    assert.ok(details[0].hasAttribute('open') && !details.slice(1).some((d) => d.hasAttribute('open')));
    assert.ok(details.map((d) => d.querySelector('summary').textContent).join() === 'Python,C++,Java,Go');
    // Scrollable code is keyboard-focusable and labelled; comments are dimmed, code is intact.
    const pres = [...doc.querySelectorAll('pre.topics-pre')];
    // role=region: aria-label is ignored on a bare <pre> (implicit role generic).
    assert.ok(
      pres.every((p) => p.getAttribute('tabindex') === '0' && p.getAttribute('role') === 'region' && p.getAttribute('aria-label')),
    );
    assert.ok(pres[0].textContent === stop.code.python);
    assert.ok(pres[3].textContent === stop.code.go);
    assert.ok(doc.querySelectorAll('.topics-comment').length > 0);
    // Each template opens in the playground (a link once the browser has packed it).
    assert.equal(doc.querySelectorAll('details.topics-code[name="topic-code"] .cs-run-playground').length, 4);
    assert.ok(details.map((d) => d.dataset.lang).join() === 'python,cpp,java,go');
    const cta = doc.querySelector('a.topics-cta');
    assert.ok(cta.getAttribute('href') === '/?view=problems&section=binary-search');
    assert.ok(cta.textContent.includes(String(stop.problems)) && cta.textContent.includes(stop.no));
    // The complexity badge is in the page language, not English on the zh page.
    const badge = doc.querySelector('.topics-complexity').textContent;
    assert.ok(badge === (zh ? stop.complexity.zh : stop.complexity.en));
    assert.ok(doc.querySelector('a[rel="prev"]').getAttribute('href') === '/topics/prefix-intervals');
    assert.ok(doc.querySelector('a[rel="next"]').getAttribute('href') === '/topics/stacks-heaps');
    assert.ok(doc.querySelector('[aria-current="page"]') !== null);
    const [crumbs, article] = ldJson(doc);
    assert.equal(crumbs.itemListElement.length, 3);
    assert.ok(crumbs.itemListElement[2].item === 'https://cswork.org/topics/binary-search');
    assert.equal(article['@type'], 'TechArticle');
    // programmingLanguage belongs to SoftwareSourceCode, not TechArticle.
    assert.ok(!('programmingLanguage' in article));
    assert.ok(article.hasPart.map((part) => part.programmingLanguage).join() === 'Python,C++,Java,Go');
    assert.ok(article.description === topicCopy(stop, zh).description);
    // Under the templates: a quick quiz on the stop, then drills cut from its template.
    const quiz = doc.querySelector('section.topics-quiz');
    const questions = quiz.querySelectorAll('.oa-mcq-list > li');
    assert.ok(questions.length >= 3 && questions.length <= 5);
    assert.ok(doc.getElementById(quiz.getAttribute('aria-labelledby')));
    assert.equal(quiz.querySelector('.oa-mcq-filters'), null, 'no filters on a stop page');
    assert.ok(quiz.querySelector('a[href="/oa/mcq"]'));
    const drill = doc.querySelector('section.topics-drill');
    assert.ok(drill.compareDocumentPosition(quiz) & 2, 'quiz comes first');
    assert.ok(drill.querySelectorAll('.topics-drill-lines button').length >= 6);
    assert.equal(drill.querySelector('[role="group"] button[aria-pressed="true"]').textContent, zh ? '排序题' : 'Put in order');
  }
});

test('variants: one closed details each, four languages, a clip target; the matrix links its cells', () => {
  for (const slug of ['binary-search', 'dp-knapsack']) {
    const stop = topicStop(slug);
    const variants = variantsFor(slug);
    assert.ok(variants.length >= 2, slug);
    for (const zh of [true, false]) {
      const doc = render(createElement(TopicView, { stop, zh }));
      const section = doc.querySelector('section.topics-variants');
      assert.ok(doc.getElementById(section.getAttribute('aria-labelledby')));
      const items = [...section.querySelectorAll('details.topics-variant')];
      assert.deepEqual(items.map((d) => d.id), variants.map((v) => `variant-${v.id}`));
      for (const [i, item] of items.entries()) {
        const v = variants[i];
        assert.ok(!item.hasAttribute('open'));
        assert.ok(item.querySelector('summary').textContent.includes(zh ? v.pattern.zh : v.pattern.en));
        assert.ok(item.textContent.includes(zh ? v.when.zh : v.when.en));
        const langs = [...item.querySelectorAll('details.topics-code')];
        assert.ok(langs.every((d) => d.getAttribute('name') === `topic-code-${v.id}`));
        assert.ok(langs.map((d) => d.dataset.lang).join() === 'python,cpp,java,go');
        assert.ok(langs[0].hasAttribute('open') && langs[3].querySelector('pre').textContent === v.code.go);
        assert.equal(item.querySelectorAll('.cs-run-playground').length, 4);
      }
      // The drill offers the main template and every variant.
      const pick = doc.querySelector('.topics-drill-templates');
      assert.equal(pick.querySelectorAll('button').length, variants.length + 1);
      assert.equal(pick.querySelector('[aria-pressed="true"]').textContent, zh ? '主模板' : 'Main template');
    }
  }
  const doc = render(createElement(TopicView, { stop: topicStop('dp-knapsack'), zh: false }));
  const table = doc.querySelector('.topics-matrix');
  assert.ok(doc.getElementById(table.closest('[role="region"]').getAttribute('aria-labelledby')));
  assert.equal(table.querySelectorAll('thead th[scope="col"]').length, 5);
  assert.equal(table.querySelectorAll('tbody th[scope="row"]').length, 3);
  const links = [...table.querySelectorAll('td a')];
  assert.ok(links.length >= 6);
  for (const a of links) assert.ok(doc.getElementById(a.getAttribute('href').slice(1)), a.getAttribute('href'));
  for (const td of [...table.querySelectorAll('td')].filter((cell) => cell.querySelector('a')))
    assert.equal(td.querySelectorAll('code[data-lang]').length, 4);
  assert.ok(table.querySelectorAll('.topics-matrix-note').length >= 1);
  assert.equal(render(createElement(TopicView, { stop: topicStop('binary-search'), zh: true })).querySelector('.topics-matrix'), null);
});

test('the first and last stops have only one neighbour; unknown slugs are not stops', () => {
  const first = render(createElement(TopicView, { stop: TOPIC_STOPS[0], zh: true }));
  assert.ok(first.querySelector('a[rel="prev"]') === null && first.querySelector('a[rel="next"]') !== null);
  const last = render(createElement(TopicView, { stop: TOPIC_STOPS.at(-1), zh: false }));
  assert.ok(last.querySelector('a[rel="next"]') === null && last.querySelector('a[rel="prev"]') !== null);
  assert.ok(topicStop('nope') === undefined);
  assert.ok(TOPIC_STOPS.every((s) => s.problems > 0 && s.title && s.titleEn));
});

// A /topics/<stop> page with lib/server/topic-page.ts's practice (shape TopicPractice).
const practiceRow = (number, stage, extra = {}) => ({
  id: `lc-${number}`,
  number,
  titleZh: `题${number}`,
  titleEn: `Problem ${number}`,
  difficulty: '简单',
  rating: number === 34 ? 1500 : null,
  stage,
  reason: `思路${number}`,
  reasonEn: `Approach ${number}`,
  judgeProblemId: `lc-${number}`,
  href: `/?view=problem&problem=lc-${number}`,
  ...extra,
});
const practiceFor = (signedIn) => {
  const s = (status) => (signedIn ? status : undefined);
  const focus = practiceRow(35, '基础', { status: s('solved') });
  return {
    signedIn,
    stages: [
      { stage: '基础', stageEn: 'Foundation', rows: [focus, practiceRow(852, '基础', { status: s('not_started') })] },
      // lc-33 is in the viewer's running contest: its approach stays home.
      { stage: '核心', stageEn: 'Core', rows: [practiceRow(34, '核心', { status: s('attempted') }), practiceRow(33, '核心', { reason: '', reasonEn: '', status: s('not_started') })] },
      { stage: '进阶', stageEn: 'Advanced', rows: [practiceRow(81, '进阶', { status: s('not_started') })] },
    ],
    focus,
    prereqs: [{ slug: 'array-foundations', total: 20, ...(signedIn && { solved: 12 }) }],
    leadsTo: [
      { slug: 'binary-search-tree', total: 15, ...(signedIn && { solved: 1 }) },
      { slug: 'dp-scheduling', total: 6, ...(signedIn && { solved: 0 }) },
    ],
    asked: { companies: 7, reports: 30, top: [{ slug: 'acme', name: 'Acme', count: 12, hub: true }, { slug: 'beta', name: 'Beta', count: 5, hub: false }] },
    oa: {
      items: [{ id: 'oa-acme-1', title: 'Find the Slot', companySlug: 'acme', companyName: 'Acme', href: '/?view=problem&problem=oa-acme-1', status: s('solved') }],
      total: 14,
    },
    core: [{ id: 'core-binary-search', titleZh: '二分查找', titleEn: 'Binary Search', difficulty: '简单', href: '/?view=problem&problem=core-binary-search', status: s('not_started') }],
  };
};

test('with practice: header chips, a warm-up, why it works, three stage tables, OA and Core Skills', () => {
  const stop = topicStop('binary-search');
  for (const zh of [true, false]) {
    const doc = render(createElement(TopicView, { stop, zh, practice: practiceFor(true) }));
    const header = doc.querySelector('section.topics-header');
    assert.ok(header.compareDocumentPosition(doc.querySelector('.topics-sign')) & 2, 'under the station sign');
    const [first, next] = [...header.querySelectorAll('.topics-chips')];
    const prereq = first.querySelector('a');
    assert.equal(prereq.getAttribute('href'), '/topics/array-foundations');
    assert.ok(prereq.hasAttribute('data-met'), '12/20 is past 60%');
    assert.ok(prereq.textContent.includes('12/20'));
    assert.deepEqual([...next.querySelectorAll('a')].map((a) => a.getAttribute('href')), ['/topics/binary-search-tree', '/topics/dp-scheduling']);
    assert.ok(![...next.querySelectorAll('a')].some((a) => a.hasAttribute('data-met')));
    assert.ok(header.textContent.includes(zh ? '7 家公司考过' : 'asked by 7 companies'));
    // Only a company with a page is linked; Beta is named without one.
    assert.deepEqual([...header.querySelectorAll('.topics-asked-top a')].map((a) => a.getAttribute('href')), ['/company/acme']);
    assert.ok(header.querySelector('.topics-asked-top').textContent.includes('Beta'));
    assert.ok(header.querySelector('.topics-progress').textContent.includes('1/2'), 'Foundation 1/2 solved');

    const focus = doc.querySelector('section.topics-focus');
    assert.equal(focus.querySelector('a.topics-focus-card').getAttribute('href'), '/?view=problem&problem=lc-35');
    assert.ok(focus.textContent.includes('LC 35'));
    assert.equal(focus.querySelector('details.topics-focus-hint p').textContent, zh ? '思路35' : 'Approach 35');
    assert.ok(!focus.querySelector('details').hasAttribute('open'));
    assert.ok(doc.querySelector('section.topics-template .topics-template-lead').textContent.includes('LC 35'));

    const why = doc.querySelector('section.topics-why');
    assert.ok(why.compareDocumentPosition(doc.querySelector('details.topics-code')) & 2, 'after the template');
    assert.ok(why.querySelectorAll('.topics-why-points li').length >= 2);
    // The script carries its language; the caption and its button stay in the UI's.
    assert.deepEqual([...why.querySelectorAll('.topics-say blockquote')].map((q) => q.getAttribute('lang')), ['zh-CN', 'en']);
    assert.ok(![...why.querySelectorAll('.topics-say figure, .topics-say figcaption')].some((el) => el.hasAttribute('lang')));
    assert.equal(why.querySelector('.topics-say-play'), null, 'no listen button without speechSynthesis');
    assert.ok(why.querySelector('.rd .recall'), 'a self-graded recall card');

    const tables = doc.querySelector('section.topics-practice');
    assert.ok(tables.compareDocumentPosition(doc.querySelector('section.topics-drill')) & 2, 'after the drills');
    const stages = [...tables.querySelectorAll('table.topics-table')];
    assert.equal(stages.length, 3);
    assert.ok(stages.every((t) => t.querySelectorAll('thead th').length === 5));
    assert.equal(stages[1].querySelector('tbody tr td:nth-child(3)').textContent, zh ? '思路34' : 'Approach 34');
    assert.ok(stages[1].querySelector('.lc-rating'));
    assert.equal(stages[1].querySelector('td[data-status]').textContent, zh ? '尝试过' : 'Attempted');
    assert.equal(
      stages[1].querySelectorAll('tbody tr')[1].querySelector('td:nth-child(3)').textContent,
      zh ? '比赛或考试结束后显示' : 'Shown after your contest or exam',
    );
    const scroll = tables.querySelector('.topics-table-scroll');
    assert.ok(scroll.getAttribute('tabindex') === '0' && doc.getElementById(scroll.getAttribute('aria-labelledby')));
    assert.equal(tables.querySelector('.topics-oa a.topics-more').getAttribute('href'), '/?view=problems&library=oa&topic=binary-search');
    assert.ok(tables.querySelector('.topics-oa a.topics-more').textContent.includes('14'));
    assert.equal(tables.querySelector('.topics-core a').getAttribute('href'), '/?view=problem&problem=core-binary-search');
  }
});

test('guests get no status column or progress; without practice the page is the cheat sheet', () => {
  const stop = topicStop('binary-search');
  const guest = render(createElement(TopicView, { stop, zh: false, practice: practiceFor(false) }));
  assert.ok([...guest.querySelectorAll('table.topics-table')].every((t) => t.querySelectorAll('thead th').length === 4));
  assert.equal(guest.querySelector('td[data-status]'), null);
  assert.equal(guest.querySelector('.topics-progress'), null);
  assert.ok(!guest.querySelector('.topics-chips').textContent.includes('/'));
  assert.ok(guest.querySelector('.topics-focus'));

  const bare = render(createElement(TopicView, { stop, zh: true }));
  for (const selector of ['.topics-header', '.topics-focus', '.topics-practice'])
    assert.equal(bare.querySelector(selector), null, selector);
  assert.ok(!bare.querySelector('section.topics-template .topics-template-lead').textContent.includes('LC'));
  // The correctness points are content, not practice: every visitor gets them.
  assert.ok(bare.querySelector('.topics-why .topics-why-points li'));
});

test('the index marks each stop with its interview heat when given', () => {
  const heat = Object.fromEntries(TOPIC_STOPS.map((s, i) => [s.slug, i % 4]));
  const doc = render(createElement(TopicsIndexView, { zh: false, heat }));
  const marks = [...doc.querySelectorAll('.topics-line .topics-heat')];
  assert.equal(marks.length, TOPIC_STOPS.filter((_, i) => i % 4).length);
  assert.equal(marks[0].querySelector('[aria-hidden="true"]').textContent, '•');
  assert.ok(marks[0].querySelector('.sr-only').textContent.includes('1 of 3'));
  assert.ok(doc.querySelector('.topics-heat-key'));
  const plain = render(createElement(TopicsIndexView, { zh: true }));
  assert.equal(plain.querySelector('.topics-heat'), null);
});

test('the printable handbook: every stop in the chosen language, no playground links, Python by default', async () => {
  const { TopicsPrintView, printLang } = await import('../app/topics/print/view.tsx');
  assert.equal(printLang('cpp'), 'cpp');
  for (const bad of [undefined, 'rust', ['cpp'], '']) assert.equal(printLang(bad), 'python');
  for (const zh of [true, false]) {
    const doc = render(createElement(TopicsPrintView, { zh, lang: printLang('cpp') }));
    assert.equal(doc.querySelectorAll('h1').length, 1);
    const stops = [...doc.querySelectorAll('article.topics-print-stop')];
    assert.equal(stops.length, 35);
    assert.equal(doc.querySelectorAll('.cs-run-playground').length, 0);
    assert.equal(doc.querySelectorAll('section.topics-print-group').length, 6);
    const binary = doc.getElementById('stop-binary-search');
    assert.equal(binary.querySelector('pre.topics-pre').textContent, topicStop('binary-search').code.cpp);
    assert.equal(binary.querySelectorAll('.topics-print-notes li').length, 6);
    // 35 code regions on one page: each label names its stop.
    const regions = [...doc.querySelectorAll('pre[role="region"]')].map((pre) => pre.getAttribute('aria-label'));
    assert.equal(new Set(regions).size, 35);
    // The table of contents links every section; the language bar marks the current one.
    const toc = [...doc.querySelectorAll('.topics-print-toc a')].map((a) => a.getAttribute('href'));
    assert.deepEqual(toc, TOPIC_STOPS.map((s) => `#stop-${s.slug}`));
    assert.equal(doc.querySelector('.topics-print-bar [aria-current="page"]').getAttribute('href'), '/topics/print?lang=cpp');
    assert.equal(doc.querySelectorAll('.topics-print-bar nav a').length, 4);
    assert.equal(doc.querySelector('.topics-print-button').textContent, zh ? '打印 / 存为 PDF' : 'Print / save as PDF');
  }
  const python = render(createElement(TopicsPrintView, { zh: false, lang: printLang('nope') }));
  assert.equal(python.querySelector('#stop-binary-search pre').textContent, topicStop('binary-search').code.python);
});

test('the glossary page: one heading, a DefinedTermSet of every term, anchors and stop links', async () => {
  const { GlossaryView } = await import('../app/topics/glossary/view.tsx');
  const { GLOSSARY } = await import('../lib/glossary.ts');
  for (const zh of [true, false]) {
    const doc = render(createElement(GlossaryView, { zh }));
    assert.equal(doc.querySelectorAll('h1').length, 1);
    const [crumbs, set] = ldJson(doc);
    assert.equal(crumbs['@type'], 'BreadcrumbList');
    assert.equal(set['@type'], 'DefinedTermSet');
    assert.equal(set.hasDefinedTerm.length, GLOSSARY.length);
    assert.equal(doc.querySelectorAll('.glossary-term').length, GLOSSARY.length);
    const term = doc.getElementById('term-difference-array');
    assert.ok(term.textContent.includes('差分') && term.textContent.includes('difference array'));
    assert.equal(term.querySelector('a').getAttribute('href'), '/topics/prefix-intervals');
    assert.equal(term.querySelector('.glossary-say').getAttribute('lang'), 'en');
    // No speech on the server: the listen buttons appear only where the browser can speak.
    assert.equal(doc.querySelector('.glossary-listen'), null);
    assert.equal(doc.querySelectorAll('.glossary-actions button').length, GLOSSARY.length);
    assert.ok(doc.querySelector('a[href="/english"]'), 'interview phrases live in /english');
    const sections = [...doc.querySelectorAll('section.glossary-group')];
    assert.equal(sections.length, 7);
    assert.ok(sections.every((s) => doc.getElementById(s.getAttribute('aria-labelledby'))));
    assert.ok(doc.querySelector('.glossary-tools label').getAttribute('for') === doc.querySelector('.glossary-tools input').id);
  }
  const index = render(createElement(TopicsIndexView, { zh: true }));
  assert.ok(index.querySelector('a.topics-roadmap[href="/topics/glossary"]'));
});
