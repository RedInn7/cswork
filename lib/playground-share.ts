import type { CodeLanguage } from './problems';
import { pipeBytes } from './zip';

/**
 * /playground share links: {language, code, stdin} as deflate-raw JSON in base64url,
 * carried in the URL fragment (#c=…) so it never reaches a server log. No table needed.
 */
export const PLAYGROUND_LANGUAGES: readonly CodeLanguage[] = ['python', 'cpp', 'java', 'go'];
export type PlaygroundState = { language: CodeLanguage; code: string; stdin: string };
/** Longest #c= value a share link carries. */
export const SHARE_MAX_CHARS = 32 * 1024;
const TEXT_MAX_BYTES = 65536;
// Two full 64 KiB texts plus JSON escaping; a crafted link can't inflate past this.
const JSON_MAX_BYTES = 4 * TEXT_MAX_BYTES;

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
const bytesOf = (text: string) => new TextEncoder().encode(text).byteLength;
const valid = (value: unknown): value is { l: CodeLanguage; c: string; s: string } => {
  const v = value as { l?: unknown; c?: unknown; s?: unknown } | null;
  return (
    !!v &&
    PLAYGROUND_LANGUAGES.includes(v.l as CodeLanguage) &&
    typeof v.c === 'string' &&
    typeof v.s === 'string' &&
    bytesOf(v.c) <= TEXT_MAX_BYTES &&
    bytesOf(v.s) <= TEXT_MAX_BYTES
  );
};

/** `value` as deflate-raw JSON in base64url, or null when that passes `maxChars`. */
export async function packJson(value: unknown, maxChars: number): Promise<string | null> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const packed = await pipeBytes(json, new CompressionStream('deflate-raw'), Infinity);
  const text = packed && toBase64Url(packed);
  return text && text.length <= maxChars ? text : null;
}

/** What packJson packed, or null for a broken value or one inflating past `maxBytes`. */
export async function unpackJson(text: string, maxBytes: number): Promise<unknown> {
  try {
    const json = await pipeBytes(fromBase64Url(text), new DecompressionStream('deflate-raw'), maxBytes);
    return json && JSON.parse(new TextDecoder().decode(json));
  } catch {
    return null;
  }
}

/** The #c= value for this state, or null when the link would pass SHARE_MAX_CHARS. */
export const encodeShare = (state: PlaygroundState) =>
  packJson({ v: 1, l: state.language, c: state.code, s: state.stdin }, SHARE_MAX_CHARS);

/** The state in a location hash (#c=…), or null for none, a broken link or a bomb. */
export async function decodeShare(hash: string): Promise<PlaygroundState | null> {
  const value = /^#(?:.*&)?c=([A-Za-z0-9_-]+)/.exec(hash)?.[1];
  if (!value || value.length > SHARE_MAX_CHARS) return null;
  const parsed = await unpackJson(value, JSON_MAX_BYTES);
  return valid(parsed) ? { language: parsed.l, code: parsed.c, stdin: parsed.s } : null;
}

const TAGS = new Map<string, CodeLanguage>([
  ['python', 'python'], ['py', 'python'], ['python3', 'python'],
  ['cpp', 'cpp'], ['c++', 'cpp'], ['java', 'java'], ['go', 'go'], ['golang', 'go'],
]);
/** The playground language of a fenced block's tag (```py, ```c++ …), or null for any other tag. */
export const playgroundLanguage = (tag: string | null | undefined) => (tag && TAGS.get(tag.toLowerCase())) || null;

/** The /playground link that opens this code, or null when it would pass SHARE_MAX_CHARS. */
export async function playgroundHref(state: PlaygroundState) {
  const value = await encodeShare(state);
  return value && `/playground#c=${value}`;
}
