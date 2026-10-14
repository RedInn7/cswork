/**
 * A LeetCode custom case is stored as it always was: one JSON value per line, in parameter
 * order. The workspace edits it as one field per parameter; these convert between the two.
 */

/** The case's lines as n fields; null when the line count doesn't match (edit it as raw text). */
export function splitFields(raw: string, n: number): string[] | null {
  // A new case is blank: n empty fields.
  if (!raw) return Array.from({ length: n }, () => '');
  const lines = raw.split(/\r?\n/);
  // A trailing newline (a pasted example) is not one more field.
  if (lines.length === n + 1 && lines[n] === '') lines.pop();
  return lines.length === n ? lines : null;
}

export const joinFields = (fields: string[]) => fields.join('\n');
