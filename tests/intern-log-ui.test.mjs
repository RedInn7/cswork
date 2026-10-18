// /career/intern (components/intern-log.tsx, components/team-match.tsx): one request loads every
// brag: note; this week's checklist items show; a week's log is saved on demand; drafts are made in
// the browser; XYZ bullets go into the resume builder's copy in this browser and wins into the story
// bank; team-matching cards save brag:teams and rank by weighted mean; the guide's internship
// checklist (components/guide-checklist.tsx) labels every item with its week.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/career/intern' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.confirm = () => true;
const { createRoot } = await import('react-dom/client');
const { InternLog, RESUME_KEY } = await import('../components/intern-log.tsx');
const { mondayOf, weekMonday } = await import('../lib/intern-log.ts');

const pad = (n) => String(n).padStart(2, '0');
const today = new Date();
// Started on the Wednesday of last week: this is week 2 of 10 whenever the test runs.
const start = new Date(Date.parse(mondayOf(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`)) - 5 * 86400000).toISOString().slice(0, 10);
const week1 = weekMonday(start, 1),
  week2 = weekMonday(start, 2);
const notes = new Map([
  ['brag:meta', JSON.stringify({ company: 'Acme', role: 'SWE Intern', start, weeks: 10 })],
  [`brag:${week1}`, JSON.stringify({ wins: [{ x: 'Set up CI', y: 'in 2 days', z: 'reusing the template', project: 'Infra' }], feedback: 'Ask earlier', learned: '', next: 'Search' })],
  ['brag:teams', '{broken'],
  ['story:x', '{}'],
]);
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const key = `${init.method ?? 'GET'} ${String(url)}`;
  calls.push(key);
  if (key === 'GET /api/oj/notes?prefix=brag%3A')
    return Response.json({ items: [...notes].filter(([k]) => k.startsWith('brag:')).map(([target, body]) => ({ target, body, updatedAt: 1 })) });
  const put = /^PUT \/api\/oj\/notes\?target=(.+)$/.exec(key);
  if (put) {
    const { body } = JSON.parse(init.body);
    const target = decodeURIComponent(put[1]);
    if (body) notes.set(target, body);
    else notes.delete(target);
    return Response.json({ target, body, updatedAt: 2 });
  }
  return Response.json({ error: 'no route' }, { status: 404 });
};
const root = createRoot(document.getElementById('root'));
const settle = (ms = 0) => act(async () => new Promise((done) => setTimeout(done, ms)));
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const button = (text) => $$('button').find((b) => b.textContent === text);
async function type(field, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new window.Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}
const click = (el) => act(async () => el.click());
// Each section's own status line, beside the buttons that set it.
const statusOf = (title) => $(`section[aria-labelledby="${title}"] .intern-status`).textContent;

test('the resume key is the builder’s', () => {
  assert.ok(readFileSync(new URL('../components/resume-builder.tsx', import.meta.url), 'utf8').includes(`export const RESUME_KEY = '${RESUME_KEY}';`));
});

test('loads once, shows this week, saves the week, exports drafts and writes bullets', async () => {
  await act(async () => root.render(createElement(InternLog, { zh: false })));
  await settle();
  assert.deepEqual(calls, ['GET /api/oj/notes?prefix=brag%3A']);
  assert.equal($('#intern-setup-title').nextElementSibling.querySelector('input').value, 'Acme');
  assert.equal($('#intern-due-title').textContent, 'Week 2 of 10: to do');
  const due = $$('.intern-due strong').map((s) => s.textContent);
  assert.ok(due.includes('Land a first small PR') && !due.includes('Write the handoff doc'), String(due));
  // The form opens on this week, empty; week 1 is listed as logged.
  const weekSelect = $('#intern-week-title').nextElementSibling.querySelector('select');
  assert.equal(weekSelect.value, week2);
  assert.match([...weekSelect.options].find((o) => o.value === week1).textContent, /\(logged\)/);
  assert.equal($$('.intern-wins .intern-card').length, 1);

  const [x, y, z, project] = $$('.intern-wins .intern-card input');
  await type(x, 'Built search');
  await type(z, 'a trie');
  await type(project, 'Search');
  assert.equal($('.intern-preview').firstChild.textContent, 'Built search, by a trie.');
  assert.equal($('.intern-preview small').textContent, 'Add a number to make it land.');
  await type(y, 'for 2k users');
  assert.equal($('.intern-preview small'), null);
  await click(button('Save this week'));
  await settle();
  assert.deepEqual(JSON.parse(notes.get(`brag:${week2}`)).wins, [{ x: 'Built search', y: 'for 2k users', z: 'a trie', project: 'Search' }]);
  assert.match(statusOf('intern-week-title'), /Week 2 .* saved\./);
  assert.equal(statusOf('intern-setup-title'), '');
  assert.equal($$('#intern-past-title ~ details').length, 2);

  // A win becomes a STAR story.
  await click(button('Save as a STAR story'));
  await settle();
  const [storyKey, storyBody] = [...notes].find(([k]) => k.startsWith('story:') && k !== 'story:x');
  assert.deepEqual(
    (({ title, action, result, competencies }) => ({ title, action, result, competencies }))(JSON.parse(storyBody)),
    { title: 'Built search', action: 'a trie', result: 'for 2k users', competencies: ['impact'] },
  );
  assert.ok(storyKey.length > 8);

  // A new length that keeps this week on screen leaves the unsaved draft alone.
  await type(x, 'Built search v2');
  await type($('#intern-setup-title').nextElementSibling.querySelector('select'), '8');
  await click(button('Save'));
  await settle();
  assert.equal(JSON.parse(notes.get('brag:meta')).weeks, 8);
  assert.equal(statusOf('intern-setup-title'), 'Internship saved.');
  assert.equal($$('.intern-wins .intern-card input')[0].value, 'Built search v2');
  await type($$('.intern-wins .intern-card input')[0], 'Built search');

  await click(button('Midpoint draft'));
  const preview = () => $('.intern-export textarea').value;
  assert.ok(preview().startsWith('# Midpoint self-review draft · SWE Intern at Acme'));
  assert.ok(preview().includes('Set up CI in 2 days, by reusing the template.') && preview().includes('Built search for 2k users, by a trie.'));
  await click(button('Final draft'));
  assert.ok(preview().includes('## Return offer'));

  await click(button('XYZ resume bullets'));
  assert.equal(preview(), '- Set up CI in 2 days, by reusing the template.\n- Built search for 2k users, by a trie.\n');
  localStorage.setItem(RESUME_KEY, JSON.stringify({ name: 'Jane', experience: [{ title: 'Old Co', subtitle: 'Intern', dates: '2025', bullets: 'Did a thing' }] }));
  await click(button('XYZ resume bullets'));
  await click($$('.intern-add')[1]);
  let resume = JSON.parse(localStorage.getItem(RESUME_KEY));
  assert.equal(resume.name, 'Jane');
  assert.deepEqual(resume.experience.map((e) => e.title), ['Acme', 'Old Co']);
  assert.equal(resume.experience[0].bullets, 'Built search for 2k users, by a trie.');
  assert.match(resume.experience[0].dates, /^\w{3} \d{4} – \w{3} \d{4}$/);
  // Further bullets go to the new entry, and a repeat is skipped.
  await click(button('Add all to resume'));
  resume = JSON.parse(localStorage.getItem(RESUME_KEY));
  assert.equal(resume.experience.length, 2);
  assert.equal(resume.experience[0].bullets, 'Built search for 2k users, by a trie.\nSet up CI in 2 days, by reusing the template.');
  assert.match(statusOf('intern-export-title'), /Added 1\. 1 already there\./);
  // Opened again later, the bullets default to the entry made from this internship.
  await act(async () => root.render(createElement(InternLog, { zh: false, key: 'reload' })));
  await settle();
  await click(button('XYZ resume bullets'));
  assert.equal($('.intern-bullets select').value, '0');
  await click(button('Add all to resume'));
  assert.equal(JSON.parse(localStorage.getItem(RESUME_KEY)).experience.length, 2);
  assert.match(statusOf('intern-export-title'), /^2 already there\.$/);
});

test('team-matching cards save brag:teams after a pause and rank by weighted mean', async () => {
  // The damaged brag:teams note started over with the default factors.
  assert.equal($$('#team-match .intern-card').length, 0);
  await click(button('Add a team'));
  await click(button('Add a team'));
  const cards = () => $$('#team-match .intern-card');
  await type(cards()[0].querySelector('input'), 'Payments');
  await type(cards()[1].querySelector('input'), 'Search');
  const scoreSelects = (card) => [...card.querySelectorAll('.intern-weights select')];
  // "The work" scored 2 and 5.
  await type(scoreSelects(cards()[0])[0], '2');
  await type(scoreSelects(cards()[1])[0], '5');
  assert.equal(cards()[1].querySelector('output').textContent, '5.00');
  const tick = cards()[0].querySelector('.intern-questions input');
  await click(tick);
  assert.deepEqual($$('.intern-ranking li').map((li) => li.textContent), ['Search: 5.00', 'Payments: 2.00']);
  assert.equal(notes.has('brag:teams') && notes.get('brag:teams') !== '{broken', false);
  await settle(900);
  const saved = JSON.parse(notes.get('brag:teams'));
  assert.deepEqual(saved.teams.map((t) => [t.name, t.asked]), [['Payments', ['project']], ['Search', []]]);
  assert.equal(saved.factors.length, 7);
  assert.ok(!('moneyWeight' in saved));
  // Removing a team drops its scores in the next save.
  const removed = saved.teams[0].id;
  await click([...cards()[0].querySelectorAll('button')].find((b) => b.textContent === 'Remove this team'));
  await settle(900);
  const after = JSON.parse(notes.get('brag:teams'));
  assert.deepEqual(after.teams.map((t) => t.name), ['Search']);
  assert.ok(!(removed in after.scores));
  assert.equal($('.intern-ranking'), null);
  // Leaving the page, or the card going away, sends the edit still waiting out its pause.
  const notesField = () => cards()[0].querySelector('textarea');
  await type(notesField(), 'Kind mentor');
  await act(async () => window.dispatchEvent(new window.Event('pagehide')));
  await settle();
  assert.equal(JSON.parse(notes.get('brag:teams')).teams[0].notes, 'Kind mentor');
  await type(notesField(), 'Kind mentor, slow CI');
  await act(async () => root.unmount());
  await settle();
  assert.equal(JSON.parse(notes.get('brag:teams')).teams[0].notes, 'Kind mentor, slow CI');
});

test('the chapter checklist tags each internship item with its week', async () => {
  const { GuideChecklist } = await import('../components/guide-checklist.tsx');
  const { CAREER_CHECKLISTS } = await import('../lib/content/career-checklists.ts');
  const again = createRoot(document.getElementById('root'));
  await act(async () => again.render(createElement(GuideChecklist, { slug: 'internship', items: CAREER_CHECKLISTS.internship, zh: false })));
  await settle();
  const weeks = $$('.guide-checklist li .guide-week').map((s) => s.textContent);
  assert.equal(weeks.length, CAREER_CHECKLISTS.internship.length);
  assert.deepEqual([weeks[0], weeks.at(-1)], ['Before day one', 'Final week']);
  assert.ok(weeks.includes('Midpoint') && weeks.includes('Week 2'));
  await act(async () => again.unmount());
});
