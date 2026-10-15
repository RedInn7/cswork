'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  EditorProps,
  DiffEditorProps,
  OnMount,
} from '@monaco-editor/react';
import { isTrackLanguage, type Language } from '@/lib/problems';
import type { IntelligenceStatus } from '@/lib/editor-intelligence';
import { useT } from '@/lib/i18n';
import { attachIntelligence } from './monaco-intelligence';
import type { VimAdapter } from './vendor/monaco-vim/index.js';
import type { EmacsExtension } from './vendor/monaco-emacs/index.js';
import {
  defaultEditorSettings,
  type EditorSettings,
} from '@/lib/editor-settings';
import { currentTheme } from '@/lib/theme-script';

/** Monaco's grammar for a language: a pandas solution is Python. */
const monacoLanguage = (language: Language) => (language === 'pandas' ? 'python' : language);
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
  /** Format Document through the language service; null while unmounted or for SQL / pandas. */
  onFormatReady?: (format: (() => void) | null) => void;
  /** The mounted Monaco editor, for decorations and gutter clicks; may return a disposer. */
  onEditorMount?: (...args: Parameters<OnMount>) => void | (() => void);
};
export function CodeEditor({
  value,
  language,
  onChange,
  settings = { ...defaultEditorSettings, theme: currentTheme() },
  path,
  readOnly = false,
  onRun,
  onSubmit,
  onSave,
  onCursor,
  problemId,
  onIntelligenceStatus,
  onSuggestReady,
  onFormatReady,
  onEditorMount,
}: CodeEditorProps) {
  const t = useT();
  const { runtime, error, retry } = useMonacoRuntime();
  const callbacks = useRef({ onRun, onSubmit, onSave, onCursor });
  callbacks.current = { onRun, onSubmit, onSave, onCursor };
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const [instance, setInstance] = useState<Parameters<OnMount>[0] | null>(
    null,
  );
  const vimStatus = useRef<HTMLDivElement>(null);
  const vim = !readOnly && settings.keymap === 'vim';
  const emacs = !readOnly && settings.keymap === 'emacs';
  // Emacs owns C-s (isearch), so off Apple devices the site's Ctrl+S steps aside and C-x C-s saves.
  const emacsKey = useRef<{ set(value: boolean): void } | null>(null);
  useEffect(() => {
    if (!vim || !instance) return;
    let active = true;
    let adapter: VimAdapter | undefined;
    // Its own chunk: only people who pick Vim download it.
    import('./vendor/monaco-vim/index.js').then(
      ({ initVimMode }) => {
        if (!active) return;
        adapter = initVimMode(instance, vimStatus.current);
        adapter.save = () => callbacks.current.onSave?.(); // :w
      },
      () => {
        /* The default keymap keeps working when the Vim chunk can't load. */
      },
    );
    return () => {
      active = false;
      try {
        adapter?.dispose();
      } catch {
        /* On unmount Monaco may already have disposed the editor. */
      }
    };
  }, [vim, instance]);
  useEffect(() => {
    emacsKey.current?.set(emacs);
    if (!emacs || !instance) return;
    let active = true;
    let extension: EmacsExtension | undefined;
    // Its own chunk too; the status bar shows a pending prefix such as C-x.
    import('./vendor/monaco-emacs/index.js').then(
      ({ EmacsExtension, registerGlobalCommand }) => {
        if (!active) return;
        // The command table is shared, so it saves whichever editor received the keys.
        registerGlobalCommand('C-x C-s', {
          description: 'save',
          run: (editor) => void editor.getAction('cswork.save')?.run(),
        });
        extension = new EmacsExtension(instance);
        extension.start();
        const show = (state: string) => {
          if (vimStatus.current) vimStatus.current.textContent = state;
        };
        show('Emacs');
        extension.onDidChangeKey((state) => show(state || 'Emacs'));
      },
      () => {
        /* The default keymap keeps working when the Emacs chunk can't load. */
      },
    );
    return () => {
      active = false;
      if (vimStatus.current) vimStatus.current.textContent = '';
      try {
        extension?.dispose();
      } catch {
        /* On unmount Monaco may already have disposed the editor. */
      }
    };
  }, [emacs, instance]);
  const mounted: OnMount = (editor, monaco) => {
    cleanup.current?.();
    setInstance(editor);
    emacsKey.current = editor.createContextKey('cswork.emacs', emacs);
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
        // On Apple devices this is Cmd+S, which Emacs leaves alone.
        keybindingContext: /Mac|iP/.test(navigator.platform)
          ? undefined
          : '!cswork.emacs',
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
      // The SQL track's languages get no language server (the Python one has no pandas
      // stubs): Monaco highlights them and word completion fills in names.
      if (!isTrackLanguage(language)) {
        actions.push(
          attachIntelligence(monaco, model, problemId, language, (status) =>
            onIntelligenceStatus?.(status),
          ),
        );
        onFormatReady?.(() => {
          editor.focus();
          void editor.getAction('editor.action.formatDocument')?.run();
        });
      }
      onSuggestReady?.(() => {
        editor.focus();
        editor.trigger('cswork', 'editor.action.triggerSuggest', {});
      });
    }
    const detach = onEditorMount?.(editor, monaco);
    cleanup.current = () => {
      detach?.();
      actions.forEach((action) => action.dispose());
      onSuggestReady?.(null);
      onFormatReady?.(null);
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
    wordBasedSuggestions: problemId && !isTrackLanguage(language) ? 'off' : 'currentDocument',
  };
  return (
    <div className="cs-editor-host" data-theme={settings.theme}>
      {runtime ? (
        <runtime.Editor
          height={vim || emacs ? 'calc(100% - 24px)' : '100%'}
          width="100%"
          language={monacoLanguage(language)}
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
      {/* monaco-vim fills this bar (mode, pending keys, the : command line); Emacs, its prefix. */}
      {runtime && (vim || emacs) && (
        <div ref={vimStatus} className="cs-vim-status" />
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
  ariaLabel,
}: {
  original: string;
  modified: string;
  originalLanguage: Language;
  language: Language;
  settings: EditorSettings;
  /** What the two sides are; defaults to a past submission against the draft. */
  ariaLabel?: string;
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
    ariaLabel:
      ariaLabel ??
      t(
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
          originalLanguage={monacoLanguage(originalLanguage)}
          modifiedLanguage={monacoLanguage(language)}
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
