import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// next/link renders a plain anchor (vinext provides it in the app).
register(
  `data:text/javascript,${encodeURIComponent(
    "export async function resolve(s,c,n){if(s==='next/link')return {url:'data:text/javascript,export default function Link({prefetch,...p}){return globalThis.__link(p)}',shortCircuit:true};return n(s,c);}" +
      `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);
globalThis.__link = (props) => createElement('a', props);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=mock-peer' });
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'PointerEvent',
  'KeyboardEvent',
  'FocusEvent',
  'getComputedStyle',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] ?? dom.window.MouseEvent });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const { createRoot } = await import('react-dom/client');
const { MockPeer, slotGrid, icsFor, roundHref } = await import('../components/mock-peer.tsx');
const { CampPanel, cardFacts, drawCard } = await import('../components/group-camp.tsx');
const { GiftBlock, RedeemGift } = await import('../components/course-gift.tsx');
const { NewsletterToggle } = await import('../components/newsletter-toggle.tsx');
const { LEAD_HOURS, WINDOW_HOURS } = await import('../lib/mock-peer.ts');

const HOUR = 3600000;
const wait = (ms = 5) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
function type(input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}
async function mount(element) {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await wait();
  return root;
}
function serve(routes) {
  const posts = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (body) posts.push([path, body]);
    const answer = routes(path, body);
    if (!answer) throw new Error(`unexpected ${path}`);
    return answer;
  };
  return { posts, restore: () => (globalThis.fetch = original) };
}

test('peer timetable: every bookable hour once, as local rows and day columns', () => {
  const now = Date.UTC(2026, 9, 14, 9, 20);
  const grid = slotGrid(now, true);
  const slots = [...grid.cells.values()];
  assert.equal(slots.length, WINDOW_HOURS - LEAD_HOURS + 1);
  assert.equal(new Set(slots).size, slots.length);
  assert.equal(Math.min(...slots), Math.floor(now / HOUR) + LEAD_HOURS);
  assert.ok(grid.days.length >= 7 && grid.days.length <= 8);
  assert.ok(grid.rows.length >= 24 && grid.rows.every((r) => /^\d\d:\d\d$/.test(r)));
  const pair = { id: 'Pair00000001', kind: 'phone', level: 'mid', slot: Date.UTC(2026, 9, 15, 14) / HOUR, partner: 'Amy, Lee', meetUrl: '' };
  const ics = icsFor(pair, 'https://cswork.test', true);
  assert.ok(ics.includes('DTSTART:20261015T140000Z\r\n'));
  // Two 50-minute rounds.
  assert.ok(ics.includes('DTEND:20261015T154000Z\r\n'));
  assert.ok(ics.includes('Partner: Amy\\, Lee'));
  assert.equal(roundHref('phone', { set: 'abcd1234', as: 'candidate' }), '/?view=mock-interview&template=phone&set=abcd1234&as=candidate');
});

test('peer page: pick hours and ask; a session shows its own two roles and checks the call link', async () => {
  const slot = Math.floor(Date.now() / HOUR) + 30;
  let state = {
    request: null,
    paused: false,
    pairs: [
      {
        id: 'Pair00000001',
        kind: 'behavioral',
        level: 'mid',
        slot,
        partner: '<b>Amy</b>',
        meetUrl: '',
        status: 'scheduled',
        rounds: [
          { set: 'aaaa1111', as: 'interviewer' },
          { set: 'bbbb2222', as: 'candidate' },
        ],
        reported: false,
        reportedMe: false,
        canReport: false,
        canCancel: true,
      },
    ],
  };
  const navigations = [];
  const api = serve((path, body) => {
    if (path === 'oj/peer' && !body) return Response.json(state);
    if (path === 'oj/peer') {
      state = { ...state, request: { displayName: body.displayName, kind: body.kind, level: body.level, slots: body.slots, expired: false } };
      return Response.json(state, { status: 201 });
    }
    if (path === 'oj/peer/Pair00000001/link') {
      state = { ...state, pairs: [{ ...state.pairs[0], meetUrl: body.url }] };
      return Response.json(state);
    }
  });
  try {
    const root = await mount(createElement(MockPeer, { navigate: (v, e) => navigations.push([v, e]), params: { pair: 'Pair00000001' } }));
    assert.ok(document.querySelector('h1').textContent === 'Peer mock interviews');
    assert.ok(document.querySelector('.mi-modes a[aria-current="page"]').textContent === 'Peer interviews');
    const pass = document.querySelector('.peer-pass');
    assert.ok(pass.hasAttribute('data-focus'));
    // Partner names are text, never markup.
    assert.ok(pass.querySelector('.peer-pass-partner strong').textContent === '<b>Amy</b>');
    assert.ok(pass.querySelector('.peer-pass-partner b') === null);
    const links = [...pass.querySelectorAll('.peer-rounds a')];
    assert.ok(links[0].getAttribute('href') === '/?view=mock-interview&template=behavioral&set=aaaa1111&as=interviewer');
    assert.ok(links[1].getAttribute('href').endsWith('set=bbbb2222&as=candidate'));
    await act(async () => links[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
    assert.deepEqual(navigations.at(-1), ['mock-interview', { template: 'behavioral', set: 'bbbb2222', as: 'candidate' }]);
    // A phishing link is refused in the form; a Zoom link saves.
    const input = pass.querySelector('.peer-link input');
    await act(async () => type(input, 'https://evil.test/zoom'));
    assert.ok(input.getAttribute('aria-invalid') === 'true');
    assert.ok(button('Save link').disabled === true);
    await act(async () => type(input, 'https://zoom.us/j/42'));
    await act(async () => button('Save link').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/peer/Pair00000001/link', { url: 'https://zoom.us/j/42' }]);
    const join = document.querySelector('.peer-join');
    assert.ok(join.getAttribute('href') === 'https://zoom.us/j/42' && join.getAttribute('rel').includes('noopener'));
    // Ask: name, type, level, two hours.
    await act(async () => button('Data Scientist').click());
    await act(async () => button('Senior (5+ yrs)').click());
    const cells = [...document.querySelectorAll('.peer-grid td button')];
    assert.equal(cells.length, WINDOW_HOURS - LEAD_HOURS + 1);
    assert.ok(button('Find me a partner').disabled === true);
    await act(async () => cells[3].click());
    await act(async () => cells[5].click());
    await act(async () => cells[5].click());
    await act(async () => cells[7].click());
    assert.ok(cells[3].getAttribute('aria-pressed') === 'true' && cells[5].getAttribute('aria-pressed') === 'false');
    await act(async () => type(document.querySelector('.peer-name input'), ' Cat '));
    await act(async () => button('Find me a partner').click());
    await wait();
    const [path, body] = api.posts.at(-1);
    assert.equal(path, 'oj/peer');
    assert.equal(body.displayName, 'Cat');
    assert.equal(body.kind, 'ds');
    assert.equal(body.level, 'senior');
    assert.equal(body.slots.length, 2);
    assert.equal(body.tz, new Date().getTimezoneOffset());
    assert.ok(document.querySelector('.peer-waiting h2').textContent.includes('Data Scientist'));
    assert.ok(document.querySelectorAll('.peer-chips li').length === 2);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

const camp = {
  plan: 'blind-75',
  planName: ['Blind 75', 'Blind 75'],
  perDay: 2,
  startDate: '2026-10-13',
  day: 2,
  days: 38,
  total: 75,
  tasks: [
    { id: 'lc-1', number: 1, titleZh: '两数之和', titleEn: 'Two Sum', difficulty: '简单' },
    { id: 'lc-121', number: 121, titleZh: '买卖股票', titleEn: 'Best Time to Buy and Sell Stock', difficulty: '简单' },
  ],
};
const members = [
  { key: 'k1', name: 'Cap', me: true, streak: 5, today: 2, camp: { today: 1, done: 3, mine: [true, false] } },
  { key: 'k2', name: 'Amy', me: false, streak: 1, today: 0, camp: { today: 2, done: 4 } },
];

test('check-in card: the facts, drawn on a 2D canvas or reported unsupported', () => {
  const facts = cardFacts({ group: 'Sprint', camp, streak: 5, today: 2, done: 3, date: '2026-10-14' }, true);
  assert.equal(facts.big, 'DAY 2');
  assert.deepEqual(facts.stats, [
    ['2', 'solved today'],
    ['5', 'day streak'],
    ['3/75', 'Blind 75'],
  ]);
  assert.equal(cardFacts({ group: 'S', camp: { ...camp, day: 0 }, streak: 0, today: 0, done: 0, date: '2026-10-14' }, false).big, '2026-10-14');
  assert.equal(drawCard({ getContext: () => null }, facts), false);
  const texts = [];
  const ctx = new Proxy(
    { fillText: (s) => texts.push(s), measureText: (s) => ({ width: s.length * 10 }) },
    { get: (target, key) => target[key] ?? (() => {}), set: () => true },
  );
  const canvas = { getContext: () => ctx };
  assert.equal(drawCard(canvas, facts), true);
  assert.equal(canvas.width, 1080);
  assert.ok(texts.includes('Sprint') && texts.includes('DAY 2') && texts.includes('3/75'));
});

test('cohort panel: day N, today’s done grid, and the owner’s settings', async () => {
  const saved = [];
  const root = await mount(
    createElement(CampPanel, {
      camp,
      members,
      group: 'Sprint',
      manage: true,
      member: true,
      busy: false,
      save: async (body) => (saved.push(body), true),
      t: (zh, en) => en,
      english: true,
    }),
  );
  assert.ok(document.querySelector('.group-camp-led').textContent === 'Day 2');
  assert.ok(document.querySelector('.group-camp-day small').textContent === 'of 38');
  const heads = [...document.querySelectorAll('.group-camp-grid thead a')];
  assert.ok(heads[0].getAttribute('href') === '/?view=problem&problem=lc-1' && heads[0].textContent === '1. Two Sum');
  const rows = [...document.querySelectorAll('.group-camp-grid tbody tr')];
  assert.equal(rows.length, 2);
  assert.deepEqual(
    [...rows[0].querySelectorAll('.group-led')].map((led) => led.getAttribute('data-level')),
    ['4', '0'],
  );
  assert.ok(rows[0].querySelector('.group-num').textContent === '3/75');
  // Another member's row: a count of today's tasks, never which ones.
  assert.equal(rows[1].querySelectorAll('.group-led').length, 0);
  assert.ok(rows[1].querySelector('td[colspan="2"]').textContent.startsWith('2/2'));
  await act(async () => button('Edit cohort').click());
  const date = document.querySelector('.group-camp-form input[type="date"]');
  assert.ok(date.value === '2026-10-13');
  await act(async () => button('Save cohort').click());
  await wait();
  assert.deepEqual(saved.at(-1), { plan: 'blind-75', perDay: 2, startDate: '2026-10-13' });
  await act(async () => button('End cohort').click());
  assert.deepEqual(saved.at(-1), { plan: '' });
  // No canvas in jsdom: the card says so instead of failing.
  const original = dom.window.HTMLCanvasElement.prototype.getContext;
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  try {
    await act(async () => button('check-in card').click());
    await wait();
    assert.ok(document.querySelector('.group-card [role="status"]').textContent.includes('can’t draw'));
  } finally {
    dom.window.HTMLCanvasElement.prototype.getContext = original;
  }
  await act(async () => root.unmount());
});

test('gift order: the buyer copies the code or link and can swap it', async () => {
  const order = {
    id: 'order-1',
    course_id: 'gomall',
    course_title: 'Go Mall',
    status: 'paid',
    gift: { code: 'ABCD-EFGH-JKMN-PQRS', issuedAt: 1, redeemedAt: null, revokedAt: null },
  };
  const copied = [];
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (s) => copied.push(s) },
  });
  const changes = [];
  const api = serve((path) => {
    if (path === 'gifts/order-1/reissue')
      return Response.json({ ...order, gift: { ...order.gift, code: 'WXYZ-WXYZ-WXYZ-WXYZ' } });
  });
  try {
    const root = await mount(createElement(GiftBlock, { order, onChange: (next) => changes.push(next) }));
    assert.ok(document.querySelector('.commerce-gift-code code').textContent === 'ABCD-EFGH-JKMN-PQRS');
    await act(async () => button('Copy link').click());
    await wait();
    assert.deepEqual(copied, ['https://cswork.test/?view=gift#code=ABCD-EFGH-JKMN-PQRS']);
    await act(async () => button('Void and get a new code').click());
    await wait();
    assert.ok(changes.at(-1).gift.code === 'WXYZ-WXYZ-WXYZ-WXYZ');
    await act(async () => root.render(createElement(GiftBlock, { order: { ...order, gift: { ...order.gift, code: null, redeemedAt: Date.UTC(2026, 9, 1) } }, onChange: () => {} })));
    assert.ok(document.querySelector('.commerce-gift').textContent.includes('Redeemed on'));
    assert.ok(document.querySelector('.commerce-gift-code') === null);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('redeem form: the code from the link fragment, sent once', async () => {
  history.replaceState(null, '', '/?view=gift#code=ABCD-EFGH-JKMN-PQRS');
  const done = [];
  const api = serve((path, body) => {
    if (path === 'gifts/redeem' && body.code === 'ABCD-EFGH-JKMN-PQRS') return Response.json({ courseId: 'gomall', title: 'Go Mall' });
  });
  try {
    const root = await mount(createElement(RedeemGift, { onDone: (title) => done.push(title) }));
    const input = document.querySelector('.commerce-redeem input');
    assert.ok(input.value === 'ABCD-EFGH-JKMN-PQRS');
    await act(async () => button('Redeem').click());
    await wait();
    assert.deepEqual(api.posts, [['gifts/redeem', { code: 'ABCD-EFGH-JKMN-PQRS' }]]);
    assert.deepEqual(done, ['Go Mall']);
    assert.ok(document.querySelector('.commerce-redeem input').value === '');
    await act(async () => root.unmount());
  } finally {
    api.restore();
    history.replaceState(null, '', '/');
  }
});

test('newsletter toggle: signed out, then subscribe while mail is off', async () => {
  let signedIn = false;
  const api = serve((path, body) => {
    if (path === 'oj/newsletter' && !body)
      return signedIn
        ? Response.json({ subscribed: false, confirmed: false, mail: false })
        : Response.json({ error: 'Please sign in first' }, { status: 401 });
    if (path === 'oj/newsletter') return Response.json({ subscribed: body.subscribe, confirmed: false, mail: false });
  });
  try {
    let root = await mount(createElement(NewsletterToggle));
    assert.ok(document.querySelector('.newsletter-toggle a').getAttribute('href') === '/?view=account#newsletter');
    await act(async () => root.unmount());
    signedIn = true;
    root = await mount(createElement(NewsletterToggle));
    await act(async () => button('Subscribe').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/newsletter', { subscribe: true, locale: 'en' }]);
    assert.ok(document.querySelector('.newsletter-toggle [role="status"]').textContent.includes('Once email delivery is switched on'));
    await act(async () => button('Unsubscribe').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/newsletter', { subscribe: false, locale: 'en' }]);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});
