/** The problem list a learner opened a problem from, so the workspace can offer previous/next. */
const key = 'cswork:problem-sequence';

export function rememberProblemSequence(ids: string[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Storage can be unavailable (private mode); navigation still works without it.
  }
}

export function problemNeighbors(id: string): { prev?: string; next?: string } {
  try {
    const ids = JSON.parse(sessionStorage.getItem(key) || '[]') as string[];
    const index = ids.indexOf(id);
    return index < 0 ? {} : { prev: ids[index - 1], next: ids[index + 1] };
  } catch {
    return {};
  }
}
