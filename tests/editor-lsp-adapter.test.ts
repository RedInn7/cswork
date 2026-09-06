import assert from 'node:assert/strict';
import test from 'node:test';
import type * as Monaco from 'monaco-editor/editor/editor.api.js';
import {
  completion,
  hover,
  markers,
  signature,
  type MonacoRuntime,
} from '../lib/editor-lsp-adapter';

// Deliberately use values unlike LSP enums; loading Monaco at runtime would require a browser.
const runtime = {
  languages: {
    CompletionItemKind: { Text: 90, Function: 91, Method: 92, Struct: 93 },
    CompletionItemInsertTextRule: { InsertAsSnippet: 4, KeepWhitespace: 1 },
    CompletionItemTag: { Deprecated: 1 },
  },
  MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
  MarkerTag: { Unnecessary: 1, Deprecated: 2 },
} as unknown as MonacoRuntime;
const model = {
  getWordUntilPosition: () => ({ word: 'sq', startColumn: 6, endColumn: 8 }),
} as unknown as Monaco.editor.ITextModel;
const position = { lineNumber: 2, column: 8 };
const lspRange = {
  start: { line: 1, character: 5 },
  end: { line: 1, character: 7 },
};
const expectedRange = {
  startLineNumber: 2,
  startColumn: 6,
  endLineNumber: 2,
  endColumn: 8,
};

void test('completion preserves UTF-16 columns, snippets and same-document import edits without commands', () => {
  const [item] = completion(runtime, model, position, [
    {
      label: 'sqrt',
      kind: 3,
      insertTextFormat: 2,
      textEdit: { range: lspRange, newText: 'sqrt(${1:x})' },
      additionalTextEdits: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
          newText: 'import math\n',
        },
      ],
      command: {
        title: 'unsafe',
        command: 'executeCommand',
        arguments: ['rm'],
      },
      documentation: {
        kind: 'markdown',
        value: '[run](command:unsafe)<script>unsafe</script>',
      },
    },
  ]).suggestions;
  assert.equal(item.kind, 91);
  assert.deepEqual(item.range, expectedRange);
  assert.equal(item.insertText, 'sqrt(${1:x})');
  assert.equal(item.insertTextRules, 4);
  assert.equal(item.additionalTextEdits?.[0].text, 'import math\n');
  assert.equal('command' in item, false);
  assert.deepEqual(item.documentation, {
    value: '[run](command:unsafe)<script>unsafe</script>',
    isTrusted: false,
    supportHtml: false,
  });
});

void test('completion inherits list defaults and gives explicit item edits precedence', () => {
  const replace = { ...lspRange, end: { line: 1, character: 9 } };
  const value = completion(runtime, model, position, {
    isIncomplete: true,
    itemDefaults: {
      editRange: { insert: lspRange, replace },
      insertTextFormat: 2,
      insertTextMode: 1,
      commitCharacters: ['.'],
    },
    items: [
      { label: 'struct', kind: 22, textEditText: 'struct ${1:Name}' },
      {
        label: 'explicit',
        insertTextFormat: 1,
        textEdit: { range: lspRange, newText: 'actual' },
      },
    ],
  });
  assert.equal(value.incomplete, true);
  assert.equal(value.suggestions[0].kind, 93);
  assert.equal(value.suggestions[0].insertTextRules, 5);
  assert.equal(value.suggestions[0].insertText, 'struct ${1:Name}');
  assert.deepEqual(value.suggestions[0].range, {
    insert: expectedRange,
    replace: { ...expectedRange, endColumn: 10 },
  });
  assert.deepEqual(value.suggestions[0].commitCharacters, ['.']);
  assert.equal(value.suggestions[1].insertText, 'actual');
  assert.deepEqual(value.suggestions[1].range, expectedRange);
});

void test('insert/replace edit and word fallback work without list defaults', () => {
  const value = completion(runtime, model, position, [
    {
      label: 'f',
      textEdit: { insert: lspRange, replace: lspRange, newText: 'f()' },
    },
    { label: 'fallback' },
  ]);
  assert.deepEqual(value.suggestions[0].range, {
    insert: expectedRange,
    replace: expectedRange,
  });
  assert.deepEqual(value.suggestions[1].range, expectedRange);
  assert.equal(value.suggestions[1].insertText, 'fallback');
  assert.deepEqual(completion(runtime, model, position, null), {
    suggestions: [],
  });
});

void test('hover treats server Markdown as untrusted and prevents language/code fence breakout', () => {
  const value = hover({
    contents: [
      { language: 'python\n```\n[run](command:unsafe)', value: '```\ncode' },
      '[run](command:unsafe)',
    ],
    range: lspRange,
  });
  assert.deepEqual(value?.range, expectedRange);
  assert.equal(value?.contents[0].value, '````\n```\ncode\n````');
  for (const content of value!.contents) {
    assert.equal(content.isTrusted, false);
    assert.equal(content.supportHtml, false);
  }
  assert.equal(
    hover({ contents: { kind: 'plaintext', value: '[run](command:unsafe)' } })
      ?.contents[0].value,
    '\\[run\\]\\(command:unsafe\\)',
  );
  assert.equal(hover(null), null);
});

void test('signature preserves parameter offsets, supports per-signature active parameter and safe docs', () => {
  const result = signature({
    signatures: [
      {
        label: 'f(x, y)',
        activeParameter: 1,
        parameters: [
          { label: [2, 3] },
          { label: 'y', documentation: { kind: 'markdown', value: '**y**' } },
        ],
      },
    ],
    activeSignature: 99,
    activeParameter: 0,
  });
  assert.equal(result?.value.activeSignature, 0);
  assert.equal(result?.value.activeParameter, 1);
  assert.deepEqual(result?.value.signatures[0].parameters[0].label, [2, 3]);
  assert.deepEqual(result?.value.signatures[0].parameters[1].documentation, {
    value: '**y**',
    isTrusted: false,
    supportHtml: false,
  });
  result?.dispose();
  assert.equal(signature({ signatures: [] }), null);
});

void test('diagnostics map severities and ranges without exposing workspace URIs', () => {
  const values = markers(
    runtime,
    [1, 2, 3, 4].map((severity) => ({
      range: lspRange,
      message: 'bad type',
      severity,
      source: 'pyright',
      code: 123,
      tags: [1, 2],
      codeDescription: { href: 'file:///private/workspace' },
      relatedInformation: [
        {
          location: { uri: 'file:///private/workspace', range: lspRange },
          message: 'related',
        },
      ],
    })) as Parameters<typeof markers>[1],
  );
  assert.deepEqual(
    values.map((v) => v.severity),
    [8, 4, 2, 1],
  );
  assert.deepEqual(values[0], {
    ...expectedRange,
    message: 'bad type',
    source: 'pyright',
    code: '123',
    severity: 8,
    tags: [1, 2],
  });
});
