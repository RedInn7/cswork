import { mockStorageKey, parseMockState } from './mock-oa';

/**
 * Code replay of a mock OA, for the learner's own review: while the exam runs, the workspace
 * records the editor every 2 seconds it changed, plus each run and submission with its
 * verdict (components/mock-replay.tsx). One track per question, kept gzipped in this browser's
 * IndexedDB and never uploaded; a session's tracks share REPLAY_BYTES. The pure parts (delta
 * frames, the cursor, the time summary) are tested in tests/mock-replay.test.ts.
 */

const MOCK_STATE_PREFIX = mockStorageKey('');

/** A change: [ms since the exam started, common prefix length, common suffix length, inserted text]. */
export type Frame = [t: number, prefix: number, suffix: number, text: string];
export type ReplayEvent = { t: number; mode: 'run' | 'judge'; status: string; passed: number; total: number; id: string };
export type Track = {
  v: 1;
  frames: Frame[];
  events: ReplayEvent[];
  /** When the question was opened. */
  opens: number[];
  /** Stopped at the size cap: what follows was not recorded. */
  full?: boolean;
};
export const REPLAY_BYTES = 2 * 1024 * 1024;
export const SNAPSHOT_MS = 2000;
export const PAUSE_MS = 3 * 60_000;
export const emptyTrack = (): Track => ({ v: 1, frames: [], events: [], opens: [] });

/** The edit from `before` to `after` as the common ends and what changed between them. */
export function delta(before: string, after: string): [number, number, string] {
  const max = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < max && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < max - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  return [prefix, suffix, after.slice(prefix, after.length - suffix)];
}
export const applyFrame = (code: string, [, prefix, suffix, text]: Frame) =>
  code.slice(0, prefix) + text + code.slice(code.length - suffix);
export const lastCode = (track: Track) => track.frames.reduce(applyFrame, '');

/** Code at time t, walking forward from the last answer (back from the start), so playback stays cheap. */
export function cursor(frames: readonly Frame[]) {
  let i = 0,
    code = '',
    at = -Infinity;
  return (t: number) => {
    if (t < at) (i = 0), (code = '');
    at = t;
    while (i < frames.length && frames[i][0] <= t) code = applyFrame(code, frames[i++]);
    return code;
  };
}

/** Index of the question last touched at or before t (opened, edited, run or submitted), or -1. */
export function activeAt(tracks: readonly (Track | null)[], t: number) {
  let best = -1,
    when = -Infinity;
  tracks.forEach((track, q) => {
    if (!track) return;
    for (const at of [...track.opens, ...track.frames.map((f) => f[0]), ...track.events.map((e) => e.t)])
      if (at <= t && at >= when) (when = at), (best = q);
  });
  return best;
}

/**
 * Where the time went: each stretch between two moments of activity belongs to the question
 * worked on at its start (the first question takes the stretch before any activity), and a
 * stretch over PAUSE_MS is also listed as a pause.
 */
export function timeSummary(tracks: readonly (Track | null)[], duration: number) {
  const points = tracks
    .flatMap((track, q) =>
      track ? [...track.opens, ...track.frames.map((f) => f[0]), ...track.events.map((e) => e.t)].map((t) => ({ t, q })) : [],
    )
    .filter((p) => p.t >= 0 && p.t <= duration)
    .sort((a, b) => a.t - b.t);
  const perQuestion = tracks.map(() => 0);
  const pauses: { from: number; to: number; q: number }[] = [];
  if (!points.length) return { perQuestion, pauses };
  const edges = [{ t: 0, q: points[0].q }, ...points, { t: duration, q: -1 }];
  for (let k = 0; k + 1 < edges.length; k++) {
    const { t: from, q } = edges[k],
      to = edges[k + 1].t;
    perQuestion[q] += to - from;
    if (to - from > PAUSE_MS) pauses.push({ from, to, q });
  }
  return { perQuestion, pauses };
}

/* ---------------------------------------------------------------- storage */

const DB = 'cswork-replay',
  STORE = 'tracks';
export const trackKey = (session: string, problem: string) => `${session}:${problem}`;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function withStore<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = use(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
// Stored gzipped where the browser has CompressionStream, as plain text where not.
async function pack(text: string): Promise<ArrayBuffer | string> {
  if (typeof CompressionStream === 'undefined') return text;
  return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
}
async function unpack(value: ArrayBuffer | string) {
  if (typeof value === 'string') return value;
  return new Response(new Blob([value]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
export const packTrack = (track: Track) => pack(JSON.stringify(track));
export async function unpackTrack(value: unknown): Promise<Track | null> {
  if (typeof value !== 'string' && !(value instanceof ArrayBuffer)) return null;
  const track = JSON.parse(await unpack(value)) as Track;
  return track?.v === 1 && Array.isArray(track.frames) && Array.isArray(track.events) && Array.isArray(track.opens) ? track : null;
}

/** Storage can be missing or blocked (private mode, old browsers): reads give null, writes false. */
export async function loadTrack(key: string) {
  try {
    return await unpackTrack(await withStore('readonly', (s) => s.get(key)));
  } catch {
    return null;
  }
}
/** False when not saved: over `cap` bytes (the caller stops recording) or storage failed. */
export async function saveTrack(key: string, track: Track, cap: number): Promise<'saved' | 'full' | 'failed'> {
  try {
    const value = await packTrack(track);
    if ((typeof value === 'string' ? value.length * 2 : value.byteLength) > cap) return 'full';
    await withStore('readwrite', (s) => s.put(value, key));
    return 'saved';
  } catch {
    return 'failed';
  }
}
/** Every track of a session, in question order (null where none was recorded). */
/** Writes still in flight in this page: a hand-in's last snapshot lands as the report opens. */
let pending: Promise<unknown> = Promise.resolve();
/** Queues a recorder's write so readers in this page see it. */
export const trackWrite = <T,>(write: Promise<T>) => {
  pending = Promise.all([pending, write.catch(() => {})]);
  return write;
};
export const loadSession = async (session: string, ids: readonly string[]) => {
  await pending;
  return Promise.all(ids.map((id) => loadTrack(trackKey(session, id))));
};
/**
 * Drops the tracks of sessions no account on this browser still has (a mock leaves the history
 * after MOCK_HISTORY newer ones). The states are read when the keys are, so a mock drawn in
 * another tab meanwhile is kept: it is written to its state before anything is recorded.
 */
export async function pruneTracks() {
  try {
    const keys = (await withStore('readonly', (s) => s.getAllKeys())) as string[];
    const keep = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (!name?.startsWith(MOCK_STATE_PREFIX)) continue;
      const state = parseMockState(localStorage.getItem(name));
      for (const s of [state.active, ...state.history]) if (s) keep.add(s.id);
    }
    for (const key of keys) if (!keep.has(key.split(':')[0])) await withStore('readwrite', (s) => s.delete(key));
  } catch {
    /* Without storage there is nothing to prune, and nothing is pruned on a failed read. */
  }
}
