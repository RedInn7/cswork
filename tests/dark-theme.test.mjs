import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import {
  END,
  START,
  contrast,
  lightText,
  manualKeys,
  parseColor,
  prefixSelector,
  REFERENCE_SURFACE,
  themedFiles,
  withDarkBlock,
} from '../scripts/dark-theme.mjs';
import { THEME_COOKIE, THEME_KEY, THEME_SCRIPT } from '../lib/theme-script.ts';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

/** A page with the inline script's inputs: stored pick, cookie, OS preference. */
function page({ stored, cookie, osDark = false, blockedStorage = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://cswork.test/',
    runScripts: 'outside-only',
  });
  const { window } = dom;
  const listeners = [];
  const query = {
    matches: osDark,
    addEventListener: (_type, fn) => listeners.push(fn),
  };
  window.matchMedia = () => query;
  if (stored) window.localStorage.setItem(THEME_KEY, stored);
  if (cookie) window.document.cookie = `${THEME_COOKIE}=${cookie}; Path=/`;
  if (blockedStorage)
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  window.eval(THEME_SCRIPT);
  const html = window.document.documentElement;
  return {
    window,
    dark: () => html.classList.contains('dark'),
    theme: () => html.getAttribute('data-theme'),
    scheme: () => html.style.colorScheme,
    osChange(matches) {
      query.matches = matches;
      for (const fn of listeners) fn();
    },
  };
}

test('the inline script sets the theme on <html> before paint', () => {
  const systemDark = page({ osDark: true });
  assert.equal(systemDark.dark(), true);
  assert.equal(systemDark.theme(), 'dark');
  assert.equal(systemDark.scheme(), 'dark');

  const systemLight = page({ osDark: false });
  assert.equal(systemLight.dark(), false);
  assert.equal(systemLight.theme(), 'light');

  // A pinned pick beats the OS; storage beats the cookie.
  assert.equal(page({ stored: 'light', osDark: true }).dark(), false);
  assert.equal(page({ stored: 'dark', osDark: false }).dark(), true);
  assert.equal(page({ stored: 'light', cookie: 'dark' }).dark(), false);
  assert.equal(page({ cookie: 'dark' }).dark(), true);
  assert.equal(page({ stored: 'system', cookie: 'dark', osDark: false }).dark(), false);
  // Storage blocked: the cookie still carries the pick; junk falls back to the OS.
  assert.equal(page({ cookie: 'dark', blockedStorage: true }).dark(), true);
  assert.equal(page({ stored: '<b>', osDark: true }).dark(), true);
});

test('"system" follows OS changes live; a pinned theme ignores them', () => {
  const system = page({ osDark: false });
  system.osChange(true);
  assert.equal(system.dark(), true);
  system.osChange(false);
  assert.equal(system.theme(), 'light');

  const pinned = page({ stored: 'light', osDark: false });
  pinned.osChange(true);
  assert.equal(pinned.dark(), false);
});

test('the header toggle cycles system → light → dark and saves the pick', async () => {
  const p = page({ osDark: true });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: p.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createElement, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { ThemeToggle } = await import('../components/theme-toggle.tsx');
  const host = document.body.appendChild(document.createElement('div'));
  const reactRoot = createRoot(host);
  await act(async () => reactRoot.render(createElement(ThemeToggle)));
  const button = () => host.querySelector('button.theme-toggle');
  assert.equal(button().getAttribute('data-preference'), 'system');
  assert.ok(button().getAttribute('aria-label').includes('Switch to Light'));
  assert.equal(p.dark(), true);

  await act(async () => button().click());
  assert.equal(button().getAttribute('data-preference'), 'light');
  assert.equal(p.dark(), false);
  assert.equal(localStorage.getItem(THEME_KEY), 'light');
  assert.ok(document.cookie.includes(`${THEME_COOKIE}=light`));

  await act(async () => button().click());
  assert.equal(p.dark(), true);
  assert.equal(p.theme(), 'dark');

  await act(async () => button().click());
  assert.equal(localStorage.getItem(THEME_KEY), 'system');
  assert.equal(p.dark(), true); // the OS is dark
  await act(async () => reactRoot.unmount());
});

test('the root layout runs the script in <head> and renders a pinned cookie theme', () => {
  const layout = read('app/layout.tsx');
  assert.ok(/<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: THEME_SCRIPT \}\} \/>/.test(layout));
  assert.ok(layout.includes("import './theme.css'"));
  assert.ok(layout.includes('suppressHydrationWarning'));
  assert.ok(read('components/academy.tsx').includes('<ThemeToggle />'));
});

// Light declarations the dark block must repeat: hard-coded background and text colours.
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(|(?<![\w-])(?:white|black)(?![\w-])/;
const SKIPPED = (node) => {
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent)
    if (p.type === 'atrule' && (/keyframes|font-face|layer|theme/.test(p.name) || /print|forced-colors/.test(p.params)))
      return true;
  return false;
};

test('every stylesheet carries an up-to-date dark block covering its background and text colours', () => {
  const manual = manualKeys(read('app/theme.css'));
  const files = themedFiles(root);
  assert.ok(files.length >= 30);
  assert.ok(files.includes('app/globals.css') && files.includes('app/study-library.css'));
  for (const file of files) {
    const css = read(file);
    // Fresh: regenerating changes nothing (run `node scripts/dark-theme.mjs` after colour edits).
    assert.ok(withDarkBlock(css, { manual, from: file }) === css, `${file}: dark block is stale`);
    const [light, block = ''] = css.split(START);
    const covered = new Set(manualKeys(block.replace(END, '')));
    for (const key of manual) covered.add(key);
    postcss.parse(light).walkDecls((d) => {
      if (!/^(color|background(-color)?)$/.test(d.prop) || !COLOR.test(d.value) || /url\(/.test(d.value)) return;
      if (d.parent.type !== 'rule' || SKIPPED(d.parent)) return;
      for (const sel of d.parent.selectors) {
        if (/^\s*(\.dark|html\.dark|:root\.dark)(?![\w-])/.test(sel)) continue;
        const key = `${prefixSelector(sel).replace(/\s+/g, ' ')}|${d.prop}`;
        assert.ok(covered.has(key), `${file}: no dark override for ${key}`);
      }
    });
  }
  // CSS modules hash their class names, so they must stay on tokens.
  for (const file of fs.readdirSync(path.join(root, 'components')).filter((f) => f.endsWith('.module.css')))
    assert.ok(!COLOR.test(read(`components/${file}`)), `components/${file}: use tokens, not literal colours`);
});

test('dark text keeps 4.5:1: tokens, generated pairs and the text mapping', () => {
  const rgb = (value) => parseColor(value).rgb;
  const tokens = Object.fromEntries(
    [...read('app/theme.css').matchAll(/^\s*(--[\w-]+):\s*(#[0-9a-f]{6});/gm)].map((m) => [m[1], m[2]]),
  );
  for (const [fg, bgs] of Object.entries({
    '--foreground': ['--background', '--card', '--popover', '--muted'],
    '--muted-foreground': ['--background', '--card', '--muted'],
    '--primary': ['--background', '--card'],
    '--primary-foreground': ['--primary'],
    '--secondary-foreground': ['--secondary'],
    '--accent-foreground': ['--accent'],
    '--destructive': ['--card'],
    '--sidebar-foreground': ['--sidebar'],
    '--verdict-ac': ['--card'],
    '--verdict-wa': ['--card'],
  }))
    for (const bg of bgs)
      assert.ok(contrast(rgb(tokens[fg]), rgb(tokens[bg])) >= 4.5, `${fg} on ${bg}`);

  // Rules that set both colours: if the light pair was readable, the dark pair is too.
  let pairs = 0;
  const solid = (value) => {
    const c = parseColor(value);
    return c && c.alpha === 1 ? c.rgb : null;
  };
  for (const file of themedFiles(root)) {
    const [light, block] = read(file).split(START);
    if (!block) continue;
    const before = new Map();
    postcss.parse(light).walkRules((r) => before.set(r.selectors.map(prefixSelector).join(','), r));
    postcss.parse(block.replace(END, '')).walkRules((rule) => {
      const get = (node, prop) => node.nodes.findLast?.((n) => n.type === 'decl' && n.prop === prop)?.value ?? '';
      const fg = solid(get(rule, 'color'));
      const bg = solid(get(rule, 'background')) ?? solid(get(rule, 'background-color'));
      const original = before.get(rule.selectors.join(','));
      if (!fg || !bg || !original) return;
      const lightFg = solid(get(original, 'color'));
      const lightBg = solid(get(original, 'background')) ?? solid(get(original, 'background-color'));
      if (!lightFg || !lightBg || contrast(lightFg, lightBg) < 4.5) return;
      pairs++;
      assert.ok(contrast(fg, bg) >= 4.5, `${file} ${rule.selector}: ${contrast(fg, bg).toFixed(2)}`);
    });
  }
  assert.ok(pairs >= 20, `checked ${pairs} pairs`);

  // Any text colour, mapped onto the lightest generated surface, clears 4.5:1.
  for (let r = 0; r < 256; r += 51)
    for (let g = 0; g < 256; g += 51)
      for (let b = 0; b < 256; b += 51) {
        const out = lightText([r / 255, g / 255, b / 255]);
        assert.ok(contrast(out, REFERENCE_SURFACE) >= 4.5, `rgb(${r} ${g} ${b})`);
      }
});
