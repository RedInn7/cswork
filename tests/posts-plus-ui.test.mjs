import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// The mermaid renderer is stubbed: this checks which blocks reach it, not mermaid itself.
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const diagram = `import React from ${JSON.stringify(react)};export const CourseDiagram=({source})=>React.createElement('figure',{'data-diagram':''},source);`;
register(
  `data:text/javascript,${encodeURIComponent(`const diagram=${JSON.stringify(diagram)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};if(u.endsWith('/components/course-diagram.tsx'))return {format:'module',source:diagram,shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const id = '11111111-1111-4111-8111-111111111111';
const thread = {
  id,
  problemId: 'discuss:algo',
  title: 'Which language for OAs?',
  language: '',
  tag: '',
  hidden: 0,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  author: 'Grace',
  mine: false,
  votes: 0,
  voted: false,
  comments: 0,
  stars: 0,
  starred: false,
  excerpt: 'Curious',
};
const poll = {
  question: 'Pick one',
  options: ['Python', 'C++'],
  multi: false,
  closesAt: null,
  closed: false,
  voters: 2,
  mine: [],
  counts: null,
};
const body = ['Curious.', '```mermaid', 'graph TD', '  A-->B', '```', '```python', 'x = 1', '```'].join('\n');

test('a thread draws its mermaid, takes one poll vote, saves and lists saved posts, and attaches a poll', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SolutionPosts } = await import('../components/solution-posts.tsx');

  const sent = [];
  const gets = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url);
    if (init.method === 'POST') {
      const data = JSON.parse(init.body);
      sent.push([path, data]);
      if (path.endsWith('/poll')) return Response.json({ poll: { ...poll, voters: 3, mine: [1], counts: [1, 2] } });
      if (path === '/api/oj/marks') return Response.json(data);
      return Response.json({ post: { ...thread, id: '22222222-2222-4222-8222-222222222222', mine: true, body: data.body, poll: null }, comments: [] }, { status: 201 });
    }
    gets.push(path);
    if (path === '/api/oj/reports/companies') return Response.json({ items: [] });
    if (path.startsWith('/api/oj/posts?starred=1'))
      return Response.json({ solved: true, items: [{ ...thread, problemId: 'q:tell-me', title: 'My STAR answer', starred: true }], more: false, next: 1 });
    if (path.startsWith('/api/oj/posts?')) return Response.json({ solved: true, items: [thread], more: false });
    return Response.json({ post: { ...thread, body, poll }, comments: [] });
  };
  const root = createRoot(document.getElementById('root'));
  const $ = (selector) => document.querySelector(selector);
  const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const click = (text) => act(async () => button(text).click());
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 5)));
  const type = (input, value) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  try {
    await act(async () => root.render(createElement(SolutionPosts, { problemId: 'discuss:algo', english: true })));
    await settle();
    await click('Which language for OAs?');
    await settle();
    // ```mermaid goes to the diagram renderer; other code stays a code block.
    const article = $('.cs-post-body');
    assert.equal(article.querySelector('figure[data-diagram]')?.textContent, 'graph TD\n  A-->B\n');
    assert.equal(article.querySelector('pre code')?.textContent.includes('x = 1'), true);
    assert.equal(article.textContent.includes('A-->B') && !article.querySelector('pre code')?.textContent.includes('A-->B'), true);

    // The poll: no results before voting, one choice, then bars of each option's share.
    assert.equal($('.cs-poll h4').textContent, 'Pick one');
    assert.equal($('.cs-poll-results'), null);
    assert.equal($('.cs-poll-meta').textContent.includes('Results show once you vote'), true);
    assert.equal(button('Vote').disabled, true);
    const radios = [...document.querySelectorAll('.cs-poll input[type="radio"]')];
    assert.equal(radios.length, 2);
    await act(async () => radios[1].click());
    await act(async () => $('.cs-poll-form').requestSubmit());
    await settle();
    assert.deepEqual(sent.at(-1), [`/api/oj/posts/${id}/poll`, { choices: [1] }]);
    const bars = [...document.querySelectorAll('.cs-poll-bar > span')].map((s) => s.style.width);
    assert.deepEqual(bars, ['33%', '67%']);
    assert.equal($('.cs-poll-results li[data-mine]').textContent.includes('C++'), true);

    // Save: a star mark on post:<id>.
    const save = button('Save');
    assert.equal(save.getAttribute('aria-pressed'), 'false');
    await act(async () => save.click());
    assert.deepEqual(sent.at(-1), ['/api/oj/marks', { target: `post:${id}`, mark: 'star', on: true }]);
    assert.equal(button('Saved').getAttribute('aria-pressed'), 'true');

    // Saved posts from every target, titled and labelled with their kind.
    await click('All threads');
    await settle();
    await click('Saved');
    await settle();
    assert.equal(gets.includes('/api/oj/posts?starred=1'), true);
    assert.equal($('.cs-post-row-title').textContent, 'My STAR answer');
    assert.equal($('.cs-post-row-meta').textContent.includes('Answer'), true);
    assert.equal($('.cs-posts-sort'), null, 'no sort among saved posts');

    // A new thread with a poll.
    await click('Saved');
    await settle();
    await click('New thread');
    assert.equal($('.cs-post-editor-note').textContent.includes('mermaid'), true);
    await click('Add a poll');
    const [title, question, first, second] = document.querySelectorAll('.cs-post-editor input:not([type])');
    await type(title, 'Mock OA timing');
    await type(question, 'Morning or night?');
    await type(first, ' Morning ');
    await type(second, 'Night');
    const area = $('textarea[aria-label="Body"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(area, 'When do you take them?');
      area.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await act(async () => $('.cs-post-editor').requestSubmit());
    await settle();
    const [path, data] = sent.at(-1);
    assert.equal(path, '/api/oj/posts');
    assert.deepEqual(data.poll, { question: 'Morning or night?', options: ['Morning', 'Night'], multi: false, closesAt: null });
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
