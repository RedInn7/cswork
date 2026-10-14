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
  contexts,
  contrast,
  lightText,
  manualKeys,
  parseColor,
  prefixSelector,
  oklchToRgb,
  REFERENCE_SURFACE,
  rgbToOklch,
  themedFiles,
  themeOptions,
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

test('the root layout runs the script in <head> and leaves the theme attributes to it', () => {
  const layout = read('app/layout.tsx');
  assert.ok(/<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: THEME_SCRIPT \}\} \/>/.test(layout));
  assert.ok(layout.includes("import './theme.css'"));
  // React re-renders this layout on navigation: any class / data-theme / style it owned
  // would be diffed back to the server's value, undoing a switch made since.
  let html = /<html\b([^>]*)>/.exec(layout)?.[1] ?? '';
  while (/\{[^{}]*\}/.test(html)) html = html.replace(/\{[^{}]*\}/g, '');
  const props = html.replace(/(['"]).*?\1/g, '').match(/[\w-]+/g) ?? [];
  assert.ok(props.includes('suppressHydrationWarning'), html);
  assert.ok(props.every((p) => p === 'lang' || p === 'suppressHydrationWarning'), html);
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
  const options = themeOptions(root);
  const { manual } = options;
  const files = themedFiles(root);
  assert.ok(files.length >= 30);
  assert.ok(files.includes('app/globals.css') && files.includes('app/study-library.css'));
  for (const file of files) {
    const css = read(file);
    // Fresh: regenerating changes nothing (run `node scripts/dark-theme.mjs` after colour edits).
    assert.ok(withDarkBlock(css, { ...options, from: file }) === css, `${file}: dark block is stale`);
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

// Solid fills on tokens app/theme.css turns light (ink, brand, red, amber …): the text on
// them has to turn dark too. Marks that hold no text (dots, glyphs, bar fills) are named here.
const MARKS = new Set([
  '.dark .notification-button i',
  '.dark .js-live-dot',
  ".dark .js-live[aria-pressed='true'] .js-live-dot",
  '.dark td[data-over] .mi-bar i',
  '.dark .om-live',
  '.dark .om-lat-avg',
  '.dark .om-glyph.is-dot',
  '.dark .om-glyph.is-avg',
]);

test('text on a fill that turns light in dark mode keeps 4.5:1', () => {
  const tokens = new Map();
  const manual = new Map();
  postcss.parse(read('app/theme.css')).walkDecls((d) => {
    if (d.prop.startsWith('--')) {
      const c = parseColor(d.value);
      if (c) tokens.set(d.prop, c.rgb);
    } else if (d.prop === 'color' && d.parent.type === 'rule')
      for (const s of d.parent.selectors) manual.set(s.trim().replace(/\s+/g, ' '), d.value);
  });
  const token = (value) => tokens.get(/^var\((--[\w-]+)\)$/.exec(value?.trim() ?? '')?.[1]);
  const colour = (value) => token(value) ?? parseColor(value ?? '')?.rgb;
  // `.x[data-a]:has(:checked) b` falls back to the text colour of `.x b`.
  const base = (sel) => sel.replace(/\[[^\]]*\]|:[\w-]+(\((?:[^()]|\([^()]*\))*\))?/g, '');
  let fills = 0;
  for (const file of themedFiles(root)) {
    const [, block] = read(file).split(START);
    if (!block) continue;
    const text = new Map();
    const fillRules = [];
    postcss.parse(block.replace(END, '')).walkRules((rule) => {
      const get = (prop) => rule.nodes.findLast((n) => n.type === 'decl' && n.prop === prop)?.value;
      for (const s of rule.selectors.map((s) => s.replace(/\s+/g, ' '))) {
        if (get('color')) text.set(s, get('color'));
        fillRules.push([s, get('background') ?? get('background-color')]);
      }
    });
    for (const [sel, fill] of fillRules) {
      const bg = token(fill);
      if (!bg || rgbToOklch(bg).L <= 0.6 || MARKS.has(sel)) continue;
      fills++;
      const fg = colour(manual.get(sel) ?? text.get(sel) ?? text.get(base(sel)));
      const ratio = fg ? contrast(fg, bg) : 0;
      assert.ok(ratio >= 4.5, `${file} ${sel}: text on ${fill} is ${fg ? ratio.toFixed(2) + ':1' : 'unset'}`);
    }
  }
  assert.ok(fills >= 8, `checked ${fills} fills`);
});

// ------------------------------------------- every dark text colour on the surface behind it

/** Stylesheets a module imports together: a page's tokens can live in a companion sheet. */
function companions() {
  const together = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name)) {
        const sheets = [...read(rel).matchAll(/^import ['"]([^'"]+\.css)['"]/gm)].map(([, spec]) =>
          spec.startsWith('@/') ? spec.slice(2) : path.posix.join(path.posix.dirname(rel), spec),
        );
        for (const a of sheets) for (const b of sheets) if (a !== b) together.set(a, new Set([...(together.get(a) ?? []), b]));
      }
    }
  };
  walk('app');
  walk('components');
  return together;
}

const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\([^()]*\)|(?<![\w-])(?:white|black)(?![\w-])/g;
const DARK_RULE = /^\s*(\.dark|:root\.dark|html\.dark)(?![\w-])/;
const WORKBENCH_DARK = /\[data-theme=['"]?dark/;
const norm = (sel) => sel.trim().replace(/\s+/g, ' ');
const unprefix = (sel) => norm(sel).replace(/^\.dark /, '');
const topLevel = (value, sep = ',') => {
  const out = [''];
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && !depth) out.push('');
    else out[out.length - 1] += ch;
  }
  return out.map((part) => part.trim());
};
const toLab = ({ L, C, H }) => [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];
const over = (top, under) => top.rgb.map((v, i) => v * top.alpha + under[i] * (1 - top.alpha));

/** A resolved colour value → {rgb, alpha}; null for images, keywords and unknowns. */
function colourOf(value, lookup, depth = 0) {
  if (!value || depth > 12) return null;
  let v = value.trim();
  if (/var\(/.test(v)) {
    const m = /var\((--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/.exec(v);
    const next = lookup(m[1]) ?? m[2];
    return next === undefined ? null : colourOf(v.replace(m[0], next), lookup, depth + 1);
  }
  // A background's base colour is its last layer, unless a gradient above it paints solid
  // colour (a navy dot inside a green ring): then where the text sits is unknown.
  const layers = topLevel(v);
  if (layers.slice(0, -1).some((layer) => (layer.match(LITERAL) ?? []).some((c) => parseColor(c)?.alpha >= 0.35)))
    return null;
  v = layers.at(-1);
  if (v === 'transparent') return { rgb: [0, 0, 0], alpha: 0 };
  const mix = /^color-mix\(in [\w-]+(?: \w+ hue)?,\s*(.*)\)$/s.exec(v);
  if (mix) {
    const parts = topLevel(mix[1]).map((part) => {
      const [, c, p] = /^(.*?)(?:\s+([\d.]+)%)?$/s.exec(part);
      return { c: colourOf(c, lookup, depth + 1), p: p === undefined ? undefined : p / 100 };
    });
    if (parts.length !== 2 || parts.some((x) => !x.c)) return null;
    const [a, b] = parts;
    const pa = a.p ?? (b.p === undefined ? 0.5 : 1 - b.p);
    if (b.c.alpha === 0) return { rgb: a.c.rgb, alpha: a.c.alpha * pa };
    if (a.c.alpha === 0) return { rgb: b.c.rgb, alpha: b.c.alpha * (1 - pa) };
    const [la, lb] = [toLab(rgbToOklch(a.c.rgb)), toLab(rgbToOklch(b.c.rgb))];
    const [L, A, B] = la.map((x, i) => x * pa + lb[i] * (1 - pa));
    const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
    return { rgb: oklchToRgb({ L, C: Math.hypot(A, B), H }), alpha: a.c.alpha * pa + b.c.alpha * (1 - pa) };
  }
  return parseColor(v);
}

test('every dark text colour clears 4.5:1 on the surface behind it', () => {
  const sheets = themedFiles(root);
  const theme = postcss.parse(read('app/theme.css'));
  const together = companions();
  // Custom properties per sheet: generated dark values, light values, and the editor's own
  // data-theme='dark' scope (which keeps its hand-set values).
  const vars = new Map();
  const define = (map, d) => map.has(d.prop) || map.set(d.prop, d.value);
  for (const file of [...sheets, 'app/theme.css']) {
    const [light, block = ''] = read(file).split(START);
    const v = { dark: new Map(), light: new Map(), scoped: new Map(), root: new Map() };
    postcss.parse(block.replace(END, '')).walkDecls(/^--/, (d) =>
      (WORKBENCH_DARK.test(d.parent.selector) ? v.scoped : v.dark).set(d.prop, d.value),
    );
    postcss.parse(light).walkDecls(/^--/, (d) => {
      const sel = d.parent.selector ?? '';
      if (WORKBENCH_DARK.test(sel)) define(v.scoped, d);
      else if (file === 'app/theme.css' && /^:root\.dark$/.test(sel)) define(v.root, d);
      else if (DARK_RULE.test(sel)) v.dark.set(d.prop, d.value);
      else define(v.light, d);
    });
    vars.set(file, v);
  }
  const themeVars = vars.get('app/theme.css');
  const lookupFor = (file, workbench) => {
    const own = vars.get(file);
    const near = [...(together.get(file) ?? [])].map((f) => vars.get(f)).filter(Boolean);
    const chain = [
      ...(workbench ? [own, ...near].map((v) => v.scoped) : []),
      own.dark,
      themeVars.dark,
      own.light,
      ...near.flatMap((v) => [v.dark, v.light]),
      themeVars.root,
      ...[...vars.values()].flatMap((v) => [v.dark, v.light]),
    ];
    return (name) => chain.find((map) => map.has(name))?.get(name);
  };

  // Every dark rule's text and background, by selector (app/theme.css last, so it wins).
  const text = new Map();
  const fill = new Map();
  const grounds = new Map();
  for (const file of [...sheets, 'app/theme.css']) {
    const css = read(file);
    const ast = file === 'app/theme.css' ? theme : postcss.parse((css.split(START)[1] ?? '').replace(END, ''));
    ast.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
      const get = (prop) => rule.nodes.findLast((n) => n.type === 'decl' && n.prop === prop)?.value;
      const fg = get('color');
      const bg = get('background') ?? get('background-color');
      for (const sel of rule.selectors.filter((s) => DARK_RULE.test(s))) {
        const lookup = lookupFor(file, WORKBENCH_DARK.test(sel));
        const key = norm(sel);
        if (fg) text.set(key, { file, value: fg, lookup });
        if (bg === undefined) continue;
        const c = colourOf(bg, lookup);
        fill.set(key, c);
        const bare = unprefix(sel);
        if (c?.alpha >= 0.99 && !bare.includes(':')) grounds.set(contexts(bare).self[0], c.rgb);
      }
    });
  }

  const card = parseColor(themeVars.root.get('--card')).rgb;
  const failures = [];
  let pairs = 0;
  for (const [sel, { file, value, lookup }] of text) {
    const fg = colourOf(value, lookup);
    if (!fg || fg.alpha < 0.05) continue;
    const own = fill.get(sel);
    if (own === null) continue; // an image or gradient: nothing to measure against
    const { self, above } = contexts(unprefix(sel));
    const ground = [...self, ...above].map((c) => grounds.get(c)).find(Boolean) ?? card;
    const bg = own && own.alpha > 0 ? over(own, ground) : ground;
    const ratio = contrast(fg.alpha < 1 ? over(fg, bg) : fg.rgb, bg);
    pairs++;
    if (ratio < 4.5) failures.push(`${ratio.toFixed(2)} ${file} ${sel} (${value})`);
  }
  assert.ok(pairs >= 1000, `checked ${pairs} pairs`);
  assert.equal(failures.length, 0, `dark text under 4.5:1:\n  ${failures.join('\n  ')}`);
});
