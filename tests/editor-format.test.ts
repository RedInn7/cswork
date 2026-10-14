import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pythonFormatArguments,
  safeResult,
  validateRequest,
  wholeDocumentEdit,
} from '../scripts/language-service/protocol.mjs';
import { LanguageSession } from '../scripts/language-service/broker.mjs';
import { textEdits } from '../lib/editor-lsp-adapter';

const format = {
  ownerId: 'student-a',
  documentId: 'lc-1:tab-1',
  language: 'go',
  code: 'package main\nfunc main(){}\n',
  version: 1,
  action: 'format',
};

test('format is a whole-document action with an optional 2/4 tab size', () => {
  assert.doesNotThrow(() => validateRequest(format));
  assert.doesNotThrow(() => validateRequest({ ...format, tabSize: 2 }));
  for (const patch of [{ tabSize: 3 }, { tabSize: '4' }, { action: 'hover', tabSize: 4 }])
    assert.throws(() => validateRequest({ ...format, ...patch }));
});

test('formatter answers cross the bridge as plain text edits only', () => {
  const edit = {
    range: { start: { line: 0, character: 0 }, end: { line: 1, character: 13 } },
    newText: 'func main() {}',
  };
  assert.deepEqual(safeResult('format', [{ ...edit, command: { command: 'evil' } }]), [edit]);
  // One malformed edit drops the answer whole rather than applying part of it.
  assert.deepEqual(safeResult('format', [edit, { range: edit.range, newText: 1 }]), []);
  assert.deepEqual(safeResult('format', null), []);
  assert.deepEqual(textEdits([edit]), [
    {
      range: { startLineNumber: 1, startColumn: 1, endLineNumber: 2, endColumn: 14 },
      text: 'func main() {}',
    },
  ]);
});

test('ruff runs inside the session container on stdin, and unchanged code needs no edit', () => {
  const args = pythonFormatArguments('cswork-lsp-fixed', 2);
  assert.deepEqual(args.slice(0, 5), ['exec', '--interactive', '--user', '10001:10001', 'cswork-lsp-fixed']);
  assert.equal(args.at(-1), '-');
  assert.ok(args.includes('indent-width = 2'));
  assert.throws(() => pythonFormatArguments('cswork-lsp-fixed', 8));
  assert.deepEqual(wholeDocumentEdit('x=1\n', 'x=1\n'), []);
  assert.deepEqual(wholeDocumentEdit('x=1\ny', 'x = 1\ny\n'), [
    {
      range: { start: { line: 0, character: 0 }, end: { line: 1, character: 1 } },
      newText: 'x = 1\ny\n',
    },
  ]);
});

test('a formatter refusing broken code answers 422 and keeps the session', async () => {
  let closed = false;
  const session = {
    language: 'go',
    uri: 'file:///workspace/main.go',
    connection: {
      sendRequest: async (method: string, params: { options: unknown }) => {
        assert.equal(method, 'textDocument/formatting');
        assert.deepEqual(params.options, { tabSize: 4, insertSpaces: true });
        throw new Error('gofmt: expected declaration');
      },
    },
    timed: (promise: Promise<unknown>) => promise,
    close: async () => {
      closed = true;
    },
  };
  await assert.rejects(
    LanguageSession.prototype.format.call(session, 4),
    (error: { status?: number }) => error.status === 422,
  );
  assert.equal(closed, false);
});
