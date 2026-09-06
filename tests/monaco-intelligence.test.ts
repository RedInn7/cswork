import assert from 'node:assert/strict';
import test from 'node:test';
import type * as Monaco from 'monaco-editor/editor/editor.api.js';
import { attachIntelligence } from '../components/monaco-intelligence';

void test('language providers discard stale/cancelled results and isolate documents across disposal', async () => {
  const providers = new Map<string, Monaco.languages.CompletionItemProvider>();
  const markers: Array<{ model: unknown; values: unknown[] }> = [];
  const runtime = {
    languages: {
      registerCompletionItemProvider: (
        language: string,
        provider: Monaco.languages.CompletionItemProvider,
      ) => providers.set(language, provider),
      registerHoverProvider() {},
      registerSignatureHelpProvider() {},
      CompletionItemKind: { Text: 18, Function: 1 },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4, KeepWhitespace: 1 },
    },
    MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
    editor: {
      setModelMarkers: (model: unknown, _owner: string, values: unknown[]) =>
        markers.push({ model, values }),
    },
  } as unknown as typeof Monaco;
  function fakeModel() {
    let version = 1;
    let code = 'math.';
    let listener: (() => void) | undefined;
    const model = {
      getVersionId: () => version,
      getValue: () => code,
      isDisposed: () => false,
      getWordUntilPosition: () => ({ word: '', startColumn: 6, endColumn: 6 }),
      onDidChangeContent: (callback: () => void) => {
        listener = callback;
        return {
          dispose: () => {
            listener = undefined;
          },
        };
      },
    } as unknown as Monaco.editor.ITextModel;
    return {
      model,
      change() {
        version++;
        code += 's';
        listener?.();
      },
    };
  }
  type Pending = {
    body: {
      version: number;
      language: string;
      documentId: string;
      action: string;
    };
    resolve: (response: Response) => void;
    signal?: AbortSignal;
  };
  const pending: Pending[] = [];
  const closes: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    if (_url.endsWith('/close')) {
      closes.push(body.documentId);
      return Promise.resolve(Response.json({ closed: true }));
    }
    return new Promise<Response>((resolve, reject) => {
      init.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('aborted', 'AbortError')),
        { once: true },
      );
      pending.push({ body, resolve, signal: init.signal ?? undefined });
    });
  }) as typeof fetch;
  const current = fakeModel();
  const statuses: string[] = [];
  const attached = attachIntelligence(
    runtime,
    current.model,
    'problem',
    'python',
    (status) => statuses.push(status.state),
  );
  let replacement: Monaco.IDisposable | undefined;
  try {
    assert.equal(providers.size, 4);
    const provider = providers.get('python')!;
    const token = {
      isCancellationRequested: false,
      onCancellationRequested: () => ({ dispose() {} }),
    } as unknown as Monaco.CancellationToken;
    const position = { lineNumber: 1, column: 6 } as Monaco.Position;
    const context = { triggerKind: 0 } as Monaco.languages.CompletionContext;
    const stale = provider.provideCompletionItems(
      current.model,
      position,
      context,
      token,
    );
    await Promise.resolve();
    assert.equal(pending.length, 1);
    current.change();
    const fresh = provider.provideCompletionItems(
      current.model,
      position,
      context,
      token,
    );
    const reply = (request: Pending) =>
      request.resolve(
        Response.json({
          ...request.body,
          result: [{ label: 'sqrt', kind: 3 }],
          diagnosticsVersion: request.body.version,
          diagnostics: [],
        }),
      );
    reply(pending[0]);
    assert.deepEqual(await stale, { suggestions: [] });
    await Promise.resolve();
    assert.equal(pending.length, 2);
    reply(pending[1]);
    assert.equal((await fresh)?.suggestions[0].label, 'sqrt');
    assert.equal(statuses.at(-1), 'ready');

    let cancelCallback = () => {};
    const cancelledToken = {
      isCancellationRequested: false,
      onCancellationRequested: (callback: () => void) => {
        cancelCallback = callback;
        return { dispose() {} };
      },
    };
    const cancelled = provider.provideCompletionItems(
      current.model,
      position,
      context,
      cancelledToken,
    );
    await Promise.resolve();
    cancelledToken.isCancellationRequested = true;
    cancelCallback();
    assert.deepEqual(await cancelled, { suggestions: [] });
    assert.equal(
      statuses.at(-1),
      'ready',
      'cancellation must not report an outage',
    );

    const inflight = provider.provideCompletionItems(
      current.model,
      position,
      context,
      token,
    );
    await Promise.resolve();
    attached.dispose();
    assert.deepEqual(await inflight, { suggestions: [] });
    assert.equal(closes[0], pending[0].body.documentId);
    assert.deepEqual(
      await provider.provideCompletionItems(
        current.model,
        position,
        context,
        token,
      ),
      { suggestions: [] },
    );
    const next = fakeModel();
    replacement = attachIntelligence(
      runtime,
      next.model,
      'problem',
      'python',
      () => {},
    );
    const nextResult = provider.provideCompletionItems(
      next.model,
      position,
      context,
      token,
    );
    await Promise.resolve();
    assert.notEqual(
      pending.at(-1)?.body.documentId,
      pending[0].body.documentId,
    );
    reply(pending.at(-1)!);
    assert.equal((await nextResult)?.suggestions[0].label, 'sqrt');
    assert.deepEqual(markers.at(-1)?.values, []);
  } finally {
    attached.dispose();
    replacement?.dispose();
    globalThis.fetch = originalFetch;
  }
});
