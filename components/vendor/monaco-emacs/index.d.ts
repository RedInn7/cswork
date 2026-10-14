// The slice of monaco-emacs's API that components/editor.tsx uses.
import type { editor } from 'monaco-editor/editor/editor.api.js';

export class EmacsExtension {
  constructor(editor: editor.IStandaloneCodeEditor);
  start(): void;
  dispose(): void;
  /** The pending prefix (C-x, C-u 4) after each key, '' once a command ran. */
  onDidChangeKey(listener: (state: string) => void): { dispose(): void };
}
