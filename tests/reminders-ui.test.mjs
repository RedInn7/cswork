// The account page's reminder card (components/reminder-settings.tsx) and following companies
// (components/company-follow-button.tsx): opting in and out, changing what and when, push for this
// device; following from a company page, signed out and in, and unfollowing from the account page.
import assert from 'node:assert/strict';
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
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=account' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ReminderSettings } = await import('../components/reminder-settings.tsx');
const { setLocale } = await import('../lib/i18n.ts');
const { CompanyFollowButton, FollowedCompanies } = await import('../components/company-follow-button.tsx');

const server = {
  settings: { prefs: null, push: null, mail: true, verified: true, endpoints: [] },
  follows: { signedIn: true, items: [] },
};
const calls = [];
// While set, saves wait for it: a request in flight.
let gate = null;
globalThis.fetch = async (url, init = {}) => {
  const key = `${init.method ?? 'GET'} ${String(url)}`;
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push([key, body]);
  if (key === 'GET /api/oj/notify') return Response.json(server.settings);
  if (gate) await gate;
  // Off drops every device's push address.
  if (key === 'POST /api/oj/notify')
    return Response.json((server.settings = { ...server.settings, prefs: body.prefs, endpoints: body.prefs ? server.settings.endpoints : [] }));
  if (key === 'POST /api/oj/notify/subscription') {
    const endpoints = server.settings.endpoints.filter((e) => e !== body.endpoint);
    if (body.on) endpoints.push(body.endpoint);
    return Response.json((server.settings = { ...server.settings, endpoints }));
  }
  if (key === 'GET /api/oj/follows/companies') return Response.json(server.follows);
  if (key === 'POST /api/oj/follows/companies') {
    const items = server.follows.items.filter((c) => c.slug !== body.slug);
    if (body.on) items.push({ slug: body.slug, name: body.slug === 'amazon' ? 'Amazon' : body.slug });
    return Response.json((server.follows = { signedIn: true, items }));
  }
  return Response.json({ error: 'no route' }, { status: 404 });
};
const root = createRoot(document.getElementById('root'));
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const box = (text) => [...document.querySelectorAll('label')].find((l) => l.textContent.includes(text)).querySelector('input');
const settle = () => act(async () => new Promise((done) => setTimeout(done, 0)));
const click = async (element) => {
  await act(async () => element.click());
  await settle();
};

test('reminders: off until turned on, then each change saves with the local time zone, and off again', async () => {
  await act(async () => root.render(createElement(ReminderSettings)));
  await settle();
  assert.equal(document.querySelector('#reminders h2').textContent, 'Reminders');
  await click(button('Turn reminders on'));
  const tz = new Date().getTimezoneOffset();
  assert.deepEqual(calls.at(-1), [
    'POST /api/oj/notify',
    { prefs: { review: true, streak: true, daily: false, contest: true, applications: true, email: false, hour: 20, tz, locale: 'en' } },
  ]);
  assert.equal(box('Job applications (24 hours and 2 hours before an OA deadline, an hour before an interview, 3 days and a day before an offer deadline; follow-ups due go in the daily digest)').checked, true);
  await click(box('Job applications'));
  assert.equal(calls.at(-1)[1].prefs.applications, false);
  assert.equal(box('The daily problem').checked, false);
  await click(box('The daily problem'));
  assert.equal(calls.at(-1)[1].prefs.daily, true);
  const hour = document.querySelector('#reminders select');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(hour, '7');
    hour.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await settle();
  assert.equal(calls.at(-1)[1].prefs.hour, 7);
  // Email is open to a verified account with mail on; push says it isn't available.
  assert.equal(box('Also email my account address').disabled, false);
  assert.match(document.querySelector('#reminders').textContent, /Push isn’t available yet/);
  await click(button('Turn reminders off'));
  assert.deepEqual(calls.at(-1), ['POST /api/oj/notify', { prefs: null }]);
  assert.ok(button('Turn reminders on'));
  await act(async () => root.render(createElement('div')));
});

test('reminders saved in another time zone or language are moved to this one on open and on a switch; unverified, no email', async () => {
  const tz = new Date().getTimezoneOffset();
  server.settings = {
    prefs: { review: true, streak: false, daily: true, contest: true, email: false, hour: 9, tz: tz + 60, locale: 'zh' },
    push: null,
    mail: true,
    verified: false,
    endpoints: [],
  };
  calls.length = 0;
  await act(async () => root.render(createElement(ReminderSettings)));
  await settle();
  assert.deepEqual(calls.at(-1), ['POST /api/oj/notify', { prefs: { ...server.settings.prefs, tz, locale: 'en' } }]);
  assert.equal(box('Also email my account address').disabled, true);
  assert.match(box('Also email my account address').closest('label').textContent, /Verify your email/);
  // Switching the site language while the card is open: once, and not again on the reply.
  calls.length = 0;
  try {
    await act(async () => setLocale('zh'));
    await settle();
    assert.deepEqual(calls, [['POST /api/oj/notify', { prefs: { ...server.settings.prefs, locale: 'zh' } }]]);
  } finally {
    await act(async () => setLocale('en'));
    await settle();
  }
  // Already matching: opening the card saves nothing.
  await act(async () => root.render(createElement('div')));
  calls.length = 0;
  await act(async () => root.render(createElement(ReminderSettings)));
  await settle();
  assert.deepEqual(calls, [['GET /api/oj/notify', undefined]]);
  await act(async () => root.render(createElement('div')));
});

test('a save in flight disables nothing, so focus stays put; a change made meanwhile is not sent', async () => {
  const tz = new Date().getTimezoneOffset();
  server.settings = {
    prefs: { review: true, streak: true, daily: false, contest: true, email: false, hour: 20, tz, locale: 'en' },
    push: null,
    mail: true,
    verified: true,
    endpoints: [],
  };
  await act(async () => root.render(createElement(ReminderSettings)));
  await settle();
  let release;
  gate = new Promise((done) => (release = done));
  try {
    calls.length = 0;
    const hour = document.querySelector('#reminders select');
    hour.focus();
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(hour, '7');
      hour.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    await settle();
    assert.equal(document.querySelector('#reminders').getAttribute('aria-busy'), 'true');
    for (const control of document.querySelectorAll('#reminders input, #reminders select, #reminders button')) {
      assert.equal(control.disabled, false, control.outerHTML);
      assert.equal(control.matches(':disabled'), false, control.outerHTML);
    }
    assert.equal(hour.getAttribute('aria-disabled'), 'true');
    assert.equal(document.activeElement, hour);
    await click(box('The daily problem'));
    assert.equal(box('The daily problem').checked, false);
    assert.deepEqual(calls.map(([key, body]) => [key, body.prefs.hour, body.prefs.daily]), [['POST /api/oj/notify', 7, false]]);
    await act(async () => release());
    await settle();
    assert.equal(hour.getAttribute('aria-disabled'), 'false');
    assert.equal(hour.value, '7');
  } finally {
    gate = null;
    await act(async () => root.render(createElement('div')));
  }
});

test('push for this device: permission, subscribe with the VAPID key, off again, gone with reminders off', async () => {
  const tz = new Date().getTimezoneOffset();
  server.settings = {
    prefs: { review: true, streak: true, daily: false, contest: true, email: false, hour: 20, tz, locale: 'en' },
    push: 'BAEC',
    mail: false,
    verified: true,
    endpoints: [],
  };
  let options = null;
  let unsubscribed = 0;
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/me', unsubscribe: async () => void unsubscribed++ };
  const registration = { pushManager: { subscribe: async (o) => ((options = o), subscription), getSubscription: async () => null } };
  window.PushManager = class {};
  globalThis.Notification = { requestPermission: async () => 'granted' };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => undefined, register: async () => registration, ready: Promise.resolve(registration) },
  });
  try {
    await act(async () => root.render(createElement(ReminderSettings)));
    await settle();
    await click(button('Turn push on for this device'));
    assert.equal(options.userVisibleOnly, true);
    assert.deepEqual([...options.applicationServerKey], [4, 1, 2]);
    assert.deepEqual(calls.at(-1), ['POST /api/oj/notify/subscription', { endpoint: subscription.endpoint, on: true }]);
    assert.match(document.querySelector('#reminders').textContent, /Push is on for this device/);
    await click(button('Turn push off here'));
    assert.deepEqual(calls.at(-1), ['POST /api/oj/notify/subscription', { endpoint: subscription.endpoint, on: false }]);
    assert.equal(unsubscribed, 1);
    assert.ok(button('Turn push on for this device'));
    // Blocked notifications: said so, nothing subscribed.
    globalThis.Notification = { requestPermission: async () => 'denied' };
    calls.length = 0;
    await click(button('Turn push on for this device'));
    assert.deepEqual(calls, []);
    assert.match(document.querySelector('#reminders [role="alert"]').textContent, /Notifications are blocked/);
    // Turning reminders off lets go of this browser's subscription too.
    globalThis.Notification = { requestPermission: async () => 'granted' };
    await click(button('Turn push on for this device'));
    await click(button('Turn reminders off'));
    assert.deepEqual(calls.at(-1), ['POST /api/oj/notify', { prefs: null }]);
    assert.equal(unsubscribed, 2);
    // A subscription the server no longer has (reminders turned off elsewhere) is not shown as on.
    await act(async () => root.render(createElement('div')));
    server.settings = {
      ...server.settings,
      prefs: { review: true, streak: true, daily: false, contest: true, email: false, hour: 20, tz, locale: 'en' },
    };
    registration.pushManager.getSubscription = async () => subscription;
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: async () => registration, register: async () => registration, ready: Promise.resolve(registration) },
    });
    await act(async () => root.render(createElement(ReminderSettings)));
    await settle();
    assert.ok(button('Turn push on for this device'));
  } finally {
    delete navigator.serviceWorker;
    delete window.PushManager;
    delete globalThis.Notification;
    await act(async () => root.render(createElement('div')));
  }
});

test('follow a company from its page; signed out it leads to signing in; unfollow from the account', async () => {
  server.follows = { signedIn: false, items: [] };
  await act(async () => root.render(createElement(CompanyFollowButton, { slug: 'amazon', name: 'Amazon', zh: false })));
  await settle();
  const signIn = document.querySelector('a.company-follow');
  assert.equal(signIn.getAttribute('href'), '/?view=account#companies');
  assert.equal(signIn.textContent, 'Sign in to follow Amazon');

  server.follows = { signedIn: true, items: [] };
  await act(async () => root.render(createElement('div')));
  await act(async () => root.render(createElement(CompanyFollowButton, { slug: 'amazon', name: 'Amazon', zh: true, hint: true })));
  await settle();
  const follow = document.querySelector('button.company-follow');
  assert.equal(follow.getAttribute('aria-pressed'), 'false');
  assert.equal(follow.textContent, '关注 Amazon，有新面经、OA 题或在招岗位时提醒我');
  await click(follow);
  assert.deepEqual(calls.at(-1), ['POST /api/oj/follows/companies', { slug: 'amazon', on: true }]);
  assert.equal(follow.getAttribute('aria-pressed'), 'true');
  assert.equal(follow.textContent, '已关注 Amazon');

  await act(async () => root.render(createElement(FollowedCompanies, { zh: false })));
  await settle();
  assert.equal(document.querySelector('.service-row a').getAttribute('href'), '/company/amazon');
  await click(document.querySelector('[aria-label="Unfollow Amazon"]'));
  assert.deepEqual(calls.at(-1), ['POST /api/oj/follows/companies', { slug: 'amazon', on: false }]);
  assert.match(document.getElementById('root').textContent, /No companies yet/);
});
