import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticsPage,
  analyticsReferrer,
  measurementId,
} from '../lib/analytics';
test('default page matches the problem library and referrers expose only approved origins', () => {
  assert.equal(
    analyticsPage('https://cswork.org/')?.page_location,
    'https://cswork.org/problems',
  );
  assert.equal(
    analyticsReferrer('https://www.google.com/search?q=private#token'),
    'https://google.com/',
  );
  for (const value of [
    'http://192.168.1.1/private',
    'http://localhost/',
    'https://staff.internal/',
    'https://unknown.example/?email=a@b.com',
    'javascript:alert(1)',
  ])
    assert.equal(analyticsReferrer(value), '');
});
test('configuration fails closed for missing and malformed IDs', () => {
  for (const value of [undefined, '', 'G-1<script>', 'UA-123'])
    assert.equal(measurementId(value), '');
  assert.equal(measurementId('G-ABC1234567'), 'G-ABC1234567');
});
test('only canonical production host and approved pages are tracked', () => {
  for (const url of [
    'http://cswork.org/',
    'https://evil.test/',
    'https://cswork.org/api/auth/callback/google?code=secret',
    'https://cswork.org/?view=tickets',
    'https://cswork.org/?view=teacher',
    'https://cswork.org/?view=__proto__',
  ])
    assert.equal(analyticsPage(url), null);
});
test('private IDs, email, query and invite hash never enter analytics', () => {
  assert.deepEqual(
    analyticsPage(
      'https://cswork.org/?view=problem&problem=private-id&email=a@test.com&q=secret#invite=token',
    ),
    {
      page_location: 'https://cswork.org/problem',
      page_title: 'CSWORK · Practice',
      page_referrer: '',
    },
  );
});
