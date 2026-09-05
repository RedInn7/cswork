'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  EditorProps,
  DiffEditorProps,
  OnMount,
} from '@monaco-editor/react';
import type { Language } from '@/lib/problems';
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
}: CodeEditorProps) {
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
        label: '运行样例 / 自定义输入',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => callbacks.current.onRun?.(),
      }),
      editor.addAction({
        id: 'cswork.submit',
        label: '提交全部测试点',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
        ],
        run: () => callbacks.current.onSubmit?.(),
      }),
      editor.addAction({
        id: 'cswork.save',
        label: '保存草稿',
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
    cleanup.current = () => actions.forEach((action) => action.dispose());
  };
  const options: EditorProps['options'] = {
    ariaLabel: readOnly ? '历史提交代码，只读' : '代码编辑器',
    automaticLayout: true,
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
          loading={<div className="cs-editor-loading">正在初始化编辑器…</div>}
          keepCurrentModel={false}
        />
      ) : error ? (
        <div className="cs-editor-fallback">
          <div role="alert">
            编辑器加载失败，代码仍可在下方编辑。
            <button onClick={retry}>重试编辑器</button>
          </div>
          <textarea
            aria-label="备用代码编辑器"
            value={value}
            readOnly={readOnly}
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      ) : (
        <div className="cs-editor-loading" role="status">
          正在加载代码编辑器…
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
  const { runtime, error, retry } = useMonacoRuntime();
  const options: DiffEditorProps['options'] = {
    readOnly: true,
    originalEditable: false,
    automaticLayout: true,
    renderSideBySide: true,
    useInlineViewWhenSpaceIsLimited: true,
    fontSize: settings.fontSize,
    wordWrap: settings.wordWrap ? 'on' : 'off',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    ariaLabel: '历史提交与当前草稿的差异',
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
          <button onClick={retry}>重试差异编辑器</button>
          <pre>{original}</pre>
          <pre>{modified}</pre>
        </div>
      ) : (
        <div className="cs-editor-loading" role="status">
          正在加载代码对比…
        </div>
      )}
    </div>
  );
}
