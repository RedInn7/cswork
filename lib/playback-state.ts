export type PlaybackTarget = { assetId: string | null; position: number };
export function playbackTarget(
  search: string,
  lessonId: string,
): PlaybackTarget | null {
  const params = new URLSearchParams(search);
  if (params.has('lesson') && params.get('lesson') !== lessonId) return null;
  const raw = params.get('t');
  if (raw === null || !/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const position = Number(raw);
  if (!Number.isFinite(position) || position < 0 || position > 86400)
    return null;
  return { position, assetId: params.get('video') || null };
}
export function initialAsset(
  ids: string[],
  savedAsset: string | null | undefined,
  target: PlaybackTarget | null,
): string | null {
  if (target?.assetId && ids.includes(target.assetId)) return target.assetId;
  if (savedAsset && ids.includes(savedAsset)) return savedAsset;
  return ids[0] || null;
}
export function seekPosition(position: number, duration: number): number {
  const safe = Number.isFinite(position) ? Math.max(0, position) : 0;
  return Number.isFinite(duration) && duration > 0
    ? Math.min(safe, duration)
    : safe;
}
export function progressReceiver<T extends (...args: never[]) => unknown>(
  owner: string,
  captured: T,
  latest: { lessonId: string; callback: T },
): T {
  return latest.lessonId === owner ? latest.callback : captured;
}
