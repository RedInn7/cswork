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
    const details = [...doc.querySelectorAll('details.topics-code')];
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
    assert.equal(doc.querySelectorAll('details.topics-code .cs-run-playground').length, 4);
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

test('the first and last stops have only one neighbour; unknown slugs are not stops', () => {
  const first = render(createElement(TopicView, { stop: TOPIC_STOPS[0], zh: true }));
  assert.ok(first.querySelector('a[rel="prev"]') === null && first.querySelector('a[rel="next"]') !== null);
  const last = render(createElement(TopicView, { stop: TOPIC_STOPS.at(-1), zh: false }));
  assert.ok(last.querySelector('a[rel="next"]') === null && last.querySelector('a[rel="prev"]') !== null);
  assert.ok(topicStop('nope') === undefined);
  assert.ok(TOPIC_STOPS.every((s) => s.problems > 0 && s.title && s.titleEn));
});
