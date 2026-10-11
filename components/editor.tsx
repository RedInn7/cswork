'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  EditorProps,
  DiffEditorProps,
  OnMount,
} from '@monaco-editor/react';
import type { Language } from '@/lib/problems';
import type { IntelligenceStatus } from '@/lib/editor-intelligence';
import { useT } from '@/lib/i18n';
import { attachIntelligence } from './monaco-intelligence';
import {
  defaultEditorSettings,
  type EditorSettings,
} from '@/lib/editor-settings';

type Runtime = typeof import('./monaco-client');
let runtimePromise: Promise<Runtime> | undefined;
function loadRuntime() {
  runtimePromise ??= import('./monaco-client').catch((error) => {
    runtimePromise = undefined;
    throw error;
  });
  return runtimePromise;
}
function useMonacoRuntime() {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    loadRuntime().then(
      (value) => {
        if (active) setRuntime(value);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  return { runtime, error, retry: () => setAttempt((n) => n + 1) };
}
export type CodeEditorProps = {
  value: string;
  language: Language;
  onChange: (code: string) => void;
  settings?: EditorSettings;
  path?: string;
  readOnly?: boolean;
  onRun?: () => void;
  onSubmit?: () => void;
  onSave?: () => void;
  onCursor?: (line: number, column: number) => void;
  problemId?: string;
  onIntelligenceStatus?: (status: IntelligenceStatus) => void;
  onSuggestReady?: (suggest: (() => void) | null) => void;
};
export function CodeEditor({
  value,
  language,
  onChange,
  settings = defaultEditorSettings,
  path,
  readOnly = false,
  onRun,
  onSubmit,
  onSave,
  onCursor,
  problemId,
  onIntelligenceStatus,
  onSuggestReady,
}: CodeEditorProps) {
  const t = useT();
  const { runtime, error, retry } = useMonacoRuntime();
  const callbacks = useRef({ onRun, onSubmit, onSave, onCursor });
  callbacks.current = { onRun, onSubmit, onSave, onCursor };
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const mounted: OnMount = (editor, monaco) => {
    cleanup.current?.();
    const actions = [
      editor.addAction({
        id: 'cswork.run',
        label: t('运行样例 / 自定义输入', 'Run examples / custom input'),
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => callbacks.current.onRun?.(),
      }),
      editor.addAction({
        id: 'cswork.submit',
        label: t('提交全部测试点', 'Submit against all test cases'),
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
        ],
        run: () => callbacks.current.onSubmit?.(),
      }),
      editor.addAction({
        id: 'cswork.save',
        label: t('保存草稿', 'Save draft'),
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => callbacks.current.onSave?.(),
      }),
      editor.onDidChangeCursorPosition((event) => {
        callbacks.current.onCursor?.(
          event.position.lineNumber,
          event.position.column,
        );
      }),
    ];
    const model = editor.getModel();
    if (!readOnly && problemId && model) {
      actions.push(
        attachIntelligence(monaco, model, problemId, language, (status) =>
          onIntelligenceStatus?.(status),
        ),
      );
      onSuggestReady?.(() => {
        editor.focus();
        editor.trigger('cswork', 'editor.action.triggerSuggest', {});
      });
    }
    cleanup.current = () => {
      actions.forEach((action) => action.dispose());
      onSuggestReady?.(null);
    };
  };
  const options: EditorProps['options'] = {
    ariaLabel: readOnly
      ? t('历史提交代码，只读', 'Submitted code, read-only')
      : t('代码编辑器', 'Code editor'),
    automaticLayout: true,
    // Keep keyboard, clipboard and accessibility behavior consistent across browser hosts.
    editContext: false,
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    fontSize: settings.fontSize,
    lineHeight: 1.65,
    tabSize: settings.tabSize,
    insertSpaces: true,
    wordWrap: settings.wordWrap ? 'on' : 'off',
    minimap: { enabled: settings.minimap },
    padding: { top: 16, bottom: 16 },
    scrollBeyondLastLine: false,
    smoothScrolling: false,
    lineNumbersMinChars: 4,
    bracketPairColorization: { enabled: true },
    guides: { indentation: true, bracketPairs: true },
    renderWhitespace: 'selection',
    readOnly,
    contextmenu: true,
    detectIndentation: false,
    accessibilitySupport: 'auto',
    quickSuggestions: { other: true, comments: false, strings: false },
    quickSuggestionsDelay: 250,
    suggestOnTriggerCharacters: true,
    parameterHints: { enabled: true },
    wordBasedSuggestions: problemId ? 'off' : 'currentDocument',
  };
  return (
    <div className="cs-editor-host" data-theme={settings.theme}>
      {runtime ? (
        <runtime.Editor
          height="100%"
          width="100%"
          language={language}
          value={value}
          path={path}
          theme={`cswork-${settings.theme}`}
          options={options}
          onChange={(next) => onChange(next ?? '')}
          onMount={mounted}
          loading={
            <div className="cs-editor-loading">
              {t('正在初始化编辑器…', 'Starting the editor…')}
            </div>
          }
          keepCurrentModel={false}
        />
      ) : error ? (
        <div className="cs-editor-fallback">
          <div role="alert">
            {t(
              '编辑器加载失败，代码仍可在下方编辑。',
              "The editor didn't load. You can still edit your code below.",
            )}
            <button onClick={retry}>{t('重试编辑器', 'Retry editor')}</button>
          </div>
          <textarea
            aria-label={t('备用代码编辑器', 'Fallback code editor')}
            value={value}
            readOnly={readOnly}
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      ) : (
        <div className="cs-editor-loading" role="status">
          {t('正在加载代码编辑器…', 'Loading the code editor…')}
        </div>
      )}
    </div>
  );
}
export function CodeDiff({
  original,
  modified,
  originalLanguage,
  language,
  settings,
}: {
  original: string;
  modified: string;
  originalLanguage: Language;
  language: Language;
  settings: EditorSettings;
}) {
  const t = useT();
  const { runtime, error, retry } = useMonacoRuntime();
  const options: DiffEditorProps['options'] = {
    editContext: false,
    readOnly: true,
    originalEditable: false,
    automaticLayout: true,
    renderSideBySide: true,
    useInlineViewWhenSpaceIsLimited: true,
    fontSize: settings.fontSize,
    wordWrap: settings.wordWrap ? 'on' : 'off',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    ariaLabel: t(
      '历史提交与当前草稿的差异',
      'Differences between the submission and your current draft',
    ),
  };
  return (
    <div className="cs-editor-host cs-diff-host" data-theme={settings.theme}>
      {runtime ? (
        <runtime.DiffEditor
          height="100%"
          original={original}
          modified={modified}
          originalLanguage={originalLanguage}
          modifiedLanguage={language}
          theme={`cswork-${settings.theme}`}
          options={options}
          onMount={(editor) => {
            editor
              .getOriginalEditor()
              .getModel()
              ?.updateOptions({ tabSize: settings.tabSize });
            editor
              .getModifiedEditor()
              .getModel()
              ?.updateOptions({ tabSize: settings.tabSize });
          }}
          keepCurrentOriginalModel={false}
          keepCurrentModifiedModel={false}
        />
      ) : error ? (
        <div className="cs-editor-fallback">
          <button onClick={retry}>
            {t('重试差异编辑器', 'Retry diff editor')}
          </button>
          <pre>{original}</pre>
          <pre>{modified}</pre>
        </div>
      ) : (
        <div className="cs-editor-loading" role="status">
          {t('正在加载代码对比…', 'Loading the code comparison…')}
        </div>
      )}
    </div>
  );
}
