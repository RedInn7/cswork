import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('Google sign-in uses a local official icon with its original aspect ratio', () => {
  const source = readFileSync('components/account.tsx', 'utf8');
  const css = readFileSync('app/globals.css', 'utf8');
  const image = readFileSync('public/auth/google-g.png');
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), 200);
  assert.equal(image.readUInt32BE(20), 204);
  assert.match(
    source,
    /src="\/auth\/google-g\.png"[\s\S]*?width=\{20\}[\s\S]*?height=\{20\.4\}[\s\S]*?alt=""[\s\S]*?aria-hidden="true"/,
  );
  assert.doesNotMatch(source, /google-g'|\? 'G' :/);
  assert.match(
    css,
    /\.login-providers \.google-signin \{[^}]*background: #fff/,
  );
  assert.match(source, /authClient\.signIn\.social\(\{/);
  assert.match(
    source,
    /t\('使用 Google 登录', 'Sign in with Google'\)[\s\S]*?t\('使用 GitHub 登录', 'Sign in with GitHub'\)/,
  );
});
