// First-party practice tracks: judged free for any verified account and public on the judge feed,
// like the OA library. A new track adds its problem id prefix here.
export const FREE_TRACKS = ['oa-', 'sql-'] as const;

export const isFreeTrack = (id: string) => FREE_TRACKS.some((prefix) => id.startsWith(prefix));

/** The same test in SQL, on a problem id column. */
export const freeTrackSql = (column: string) =>
  `(${FREE_TRACKS.map((prefix) => `${column} LIKE '${prefix}%'`).join(' OR ')})`;
