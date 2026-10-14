import { starters, type Language } from './problems';
import type { CodingMode } from './coding-mode';
import { currentTheme } from './theme-script';

export type EditorSettings = {
  theme: 'light' | 'dark';
  fontSize: number;
  tabSize: 2 | 4;
  wordWrap: boolean;
  minimap: boolean;
  layout: 'horizontal' | 'vertical';
  /** Topic tags (the spoilers) stay behind the Topics button; company tags always show. */
  hideTags: boolean;
  keymap: 'default' | 'vim';
};

export const defaultEditorSettings: EditorSettings = {
  theme: 'light',
  fontSize: 14,
  tabSize: 4,
  wordWrap: false,
  minimap: false,
  layout: 'horizontal',
  hideTags: true,
  keymap: 'default',
};

export function settingsKey(userId: string) {
  return `cswork:editor:settings:${userId}`;
}

export function readEditorSettings(userId: string): EditorSettings {
  try {
    const value = JSON.parse(localStorage.getItem(settingsKey(userId)) || '{}');
    return {
      // Until the reader picks one here, the editor follows the site theme.
      theme: value.theme === 'dark' || value.theme === 'light' ? value.theme : currentTheme(),
      fontSize: [12, 13, 14, 15, 16, 18, 20].includes(value.fontSize)
        ? value.fontSize
        : 14,
      tabSize: value.tabSize === 2 ? 2 : 4,
      wordWrap: value.wordWrap === true,
      minimap: value.minimap === true,
      layout: value.layout === 'vertical' ? 'vertical' : 'horizontal',
      hideTags: value.hideTags !== false,
      keymap: value.keymap === 'vim' ? 'vim' : 'default',
    };
  } catch {
    return defaultEditorSettings;
  }
}

/**
 * Save the settings. The theme is kept out until the reader picks one (it differs from
 * the site theme, or one was saved before), so saving font size or tags doesn't pin the
 * editor to whatever the site happened to be at the time.
 */
export function writeEditorSettings(userId: string, next: EditorSettings) {
  const key = settingsKey(userId);
  let saved: { theme?: unknown } = {};
  try {
    saved = JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    // Unreadable: written over below.
  }
  const picked = saved.theme === 'light' || saved.theme === 'dark' || next.theme !== currentTheme();
  const { theme, ...rest } = next;
  localStorage.setItem(key, JSON.stringify(picked ? { theme, ...rest } : rest));
}

export type EditorDraft = { code: string; updatedAt: number };

export function draftStorageKey(
  userId: string,
  problemId: string,
  language: Language,
  codingMode: CodingMode = 'acm',
) {
  const key = `cswork:editor:draft:${userId}:${problemId}:${language}`;
  return codingMode === 'acm' ? key : `${key}:leetcode`;
}

export function readEditorDraft(
  userId: string,
  problemId: string,
  language: Language,
  codingMode: CodingMode = 'acm',
  template = starters[language],
): EditorDraft {
  const raw = localStorage.getItem(
    draftStorageKey(userId, problemId, language, codingMode),
  );
  if (raw) {
    try {
      const value = JSON.parse(raw);
      if (typeof value.code === 'string' && Number.isFinite(value.updatedAt)) {
        // Upgrade only untouched old C++ starters; never rewrite a student's code.
        if (
          codingMode === 'leetcode' &&
          language === 'cpp' &&
          value.code.replace(
            /^#include <bits\/stdc\+\+\.h>\r?\nusing namespace std;\s*/,
            '',
          ) === template
        ) {
          return { code: template, updatedAt: value.updatedAt };
        }
        return { code: value.code, updatedAt: value.updatedAt };
      }
    } catch {
      // Preserve plain-text drafts created by older versions.
      return { code: raw, updatedAt: 0 };
    }
  }
  const previous =
    codingMode === 'acm'
      ? localStorage.getItem(`sde:${userId}:${problemId}:${language}`)
      : null;
  return { code: previous ?? template, updatedAt: 0 };
}

/** Where a signed-in draft also lives on the server (user_drafts, lib/server/learner-cloud.ts). */
export type CloudDraftTarget = {
  problemId: string;
  language: Language;
  codingMode: CodingMode;
};
export const CLOUD_DRAFT_DELAY_MS = 3000;
const uploads = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; send: (keepalive?: boolean) => void }
>();
export function cloudDraftUrl({ problemId, language, codingMode }: CloudDraftTarget) {
  return `/api/oj/cloud/drafts/${encodeURIComponent(problemId)}?${new URLSearchParams({ language, mode: codingMode })}`;
}
/** The newest local version goes up once typing has paused; a failed upload leaves the local draft. */
function queueCloudDraft(key: string, target: CloudDraftTarget, draft: EditorDraft) {
  clearTimeout(uploads.get(key)?.timer);
  const send = (keepalive = false) => {
    uploads.delete(key);
    void fetch(cloudDraftUrl(target), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // sentAt lets the server re-base updatedAt on its own clock (devices' clocks differ).
      body: JSON.stringify({ ...draft, sentAt: Date.now() }),
      keepalive,
    }).catch(() => {});
  };
  uploads.set(key, { timer: setTimeout(send, CLOUD_DRAFT_DELAY_MS), send });
}
/** Sends waiting uploads now: the tab is being hidden or closed. */
export function flushCloudDrafts() {
  for (const { timer, send } of uploads.values()) {
    clearTimeout(timer);
    send(true);
  }
}
export async function readCloudDraft(
  target: CloudDraftTarget,
  signal?: AbortSignal,
): Promise<EditorDraft | null> {
  const response = await fetch(cloudDraftUrl(target), { signal });
  if (!response.ok) return null;
  const { draft, now } = (await response.json()) as {
    draft?: EditorDraft | null;
    now?: number;
  };
  if (!draft || typeof draft.code !== 'string' || !Number.isFinite(draft.updatedAt))
    return null;
  // Server time to this browser's, so it compares with local drafts whatever this clock says.
  return Number.isFinite(now)
    ? { code: draft.code, updatedAt: draft.updatedAt + Date.now() - now! }
    : draft;
}

/** Saves in this browser and, given a cloud target (signed in), uploads 3 s later. */
export function writeEditorDraft(
  key: string,
  code: string,
  cloud?: CloudDraftTarget,
): EditorDraft {
  const draft = { code, updatedAt: Date.now() };
  // Queued first: an unavailable localStorage makes the server copy the only one.
  if (cloud) queueCloudDraft(key, cloud, draft);
  localStorage.setItem(key, JSON.stringify(draft));
  return draft;
}

export const languageFiles: Record<Language, string> = {
  python: 'solution.py',
  go: 'main.go',
  java: 'Main.java',
  cpp: 'main.cpp',
  sql: 'query.sql',
};
