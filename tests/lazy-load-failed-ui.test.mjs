import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, lazy, Suspense } from 'react';
import { prerender } from 'react-dom/static';
import { register } from 'node:module';
register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);

test('a split chunk that 404s after a deploy renders a reload prompt instead of crashing', async () => {
  const { loadFailed } = await import('../components/learning.tsx');
  // Same shape as the lazy() factories in academy.tsx and learning.tsx.
  const View = lazy(() =>
    Promise.reject(new Error('Failed to fetch dynamically imported module')).then(
      (m) => ({ default: m.View }),
      loadFailed,
    ),
  );
  const { prelude } = await prerender(
    createElement(Suspense, { fallback: 'loading' }, createElement(View)),
  );
  const html = await new Response(prelude).text();
  assert.match(html, /<h3>Failed to load this page<\/h3>/);
  assert.match(html, /<button[^>]*>Reload<\/button>/);
});
