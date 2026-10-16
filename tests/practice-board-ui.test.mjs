import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);
const { PracticeBoardView } = await import('../app/leaderboard/view.tsx');
const { ProfileView } = await import('../app/u/views.tsx');

const render = (type, props) => new JSDOM(renderToStaticMarkup(createElement(type, props))).window.document;
const row = (rank, handle, me = false) => ({ rank, handle, score: 50 - rank, solved: 10 - rank, streak: 3, me });

test('the board links handles, marks the sort and the viewer, and keeps a far-down viewer in the footer', () => {
  const school = { key: 'mit', name: 'M.I.T.', members: 3 };
  const board = { rows: [row(1, 'ada'), row(2, 'bo', true)], mine: row(2, 'bo', true), total: 2, schools: [school], school };
  for (const zh of [true, false]) {
    const doc = render(PracticeBoardView, { board, sort: 'solved', language: 'cpp', zh });
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.deepEqual([...doc.querySelectorAll('tbody th a')].map((a) => a.getAttribute('href')), ['/u/ada', '/u/bo']);
    assert.equal(doc.querySelector('tbody tr[data-me] a').textContent, '@bo');
    assert.equal(doc.querySelector('tfoot'), null, 'already in the top rows');
    assert.equal(doc.querySelectorAll('th[aria-sort="descending"]').length, 1);
    // The tabs keep the filters; the form keeps the sort.
    assert.equal(doc.querySelector('nav a[aria-current="page"]').getAttribute('href'), '/leaderboard?sort=solved&school=mit&language=cpp');
    assert.equal(doc.querySelector('nav a').getAttribute('href'), '/leaderboard?school=mit&language=cpp');
    assert.equal(doc.querySelector('input[name="sort"]').value, 'solved');
    assert.equal(doc.querySelector('select[name="school"] option[selected]').value, 'mit');
    assert.equal(doc.querySelector('select[name="language"] option[selected]').value, 'cpp');
    assert.ok(doc.querySelector('a[href="/contest/leaderboard"]'));
    // No email, nickname or user id: nothing but the handle and the three numbers.
    assert.equal(doc.body.textContent.includes('@example'), false);
  }
  const far = { ...board, school: null, rows: [row(1, 'ada')], mine: row(140, 'bo', true), total: 140 };
  const doc = render(PracticeBoardView, { board: far, sort: 'score', zh: false });
  assert.equal(doc.querySelector('tfoot tr[data-me] td').textContent, '140');
  assert.equal(doc.querySelector('nav a').getAttribute('href'), '/leaderboard');
  assert.equal(doc.querySelector('input[name="sort"]'), null);
  const empty = render(PracticeBoardView, { board: { ...far, rows: [], mine: null, total: 0 }, sort: 'score', zh: true });
  assert.equal(empty.querySelector('table'), null);
  assert.ok(empty.querySelector('a[href="/?view=account"]'), 'says how to get on the board');
});

test('the profile draws the climbing curve and the daily effort bars, and an older payload still renders', () => {
  const profile = {
    handle: 'line-rider',
    bio: '',
    indexable: false,
    solved: { total: 3, easy: 1, medium: 0, hard: 2 },
    stops: [],
    activity: [],
    recent: [],
    lists: [],
    climb: { start: Date.UTC(2026, 5, 1), weeks: [1, 1, 3] },
    effort: { start: Date.UTC(2026, 2, 19), days: [...Array(82).fill([0, 0, 0]), [1, 0, 0], [0, 0, 2]] },
  };
  const doc = render(ProfileView, { profile, catalogue: new Map(), zh: false });
  assert.ok(doc.getElementById('learner-climb') && doc.getElementById('learner-effort'));
  assert.equal(doc.querySelector('#learner-climb + figure polyline').getAttribute('points').split(' ').length, 3);
  assert.match(doc.querySelector('#learner-climb + figure svg').getAttribute('aria-label'), /3 solved over 3 weeks/);
  assert.equal(doc.querySelectorAll('#learner-effort + figure rect').length, 2);
  assert.deepEqual(
    [...doc.querySelectorAll('#learner-effort + figure figcaption b')].map((b) => b.textContent),
    ['1', '0', '2'],
  );
  const { climb: _c, effort: _e, ...old } = profile;
  assert.equal(render(ProfileView, { profile: old, catalogue: new Map(), zh: true }).getElementById('learner-climb'), null);
});
