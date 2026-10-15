import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

test('topic tags start hidden and the keymap starts default; junk falls back', async () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
  const { readEditorSettings, settingsKey } = await import(
    '../lib/editor-settings'
  );
  assert.equal(readEditorSettings('u').hideTags, true);
  assert.equal(readEditorSettings('u').keymap, 'default');
  store.set(settingsKey('u'), JSON.stringify({ hideTags: false, keymap: 'vim' }));
  assert.equal(readEditorSettings('u').hideTags, false);
  assert.equal(readEditorSettings('u').keymap, 'vim');
  store.set(settingsKey('u'), JSON.stringify({ hideTags: 0, keymap: 'emacs' }));
  assert.equal(readEditorSettings('u').hideTags, true);
  assert.equal(readEditorSettings('u').keymap, 'emacs');
  store.set(settingsKey('u'), JSON.stringify({ keymap: 'sublime' }));
  assert.equal(readEditorSettings('u').keymap, 'default');
});

test('the editor follows the site theme until the reader picks one', async () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
  let dark = true;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { documentElement: { classList: { contains: () => dark } } },
  });
  const { readEditorSettings, writeEditorSettings } = await import(
    '../lib/editor-settings'
  );
  try {
    // Saving an unrelated setting on a dark site doesn't pin the editor dark.
    writeEditorSettings('u', { ...readEditorSettings('u'), fontSize: 16 });
    dark = false;
    assert.equal(readEditorSettings('u').theme, 'light');
    assert.equal(readEditorSettings('u').fontSize, 16);
    // A real pick sticks, through later saves and site switches.
    writeEditorSettings('u', { ...readEditorSettings('u'), theme: 'dark' });
    writeEditorSettings('u', { ...readEditorSettings('u'), hideTags: false });
    assert.equal(readEditorSettings('u').theme, 'dark');
  } finally {
    Reflect.deleteProperty(globalThis, 'document');
  }
});

test('vendored monaco-vim imports the Monaco build the editor already loads', () => {
  const vim = readFileSync(
    new URL('../components/vendor/monaco-vim/index.js', import.meta.url),
    'utf8',
  );
  const client = readFileSync(
    new URL('../components/monaco-client.ts', import.meta.url),
    'utf8',
  );
  const imports = [...vim.matchAll(/^import \{([^}]+)\} from "([^"]+)";$/gm)];
  assert.deepEqual(
    imports.map((m) => m[2]),
    [
      'monaco-editor/editor/editor.api.js',
      'monaco-editor/editor/common/commands/shiftCommand.js',
    ],
  );
  // One Monaco instance: the same specifier monaco-client.ts imports.
  assert.equal(client.includes(`from '${imports[0][2]}'`), true);
  // An upgrade that moves or renames these breaks Vim mode: fail here instead.
  const require = createRequire(import.meta.url);
  for (const [, names, specifier] of imports) {
    const source = readFileSync(require.resolve(specifier), 'utf8');
    const exported = /export \{([^}]+)\};?\s*$/m.exec(source)?.[1] ?? '';
    for (const name of names.split(',').map((n) => n.trim()))
      assert.equal(
        exported.split(',').some((n) => n.trim() === name),
        true,
        `${specifier} exports ${name}`,
      );
  }
});

test('vendored monaco-emacs shares that Monaco build and needs no lodash', () => {
  const emacs = readFileSync(
    new URL('../components/vendor/monaco-emacs/index.js', import.meta.url),
    'utf8',
  );
  const specifiers = new Set(
    [...emacs.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]),
  );
  assert.deepEqual([...specifiers], ['monaco-editor/editor/editor.api.js']);
  assert.equal(/require\(|lodash/.test(emacs.replace(/^\/\/.*$/gm, '')), false);
  // Off Apple devices the site's Ctrl+S yields to isearch, and C-x C-s saves instead.
  const editor = readFileSync(new URL('../components/editor.tsx', import.meta.url), 'utf8');
  assert.match(editor, /keybindingContext: \/Mac\|iP\/\.test\(navigator\.platform\)\s*\? undefined\s*: '!cswork\.emacs'/);
  assert.match(editor, /registerGlobalCommand\('C-x C-s'[\s\S]*?getAction\('cswork\.save'\)/);
  assert.match(emacs, /^  registerGlobalCommand,$/m);
});
