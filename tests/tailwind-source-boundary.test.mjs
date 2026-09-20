import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

test('Tailwind scans UI sources but never judge fixtures or reference programs', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'cswork-tailwind-source-'));
  try {
    for (const directory of ['app', 'components', 'hooks', 'lib', 'content/oa-judge/packages', 'scripts'])
      mkdirSync(join(fixture, directory), { recursive: true });
    symlinkSync(resolve('node_modules'), join(fixture, 'node_modules'), 'dir');
    writeFileSync(join(fixture, 'app/page.tsx'), '<main className="p-[137px]" />');
    writeFileSync(join(fixture, 'components/card.tsx'), '<div className="text-[141px]" />');
    writeFileSync(join(fixture, 'hooks/styles.ts'), 'export const classes = "gap-[143px]";');
    writeFileSync(join(fixture, 'lib/styles.ts'), 'export const classes = "rounded-[149px]";');
    writeFileSync(join(fixture, 'content/oa-judge/packages/example.json'), '{"input":"m-[139px]"}');
    writeFileSync(join(fixture, 'scripts/reference.py'), 'example = "w-[151px]"\n');
    const css = readFileSync(resolve('app/globals.css'), 'utf8');
    const from = join(fixture, 'app/globals.css');
    writeFileSync(from, css);
    const result = await postcss([tailwind({ base: fixture, optimize: false })]).process(css, { from });
    for (const [property, size] of [['padding', 137], ['font-size', 141], ['gap', 143], ['border-radius', 149]])
      assert.match(result.css, new RegExp(`${property}:\\s*${size}px`), 'Missing UI source: ' + property);
    assert.doesNotMatch(result.css, /margin:\s*139px|width:\s*151px/, 'Judge data must not generate UI utilities');
    const dependencies = result.messages.filter(message => message.type === 'dependency').map(message => message.file);
    assert(!dependencies.some(file => file.includes('oa-judge/packages') || file.endsWith('reference.py')),
      'Large judge data must not enter the frontend dependency graph');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
