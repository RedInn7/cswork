import { starters, type Language } from './problems';

export type EditorSettings = {
  theme: 'light' | 'dark';
  fontSize: number;
  tabSize: 2 | 4;
  wordWrap: boolean;
  minimap: boolean;
  layout: 'horizontal' | 'vertical';
};

export const defaultEditorSettings: EditorSettings = {
  theme: 'light',
  fontSize: 14,
  tabSize: 4,
  wordWrap: false,
  minimap: false,
  layout: 'horizontal',
};

export function settingsKey(userId: string) {
  return `cswork:editor:settings:${userId}`;
}

export function readEditorSettings(userId: string): EditorSettings {
  try {
    const value = JSON.parse(localStorage.getItem(settingsKey(userId)) || '{}');
    return {
      theme: value.theme === 'dark' ? 'dark' : 'light',
      fontSize: [12, 13, 14, 15, 16, 18, 20].includes(value.fontSize)
        ? value.fontSize
        : 14,
      tabSize: value.tabSize === 2 ? 2 : 4,
      wordWrap: value.wordWrap === true,
      minimap: value.minimap === true,
      layout: value.layout === 'vertical' ? 'vertical' : 'horizontal',
    };
  } catch {
    return defaultEditorSettings;
  }
}

export type EditorDraft = { code: string; updatedAt: number };

export function draftStorageKey(
  userId: string,
  problemId: string,
  language: Language,
) {
  return `cswork:editor:draft:${userId}:${problemId}:${language}`;
}

export function readEditorDraft(
  userId: string,
  problemId: string,
  language: Language,
): EditorDraft {
  const raw = localStorage.getItem(
    draftStorageKey(userId, problemId, language),
  );
  if (raw) {
    try {
      const value = JSON.parse(raw);
      if (typeof value.code === 'string' && Number.isFinite(value.updatedAt)) {
        return { code: value.code, updatedAt: value.updatedAt };
      }
    } catch {
      // Preserve plain-text drafts created by older versions.
      return { code: raw, updatedAt: 0 };
    }
  }
  const previous = localStorage.getItem(
    `sde:${userId}:${problemId}:${language}`,
  );
  return { code: previous ?? starters[language], updatedAt: 0 };
}

export function writeEditorDraft(key: string, code: string): EditorDraft {
  const draft = { code, updatedAt: Date.now() };
  localStorage.setItem(key, JSON.stringify(draft));
  return draft;
}

export const languageFiles: Record<Language, string> = {
  python: 'solution.py',
  go: 'main.go',
  java: 'Main.java',
  cpp: 'main.cpp',
};
