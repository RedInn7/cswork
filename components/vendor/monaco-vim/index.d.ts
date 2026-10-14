// The slice of monaco-vim's API that components/editor.tsx uses.
import type { editor } from 'monaco-editor/editor/editor.api.js';

/** `save` is what :w calls. */
export type VimAdapter = { dispose(): void; save?: () => void };
export function initVimMode(
  editor: editor.IStandaloneCodeEditor,
  statusbarNode?: HTMLElement | null,
): VimAdapter;
