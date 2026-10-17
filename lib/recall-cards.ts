// Client-safe: self-made review cards (components/card-editor.tsx, review-session.tsx) and the
// Anki / CSV export. A card is the private note `card:<id>`; its review state sits in RECALL_CARDS.

/** One card as stored: the front asks, the back answers; `src` is the site page it came from. */
export type Card = { v: 1; front: string; back: string; tags: string[]; src?: { href: string; title: string } };
/** One exported note: front, back and Anki tags. */
export type ExportRow = { front: string; back: string; tags: string[] };

export const CARD_MAX = 200;
export const CARD_TEXT_MAX = 2000;
export const CARD_TAGS_MAX = 8;
const TAG = /^[\p{L}\p{N}_:-]{1,32}$/u;
// A path on this site only: one leading slash, no `//` or `/\` (both open another host).
const LOCAL = /^\/(?![/\\])[^\s\\]{0,500}$/;

/** A card id: 12 random a-z0-9. */
export function newCardId() {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => abc[b % 36]).join('');
}
export const CARD_ID = /^card:[a-z0-9]{12}$/;

/** A stored card, or null when anything is off (the server answers 400 for it). */
export function parseCard(raw: string | null | undefined): Card | null {
  try {
    const c = JSON.parse(raw || 'null') as Record<string, unknown> | null;
    if (!c || c.v !== 1 || typeof c.front !== 'string' || typeof c.back !== 'string' || !Array.isArray(c.tags)) return null;
    const { front, back, tags, src } = c as Card;
    if (!front.trim() || [...front].length > CARD_TEXT_MAX || [...back].length > CARD_TEXT_MAX) return null;
    if (tags.length > CARD_TAGS_MAX || !tags.every((tag) => typeof tag === 'string' && TAG.test(tag))) return null;
    if (Object.keys(c).some((k) => !['v', 'front', 'back', 'tags', 'src'].includes(k))) return null;
    if (src !== undefined) {
      if (!src || typeof src !== 'object' || typeof src.href !== 'string' || typeof src.title !== 'string') return null;
      if (!LOCAL.test(src.href) || src.title.length > 200 || Object.keys(src).length !== 2) return null;
    }
    return { v: 1, front, back, tags, ...(src && { src: { href: src.href, title: src.title } }) };
  } catch {
    return null;
  }
}

/** Tags typed as "a b, c": the valid ones, deduplicated, at most CARD_TAGS_MAX. */
export const splitTags = (text: string) =>
  [...new Set(text.split(/[\s,，]+/).filter((tag) => TAG.test(tag)))].slice(0, CARD_TAGS_MAX);

const html = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');

/** An Anki import file (File → Import): tab separated, HTML fields, tags in column 3. */
export function toAnki(rows: readonly ExportRow[]) {
  const head = '#separator:tab\n#html:true\n#tags column:3\n';
  return head + rows.map((r) => [html(r.front), html(r.back), r.tags.join(' ')].join('\t')).join('\n') + '\n';
}

/** One RFC 4180 field; a leading = + - @ gets a ' so a spreadsheet never runs it as a formula. */
function cell(text: string) {
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
/** A CSV with a BOM (Excel reads it as UTF-8) and CRLF lines. */
export function toCsv(rows: readonly ExportRow[]) {
  const lines = [['Front', 'Back', 'Tags'], ...rows.map((r) => [r.front, r.back, r.tags.join(' ')])];
  return '﻿' + lines.map((line) => line.map(cell).join(',')).join('\r\n') + '\r\n';
}
