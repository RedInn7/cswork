'use client';
import { useEffect, useRef, useState } from 'react';
import type { EditorProps, OnMount } from '@monaco-editor/react';
import { useT } from '@/lib/i18n';
import { currentTheme, type Theme } from '@/lib/theme-script';

// The same Monaco chunk as components/editor.tsx, which stays out of JavaScript (it isn't a judge Language).
type Runtime = typeof import('./monaco-client');
let runtimePromise: Promise<Runtime> | undefined;
function loadRuntime() {
  runtimePromise ??= import('./monaco-client').catch((error) => {
    runtimePromise = undefined;
    throw error;
  });
  return runtimePromise;
}

const OPTIONS: EditorProps['options'] = {
  automaticLayout: true,
  editContext: false,
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  fontSize: 14,
  lineHeight: 1.65,
  tabSize: 2,
  insertSpaces: true,
  detectIndentation: false,
  minimap: { enabled: false },
  padding: { top: 14, bottom: 14 },
  scrollBeyondLastLine: false,
  lineNumbersMinChars: 3,
  bracketPairColorization: { enabled: true },
  renderWhitespace: 'selection',
  accessibilitySupport: 'auto',
  wordBasedSuggestions: 'currentDocument',
  quickSuggestions: { other: true, comments: false, strings: false },
};

/**
 * The /frontend/js editor: Monaco with JavaScript highlighting, Ctrl/⌘+Enter to run the public
 * tests and Ctrl/⌘+Shift+Enter to submit. A plain textarea stands in when Monaco can't load.
 */
export function JsEditor({
  value,
  onChange,
  onRun,
  onSubmit,
}: {
  value: string;
  onChange: (code: string) => void;
  onRun: () => void;
  onSubmit: () => void;
}) {
  const t = useT();
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [failed, setFailed] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const keys = useRef({ onRun, onSubmit });
  keys.current = { onRun, onSubmit };
  useEffect(() => {
    let live = true;
    // oxlint-disable-next-line react/react-compiler -- The site theme is known only in the browser.
    setTheme(currentTheme());
    loadRuntime().then(
      (loaded) => live && setRuntime(loaded),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);
  const mount: OnMount = (editor, monaco) => {
    editor.addAction({
      id: 'cswork.run',
      label: t('运行公开用例', 'Run the public tests'),
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => keys.current.onRun(),
    });
    editor.addAction({
      id: 'cswork.submit',
      label: t('提交：运行全部用例', 'Submit: run every test'),
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter],
      run: () => keys.current.onSubmit(),
    });
  };
  if (failed)
    return (
      <div className="cs-editor-host js-editor" data-theme={theme}>
        <div className="cs-editor-fallback">
          <div role="alert">{t('编辑器加载失败，可以在下面直接写代码。', "The editor didn't load. You can still write your code below.")}</div>
          <textarea
            aria-label={t('代码编辑器', 'Code editor')}
            value={value}
            spellCheck={false}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
    );
  return (
    <div className="cs-editor-host js-editor" data-theme={theme}>
      {runtime ? (
        <runtime.Editor
          height="100%"
          width="100%"
          language="javascript"
          value={value}
          theme={`cswork-${theme}`}
          options={{ ...OPTIONS, ariaLabel: t('JavaScript 代码编辑器', 'JavaScript code editor') }}
          onChange={(next) => onChange(next ?? '')}
          onMount={mount}
          loading={<div className="cs-editor-loading">{t('正在初始化编辑器…', 'Starting the editor…')}</div>}
        />
      ) : (
        <div className="cs-editor-loading" role="status">
          {t('正在加载代码编辑器…', 'Loading the code editor…')}
        </div>
      )}
    </div>
  );
}
