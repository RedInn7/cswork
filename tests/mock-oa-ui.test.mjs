import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);
const { MockExamBar } = await import('../components/mock-exam-bar.tsx');
const { MockOa, MockTopicBrief } = await import('../components/mock-oa.tsx');

const session = (startedAt) => ({
  id: 's1',
  company: 'tiktok',
  name: 'TikTok / ByteDance',
  platform: 'CodeSignal',
  preset: true,
  scoring: 'gca',
  source: 'mixed',
  slots: ['easy', 'easy', 'medium'],
  ids: ['lc-1', 'lc-2', 'oa-tiktok-3'],
  minutes: 70,
  skew: 0,
  createdAt: startedAt,
  startedAt,
});

test('the exam strip shows each question state, the countdown and the 5-minute warning', () => {
  const start = Date.now() - 66 * 60000;
  const html = renderToStaticMarkup(
    createElement(MockExamBar, {
      session: session(start),
      userId: 'u1',
      problemId: 'lc-2',
      navigate() {},
      submissions: [
        { problem_id: 'lc-1', status: 'accepted', created_at: start + 60000 },
        { problem_id: 'lc-2', status: 'wrong_answer', created_at: start + 120000 },
        // Before the exam: does not count.
        { problem_id: 'oa-tiktok-3', status: 'accepted', created_at: start - 3600000 },
      ],
    }),
  );
  assert.match(html, /data-warn="5"/);
  assert.match(html, /<li data-state="ac"><button[^>]*aria-label="Q1, accepted"/);
  assert.match(html, /<li data-state="tried"><button[^>]*aria-current="step"[^>]*aria-label="Q2, attempted"/);
  assert.match(html, /<li data-state="todo"><button[^>]*aria-label="Q3, not started"/);
  assert.match(html, /role="timer"[^>]*>0[34]:\d\d</);
  assert.match(html, /aria-live="polite"[^>]*>Last 5 min</);
  assert.match(html, /TikTok \/ ByteDance/);
});

test('early in the exam there is no warning; guests can open the mock landing', () => {
  const html = renderToStaticMarkup(
    createElement(MockExamBar, {
      session: session(Date.now()),
      userId: 'u1',
      problemId: 'lc-1',
      navigate() {},
      submissions: [],
    }),
  );
  assert.doesNotMatch(html, /data-warn/);
  assert.match(html, /role="timer"[^>]*>1:10:00</);
  const landing = renderToStaticMarkup(
    createElement(MockOa, {
      boot: { person: null, courses: [], problems: [], progress: [], submissions: [], notifications: [], services: {} },
      params: { view: 'mock' },
      navigate() {},
    }),
  );
  assert.match(landing, /aria-pressed="true">Mock OA/);
  assert.match(landing, /One click draws a real-format OA/);
  assert.match(landing, /aria-busy="true"/, 'company cards load after the presets request');
  assert.match(landing, /Finished mocks show up here/);
});

test('the check-in says what the OA tests and links its topics to their Line 500 stops', () => {
  const preset = {
    topics: [
      { slug: 'greedy-scheduling', weight: 1 },
      { slug: 'simulation', weight: 0.5 },
    ],
    focus_zh: '贪心',
    focus_en: 'Greedy with sorting.',
    style_zh: '故事',
    style_en: 'Long stories.',
    tips_zh: '先看范围',
    tips_en: 'Check the constraints.',
    evidence: 'thin',
  };
  const html = renderToStaticMarkup(createElement(MockTopicBrief, { preset, navigate() {} }));
  assert.match(html, /What this OA tests/);
  assert.match(html, /Greedy with sorting\./);
  assert.match(html, /Long stories\./);
  assert.match(html, /Check the constraints\./);
  assert.match(html, /<a href="\/\?view=problems&amp;section=greedy-scheduling">Greedy<\/a>/);
  // Simulation is not a Line 500 stop: named, not linked.
  assert.match(html, /<span>Simulation<\/span>/);
  assert.match(html, /--w:0\.5/);
  assert.match(html, /weight 50%/);
  assert.match(html, /little public information/);
  const solid = renderToStaticMarkup(
    createElement(MockTopicBrief, { preset: { ...preset, evidence: 'data+reports' }, navigate() {} }),
  );
  assert.doesNotMatch(solid, /little public information/);
});

test('a ?section= link opens Line 500 on that stop; anything else opens the whole line', async () => {
  const { stopFromUrl, stopHref, topicName } = await import('../lib/route-stops.ts');
  assert.equal(stopFromUrl(), '', 'no location on the server');
  try {
    for (const [search, stop] of [
      ['?view=problems&section=binary-search', 'binary-search'],
      ['?view=problems&section=simulation', ''],
      ['?view=problems&section=__proto__', ''],
      ['?view=problems', ''],
    ]) {
      globalThis.location = { search };
      assert.equal(stopFromUrl(), stop, search);
    }
  } finally {
    delete globalThis.location;
  }
  assert.equal(stopHref('sql'), null);
  assert.equal(topicName('sql', true), 'SQL');
  assert.equal(topicName('simulation', true), '模拟/实现');
  assert.equal(topicName('made-up', false), 'made-up');
});
