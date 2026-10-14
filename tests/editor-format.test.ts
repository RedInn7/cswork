import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pythonFormatArguments,
  safeResult,
  validateRequest,
  wholeDocumentEdit,
} from '../scripts/language-service/protocol.mjs';
import { LanguageSession } from '../scripts/language-service/broker.mjs';
import { ConnectionError, ConnectionErrors, ResponseError } from 'vscode-jsonrpc/node.js';
import { textEdits } from '../lib/editor-lsp-adapter';

const format = {
  ownerId: 'student-a',
  documentId: 'lc-1:tab-1',
  language: 'go',
  code: 'package main\nfunc main(){}\n',
  version: 1,
  action: 'format',
};

void test('format is a whole-document action with an optional 2/4 tab size', () => {
  assert.doesNotThrow(() => validateRequest(format));
  assert.doesNotThrow(() => validateRequest({ ...format, tabSize: 2 }));
  for (const patch of [{ tabSize: 3 }, { tabSize: '4' }, { action: 'hover', tabSize: 4 }])
    assert.throws(() => validateRequest({ ...format, ...patch }));
});

void test('formatter answers cross the bridge as plain text edits only', () => {
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

void test('ruff runs inside the session container on stdin, and unchanged code needs no edit', () => {
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

function formattingSession(failure: Error, dead = false) {
  const session = {
    language: 'go',
    uri: 'file:///workspace/main.go',
    dead,
    closed: false,
    connection: {
      sendRequest: async (method: string, params: { options: unknown }) => {
        assert.equal(method, 'textDocument/formatting');
        assert.deepEqual(params.options, { tabSize: 4, insertSpaces: true });
        throw failure;
      },
    },
    timed: (promise: Promise<unknown>) => promise,
    close: async () => {
      session.closed = true;
    },
  };
  return session;
}
const statusOf = (session: object) =>
  LanguageSession.prototype.format.call(session, 4).then(
    () => 200,
    (error: { status?: number }) => error.status,
  );

void test('a formatter refusing broken code answers 422 and keeps the session', async () => {
  const session = formattingSession(new ResponseError(-32603, 'gofmt: expected declaration'));
  assert.equal(await statusOf(session), 422);
  assert.equal(session.closed, false);
});

void test('a dropped or closed language server is an outage (503), not a syntax error', async () => {
  assert.equal(
    await statusOf(formattingSession(new ConnectionError(ConnectionErrors.Closed, 'closed'))),
    503,
  );
  assert.equal(await statusOf(formattingSession(new Error('write EPIPE'))), 503);
  // A session that died while the request was out: even its error reply isn't about the code.
  assert.equal(await statusOf(formattingSession(new ResponseError(-32603, 'x'), true)), 503);
});
