/** The problem list a learner opened a problem from, so the workspace can offer previous/next. */
const key = 'cswork:problem-sequence';
// The classic list the sequence came from; every other list clears it.
const libraryKey = 'cswork:problem-library';

export function rememberProblemSequence(ids: string[], library?: string) {
  try {
    sessionStorage.setItem(key, JSON.stringify(ids));
    if (library) sessionStorage.setItem(libraryKey, library);
    else sessionStorage.removeItem(libraryKey);
  } catch {
    // Storage can be unavailable (private mode); navigation still works without it.
  }
}

// The bank's filters as last listed, so the workspace's shuffle draws under them.
const libraryQueryKey = 'cswork:library-query';
export function rememberLibraryQuery(params: URLSearchParams) {
  try {
    sessionStorage.setItem(libraryQueryKey, params.toString());
  } catch {
    // Without storage the shuffle falls back to unsolved problems.
  }
}
/** `oj/library` parameters for one random pick: the bank's last filters, else unsolved ones. */
export function randomPickQuery() {
  let saved = '';
  try {
    saved = sessionStorage.getItem(libraryQueryKey) || '';
  } catch {
    // Same fallback as an empty session.
  }
  const params = new URLSearchParams(saved || 'status=todo');
  params.delete('page');
  params.set('random', '1');
  return params.toString();
}

/** The remembered list; empty when there is none or storage is unavailable. */
export function problemSequence(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(key) || '[]') as string[];
  } catch {
    return [];
  }
}

/** Previous/next in the remembered list, and that list's library while `id` is in it. */
export function problemNeighbors(id: string): {
  prev?: string;
  next?: string;
  library?: string;
} {
  try {
    const ids = problemSequence();
    const index = ids.indexOf(id);
    return index < 0
      ? {}
      : {
          prev: ids[index - 1],
          next: ids[index + 1],
          library: sessionStorage.getItem(libraryKey) || undefined,
        };
  } catch {
    return {};
  }
}

/** The first unsolved id after `current` in list order, wrapping to the start; never `current`. */
export function nextUnsolved(
  ids: string[],
  current: string,
  solved: ReadonlySet<string>,
) {
  const at = ids.indexOf(current);
  return [...ids.slice(at + 1), ...ids.slice(0, Math.max(at, 0))].find(
    (id) => id !== current && !solved.has(id),
  );
}
