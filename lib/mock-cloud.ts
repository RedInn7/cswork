import { api } from './types';
import {
  MOCK_HISTORY,
  readMockState,
  writeMockState,
  type MockSession,
  type MockState,
} from './mock-oa';

/**
 * Finished mock OAs follow the account (/api/oj/mock-oa/history); this browser's
 * history stays the working copy (and keeps the cross-tab sync). The server scores
 * each upload itself, so its result wins over the one this browser computed.
 */
type Saved = { saved: string[]; items: MockSession[] };

/** Server sessions merged into the local history: newest first, capped like the local one. */
export function mergeMockHistory(state: MockState, remote: readonly MockSession[]): MockState {
  const byId = new Map(state.history.map((s) => [s.id, s]));
  for (const s of remote) {
    if (state.active?.id === s.id) continue;
    const local = byId.get(s.id);
    byId.set(s.id, local ? { ...local, ...(s.result ? { result: s.result } : {}) } : s);
  }
  return {
    ...state,
    history: [...byId.values()]
      .sort((a, b) => (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt))
      .slice(0, MOCK_HISTORY),
  };
}

/** Finished local sessions the server does not have yet, or has without a score. */
export function unsyncedMocks(history: readonly MockSession[], remote: readonly MockSession[]) {
  const scored = new Set(remote.filter((s) => s.result).map((s) => s.id));
  return history.filter((s) => s.startedAt && s.finishedAt && !scored.has(s.id));
}

/** Uploads finished sessions; resolves to the account's whole history. */
export function uploadMocks(sessions: readonly MockSession[]) {
  return api<Saved>('oj/mock-oa/history', { sessions: sessions.slice(0, 30) });
}

/**
 * Once per visit: push what this browser has that the account lacks (the first sign-in
 * uploads the old local history), then pull the account's sessions into this browser.
 * Resolves to the merged state, or null when the account could not be reached.
 */
export async function syncMockHistory(userId: string): Promise<MockState | null> {
  try {
    let { items } = await api<{ items: MockSession[] }>('oj/mock-oa/history');
    const missing = unsyncedMocks(readMockState(userId).history, items);
    if (missing.length) items = (await uploadMocks(missing)).items;
    const merged = mergeMockHistory(readMockState(userId), items);
    writeMockState(userId, merged);
    return merged;
  } catch {
    return null;
  }
}
