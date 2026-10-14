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

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=group' });
for (const name of [
  'window',
  'document',
  'HTMLElement',
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
const { StudyGroups, memberBoard, weeklyRanks, stopLabel } = await import('../components/study-groups.tsx');

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
    const path = String(url).replace('/api/', '').replace(/[?&]tz=-?\d+/, '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (body) posts.push([path, body]);
    const answer = routes(path, body);
    if (!answer) throw new Error(`unexpected ${path}`);
    return answer;
  };
  return { posts, restore: () => (globalThis.fetch = original) };
}
const days = (...last) => [...Array(98 - last.length).fill(0), ...last];
const member = (name, extra = {}) => ({
  key: `key-${name}`,
  name,
  role: 'member',
  me: false,
  joinedAt: 1,
  days: days(),
  week: 0,
  goal: null,
  ...extra,
});

test('the board reuses the calendar streak and ranks the week', () => {
  const stamp = new Date().toDateString();
  const board = memberBoard(member('Amy', { days: days(1, 2, 0, 3, 1) }), stamp);
  assert.equal(board.cells.length, 14);
  assert.deepEqual(board.cells.slice(-5).map((c) => c.count), [1, 2, 0, 3, 1]);
  assert.ok(board.cells.at(-3).frozen === true, 'a one-day gap spends a freeze, as on the personal calendar');
  assert.equal(board.streak, 4);
  assert.equal(board.today, 1);
  // Nothing today yet: yesterday's streak still stands.
  assert.equal(memberBoard(member('Bob', { days: days(2, 1, 0) }), stamp).streak, 2);
  const ranked = weeklyRanks([
    { name: 'b', week: 3, streak: 1 },
    { name: 'a', week: 3, streak: 1 },
    { name: 'c', week: 3, streak: 5 },
    { name: 'd', week: 9, streak: 0 },
  ]);
  assert.deepEqual(ranked.map((m) => m.name), ['d', 'c', 'a', 'b']);
  assert.equal(stopLabel('hash-counting', (zh, en) => en), 'Stop 2 · Hashing');
});

test('index: create a group and jump to it; codes go to the invite card', async () => {
  const navigations = [];
  const navigate = (view, extra) => navigations.push([view, extra]);
  const api = serve((path, body) => {
    if (path === 'oj/groups' && !body)
      return Response.json({ items: [{ id: 'Grp000000001', name: 'Sprint', role: 'owner', joinedAt: 1, members: 4 }] });
    if (path === 'oj/groups') return Response.json({ id: 'Grp000000002' }, { status: 201 });
  });
  try {
    const root = await mount(createElement(StudyGroups, { navigate, params: {} }));
    assert.ok(document.querySelector('h1').textContent === 'Study groups');
    assert.ok(document.querySelector('a[href="/?view=group&id=Grp000000001"]').textContent.includes('4 members'));
    assert.ok(document.querySelector('.group-privacy').textContent.includes('Never your email'));
    await act(async () => type(document.querySelector('input[aria-label="Group name"]'), ' Fall sprint '));
    await act(async () => type(document.querySelector('input[aria-label="Your name in the group"]'), 'Amy'));
    await act(async () => button('Create group').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/groups', { name: 'Fall sprint', displayName: 'Amy' }]);
    assert.deepEqual(navigations.at(-1), ['group', { id: 'Grp000000002' }]);
    await act(async () => type(document.querySelector('input[aria-label="Invite code"]'), 'abcd-efgh'));
    await act(async () => button('Join').click());
    assert.deepEqual(navigations.at(-1), ['group', { join: 'abcd-efgh' }]);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('invite card: preview the group, pick a name, join', async () => {
  const navigations = [];
  const api = serve((path, body) => {
    if (path === 'oj/groups/preview?code=ABCD2345')
      return Response.json({ id: null, name: '<b>Sprint</b>', members: 3, full: false });
    if (path === 'oj/groups/join' && body) return Response.json({ id: 'Grp000000001' });
  });
  try {
    const root = await mount(
      createElement(StudyGroups, { navigate: (v, e) => navigations.push([v, e]), params: { join: 'ABCD2345' } }),
    );
    // Group names are text, never markup.
    assert.ok(document.querySelector('h1').textContent === 'Join “<b>Sprint</b>”');
    assert.ok(document.querySelector('h1 b') === null);
    await act(async () => type(document.querySelector('input[aria-label="Your name in the group"]'), 'Bob'));
    await act(async () => button('Join group').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/groups/join', { code: 'ABCD2345', displayName: 'Bob' }]);
    assert.deepEqual(navigations.at(-1), ['group', { id: 'Grp000000001' }]);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('group page: grid, streaks, leaderboard and goal; the owner removes a member', async () => {
  let group = {
    id: 'Grp000000001',
    name: 'Sprint',
    role: 'owner',
    inviteCode: 'ABCD2345',
    goal: { text: 'Hashing by Sunday', stop: 'hash-counting', stopTotal: 19, setAt: Date.now() },
    max: 50,
    createdAt: 1,
    members: [
      member('Cap', { role: 'owner', me: true, days: days(1, 1, 1), week: 3, goal: 19 }),
      member('Amy', { days: days(0, 2, 4), week: 6, goal: 4 }),
      member('Bob'),
    ],
  };
  const api = serve((path, body) => {
    if (path === 'oj/groups/Grp000000001' && !body) return Response.json(group);
    if (path === 'oj/groups/Grp000000001/remove') {
      group = { ...group, members: group.members.filter((m) => m.key !== body.member) };
      return Response.json(group);
    }
  });
  try {
    const root = await mount(createElement(StudyGroups, { navigate: () => {}, params: { id: 'Grp000000001' } }));
    assert.ok(document.querySelector('h1').textContent === 'Sprint');
    assert.ok(document.querySelector('.group-goal').textContent.includes('This week’s goal'));
    assert.ok(document.querySelector('.group-goal-stop').textContent.includes('1 of 3 finished'));
    assert.ok(document.querySelector('.cloud-share input').value.endsWith('/?view=group&join=ABCD2345'));
    const rows = [...document.querySelectorAll('.group-grid tbody tr')];
    assert.equal(rows.length, 3);
    assert.equal(document.querySelectorAll('.group-grid thead .group-day').length, 14);
    assert.equal(rows[0].querySelectorAll('.group-led').length, 14);
    assert.ok(rows[0].querySelector('.group-num').textContent === '3', 'Cap: three days running');
    assert.ok(rows[1].querySelectorAll('.group-num')[1].textContent === '4', 'Amy: four today');
    assert.ok(rows[1].querySelector('.group-num[data-done]') === null && rows[0].querySelector('.group-num[data-done]') !== null);
    assert.ok(rows[0].hasAttribute('data-me'));
    assert.deepEqual(
      [...document.querySelectorAll('.group-ranks .group-name')].map((n) => n.textContent),
      ['Amy', 'Cap', 'Bob'],
    );
    // The owner's own row has no remove button; the others do.
    assert.equal(document.querySelectorAll('.group-grid .cloud-remove').length, 2);
    assert.ok(!!button('New invite code') && !!button('Disband') && !button('Leave group') && !button('Report'));
    await act(async () => document.querySelector('button[aria-label="Remove Bob"]').click());
    await wait();
    await act(async () => button('Remove').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/groups/Grp000000001/remove', { member: 'key-Bob' }]);
    assert.equal(document.querySelectorAll('.group-grid tbody tr').length, 2);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('group page as a member: leave and report, no owner tools; a stale goal says so', async () => {
  const group = {
    id: 'Grp000000001',
    name: 'Sprint',
    role: 'member',
    inviteCode: 'ABCD2345',
    goal: { text: 'Old goal', stop: null, stopTotal: 0, setAt: Date.now() - 30 * 86400000 },
    max: 50,
    createdAt: 1,
    members: [member('Cap', { role: 'owner' }), member('Amy', { me: true })],
  };
  const api = serve((path, body) => {
    if (path === 'oj/groups/Grp000000001' && !body) return Response.json(group);
    if (path === 'tickets') return Response.json({ id: 't1' }, { status: 201 });
  });
  try {
    const root = await mount(createElement(StudyGroups, { navigate: () => {}, params: { id: 'Grp000000001' } }));
    assert.ok(document.querySelector('.group-goal').hasAttribute('data-stale'));
    assert.ok(document.querySelector('.group-goal-label').textContent.startsWith('Group goal · set'));
    assert.equal(document.querySelectorAll('.group-grid .cloud-remove').length, 0);
    assert.ok(!button('New invite code') && !button('Disband') && !!button('Leave group'));
    await act(async () => button('Report').click());
    const reason = document.querySelector('.cloud-board textarea');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(reason, 'Rude name');
      reason.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await act(async () => button('Send report').click());
    await wait();
    const [path, body] = api.posts.at(-1);
    assert.ok(path === 'tickets' && body.title.startsWith('[group:Grp000000001]') && body.body.startsWith('Rude name'));
    assert.ok(document.querySelector('.group-reported') !== null);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});
