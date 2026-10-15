import { mockStorageKey, parseMockState, type MockSession } from './mock-oa';

/**
 * Code replay of a mock OA or a contest run, for the learner's own review: while it runs, the
 * workspace records the editor every 2 seconds it changed, plus each run and submission with its
 * verdict, and for the focus self-check the stretches the page was hidden or unfocused and
 * the long pastes (components/mock-replay.tsx). One track per question, kept gzipped in this browser's
 * IndexedDB and never uploaded; a session's tracks share REPLAY_BYTES. The pure parts (delta
 * frames, the cursor, the time summary) are tested in tests/mock-replay.test.ts.
 */

const MOCK_STATE_PREFIX = mockStorageKey('');

/** A change: [ms since the exam started, common prefix length, common suffix length, inserted text]. */
export type Frame = [t: number, prefix: number, suffix: number, text: string];
export type ReplayEvent = { t: number; mode: 'run' | 'judge'; status: string; passed: number; total: number; id: string };
/** A stretch the page was hidden or lost focus: [from, to] in ms since the exam started. */
export type Away = [from: number, to: number];
/** A paste of over PASTE_CHARS characters: [ms since the exam started, characters]. */
export type Paste = [t: number, chars: number];
export type Track = {
  v: 2;
  frames: Frame[];
  events: ReplayEvent[];
  /** When the question was opened. */
  opens: number[];
  away: Away[];
  pastes: Paste[];
  /** Stopped at the size cap: what follows was not recorded. */
  full?: boolean;
  /** Begun before the focus self-check (v1): away and pastes were not recorded. */
  legacy?: boolean;
};
export const REPLAY_BYTES = 2 * 1024 * 1024;
export const SNAPSHOT_MS = 2000;
export const PAUSE_MS = 3 * 60_000;
export const PASTE_CHARS = 40;
/** Shorter than this is not leaving (a click into devtools, a permission prompt). */
export const AWAY_MS = 1000;
export const emptyTrack = (): Track => ({ v: 2, frames: [], events: [], opens: [], away: [], pastes: [] });

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

/**
 * The report's focus self-check: the stretches away from the page merged across questions and
 * clipped to the exam, their total, and the long pastes with their question, in time order.
 */
export function focusSummary(tracks: readonly (Track | null)[], duration: number) {
  const spans = tracks
    .flatMap((track) => track?.away ?? [])
    .map(([from, to]): Away => [Math.max(0, from), Math.min(duration, to)])
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);
  const away: Away[] = [];
  for (const [from, to] of spans) {
    const last = away.at(-1);
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else away.push([from, to]);
  }
  const pastes = tracks
    .flatMap((track, q) => (track?.pastes ?? []).map(([t, chars]) => ({ t, q, chars })))
    .filter((p) => p.t >= 0 && p.t <= duration && p.chars > PASTE_CHARS)
    .sort((a, b) => a.t - b.t);
  return { away, awayMs: away.reduce((sum, [from, to]) => sum + to - from, 0), pastes };
}

/** What recording and replaying need of a session: a mock OA's, or a contest run's (contestReplay). */
export type ReplaySession = Pick<MockSession, 'id' | 'startedAt' | 'finishedAt' | 'skew' | 'minutes' | 'ids'>;

const CONTEST_PREFIX = 'contest-';
/**
 * A contest entrant's own run as a replay session, from the room view's window (server clock;
 * `skew` is server minus this browser, and the recorder keeps browser time). An entrant's name is
 * unique in its room and fixed, so on a shared browser the id is theirs alone.
 */
export const contestReplay = (
  room: string,
  me: { name: string; start: number; end: number },
  ids: string[],
  skew = 0,
): ReplaySession => ({
  id: `${CONTEST_PREFIX}${room}-${me.name}`,
  startedAt: me.start - skew,
  finishedAt: me.end - skew,
  minutes: (me.end - me.start) / 60_000,
  ids,
  skew,
});

/**
 * Contest runs have no history to prune their tracks by: this browser keeps the CONTEST_KEEP it
 * started recording last (a duel is a room of its own, so they pile up). A bad list throws: nothing
 * is remembered, and nothing pruned.
 */
const CONTEST_RUNS = 'cswork:contest-replays',
  CONTEST_KEEP = 20;
const contestRuns = (): string[] => {
  const list: unknown = JSON.parse(localStorage.getItem(CONTEST_RUNS) || '[]');
  return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : [];
};
/** Called as a session starts recording; anything but a contest run is left to its mock history. */
export function rememberContestRun(id: string) {
  if (!id.startsWith(CONTEST_PREFIX)) return;
  try {
    localStorage.setItem(CONTEST_RUNS, JSON.stringify([id, ...contestRuns().filter((x) => x !== id)].slice(0, CONTEST_KEEP)));
  } catch {
    /* No storage (or full): the run is recorded all the same, and a later prune may drop it. */
  }
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
/** A v1 track (before the focus self-check) reads as a legacy v2 one, with nothing away and no pastes. */
export async function unpackTrack(value: unknown): Promise<Track | null> {
  if (typeof value !== 'string' && !(value instanceof ArrayBuffer)) return null;
  const track = JSON.parse(await unpack(value)) as Omit<Track, 'v'> & { v: number };
  if (!(track?.v === 1 || track?.v === 2) || !Array.isArray(track.frames) || !Array.isArray(track.events) || !Array.isArray(track.opens))
    return null;
  return {
    ...track,
    v: 2,
    ...(track.v === 1 ? { legacy: true } : {}),
    away: Array.isArray(track.away) ? track.away : [],
    pastes: Array.isArray(track.pastes) ? track.pastes : [],
  };
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
 * Drops the tracks of mock sessions no account on this browser still has (a mock leaves the
 * history after MOCK_HISTORY newer ones), and of contest runs past the last CONTEST_KEEP. The
 * states are read when the keys are, so a mock drawn or a run started in another tab meanwhile is
 * kept: it is written to its state or the list before anything is recorded.
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
    for (const id of contestRuns()) keep.add(id);
    // The session id is everything before the last ':' (problem ids have none; a contest name may).
    for (const key of keys) if (!keep.has(key.slice(0, key.lastIndexOf(':')))) await withStore('readwrite', (s) => s.delete(key));
  } catch {
    /* Without storage there is nothing to prune, and nothing is pruned on a failed read. */
  }
}
