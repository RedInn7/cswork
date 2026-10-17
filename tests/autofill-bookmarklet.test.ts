// The resume builder's autofill bookmarklet (lib/autofill-bookmarklet.ts), run as a browser runs a
// javascript: link on typical Greenhouse, Lever and Ashby application forms: the right fields
// filled through input events, filled-in values, files, comboboxes, referrer and other look-alike
// questions left alone, nothing submitted, and no filling at all off those three hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { autofillData, autofillHref } from '../lib/autofill-bookmarklet';
import { blankResume } from '../components/resume-builder';

const resume = {
  ...blankResume(),
  name: '  Ada King   Lovelace ',
  email: 'ada@example.com',
  phone: '+1 206 555 0100',
  location: 'Seattle, WA',
  links: 'github.com/ada, https://www.linkedin.com/in/ada，ada.dev/100%',
  education: [{ title: 'University of Washington', subtitle: 'B.S. Computer Science', dates: '2022 – 2026', bullets: '' }],
  experience: [{ title: 'Acme Corp', subtitle: 'SWE Intern', dates: 'Summer 2025', bullets: '' }],
};

test('autofillData: the name splits at its last space, links sort into LinkedIn, GitHub and site', () => {
  assert.deepEqual(autofillData(resume), {
    first: 'Ada King',
    last: 'Lovelace',
    full: 'Ada King Lovelace',
    email: 'ada@example.com',
    phone: '+1 206 555 0100',
    city: 'Seattle, WA',
    linkedin: 'https://www.linkedin.com/in/ada',
    github: 'https://github.com/ada',
    site: 'https://ada.dev/100%',
    school: 'University of Washington',
    degree: 'B.S. Computer Science',
    company: 'Acme Corp',
  });
  const chinese = autofillData({ ...blankResume(), name: '张三', education: [], experience: [] });
  assert.deepEqual([chinese.first, chinese.last, chinese.full, chinese.school, chinese.company, chinese.site], ['', '', '张三', '', '', '']);
});

const data = autofillData(resume);
const href = autofillHref(data, { origin: 'https://cswork.test', zh: true });

/** Loads `body` at `url`, clicks the bookmarklet there and reports what it did. */
function run(url: string, body: string, link = href) {
  const dom = new JSDOM(`<!doctype html><title>Job Application for Backend Engineer at Acme</title><body>${body}</body>`, {
    url,
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  const w = dom.window;
  const seen = { alerts: [] as string[], confirms: [] as string[], opened: [] as [string, string?][], input: [] as string[], change: [] as string[], submits: 0 };
  w.alert = (m: string) => void seen.alerts.push(m);
  w.confirm = (m: string) => (seen.confirms.push(m), true);
  w.open = ((u: string, target?: string) => (seen.opened.push([u, target]), null)) as typeof w.open;
  w.document.addEventListener('input', (e) => seen.input.push((e.target as HTMLInputElement).id || (e.target as HTMLInputElement).name));
  w.document.addEventListener('change', (e) => seen.change.push((e.target as HTMLInputElement).id || (e.target as HTMLInputElement).name));
  w.document.addEventListener('submit', () => seen.submits++);
  assert.ok(link.startsWith('javascript:'));
  // A browser percent-decodes a javascript: URL once, then runs it.
  assert.equal(w.eval(decodeURIComponent(link.slice('javascript:'.length))), undefined, 'the page is not replaced by a value');
  const value = (sel: string) => (w.document.querySelector(sel) as HTMLInputElement).value;
  return { w, seen, value, overlay: w.document.getElementById('cswork-autofill') };
}

const GREENHOUSE = `<form id="application-form" action="/apply" method="post">
  <label id="first_name-label" for="first_name">First Name<span>*</span></label><input id="first_name" name="first_name" type="text" autocomplete="given-name" aria-required="true">
  <label for="last_name">Last Name</label><input id="last_name" name="last_name" type="text" autocomplete="family-name">
  <label for="preferred_name">Preferred First Name</label><input id="preferred_name" type="text">
  <label for="email">Email</label><input id="email" type="email" value="kept@old.example">
  <label for="phone">Phone</label><input id="phone" type="tel">
  <label for="candidate-location">Location (City)</label><input id="candidate-location" role="combobox" aria-autocomplete="list">
  <label for="resume">Resume/CV</label><input id="resume" type="file">
  <label for="question_1">LinkedIn Profile</label><input id="question_1" type="text">
  <label for="question_2">Website</label><input id="question_2">
  <label for="question_3">Referrer Name</label><input id="question_3" type="text">
  <label for="question_4">How did you hear about this job?</label><input id="question_4" type="text">
  <label for="question_5">Emergency contact phone</label><input id="question_5" type="tel">
  <label for="question_6">GitHub</label><input id="question_6" type="url" disabled>
  <label for="question_7">Why Acme?</label><textarea id="question_7"></textarea>
  <label for="question_8">Do you need sponsorship?</label><select id="question_8"><option></option><option>No</option></select>
  <span id="q9-label">Current Company</span><input id="question_9" type="text" aria-labelledby="q9-label">
  <button type="submit">Submit application</button>
</form>`;

test('Greenhouse: the matching empty text fields fill through input events; the rest stays as it was', () => {
  const { seen, value, overlay, w } = run('https://job-boards.greenhouse.io/acme/jobs/4012345', GREENHOUSE);
  assert.deepEqual(
    ['#first_name', '#last_name', '#preferred_name', '#email', '#phone', '#candidate-location', '#question_1', '#question_2', '#question_3', '#question_4', '#question_5', '#question_6', '#question_9'].map(value),
    ['Ada King', 'Lovelace', '', 'kept@old.example', '+1 206 555 0100', '', 'https://www.linkedin.com/in/ada', 'https://ada.dev/100%', '', '', '', '', 'Acme Corp'],
  );
  assert.equal(value('#question_7'), '');
  assert.equal(value('#question_8'), '');
  assert.equal(value('#resume'), '');
  const filled = ['first_name', 'last_name', 'phone', 'question_1', 'question_2', 'question_9'];
  assert.deepEqual(seen.input, filled);
  assert.deepEqual(seen.change, filled);
  assert.equal(seen.submits, 0);
  assert.equal(overlay?.getAttribute('role'), 'status');
  assert.match(overlay!.textContent!, /^已填 6 项，请检查后自己提交。/);
  // Save to tracker opens the tracker with this page; running it again keeps one overlay.
  const save = [...overlay!.querySelectorAll('button')].find((b) => b.textContent === '存到投递看板')!;
  save.click();
  const url = new URL(seen.opened[0][0]);
  assert.equal(url.origin + url.pathname, 'https://cswork.test/career/tracker');
  assert.equal(url.searchParams.get('company'), 'job-boards.greenhouse.io');
  assert.equal(url.searchParams.get('role'), 'Job Application for Backend Engineer at Acme');
  w.eval(decodeURIComponent(href.slice('javascript:'.length)));
  assert.equal(w.document.querySelectorAll('#cswork-autofill').length, 1);
  assert.match(w.document.getElementById('cswork-autofill')!.textContent!, /^已填 0 项/, 'nothing empty is left to fill');
});

test('Lever: full name, current company and the URL fields, Twitter left alone', () => {
  const field = (label: string, name: string, type = 'text') =>
    `<li class="application-question"><label><div class="application-label">${label}<span class="required">✱</span></div><div class="application-field"><input type="${type}" name="${name}"></div></label></li>`;
  const { value, seen } = run(
    'https://jobs.lever.co/acme/1b2c3d4e/apply',
    `<form method="POST"><ul>${[
      field('Full name', 'name'),
      field('Email', 'email', 'email'),
      field('Phone', 'phone'),
      field('Current location', 'location'),
      field('Current company', 'org'),
      field('LinkedIn URL', 'urls[LinkedIn]'),
      field('Twitter URL', 'urls[Twitter]'),
      field('GitHub URL', 'urls[GitHub]'),
      field('Portfolio URL', 'urls[Portfolio]'),
    ].join('')}</ul><button type="submit">Submit application</button></form>`,
  );
  const named = (n: string) => value(`[name="${n}"]`);
  assert.deepEqual(['name', 'email', 'phone', 'location', 'org', 'urls[LinkedIn]', 'urls[Twitter]', 'urls[GitHub]', 'urls[Portfolio]'].map(named), [
    'Ada King Lovelace', 'ada@example.com', '+1 206 555 0100', 'Seattle, WA', 'Acme Corp', 'https://www.linkedin.com/in/ada', '', 'https://github.com/ada', 'https://ada.dev/100%',
  ]);
  assert.equal(seen.input.length, 8);
  assert.equal(seen.submits, 0);
});

test('Ashby: system fields, school and degree; pronouns, emergency contact and the file stay empty', () => {
  const field = (id: string, label: string, type = 'text') =>
    `<div class="ashby-application-form-field-entry"><label for="${id}" class="ashby-application-form-question-title">${label}</label><input id="${id}" name="${id}" type="${type}" placeholder="Type here..."></div>`;
  const { value } = run(
    'https://jobs.ashbyhq.com/acme/3f9a/application',
    [
      field('_systemfield_name', 'Name'),
      field('_systemfield_email', 'Email', 'email'),
      field('a1b2', 'Phone Number', 'tel'),
      field('c3d4', 'LinkedIn'),
      field('e5f6', 'School'),
      field('e7f8', 'Degree'),
      field('g7h8', 'Emergency Contact Name'),
      field('i9j0', 'Pronouns'),
      field('k1l2', 'Resume', 'file'),
    ].join('') + '<button type="submit">Submit Application</button>',
  );
  assert.deepEqual(['_systemfield_name', '_systemfield_email', 'a1b2', 'c3d4', 'e5f6', 'e7f8', 'g7h8', 'i9j0', 'k1l2'].map((id) => value(`#${id}`)), [
    'Ada King Lovelace', 'ada@example.com', '+1 206 555 0100', 'https://www.linkedin.com/in/ada', 'University of Washington', 'B.S. Computer Science', '', '', '',
  ]);
});

test('other hosts: nothing is filled; an embedded application form is offered instead', () => {
  const lookalike = run('https://careers.acme.example/jobs/42', GREENHOUSE);
  assert.equal(lookalike.value('#first_name'), '');
  assert.deepEqual(lookalike.seen.input, []);
  assert.equal(lookalike.overlay, null);
  assert.match(lookalike.seen.alerts[0], /只支持 Greenhouse、Lever、Ashby/);
  assert.equal(run('https://greenhouse.io.evil.example/apply', GREENHOUSE).value('#first_name'), '');
  assert.equal(run('https://workday.example/apply', GREENHOUSE).seen.alerts.length, 1);

  const embedded = run(
    'https://careers.acme.example/jobs/42',
    '<iframe src="https://example.com/video"></iframe><iframe src="https://boards.greenhouse.io/embed/job_app?for=acme&amp;token=4012345"></iframe>',
  );
  assert.equal(embedded.seen.confirms.length, 1);
  assert.deepEqual(embedded.seen.opened, [['https://boards.greenhouse.io/embed/job_app?for=acme&token=4012345', '_self']]);
  assert.deepEqual(embedded.seen.alerts, []);
});

test('the English bookmarklet; an empty resume fills nothing', () => {
  const english = autofillHref(data, { origin: 'https://cswork.test', zh: false });
  assert.match(run('https://jobs.lever.co/acme/1/apply', '<input name="email" type="email">', english).overlay!.textContent!, /^Filled 1 field\. Check them, then submit it yourself\./);
  const empty = autofillHref(autofillData(blankResume()), { origin: 'https://cswork.test', zh: false });
  const { seen, overlay } = run('https://jobs.lever.co/acme/1/apply', '<input name="name"><input name="email" type="email">', empty);
  assert.deepEqual(seen.input, []);
  assert.match(overlay!.textContent!, /^Filled 0 fields/);
});
