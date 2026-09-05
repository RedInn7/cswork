// Imported only after mount. All editor resources are served by cswork itself.
import { loader, default as Editor, DiffEditor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import 'monaco-editor/languages/definitions/python/register.js';
import 'monaco-editor/languages/definitions/go/register.js';
import 'monaco-editor/languages/definitions/java/register.js';
import 'monaco-editor/languages/definitions/cpp/register.js';
import 'monaco-editor/editor/browser/coreCommands.js';
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/editor/contrib/comment/browser/comment.js';
import 'monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js';
import 'monaco-editor/editor/contrib/cursorUndo/browser/cursorUndo.js';
import 'monaco-editor/editor/browser/widget/diffEditor/diffEditor.contribution.js';
import 'monaco-editor/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/editor/contrib/fontZoom/browser/fontZoom.js';
import 'monaco-editor/features/find/register.js';
import 'monaco-editor/editor/contrib/find/browser/findController.js';
import 'monaco-editor/editor/contrib/indentation/browser/indentation.js';
import 'monaco-editor/editor/contrib/lineSelection/browser/lineSelection.js';
import 'monaco-editor/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-editor/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/editor/contrib/readOnlyMessage/browser/contribution.js';
import 'monaco-editor/editor/contrib/snippet/browser/snippetController2.js';
import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js';
import 'monaco-editor/editor/contrib/tokenization/browser/tokenization.js';
import 'monaco-editor/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-editor/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';
import 'monaco-editor/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess.js';
import 'monaco-editor/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
// suggestController pulls Monaco's icon styles in through relative imports.
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

monaco.editor.defineTheme('cswork-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#ffffff',
    'editor.lineHighlightBackground': '#f5f7fc',
    'editorLineNumber.foreground': '#9aa4b3',
    'editorLineNumber.activeForeground': '#4563a0',
    'editor.selectionBackground': '#dce7ff',
  },
});
monaco.editor.defineTheme('cswork-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#141a24',
    'editor.lineHighlightBackground': '#1d2533',
    'editorLineNumber.foreground': '#687991',
    'editorLineNumber.activeForeground': '#c3d2ee',
    'editor.selectionBackground': '#284164',
  },
});
loader.config({ monaco });
export { Editor, DiffEditor, monaco };
