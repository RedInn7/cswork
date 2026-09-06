import type * as Monaco from 'monaco-editor/editor/editor.api.js';
import type {
  CompletionItem,
  CompletionList,
  Hover,
  SignatureHelp,
} from 'vscode-languageserver-protocol';
import type { Language } from '@/lib/problems';
import type {
  IntelligenceAction,
  IntelligenceResponse,
  IntelligenceStatus,
} from '@/lib/editor-intelligence';
import {
  completion,
  hover,
  signature,
  markers,
} from '@/lib/editor-lsp-adapter';

type Runtime = typeof Monaco;
type Connection = {
  request: (
    action: IntelligenceAction,
    position?: Monaco.Position,
    token?: Monaco.CancellationToken,
  ) => Promise<IntelligenceResponse | null>;
};
const connections = new WeakMap<Monaco.editor.ITextModel, Connection>();
let registered = false;

function register(monaco: Runtime) {
  if (registered) return;
  registered = true;
  for (const language of ['python', 'go', 'cpp', 'java']) {
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['.', ':', '>'],
      async provideCompletionItems(model, position, _context, token) {
        const response = await connections
          .get(model)
          ?.request('completion', position, token);
        return response
          ? completion(
              monaco,
              model,
              position,
              response.result as CompletionItem[] | CompletionList | null,
            )
          : { suggestions: [] };
      },
    });
    monaco.languages.registerHoverProvider(language, {
      async provideHover(model, position, token) {
        const response = await connections
          .get(model)
          ?.request('hover', position, token);
        return response ? hover(response.result as Hover | null) : null;
      },
    });
    monaco.languages.registerSignatureHelpProvider(language, {
      signatureHelpTriggerCharacters: ['(', ','],
      signatureHelpRetriggerCharacters: [')'],
      async provideSignatureHelp(model, position, token) {
        const response = await connections
          .get(model)
          ?.request('signature', position, token);
        return response
          ? signature(response.result as SignatureHelp | null)
          : null;
      },
    });
  }
}

export function attachIntelligence(
  monaco: Runtime,
  model: Monaco.editor.ITextModel,
  problemId: string,
  language: Language,
  status: (value: IntelligenceStatus) => void,
): Monaco.IDisposable {
  register(monaco);
  const identity = { problemId, language, documentId: crypto.randomUUID() };
  let disposed = false;
  let started = false;
  let timer: ReturnType<typeof setTimeout>;
  let diagnosticRetries = 0;
  // Serialize document updates so older requests cannot overwrite newer code.
  let queue: Promise<unknown> = Promise.resolve();
  const controllers = new Set<AbortController>();
  const connection: Connection = {
    request(action, position, token) {
      const version = model.getVersionId();
      const code = model.getValue();
      const work = async (): Promise<IntelligenceResponse | null> => {
        if (
          disposed ||
          token?.isCancellationRequested ||
          model.isDisposed() ||
          model.getVersionId() !== version
        )
          return null;
        if (new TextEncoder().encode(code).length > 65536) return null;
        const controller = new AbortController();
        controllers.add(controller);
        const cancel = token?.onCancellationRequested(() => controller.abort());
        if (!started)
          status({ state: 'starting', message: '正在启动语言服务…' });
        try {
          const response = await fetch('/api/oj/intelligence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...identity,
              code,
              version,
              action,
              ...(position
                ? {
                    position: {
                      line: position.lineNumber - 1,
                      character: position.column - 1,
                    },
                  }
                : {}),
            }),
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(65000),
            ]),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || '语言服务暂不可用');
          if (
            disposed ||
            model.isDisposed() ||
            token?.isCancellationRequested ||
            result.version !== model.getVersionId() ||
            result.language !== language
          )
            return null;
          started = true;
          status({
            state: 'ready',
            message:
              language === 'java'
                ? '智能补全已就绪 · 错误检查请运行'
                : '智能补全已就绪',
          });
          monaco.editor.setModelMarkers(
            model,
            'cswork-lsp',
            markers(
              monaco,
              result.diagnosticsVersion === version
                ? result.diagnostics || []
                : [],
            ),
          );
          if (
            action === 'diagnostics' &&
            result.diagnosticsVersion !== version &&
            diagnosticRetries++ < 3
          ) {
            clearTimeout(timer);
            timer = setTimeout(() => {
              if (
                !disposed &&
                !model.isDisposed() &&
                model.getVersionId() === version
              )
                void connection.request('diagnostics');
            }, 1500);
          }
          return result as IntelligenceResponse;
        } catch (error) {
          if (
            !disposed &&
            !controller.signal.aborted &&
            !model.isDisposed() &&
            model.getVersionId() === version
          )
            status({
              state: 'unavailable',
              message:
                error instanceof Error ? error.message : '语言服务暂不可用',
            });
          return null;
        } finally {
          controllers.delete(controller);
          cancel?.dispose();
        }
      };
      const result = queue.then(work, work);
      queue = result;
      return result;
    },
  };
  connections.set(model, connection);
  const schedule = () => {
    clearTimeout(timer);
    diagnosticRetries = 0;
    monaco.editor.setModelMarkers(model, 'cswork-lsp', []);
    timer = setTimeout(() => {
      void connection.request('diagnostics');
    }, 700);
  };
  const changed = model.onDidChangeContent(schedule);
  schedule();
  return {
    dispose() {
      disposed = true;
      clearTimeout(timer);
      changed.dispose();
      connections.delete(model);
      for (const controller of controllers) controller.abort();
      if (!model.isDisposed())
        monaco.editor.setModelMarkers(model, 'cswork-lsp', []);
      // Best effort; the broker also enforces an idle TTL when a tab disappears.
      void fetch('/api/oj/intelligence/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(identity),
        keepalive: true,
      }).catch(() => {});
    },
  };
}
