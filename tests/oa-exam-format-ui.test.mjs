import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { OaExamFormat, oaExamTag } = await import('../app/oa/parts.tsx');
const { MOCK_PRESETS_UPDATED, mockPresetFor } = await import('../lib/server/mock-oa-presets.ts');

const render = (slug, zh) =>
  renderToStaticMarkup(
    createElement(OaExamFormat, { preset: mockPresetFor(slug), updated: MOCK_PRESETS_UPDATED, zh }),
  );

test('a company row tags its OA format; aliases share it', () => {
  assert.equal(oaExamTag(mockPresetFor('tiktok'), true), 'CodeSignal · 4 题 · 70 分钟');
  assert.equal(oaExamTag(mockPresetFor('amazon-mern'), false), 'HackerRank · 2 Q · 90 min');
});

test('the company page lists platform, size, time, scoring, other sections, roles, notes and sources', () => {
  const gca = render('tiktok', true);
  assert.match(gca, /<dl class="oa-exam-format">/);
  assert.match(gca, /<dt>平台<\/dt><dd>CodeSignal<\/dd>/);
  assert.match(gca, /<dt>题量<\/dt><dd>4 道编程题<\/dd>/);
  assert.match(gca, /<dt>时长<\/dt><dd>70 分钟<\/dd>/);
  assert.match(gca, /CodeSignal GCA 式 200–600 分/);
  // "None (remark)" reads as coding only, keeping the remark.
  assert.match(gca, /<dt>编程以外的环节<\/dt><dd>无（2026 起已取消选择题）<\/dd>/);
  assert.match(gca, new RegExp(`资料更新于 ${MOCK_PRESETS_UPDATED}`));

  const tests = render('amazon', false);
  assert.match(tests, /By test cases passed/);
  assert.match(tests, /<dt>Besides coding<\/dt><dd>Work Style Assessment/);
  assert.match(tests, /<dt>Roles<\/dt><dd>SDE intern, New grad \(SDE I\)<\/dd>/);
  assert.match(tests, /<a href="https:\/\/amazon\.jobs\/[^"]+" rel="nofollow noopener noreferrer" target="_blank">/);
});

test('a format that lists an aptitude test links to the aptitude practice; others do not', () => {
  for (const slug of ['coinbase', 'jpmorgan-chase', 'the-d-e-shaw-group', 'oracle'])
    assert.match(render(slug, false), /<dt>Aptitude practice<\/dt><dd><a href="\/oa\/aptitude">/, slug);
  assert.doesNotMatch(render('tiktok', true), /\/oa\/aptitude/);
  assert.doesNotMatch(render('amazon', false), /\/oa\/aptitude/);
});
