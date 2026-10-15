import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// Group chat, direct messages, the work badge card and the referral board's buttons.
register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/', pretendToBeVisual: true });
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
// The chats' 10-second polls run when the test says so.
const polls = [];
const realInterval = globalThis.setInterval;
const realClear = globalThis.clearInterval;
// A cleared poll becomes null, so a test can see the polling stop.
globalThis.setInterval = (fn, ms, ...rest) => (ms === 10000 ? polls.push(fn) + 1e6 : realInterval(fn, ms, ...rest));
globalThis.clearInterval = (id) => (typeof id === 'number' && id > 1e6 ? (polls[id - 1e6 - 1] = null) : realClear(id));
const { createRoot } = await import('react-dom/client');
const { StudyGroups } = await import('../components/study-groups.tsx');
const { Messages } = await import('../components/messages.tsx');
const { WorkBadgeSettings } = await import('../components/work-badge.tsx');
const { FollowButton } = await import('../components/follow-button.tsx');
const { SolutionPosts } = await import('../components/solution-posts.tsx');

const wait = (ms = 5) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement : el.tagName === 'SELECT' ? dom.window.HTMLSelectElement : dom.window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new dom.window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
async function mount(element) {
  document.body.innerHTML = '<div id="root"></div>';
  polls.length = 0;
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await wait();
  return root;
}
function serve(routes) {
  const posts = [];
  const gets = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '').replace(/[?&]tz=-?\d+/, '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    (body ? posts : gets).push(body ? [path, body] : path);
    const answer = routes(path, body);
    if (!answer) throw new Error(`unexpected ${path}`);
    return answer;
  };
  return { posts, gets, restore: () => (globalThis.fetch = original) };
}
const line = (id, body, extra = {}) => ({ id, body, createdAt: 1000 + Number(id.slice(1)), mine: false, ...extra });

test('group chat: names, polling, a polite count, unsend and report', async () => {
  const group = {
    id: 'Grp000000001',
    name: 'Sprint',
    role: 'member',
    inviteCode: 'ABCD2345',
    goal: null,
    max: 50,
    createdAt: 1,
    members: [],
  };
  let chat = [line('m1', 'Hi all', { name: 'Amy' }), line('m2', 'Mine\ntwo lines', { name: 'Bob', mine: true })];
  const api = serve((path, body) => {
    if (path === 'oj/groups/Grp000000001') return Response.json(group);
    if (path.startsWith('oj/groups/Grp000000001/messages') && !body) return Response.json({ items: chat });
    if (path === 'oj/groups/Grp000000001/messages') {
      chat = [...chat, ...(body.body === 'Hi again' ? [line('m6', 'Typed meanwhile', { name: 'Cat' })] : []), line(body.body === 'Hi again' ? 'm7' : 'm4', body.body, { name: 'Bob', mine: true })];
      return Response.json({ items: chat }, { status: 201 });
    }
    if (path === 'oj/groups/Grp000000001/unsay') return Response.json({ items: (chat = chat.filter((m) => m.id !== body.message)) });
    if (path === 'oj/groups/Grp000000001/report') return Response.json({ reported: true });
  });
  try {
    const root = await mount(createElement(StudyGroups, { navigate: () => {}, params: { id: 'Grp000000001' } }));
    const lines = () => [...document.querySelectorAll('.chat-log li')];
    assert.deepEqual(lines().map((li) => li.querySelector('b').textContent), ['Amy', 'You']);
    assert.equal(lines()[1].querySelector('.chat-body').textContent, 'Mine\ntwo lines');
    assert.ok(lines()[1].hasAttribute('data-mine'));
    assert.equal(document.querySelector('[aria-live="polite"]').textContent, '');
    // A poll reloads the chat and announces a count of new lines, not the text.
    chat = [...chat, line('m3', 'New one', { name: 'Cat' })];
    await act(async () => polls[0]());
    await wait();
    assert.equal(api.gets.at(-1), 'oj/groups/Grp000000001/messages');
    assert.equal(lines().length, 3);
    assert.equal(document.querySelector('[aria-live="polite"]').textContent, '1 new message');
    // The next poll's one new line is read too: same words, a new node in the live region.
    const said = document.querySelector('[aria-live="polite"] span');
    chat = [...chat, line('m5', 'Another', { name: 'Cat' })];
    await act(async () => polls[0]());
    await wait();
    assert.equal(document.querySelector('[aria-live="polite"]').textContent, '1 new message');
    assert.equal(document.querySelector('[aria-live="polite"] span') === said, false, 'a new node');
    chat = chat.filter((m) => m.id !== 'm5');
    await act(async () => polls[0]());
    await wait();
    assert.equal(document.querySelector('[aria-live="polite"]').textContent, '');
    // Send with Enter; Shift+Enter would only break the line.
    const box = document.querySelector('textarea[aria-label="Message the group"]');
    await act(async () => type(box, 'Hello'));
    await act(async () => box.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/groups/Grp000000001/messages', { body: 'Hello' }]);
    assert.equal(box.value, '');
    assert.equal(lines().length, 4);
    assert.equal(document.querySelector('[aria-live="polite"]').textContent, '', 'your own line is not news');
    // Unsend your own; report someone else's (no "wrong solution" for a chat line).
    await act(async () => lines()[1].querySelector('button').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/groups/Grp000000001/unsay', { message: 'm2' }]);
    assert.equal(lines().length, 3);
    await act(async () => lines()[0].querySelector('button').click());
    assert.equal(lines()[0].querySelector('option[value="wrong"]'), null);
    await act(async () => lines()[0].querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/groups/Grp000000001/report', { message: 'm1', reason: 'spam' }]);
    // A line taken back or moderated elsewhere leaves the open chat on the next poll.
    chat = chat.filter((m) => m.id !== 'm1');
    await act(async () => polls[0]());
    await wait();
    assert.deepEqual(lines().map((li) => li.querySelector('.chat-body').textContent), ['New one', 'Hello']);
    // A line from someone else that comes back with your send's answer is announced too.
    await act(async () => type(box, 'Hi again'));
    await act(async () => box.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    await wait();
    assert.equal(lines().length, 4);
    assert.equal(document.querySelector('[aria-live="polite"]').textContent, '1 new message');
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('group chat for a teacher without a report: a quiet note, and the 403 is not polled again', async () => {
  const group = { id: 'Grp000000001', name: 'Sprint', role: null, inviteCode: null, goal: null, max: 50, createdAt: 1, members: [] };
  const api = serve((path) => {
    if (path === 'oj/groups/Grp000000001') return Response.json(group);
    if (path.startsWith('oj/groups/Grp000000001/messages'))
      return Response.json({ error: '只有处理举报时老师才能查看小组聊天' }, { status: 403 });
  });
  try {
    const root = await mount(createElement(StudyGroups, { navigate: () => {}, params: { id: 'Grp000000001' } }));
    const panel = document.querySelector('.group-chat');
    // Booleans, so a failure does not print a whole DOM node.
    assert.equal(!!panel.querySelector('[role="alert"]'), false, 'no alert');
    assert.ok(panel.textContent.includes('Teachers can read a group chat only while a message in it is reported'));
    assert.equal(!!panel.querySelector('textarea'), false);
    assert.equal(polls[0] === null, true, 'the poll stopped');
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('chat.css keeps the Report link plain and errors readable on the navy panels', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../app/chat.css', import.meta.url), 'utf8');
  // solution-posts.css's .cs-post-act:hover:not(:disabled) is (0,3,0): chat needs its own, higher.
  assert.match(css, /\.chat-meta \.cs-post-act:hover:not\(:disabled\) \{\s*background: none;\s*color: inherit;/);
  const rule = css.match(/\.group-panel \.cloud-error,\s*\.dm-panel \.cloud-error,\s*\.chat-meta \.cs-posts-error \{\s*color: (#[0-9a-f]{6});/);
  assert.ok(rule, 'error colour on the navy panels');
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const navy = lum('#0e1a2b');
  assert.ok((lum(rule[1]) + 0.05) / (navy + 0.05) >= 4.5);
});

test('messages: the inbox and who may write, a conversation with block and report, a first message', async () => {
  const navigations = [];
  const navigate = (view, extra) => navigations.push([view, extra]);
  let inbox = {
    open: 'all',
    items: [{ key: 'k1', name: '@amy-g', at: 1, last: 'Sure, send it', lastMine: false, unread: 2, blocked: false }],
  };
  let convo = {
    key: 'k1',
    name: '@amy-g',
    blocked: false,
    canSend: true,
    post: { id: 'p1', title: 'Google referrals' },
    items: [line('d1', 'Could you refer me?', { mine: true }), line('d2', 'Sure, send it')],
  };
  const api = serve((path, body) => {
    if (path === 'oj/dm') return body ? Response.json({ ...convo, key: 'k9' }, { status: 201 }) : Response.json(inbox);
    if (path === 'oj/dm/settings') return Response.json((inbox = { ...inbox, open: body.open }));
    if (path.startsWith('oj/dm/k1') && !body) return Response.json(convo);
    if (path === 'oj/dm/k1/block') return Response.json((convo = { ...convo, blocked: body.on, canSend: !body.on }));
    if (path === 'oj/dm/k1/report') return Response.json({ reported: true });
  });
  try {
    let root = await mount(createElement(Messages, { navigate, params: {} }));
    const row = document.querySelector('a[href="/?view=messages&thread=k1"]');
    assert.ok(row.textContent.includes('@amy-g') && row.textContent.includes('2 unread'));
    await act(async () => type(document.querySelector('.dm-open select'), 'none'));
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/dm/settings', { open: 'none' }]);
    await act(async () => row.click());
    assert.deepEqual(navigations.at(-1), ['messages', { thread: 'k1' }]);
    await act(async () => root.unmount());

    root = await mount(createElement(Messages, { navigate, params: { thread: 'k1' } }));
    assert.equal(document.querySelector('#dm-with').textContent, '@amy-g');
    assert.ok(document.querySelector('.dm-post a[href="/discuss/p1"]'));
    // Only the other side's lines can be reported.
    const lines = [...document.querySelectorAll('.chat-log li')];
    assert.equal(lines[0].querySelector('button'), null);
    await act(async () => lines[1].querySelector('button').click());
    await act(async () => lines[1].querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/dm/k1/report', { message: 'd2', reason: 'spam' }]);
    await act(async () => button('Block').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/dm/k1/block', { on: true }]);
    assert.ok(document.querySelector('textarea').disabled);
    assert.ok(document.querySelector('.dm-note').textContent.includes('You blocked them'));
    assert.ok(button('Unblock'));
    await act(async () => root.unmount());

    // A referral request: the first message opens the conversation and goes there.
    root = await mount(createElement(Messages, { navigate, params: { post: 'p1' } }));
    assert.equal(document.querySelector('#dm-first').textContent, 'Request a referral');
    await act(async () => type(document.querySelector('textarea'), 'Hi, I am Bob'));
    await act(async () => button('Send').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/dm', { post: 'p1', body: 'Hi, I am Bob' }]);
    assert.deepEqual(navigations.at(-1), ['messages', { thread: 'k9' }]);
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});

test('work badge: every placement starts off and switches one at a time; codes only with mail', async () => {
  let state = {
    mail: true,
    verification: {
      company: { slug: 'google', name: 'Google' },
      domain: 'google.com',
      expiresAt: Date.UTC(2027, 0, 1),
      active: true,
      pending: false,
      show: { profile: false, posts: false, referrals: false },
    },
  };
  const api = serve((path, body) => {
    if (path === 'oj/work') return Response.json(state);
    if (path === 'oj/work/show')
      return Response.json((state = { ...state, verification: { ...state.verification, show: { ...state.verification.show, ...body } } }));
    if (path === 'oj/work/verify') return Response.json((state = { ...state, verification: { ...state.verification, pending: true } }));
  });
  try {
    const root = await mount(createElement(WorkBadgeSettings));
    assert.ok(document.body.textContent.includes('Verified: Google employee (google.com)'));
    const boxes = () => [...document.querySelectorAll('fieldset input[type="checkbox"]')];
    assert.deepEqual(boxes().map((b) => b.checked), [false, false, false]);
    await act(async () => boxes()[1].click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/work/show', { posts: true }]);
    assert.deepEqual(boxes().map((b) => b.checked), [false, true, false]);
    await act(async () => type(document.querySelector('input[type="email"]'), 'me@google.com'));
    await act(async () => button('Send code').click());
    await wait();
    assert.deepEqual(api.posts.at(-1), ['oj/work/verify', { email: 'me@google.com' }]);
    assert.ok(document.querySelector('input[autocomplete="one-time-code"]'));
    await act(async () => root.unmount());
    state = { mail: false, verification: null };
    const off = await mount(createElement(WorkBadgeSettings));
    assert.ok(button('Send code').disabled);
    assert.equal(document.querySelector('fieldset'), null);
    await act(async () => off.unmount());
  } finally {
    api.restore();
  }
});

test('mutual follows get a message link; a verified referral thread a request button', async () => {
  let mutual = true;
  const post = {
    id: 'p1',
    problemId: 'discuss:referral',
    title: 'Google referrals',
    language: '',
    tag: 'google',
    hidden: 0,
    createdAt: 1,
    updatedAt: 1,
    author: '@amy-g',
    mine: false,
    votes: 0,
    voted: false,
    comments: 0,
    employer: 'Google',
    referral: true,
    body: 'Happy to refer.',
  };
  const api = serve((path) => {
    if (path.startsWith('oj/follows')) return Response.json({ following: true, mutual, self: false, signedIn: true, followers: 1, followees: 1 });
    if (path === 'oj/posts/p1') return Response.json({ post, comments: [] });
    if (path === 'oj/reports/companies') return Response.json({ items: [{ slug: 'google', name: 'Google' }] });
    if (path.startsWith('oj/posts?')) return Response.json({ solved: true, items: [post], more: false });
  });
  try {
    let root = await mount(createElement(FollowButton, { handle: 'amy-g', zh: false, followers: 1 }));
    assert.ok(document.querySelector('a[href="/?view=messages&to=amy-g"]'));
    await act(async () => root.unmount());
    mutual = false;
    root = await mount(createElement(FollowButton, { handle: 'amy-g', zh: false, followers: 1 }));
    assert.equal(document.querySelector('a[href^="/?view=messages"]'), null);
    await act(async () => root.unmount());

    root = await mount(createElement(SolutionPosts, { problemId: 'discuss:referral', english: true, initialPost: 'p1' }));
    assert.deepEqual([...document.querySelectorAll('.cs-post-badge')].map((b) => b.textContent), ['Verified · Google employee', 'Gives referrals']);
    assert.ok(document.querySelector('a[href="/?view=messages&post=p1"]').textContent.includes('Request a referral'));
    await act(async () => root.unmount());
  } finally {
    api.restore();
  }
});
