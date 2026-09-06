import type * as Monaco from 'monaco-editor/editor/editor.api.js';
import type {
  CompletionItem,
  CompletionList,
  Diagnostic,
  Hover,
  MarkupContent,
  Range,
  SignatureHelp,
} from 'vscode-languageserver-protocol';

export type MonacoRuntime = typeof Monaco;

function range(value: Range): Monaco.IRange {
  // LSP and Monaco both measure columns in UTF-16 code units.
  return {
    startLineNumber: value.start.line + 1,
    startColumn: value.start.character + 1,
    endLineNumber: value.end.line + 1,
    endColumn: value.end.character + 1,
  };
}

function markdown(value: string): Monaco.IMarkdownString {
  return { value, isTrusted: false, supportHtml: false };
}

function plain(value: string): string {
  return value.replace(/[\\`*_{}[\]()<>#+.!|~-]/g, '\\$&');
}

function documentation(
  value: string | MarkupContent | undefined,
): string | Monaco.IMarkdownString | undefined {
  if (typeof value === 'string' || value === undefined) return value;
  return markdown(
    value.kind === 'plaintext' ? plain(value.value) : value.value,
  );
}

const kindNames = [
  'Text',
  'Method',
  'Function',
  'Constructor',
  'Field',
  'Variable',
  'Class',
  'Interface',
  'Module',
  'Property',
  'Unit',
  'Value',
  'Enum',
  'Keyword',
  'Snippet',
  'Color',
  'File',
  'Reference',
  'Folder',
  'EnumMember',
  'Constant',
  'Struct',
  'Event',
  'Operator',
  'TypeParameter',
] as const;

export function completion(
  monaco: MonacoRuntime,
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition,
  result: CompletionItem[] | CompletionList | null,
): Monaco.languages.CompletionList {
  if (!result) return { suggestions: [] };
  const list: CompletionList = Array.isArray(result)
    ? { items: result, isIncomplete: false }
    : result;
  const defaults = list.itemDefaults;
  const word = model.getWordUntilPosition(position);
  const fallback: Monaco.IRange = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
  return {
    incomplete: list.isIncomplete,
    suggestions: list.items.map((item) => {
      const edit = item.textEdit;
      const editRange =
        edit && 'range' in edit
          ? edit.range
          : edit && 'insert' in edit
            ? { insert: edit.insert, replace: edit.replace }
            : defaults?.editRange;
      const itemRange = editRange
        ? 'insert' in editRange
          ? {
              insert: range(editRange.insert),
              replace: range(editRange.replace),
            }
          : range(editRange)
        : fallback;
      const format = item.insertTextFormat ?? defaults?.insertTextFormat;
      const mode = item.insertTextMode ?? defaults?.insertTextMode;
      const kind = kindNames[(item.kind ?? 1) - 1] ?? 'Text';
      return {
        label: item.labelDetails
          ? { label: item.label, ...item.labelDetails }
          : item.label,
        kind: monaco.languages.CompletionItemKind[kind],
        range: itemRange,
        insertText:
          edit?.newText ??
          (defaults?.editRange ? item.textEditText : undefined) ??
          item.insertText ??
          item.label,
        insertTextRules:
          (format === 2
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : 0) |
          (mode === 1
            ? monaco.languages.CompletionItemInsertTextRule.KeepWhitespace
            : 0),
        detail: item.detail,
        documentation: documentation(item.documentation),
        filterText: item.filterText,
        sortText: item.sortText,
        preselect: item.preselect,
        commitCharacters: item.commitCharacters ?? defaults?.commitCharacters,
        tags:
          // eslint-disable-next-line typescript/no-deprecated -- Older language servers still send the legacy LSP deprecated flag.
          item.deprecated || item.tags?.includes(1)
            ? [monaco.languages.CompletionItemTag.Deprecated]
            : undefined,
        additionalTextEdits: item.additionalTextEdits?.map((extra) => ({
          range: range(extra.range),
          text: extra.newText,
        })),
        // Server commands and arbitrary workspace edits must never run on acceptance.
      };
    }),
  };
}

export function hover(result: Hover | null): Monaco.languages.Hover | null {
  if (!result) return null;
  const values = Array.isArray(result.contents)
    ? result.contents
    : [result.contents];
  const contents = values.map((value) => {
    if (typeof value === 'string') return markdown(value);
    if ('kind' in value)
      return markdown(
        value.kind === 'plaintext' ? plain(value.value) : value.value,
      );
    // Language labels cannot break out of the code fence; code may itself contain fences.
    const language = /^[a-zA-Z0-9_+-]+$/.test(value.language)
      ? value.language
      : '';
    const longest = Math.max(
      2,
      ...(value.value.match(/`+/g) ?? []).map((run) => run.length),
    );
    const fence = '`'.repeat(longest + 1);
    return markdown(`${fence}${language}\n${value.value}\n${fence}`);
  });
  return { contents, ...(result.range ? { range: range(result.range) } : {}) };
}

export function signature(
  result: SignatureHelp | null,
): Monaco.languages.SignatureHelpResult | null {
  if (!result || result.signatures.length === 0) return null;
  const activeSignature = Math.min(
    Math.max(0, result.activeSignature ?? 0),
    result.signatures.length - 1,
  );
  const selected = result.signatures[activeSignature];
  const activeParameter = Math.min(
    Math.max(0, selected.activeParameter ?? result.activeParameter ?? 0),
    Math.max(0, (selected.parameters?.length ?? 0) - 1),
  );
  return {
    value: {
      activeSignature,
      activeParameter,
      signatures: result.signatures.map((value) => ({
        label: value.label,
        documentation: documentation(value.documentation),
        activeParameter: value.activeParameter,
        parameters: (value.parameters ?? []).map((parameter) => ({
          label: parameter.label,
          documentation: documentation(parameter.documentation),
        })),
      })),
    },
    dispose() {},
  };
}

export function markers(
  monaco: MonacoRuntime,
  diagnostics: Diagnostic[],
): Monaco.editor.IMarkerData[] {
  const severity = [
    monaco.MarkerSeverity.Error,
    monaco.MarkerSeverity.Warning,
    monaco.MarkerSeverity.Info,
    monaco.MarkerSeverity.Hint,
  ];
  return diagnostics.map((value) => ({
    ...range(value.range),
    message: value.message,
    source: value.source,
    code: value.code === undefined ? undefined : String(value.code),
    severity:
      severity[(value.severity ?? 1) - 1] ?? monaco.MarkerSeverity.Error,
    tags: value.tags?.flatMap((tag) =>
      tag === 1
        ? [monaco.MarkerTag.Unnecessary]
        : tag === 2
          ? [monaco.MarkerTag.Deprecated]
          : [],
    ),
    // Ignore related file URIs and codeDescription links from isolated server workspaces.
  }));
}
